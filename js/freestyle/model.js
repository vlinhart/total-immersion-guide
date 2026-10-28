// Total Immersion freestyle — kinematic swimmer model + stroke-specific overlays.
// Body frame: x forward (head direction), y to swimmer's right, z up. Water surface at z = 0.
// Arm "A" = right arm (+y), arm "B" = left arm (-y). One full cycle T in [0,1) = two strokes.
'use strict';

const M = (() => {
  const { D2R, clamp, lerp, smooth, frac, wrapHalf, add, scale, rotX, rotPitch, dirAng } = G;

  const BODY = {
    sh: 20,            // shoulder half width
    hipX: -58, hipW: 9,
    Lu: 30, Lf: 27, Lh: 11,
    Lt: 42, Ls: 40, Lft: 14,
    headX: 29, headZ: 3, headR: 9.5,
    depth: -10,
  };

  // Arm keyframes over one arm cycle (0 = fingertips enter the water).
  // u = upper-arm angle, f = forearm angle (0 = forward, 90 = straight down, 180 = backward, 270 = straight up)
  // e/h = lateral offset of elbow / hand (positive = away from midline). hold = flat segment.
  const ARM_KEYS = [
    { t: 0.00, u: -28, f: 24, e: 4, h: -1 },
    { t: 0.08, u: 9, f: 11, e: 0, h: 0, hold: 1 },
    { t: 0.45, u: 10, f: 12, e: 0, h: 0, hold: 1 },
    { t: 0.52, u: 22, f: 62, e: 3, h: -2 },
    { t: 0.58, u: 38, f: 92, e: 4, h: -3 },
    { t: 0.67, u: 85, f: 124, e: 2, h: -5 },
    { t: 0.75, u: 148, f: 166, e: 0, h: -6 },
    { t: 0.80, u: 192, f: 172, e: 4, h: -2 },
    { t: 0.88, u: 242, f: 100, e: 20, h: 12 },
    { t: 0.95, u: 305, f: 52, e: 14, h: 5 },
  ];
  // Mistake: lead hand presses down immediately (no patient lead hand)
  const ARM_KEYS_PRESS = [
    { t: 0.00, u: -28, f: 24, e: 4, h: -1 },
    { t: 0.07, u: 8, f: 10, e: 0, h: 0 },
    { t: 0.25, u: 32, f: 38, e: 0, h: 0 },
    { t: 0.42, u: 55, f: 70, e: 1, h: -1 },
    { t: 0.55, u: 75, f: 100, e: 2, h: -3 },
    { t: 0.66, u: 105, f: 130, e: 2, h: -5 },
    { t: 0.75, u: 148, f: 166, e: 0, h: -6 },
    { t: 0.80, u: 192, f: 172, e: 4, h: -2 },
    { t: 0.88, u: 242, f: 100, e: 20, h: 12 },
    { t: 0.95, u: 305, f: 52, e: 14, h: 5 },
  ];
  // Wide swinging recovery (Swing Switch drill)
  const ARM_KEYS_SWING = ARM_KEYS.map(k =>
    k.t >= 0.8 ? { ...k, e: k.e + 12, h: k.h + 14 } : k);

  function sampleKeys(keys, t) {
    t = frac(t);
    const n = keys.length;
    const at = i => {
      const w = Math.floor(i / n), k = keys[((i % n) + n) % n];
      return { t: k.t + w, u: k.u + 360 * w, f: k.f, e: k.e, h: k.h, hold: k.hold };
    };
    let i = n - 1;
    for (let j = 0; j < n; j++) if (keys[j].t <= t) i = j;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const dt = p2.t - p1.t;
    const s = (t - p1.t) / dt;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const out = {};
    for (const key of ['u', 'f', 'e', 'h']) {
      const m1 = p1.hold ? 0 : (p2[key] - p0[key]) / (p2.t - p0.t) * dt;
      const m2 = p2.hold ? 0 : (p3[key] - p1[key]) / (p3.t - p1.t) * dt;
      out[key] = (p1.hold && p2.hold) ? p1[key] : h00 * p1[key] + h10 * m1 + h01 * p2[key] + h11 * m2;
    }
    return out;
  }

  // Leg kick curve vs distance d from kick moment (cycle units). th = thigh angle down, k = knee bend.
  const KICK_KEYS = [
    { d: -0.5, th: 3, k: 6 }, { d: -0.16, th: 3, k: 8 }, { d: -0.03, th: 9, k: 34 },
    { d: 0.04, th: 13, k: 0 }, { d: 0.30, th: 3, k: 6 }, { d: 0.5, th: 3, k: 6 },
  ];
  function kickCurve(d) {
    for (let i = 0; i < KICK_KEYS.length - 1; i++) {
      const a = KICK_KEYS[i], b = KICK_KEYS[i + 1];
      if (d >= a.d && d <= b.d) {
        const s = smooth((d - a.d) / (b.d - a.d));
        return { th: lerp(a.th, b.th, s), k: lerp(a.k, b.k, s) };
      }
    }
    return { th: 3, k: 6 };
  }

  // Phases of one arm (t relative to that arm)
  const PHASES = [
    { id: 'spear', name: 'Entry & Spear', a: 0.00, b: 0.08, color: '#34d399' },
    { id: 'lead', name: 'Patient Lead Hand', a: 0.08, b: 0.45, color: '#60a5fa' },
    { id: 'catch', name: 'Catch', a: 0.45, b: 0.58, color: '#f59e0b' },
    { id: 'pull', name: 'Pull — Hold Your Place', a: 0.58, b: 0.68, color: '#f97316' },
    { id: 'push', name: 'Push & Finish', a: 0.68, b: 0.77, color: '#ef4444' },
    { id: 'release', name: 'Release', a: 0.77, b: 0.81, color: '#e879f9' },
    { id: 'recovery', name: 'Relaxed Recovery', a: 0.81, b: 0.93, color: '#a78bfa' },
    { id: 'entry', name: 'Mail-Slot Entry', a: 0.93, b: 1.00, color: '#2dd4bf' },
  ];
  const phaseOf = t => { t = frac(t); return PHASES.find(p => t >= p.a && t < p.b) || PHASES[0]; };

  const DEFAULTS = {
    rollAmp: 40, crossover: 0, press: false, headUp: false, bigKick: false,
    liftBreath: false, breath: 2, swing: false,
  };

  const MISTAKES = {
    none: {},
    headUp: { headUp: true },
    flat: { rollAmp: 6 },
    over: { rollAmp: 78 },
    cross: { crossover: 24 },
    press: { press: true },
    bigKick: { bigKick: true },
    liftBreath: { liftBreath: true, breath: 2 },
  };

  function rollAt(t, R) {
    t = frac(t);
    if (t < 0.08) return lerp(R, -R, smooth((t + 0.05) / 0.13));
    if (t < 0.45) return -R;
    if (t < 0.58) return lerp(-R, R, smooth((t - 0.45) / 0.13));
    if (t < 0.95) return R;
    return lerp(R, -R, smooth((t - 0.95) / 0.13));
  }

  function breathAt(T, mode) {
    // returns {amt, side}: side +1 = breathing to the right, -1 = left
    if (!mode) return { amt: 0, side: 0 };
    const win = u => {
      if (u < 0.56 || u > 0.97) return 0;
      if (u < 0.66) return smooth((u - 0.56) / 0.10);
      if (u < 0.85) return 1;
      return 1 - smooth((u - 0.85) / 0.12);
    };
    const c = Math.floor(T), t = T - c;
    const uA = t, uB = frac(t + 0.5);
    const cB = t < 0.5 ? c - 1 : c; // cycle in which B's stroke started
    const idxA = 2 * c, idxB = 2 * cB + 1;
    const want = idx => mode === 2 ? idx % 2 === 0 : ((idx % 3) + 3) % 3 === 2;
    const a = want(idxA) ? win(uA) : 0;
    const b = want(idxB) ? win(uB) : 0;
    if (a >= b) return { amt: a, side: a > 0 ? 1 : 0 };
    return { amt: b, side: -1 };
  }

  function legAt(T, side, params) {
    // side: +1 right leg, -1 left leg. Left leg kicks with right-hand spear (t=0.02); right leg at 0.52.
    const t = frac(T);
    if (params.bigKick) {
      const off = side < 0 ? 0 : 1 / 6;
      const d = wrapHalf((t - off) * 3) ;
      const c = kickCurve(d);
      return { th: c.th * 2.4 - 4, k: c.k * 1.5, active: Math.abs(d) < 0.08 };
    }
    const kt = side < 0 ? 0.02 : 0.52;
    const d = wrapHalf(t - kt);
    const c = kickCurve(d);
    return { th: c.th, k: c.k, active: d > -0.04 && d < 0.07 };
  }

  // Full swim state from master time T (cycles)
  function swimState(T, params) {
    const p = { ...DEFAULTS, ...params };
    const t = frac(T);
    const roll = rollAt(t, p.rollAmp);
    const br = breathAt(T, p.breath);
    // Head stays mostly still (face down); when breathing it turns with the body to the air.
    const headRoll = roll * 0.25 + br.side * br.amt * (p.liftBreath ? 12 : Math.max(p.rollAmp, 30) + 45 - Math.abs(roll) * 0.25);
    let pitch = 2, headPitch = 0, depth = 0, liftZ = 3.5 * br.amt;
    if (p.headUp) { pitch += 9; headPitch += 28; depth += 1; }
    if (p.liftBreath && br.amt > 0) { headPitch += 32 * br.amt; pitch += 9 * br.amt; liftZ = 5 * br.amt; }
    return {
      T, tA: t, tB: frac(t + 0.5), roll, headRoll, pitch, headPitch, depth, liftZ,
      breath: br, legR: legAt(T, 1, p), legL: legAt(T, -1, p),
      keysA: p.press ? ARM_KEYS_PRESS : p.swing ? ARM_KEYS_SWING : ARM_KEYS,
      params: p,
    };
  }

  function armPose(keys, t, side, crossover) {
    const k = sampleKeys(keys, t);
    // crossover weighting: strongest during entry and lead phase
    let cw = 0;
    if (crossover) {
      const tt = frac(t);
      if (tt > 0.9) cw = smooth((tt - 0.9) / 0.1);
      else if (tt < 0.5) cw = 1;
      else if (tt < 0.62) cw = 1 - smooth((tt - 0.5) / 0.12);
    }
    const S = [0, side * BODY.sh, 0];
    const norm = (v, L) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return scale(v, L / n); };
    const E = add(S, norm(add(scale(dirAng(k.u), BODY.Lu), [0, side * k.e, 0]), BODY.Lu));
    const lat = k.h - cw * crossover;
    const fv = norm(add(scale(dirAng(k.f), BODY.Lf + BODY.Lh), [0, side * (lat - k.e), 0]), BODY.Lf + BODY.Lh);
    const W = add(E, scale(fv, BODY.Lf / (BODY.Lf + BODY.Lh)));
    const H = add(E, fv);
    return { S, E, W, H, k };
  }

  function legPose(leg, side) {
    const Hp = [BODY.hipX, side * BODY.hipW, 0];
    const th = leg.th * D2R, sh = (leg.th - leg.k) * D2R;
    const K = add(Hp, [-BODY.Lt * Math.cos(th), 0, -BODY.Lt * Math.sin(th)]);
    const A = add(K, [-BODY.Ls * Math.cos(sh), 0, -BODY.Ls * Math.sin(sh)]);
    const fa = (leg.th - leg.k * 0.3 + 8) * D2R; // pointed foot
    const F = add(A, [-BODY.Lft * Math.cos(fa), 0, -BODY.Lft * Math.sin(fa)]);
    return { Hp, K, A, F };
  }

  const TORSO = [ // x, half width, half depth
    [13, 9, 7], [7, 19, 10], [0, 21, 11], [-14, 18, 12], [-32, 15, 10], [-48, 14, 10], [-60, 15, 10], [-70, 12, 9], [-75, 7, 6],
  ];

  function computePose(st) {
    const B = BODY;
    const legRoll = st.roll * 0.8;
    const W = (p, r) => {
      const q = rotPitch(rotX(p, r), st.pitch);
      return [q[0], q[1], q[2] + B.depth + st.depth];
    };
    const Wd = (v, r) => rotPitch(rotX(v, r), st.pitch, 0);
    const mapAll = (o, r) => { const out = {}; for (const k in o) if (Array.isArray(o[k])) out[k] = W(o[k], r); return out; };
    // Underwater, the arm pulls straight down/back in the world rather than along the rolled body's "down".
    const ARM_ROLL = [[0, 1], [0.08, 1], [0.45, 0.9], [0.55, 0.3], [0.6, 0.12], [0.76, 0.12], [0.82, 0.6], [0.88, 1], [1, 1]];
    const armRollK = t => {
      t = frac(t);
      for (let i = 0; i < ARM_ROLL.length - 1; i++) {
        const [a, va] = ARM_ROLL[i], [b, vb] = ARM_ROLL[i + 1];
        if (t >= a && t <= b) return lerp(va, vb, smooth((t - a) / (b - a)));
      }
      return 1;
    };
    const mapArm = (a, t) => {
      const S = W(a.S, st.roll), ra = st.roll * armRollK(t);
      const rel = p => add(S, Wd([p[0] - a.S[0], p[1] - a.S[1], p[2] - a.S[2]], ra));
      return { S, E: rel(a.E), W: rel(a.W), H: rel(a.H), k: a.k };
    };

    const aA = armPose(st.keysA, st.tA, 1, st.params.crossover);
    const aB = armPose(st.keysA, st.tB, -1, st.params.crossover);
    const armR = mapArm(aA, st.tA);
    const armL = mapArm(aB, st.tB);
    const legR = mapAll(legPose(st.legR, 1), legRoll); legR.active = st.legR.active;
    const legL = mapAll(legPose(st.legL, -1), legRoll); legL.active = st.legL.active;

    const torso = TORSO.map(([x, w, d], i) => {
      const r = lerp(st.roll, legRoll, i / (TORSO.length - 1));
      return { c: W([x, 0, 0], r), w, d, r };
    });

    // head
    const hc0 = [B.headX + st.headPitch * 0.06, 0, B.headZ + st.headPitch * 0.12 + st.liftZ];
    const pitchHead = st.headPitch;
    const hc = W(hc0, st.roll);
    const Rh = v => Wd(rotPitch(rotX(v, st.headRoll), pitchHead, 0), 0);
    const face = Rh([0, 0, -1]);
    const crown = Rh([1, 0, 0]);
    const eyeAx = Rh([0, 1, 0]);
    const neck = [W([8, 0, -1], st.roll), hc];
    const mouth = add(hc, add(scale(face, B.headR * 0.85), scale(crown, -B.headR * 0.45)));
    const spineTop = W([B.headX + B.headR, 0, B.headZ], st.roll);
    const hipC = W([B.hipX, 0, 0], legRoll);
    return { armR, armL, legR, legL, torso, head: { c: hc, r: B.headR, face, crown, eyeAx, mouth }, neck, spineTop, hipC, st };
  }

  return {
    D2R, clamp, lerp, smooth, frac, wrapHalf, BODY, PHASES, phaseOf, DEFAULTS, MISTAKES,
    swimState, computePose, sampleKeys, ARM_KEYS, kickCurve, rollAt, breathAt,
  };
})();

