// Heads-up (recreational) breaststroke — kinematic swimmer model + stroke-specific overlays.
// Body frame: x forward (head direction), y to swimmer's right, z up. Water surface at z = 0.
// One cycle T in [0,1) = one stroke: active part (pull → breathe → kick) followed by the glide.
'use strict';

const M = (() => {
  const { clamp, lerp, smooth, frac, add, sub, scale, norm, rotPitch, ik, sampleCyclic } = G;

  const BODY = {
    sh: 20, hipX: -58, hipW: 9,
    Lu: 30, Lf: 27, Lh: 11,
    Lt: 42, Ls: 40, Lft: 14,
    headR: 9.5, depth: -9.6,
    headPitch: 46,           // head tilted back relative to the spine so the eyes look forward-down
  };

  // ---- arms: hand target relative to the shoulder (y = outward), elbow pole (y = outward) ----
  const ARM = [
    { t: 0.00, h: [64, -17, -10], p: [0, 1, 0.3], hold: 1 },  // extended, hands together
    { t: 0.20, h: [58, 17, -14], p: [0, 1, 0.5] },             // outsweep: a bit wider than the shoulders
    { t: 0.28, h: [44, 22, -28], p: [0, 0.6, 1] },             // catch: high elbows
    { t: 0.36, h: [30, 5, -28], p: [-0.2, 1, 0.8] },           // insweep
    { t: 0.44, h: [22, -16, -13], p: [-0.5, 1, -0.2] },        // hands together under the chin
    { t: 0.55, h: [46, -17, -9], p: [0, 0.8, -0.6] },          // shoot forward just under the surface
    { t: 0.66, h: [64, -17, -10], p: [0, 1, 0.3], hold: 1 },   // extended, waiting for the kick
  ];
  const ARM_WIDE = [ // mistake: pulling past the shoulders
    { t: 0.00, h: [64, -17, -10], p: [0, 1, 0.3], hold: 1 },
    { t: 0.18, h: [52, 30, -14], p: [0, 1, 0.5] },
    { t: 0.28, h: [20, 36, -26], p: [0, 1, 0.6] },
    { t: 0.38, h: [-10, 24, -32], p: [0.4, 1, 0.4] },
    { t: 0.47, h: [14, -10, -20], p: [-0.3, 1, -0.3] },
    { t: 0.57, h: [46, -17, -9], p: [0, 0.8, -0.6] },
    { t: 0.66, h: [64, -17, -10], p: [0, 1, 0.3], hold: 1 },
  ];

  // ---- legs: ankle target relative to the hip joint (y = outward), knee pole, foot direction ----
  const STREAM = { a: [-80, -5, -2], p: [0, 0.1, -1], f: [-1, 0, -0.12] };
  const LEG_WHIP = [
    { t: 0.00, ...STREAM, hold: 1 },
    { t: 0.40, ...STREAM, hold: 1 },
    { t: 0.54, a: [-64, 6, 3], p: [0, 0, -1], f: [-0.9, 0.1, -0.25] },          // heels rise toward the surface
    { t: 0.66, a: [-52, 11, 7], p: [0, -0.3, -1], f: [0.1, 0.7, -0.7] },        // heels near the seat, knees ~hip width
    { t: 0.72, a: [-56, 20, 5], p: [0, -0.25, -1], f: [0.35, 0.85, -0.4] },     // feet flexed & turned out
    { t: 0.82, a: [-66, 24, -4], p: [0, -0.1, -1], f: [-0.1, 0.9, -0.45] },     // push back & around
    { t: 0.92, a: [-78, 6, -4], p: [0, 0.1, -1], f: [-0.7, 0.3, -0.5] },        // whip together
  ];
  const widen = (keys, dy, pole) => keys.map(k => (k.t > 0.45 && k.t < 0.9)
    ? { ...k, a: [k.a[0] + 2, k.a[1] + dy, k.a[2] - 3], p: pole } : k);
  const LEG_FROG = widen(LEG_WHIP, 12, [0, 1.2, -0.6]);
  const LEG_KNEES_UNDER = LEG_WHIP.map(k => (k.t > 0.45 && k.t < 0.8)
    ? { ...k, a: [k.a[0] + 32, k.a[1] - 2, k.a[2] - 24], p: [1.3, 0.1, -1] } : k);
  const pointed = keys => keys.map(k => ({ ...k, f: [-1, 0, -0.18] }));

  // ---- body bob & pitch over the active part ----
  const BOB = [
    { t: 0.00, pitch: 8, dz: -1.5, hold: 1 },
    { t: 0.20, pitch: 8.5, dz: -0.8 },
    { t: 0.38, pitch: 12, dz: 0.6 },   // shoulders rise: inhale
    { t: 0.50, pitch: 11.5, dz: 0.3 },
    { t: 0.66, pitch: 10.5, dz: -0.4 },
    { t: 0.80, pitch: 7.5, dz: -1.3 },   // kick drives the body forward and flat
    { t: 0.94, pitch: 7.5, dz: -1.6 },
  ];

  const glideFrac = p => p.noGlide ? 0.03 : p.glide === 'short' ? 0.15 : 0.35;

  // Phases in "active fraction" a (0..1). The glide occupies the last part of the cycle.
  const ARM_PH = [
    { id: 'out', name: 'Roztažení', a: 0.00, b: 0.20, color: '#f59e0b' },
    { id: 'in', name: 'Záběr dovnitř', a: 0.20, b: 0.44, color: '#f97316' },
    { id: 'fwd', name: 'Vystřelení vpřed', a: 0.44, b: 0.66, color: '#2dd4bf' },
    { id: 'wait', name: 'Natažené paže', a: 0.66, b: 1.00, color: '#60a5fa' },
  ];
  const LEG_PH = [
    { id: 'rest', name: 'Nohy v klidu', short: 'V klidu', a: 0.00, b: 0.40, color: '#64748b' },
    { id: 'draw', name: 'Přitažení pat', a: 0.40, b: 0.66, color: '#a78bfa' },
    { id: 'turn', name: 'Vytočení chodidel', short: 'Vytočení', a: 0.66, b: 0.72, color: '#e879f9' },
    { id: 'kick', name: 'Kop', a: 0.72, b: 0.94, color: '#ef4444' },
    { id: 'close', name: 'Spojení nohou', short: 'Spojení', a: 0.94, b: 1.00, color: '#fb7185' },
  ];
  const BREATH_PH = [
    { id: 'exhale', name: 'Výdech do vody', short: 'Výdech', a: 0.00, b: 0.22, color: '#38bdf8' },
    { id: 'inhale', name: 'Nádech', a: 0.22, b: 0.46, color: '#67e8f9' },
    { id: 'lower', name: 'Ústa zpět k hladině', short: 'Zpět k hladině', a: 0.46, b: 0.66, color: '#94a3b8' },
    { id: 'exhale', name: 'Výdech do vody', short: 'Výdech', a: 0.66, b: 1.00, color: '#38bdf8' },
  ];
  const GLIDE = { id: 'glide', name: 'Skluz', color: '#34d399' };
  const LEG_SHIFT = -0.3; // mistake "together": legs work during the pull

  function phasesIn(list, a, shift = 0) {
    const x = frac(a + shift);
    return list.find(p => x >= p.a && x < p.b) || list[list.length - 1];
  }
  // Timeline phases in cycle units t for the given params.
  function phases(params, which) {
    const p = { ...DEFAULTS, ...params };
    const A = 1 - glideFrac(p);
    const list = which === 'arms' ? ARM_PH : which === 'legs' ? LEG_PH : BREATH_PH;
    const early = which === 'legs' && p.together;
    const shift = early ? LEG_SHIFT : 0; // phase at active a is list-phase at frac(a - shift)
    const out = [];
    for (const ph of list) {
      const a = ph.a + shift, b = ph.b + shift;
      const push = (x, y) => { if (y > x) out.push({ ...ph, a: x * A, b: y * A }); };
      if (a < 0) { push(a + 1, Math.min(1, b + 1)); push(0, b); }
      else if (b > 1) { push(a, 1); push(0, b - 1); }
      else push(a, b);
    }
    out.push({ ...(early ? phasesIn(LEG_PH, 1 - shift) : GLIDE), a: A, b: 1 });
    return out;
  }

  const DEFAULTS = {
    glide: 'long', kick: 'whip',
    headBack: false, together: false, widePull: false, noGlide: false, kneesUnder: false, pointedFeet: false, screw: false,
  };
  const MISTAKES = {
    none: {},
    headBack: { headBack: true },
    together: { together: true },
    widePull: { widePull: true },
    noGlide: { noGlide: true },
    kneesUnder: { kneesUnder: true },
    pointedFeet: { pointedFeet: true },
    screw: { screw: true },
  };

  function swimState(T, params) {
    const p = { ...DEFAULTS, ...params };
    const t = frac(T);
    const A = 1 - glideFrac(p);
    const gliding = t >= A;
    const a = gliding ? 1 : t / A;
    const aLeg = p.together ? frac(a - LEG_SHIFT) : a;
    const bob = sampleCyclic(BOB, a >= 1 ? 0 : a, ['pitch', 'dz']);
    let pitch = bob.pitch, depth = bob.dz, headPitch = BODY.headPitch;
    if (p.headBack) { headPitch += 30; pitch += 4; depth -= 1; }
    if (p.kneesUnder) {
      const k = smooth(clamp((aLeg - 0.45) / 0.2, 0, 1)) * (1 - smooth(clamp((aLeg - 0.75) / 0.15, 0, 1)));
      pitch += 6 * k; depth -= 1.5 * k;
    }
    if (p.noGlide) depth -= 0.8;
    const armKeys = p.widePull ? ARM_WIDE : ARM;
    let legKeys = p.kick === 'frog' ? LEG_FROG : LEG_WHIP;
    if (p.kneesUnder) legKeys = LEG_KNEES_UNDER;
    if (p.pointedFeet) legKeys = pointed(legKeys);
    const legKeysL = p.screw ? pointed(legKeys).map(k => (k.t > 0.45 && k.t < 0.9) ? { ...k, a: [k.a[0], k.a[1] - 12, k.a[2] - 4], p: [0.2, -0.4, -1] } : k) : legKeys;
    const armPh = gliding ? GLIDE : phasesIn(ARM_PH, a);
    const legPh = gliding && !p.together ? GLIDE : phasesIn(LEG_PH, aLeg);
    const breathPh = gliding ? { ...BREATH_PH[3] } : phasesIn(BREATH_PH, a);
    const kickActive = legPh.id === 'kick';
    return {
      T, t, a, aLeg, A, gliding, roll: 0, pitch, depth, headPitch,
      armKeys, legKeys, legKeysL, armPh, legPh, breathPh, kickActive,
      inhaling: breathPh.id === 'inhale',
      params: p,
    };
  }

  const TORSO = [ // x, half width, half depth (same body as the freestyle model)
    [13, 9, 7], [7, 19, 10], [0, 21, 11], [-14, 18, 12], [-32, 15, 10], [-48, 14, 10], [-60, 15, 10], [-70, 12, 9], [-75, 7, 6],
  ];

  function computePose(st) {
    const B = BODY;
    const W = p => { const q = rotPitch(p, st.pitch); return [q[0], q[1], q[2] + B.depth + st.depth]; };
    const Wd = v => rotPitch(v, st.pitch, 0);

    const arm = side => {
      const k = sampleCyclic(st.armKeys, st.a >= 1 ? 0 : st.a, ['h', 'p']);
      const S = [0, side * B.sh, 0];
      const Ht = add(S, [k.h[0], side * k.h[1], k.h[2]]);
      const { M: E, E: H } = ik(S, Ht, B.Lu, B.Lf + B.Lh, [k.p[0], side * k.p[1], k.p[2]]);
      const Wr = add(E, scale(sub(H, E), B.Lf / (B.Lf + B.Lh)));
      return { S: W(S), E: W(E), W: W(Wr), H: W(H) };
    };
    const leg = (side, keys) => {
      const aL = st.aLeg >= 1 ? 0 : st.aLeg;
      const k = sampleCyclic(keys, aL, ['a', 'p', 'f']);
      const Hp = [B.hipX, side * B.hipW, 0];
      const At = add(Hp, [k.a[0], side * k.a[1], k.a[2]]);
      const { M: K, E: A } = ik(Hp, At, B.Lt, B.Ls, [k.p[0], side * k.p[1], k.p[2]]);
      const F = add(A, norm([k.f[0], side * k.f[1], k.f[2]], B.Lft));
      return { Hp: W(Hp), K: W(K), A: W(A), F: W(F), active: st.kickActive };
    };

    const armR = arm(1), armL = arm(-1);
    const legR = leg(1, st.legKeys), legL = leg(-1, st.legKeysL);
    const torso = TORSO.map(([x, w, d]) => ({ c: W([x, 0, 0]), w, d, r: 0 }));

    const neckBase = [8, 0, -1];
    const hc0 = add(neckBase, rotPitch([16, 0, 3], st.headPitch, 0));
    const hc = W(hc0);
    const Rh = v => Wd(rotPitch(v, st.headPitch, 0));
    const face = Rh([0, 0, -1]), crown = Rh([1, 0, 0]), eyeAx = Rh([0, 1, 0]);
    const mouth = add(hc, add(scale(face, B.headR * 0.85), scale(crown, -B.headR * 0.45)));
    const eyes = add(hc, add(scale(face, B.headR * 0.82), scale(crown, B.headR * 0.38)));
    const nose = add(hc, add(scale(face, B.headR * 0.95), scale(crown, B.headR * 0.02)));
    return {
      armR, armL, legR, legL, torso,
      head: { c: hc, r: B.headR, face, crown, eyeAx, mouth, eyes, nose },
      neck: [W(neckBase), hc], spineTop: W(add(neckBase, rotPitch([16 + B.headR, 0, 3], st.headPitch, 0))), hipC: W([B.hipX, 0, 0]), st,
    };
  }

  // Normalized shoulder height over the cycle (for the timeline curve)
  function shoulderHeight(t, params) {
    const st = swimState(t, params);
    const z = rotPitch([0, 0, 0], st.pitch)[2] + st.depth;
    return z;
  }

  // Drill helpers: arms resting at the sides; sculling sweeps in front of the chest.
  const ARM_SIDE = [
    { t: 0.0, h: [-44, -6, -10], p: [0, 1, 0.2], hold: 1 },
    { t: 0.5, h: [-44, -6, -10], p: [0, 1, 0.2], hold: 1 },
  ];
  const SCULL = [
    { t: 0.0, h: [42, -10, -15], p: [0, 1, 0.3] },
    { t: 0.5, h: [42, 14, -15], p: [0, 1, 0.3] },
  ];

  return { BODY, DEFAULTS, MISTAKES, ARM_PH, LEG_PH, BREATH_PH, GLIDE, ARM_SIDE, SCULL, swimState, computePose, phases, glideFrac, shoulderHeight };
})();