// Stroke definition consumed by the shared renderer (js/engine/render.js).
const STROKE = (() => {
  const { D2R } = G;

  function labels(view, c) {
    const { P, v, pose, st, fs, f1, tag, COL } = c;
    let s = '';
    if (view === 'side') {
      // front quadrant zone
      const x0 = P([pose.spineTop[0] - 6, 0, 0])[0];
      const both = pose.armR.H[0] > pose.spineTop[0] - 4 && pose.armL.H[0] > pose.spineTop[0] - 4;
      s += `<rect x="${f1(x0)}" y="${f1(v.cy + 4)}" width="${f1(v.w - x0)}" height="${f1(v.h - v.cy - 22)}" fill="${both ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.03)'}" stroke="${both ? '#34d399' : 'rgba(255,255,255,0.18)'}" stroke-dasharray="4 5"/>`;
      s += `<text x="${f1(v.w - 8)}" y="${f1(v.h - 24)}" font-size="${fs * 0.85}" fill="${both ? '#6ee7b7' : 'rgba(255,255,255,0.45)'}" text-anchor="end">front quadrant${both ? ' — both hands ahead of head' : ''}</text>`;
      for (const [arm, side, t] of [[pose.armR, 'R', st.tA], [pose.armL, 'L', st.tB]]) {
        const ph = M.phaseOf(t);
        const h = P(arm.H);
        const dy = arm.H[2] > -12 ? -30 : 30;
        s += tag(h[0], h[1] + dy, `${side === 'R' ? 'Right' : 'Left'}: ${ph.name}`, COL[side].fill, fs);
      }
      for (const [leg, side] of [[pose.legR, 'R'], [pose.legL, 'L']]) {
        if (leg.active) { const f = P(leg.F); s += tag(f[0] + 12, f[1] + 26, `${side === 'R' ? 'right' : 'left'} foot flick`, '#f8fafc', fs * 0.9); }
      }
    }
    if (view === 'front') {
      const a = P(pose.armR.S), b = P(pose.armL.S);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      s += `<line x1="${f1(mx - 70)}" y1="${f1(my)}" x2="${f1(mx + 70)}" y2="${f1(my)}" stroke="#fff" stroke-opacity="0.35" stroke-dasharray="4 4"/>`;
      s += `<line x1="${f1(a[0] - (b[0] - a[0]) * 0.5)}" y1="${f1(a[1] - (b[1] - a[1]) * 0.5)}" x2="${f1(b[0] + (b[0] - a[0]) * 0.5)}" y2="${f1(b[1] + (b[1] - a[1]) * 0.5)}" stroke="#fde047" stroke-width="1.8"/>`;
      const r = Math.round(Math.abs(st.roll));
      const side = st.roll > 8 ? 'left side down' : st.roll < -8 ? 'right side down' : 'nearly flat';
      s += tag(v.w / 2, v.h - 26, `body roll ${r}° · ${side}`, '#fde047', fs);
      if (st.breath.amt > 0.3) s += tag(v.w / 2, v.h - 56, `breathing to the ${st.breath.side > 0 ? 'right' : 'left'}`, '#67e8f9', fs);
    }
    if (view === 'top') {
      for (const sd of [1, -1]) {
        const y = v.cy - sd * M.BODY.sh * v.s;
        s += `<line x1="${f1(P([0, 0, 0])[0])}" y1="${f1(y)}" x2="${v.w}" y2="${f1(y)}" stroke="#fde047" stroke-opacity="0.55" stroke-dasharray="8 6" stroke-width="1.5"/>`;
      }
      s += `<line x1="${f1(P([40, 0, 0])[0])}" y1="${v.cy}" x2="${v.w}" y2="${v.cy}" stroke="#f87171" stroke-opacity="0.45" stroke-dasharray="2 6" stroke-width="1.5"/>`;
      s += `<text x="${v.w - 8}" y="${f1(v.cy - M.BODY.sh * v.s - 6)}" font-size="${fs * 0.85}" fill="#fde047" text-anchor="end" opacity="0.85">right "railroad track"</text>`;
      s += `<text x="${v.w - 8}" y="${f1(v.cy + M.BODY.sh * v.s + 14)}" font-size="${fs * 0.85}" fill="#fde047" text-anchor="end" opacity="0.85">left "railroad track"</text>`;
      s += `<text x="${v.w - 8}" y="${f1(v.cy - 5)}" font-size="${fs * 0.8}" fill="#fca5a5" text-anchor="end" opacity="0.8">midline — never cross</text>`;
    }
    return s;
  }

  function vectors(view, c) {
    const { P, pose, st, opts, f1, arrow } = c;
    let s = '';
    for (const [arm, t] of [[pose.armR, st.tA], [pose.armL, st.tB]]) {
      const ph = M.phaseOf(t).id;
      if (view !== 'front' && (ph === 'catch' || ph === 'pull' || ph === 'push')) {
        const h = P(arm.W);
        s += arrow([h[0] + 6, h[1]], [h[0] - 40, h[1]], '#fbbf24', 3.5);
      }
      if (view !== 'front' && (ph === 'spear')) {
        const a = P(arm.W), b = P(arm.H);
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        s += arrow([b[0] + 4 * dx / L, b[1] + 4 * dy / L], [b[0] + 44 * dx / L, b[1] + 44 * dy / L], '#34d399', 3.5);
      }
    }
    if (view === 'side') {
      for (const leg of [pose.legR, pose.legL]) if (leg.active) {
        const f = P(leg.A);
        s += arrow([f[0], f[1] + 4], [f[0], f[1] + 36], '#f8fafc', 3);
      }
      const ph = [M.phaseOf(st.tA).id, M.phaseOf(st.tB).id];
      if (ph.includes('pull') || ph.includes('push') || ph.includes('spear')) {
        const h = P(pose.head.c);
        s += arrow([h[0] + 40, h[1] - 50], [h[0] + 95, h[1] - 50], '#34d399', 3);
        s += `<text x="${f1(h[0] + 67)}" y="${f1(h[1] - 60)}" font-size="${(opts.fs || 12) * 0.85}" fill="#6ee7b7" text-anchor="middle">body moves forward</text>`;
      }
    }
    if (view === 'front') {
      const t = st.tA;
      const rolling = (t > 0.45 && t < 0.58) || t > 0.95 || t < 0.08;
      if (rolling) {
        const dir = (t > 0.45 && t < 0.58) ? 1 : -1; // positive roll = right side up
        const cc = P(pose.torso[3].c);
        const r = 62;
        const a0 = dir > 0 ? 200 : -20, a1 = dir > 0 ? 250 : -70;
        const p0 = [cc[0] + r * Math.cos(a0 * D2R), cc[1] + r * Math.sin(a0 * D2R)];
        const p1 = [cc[0] + r * Math.cos(a1 * D2R), cc[1] + r * Math.sin(a1 * D2R)];
        s += `<path d="M${f1(p0[0])},${f1(p0[1])} A${r},${r} 0 0 ${dir > 0 ? 1 : 0} ${f1(p1[0])},${f1(p1[1])}" fill="none" stroke="#a78bfa" stroke-width="3.5"/>`;
        const tan = dir > 0 ? [-(p1[1] - cc[1]), p1[0] - cc[0]] : [p1[1] - cc[1], -(p1[0] - cc[0])];
        const L = Math.hypot(tan[0], tan[1]);
        s += arrow(p1, [p1[0] + tan[0] / L * 2, p1[1] + tan[1] / L * 2], '#a78bfa', 1, 12);
        s += `<text x="${f1(cc[0])}" y="${f1(cc[1] + r + 18)}" font-size="${(opts.fs || 12) * 0.85}" fill="#c4b5fd" text-anchor="middle">hip-driven rotation</text>`;
      }
    }
    return s;
  }

  return {
    swimState: M.swimState,
    computePose: M.computePose,
    exhaling: (T, params) => !(M.breathAt(T, params.breath).amt > 0.05),
    labels, vectors,
  };
})();