// Stroke definition consumed by the shared renderer (js/engine/render.js).
const STROKE = (() => {
  const vel = (st, which, dt = 0.012) => {
    const a = M.computePose(st), b = M.computePose(M.swimState(st.T + dt, st.params));
    return pt => { const p0 = pt(a), p1 = pt(b); return [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; };
  };

  function labels(view, c) {
    const { P, v, pose, st, fs, f1, COL } = c;
    const tag = c.opts.minimal ? () => '' : c.tag;
    let s = '';
    const h = pose.head;
    if (view === 'side') {
      const hand = P(pose.armL.H), foot = P(pose.legL.F);
      s += tag(hand[0], hand[1] + (pose.armL.H[2] > -16 ? 32 : 30), `Paže: ${st.armPh.name}`, COL.L.fill, fs);
      s += tag(foot[0] + 10, Math.max(foot[1] + 30, v.cy + 40), `Nohy: ${st.legPh.name}`, '#f8fafc', fs);
      const eye = P(h.eyes), mouth = P(h.mouth);
      const eyesUp = h.eyes[2] > 0.5, mouthUnder = h.mouth[2] < -0.5;
      s += tag(eye[0] + 70, eye[1] - 46, eyesUp ? 'oči nad hladinou ✓' : 'oči pod vodou!', eyesUp ? '#86efac' : '#f87171', fs * 0.9);
      if (st.inhaling) s += tag(mouth[0] + 70, mouth[1] - 10, 'nádech ústy', '#67e8f9', fs * 0.9);
      else if (mouthUnder) s += tag(mouth[0] + 70, mouth[1] + 18, 'výdech do vody', '#38bdf8', fs * 0.9);
      if (st.gliding) s += tag(v.w / 2, 26, 'SKLUZ — klouzej, odpočívej, počítej 1-2', '#34d399', fs);
    }
    if (view === 'front') {
      for (const sd of [1, -1]) {
        const q = P([0, sd * M.BODY.sh, -4]);
        s += `<line x1="${f1(q[0])}" y1="${f1(v.cy)}" x2="${f1(q[0])}" y2="${f1(v.h - 30)}" stroke="#fde047" stroke-opacity="0.45" stroke-dasharray="6 6" stroke-width="1.5"/>`;
      }
      s += `<text x="${f1(v.cx)}" y="${f1(v.h - 46)}" font-size="${fs * 0.8}" fill="#fde047" opacity="0.8" text-anchor="middle">šířka ramen</text>`;
      s += tag(v.w / 2, v.h - 22, `Paže: ${st.armPh.name}`, COL.L.fill, fs);
      if (st.inhaling) s += tag(v.w / 2, 18, 'nádech — oči stále vpřed', '#67e8f9', fs);
    }
    if (view === 'below') {
      const x0 = P([0, 0, 0])[0];
      s += `<line x1="${f1(x0)}" y1="14" x2="${f1(x0)}" y2="${v.h - 14}" stroke="#f87171" stroke-opacity="0.75" stroke-dasharray="6 5" stroke-width="2"/>`;
      if (!c.opts.minimal) s += `<text x="${f1(x0 - 6)}" y="28" font-size="${fs * 0.8}" fill="#fecaca" text-anchor="end">ramena — ruce nikdy za tuto čáru</text>`;
      const hx = P(pose.hipC)[0];
      for (const sd of [1, -1]) {
        const y = v.cy + sd * (M.BODY.hipW + 4) * v.s;
        s += `<line x1="${f1(hx - 150)}" y1="${f1(y)}" x2="${f1(hx + 10)}" y2="${f1(y)}" stroke="#fde047" stroke-opacity="0.5" stroke-dasharray="6 6" stroke-width="1.5"/>`;
      }
      s += `<text x="${f1(hx - 150)}" y="${f1(v.h - 22)}" font-size="${fs * 0.8}" fill="#fde047" opacity="0.85">kolena ~ na šířku boků</text>`;
      const hand = P(pose.armR.H);
      s += tag(hand[0], Math.max(24, hand[1] - 30), `Paže: ${st.armPh.name}`, COL.R.fill, fs);
      if (st.legPh.id === 'turn' || st.legPh.id === 'kick') {
        const f = P(pose.legR.F);
        s += tag(f[0], Math.min(v.h - 30, f[1] + 34), st.params.pointedFeet ? 'špičky natažené ✗' : 'chodidla přitažená a vytočená ven', st.params.pointedFeet ? '#f87171' : '#f8fafc', fs * 0.9);
      }
    }
    return s;
  }

  function vectors(view, c) {
    const { P, pose, st, fs, f1, arrow } = c;
    let s = '';
    const v = vel(st);
    const showArm = ['out', 'in'].includes(st.armPh.id);
    const showLeg = st.legPh.id === 'kick';
    const draw = (pt, color, len = 46) => {
      const p0 = pt(pose);
      const d = v(pt);
      const q0 = P(p0), q1 = P([p0[0] + d[0], p0[1] + d[1], p0[2] + d[2]]);
      const dx = q1[0] - q0[0], dy = q1[1] - q0[1], L = Math.hypot(dx, dy);
      if (L < 1.2) return '';
      return arrow([q0[0], q0[1]], [q0[0] + dx / L * len, q0[1] + dy / L * len], color, 3.2);
    };
    if (showArm) for (const k of (view === 'side' ? ['armL'] : ['armR', 'armL'])) s += draw(p => p[k].H, '#fbbf24');
    if (showLeg) for (const k of (view === 'side' ? ['legL'] : ['legR', 'legL'])) s += draw(p => p[k].A, '#f8fafc', 40);
    if (view === 'side' && (showLeg || st.gliding)) {
      const h = P(pose.head.c);
      s += arrow([h[0] + 40, h[1] - 52], [h[0] + 95, h[1] - 52], '#34d399', 3);
      s += `<text x="${f1(h[0] + 67)}" y="${f1(h[1] - 62)}" font-size="${fs * 0.85}" fill="#6ee7b7" text-anchor="middle">${showLeg ? 'kop tě posouvá vpřed' : 'skluz'}</text>`;
    }
    return s;
  }

  return {
    swimState: M.swimState,
    computePose: M.computePose,
    exhaling: (T, params) => M.swimState(T, params).breathPh.id === 'exhale',
    sideMouth: true,
    frontHull: true,
    labels, vectors,
  };
})();
