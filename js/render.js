// SVG rendering of the swimmer model in three synchronized views.
'use strict';

const R = (() => {
  const { frac, clamp, smooth, D2R } = M;
  const f1 = n => (Math.round(n * 10) / 10).toString();

  const VIEWS = {
    side: { w: 700, h: 320, s: 2.6, cx: 440, cy: 120,
      P: (p, v) => [v.cx + p[0] * v.s, v.cy - p[2] * v.s] },
    front: { w: 380, h: 360, s: 3.2, cx: 190, cy: 128,
      P: (p, v) => [v.cx - p[1] * v.s, v.cy - p[2] * v.s] },
    top: { w: 700, h: 280, s: 2.6, cx: 440, cy: 140,
      P: (p, v) => [v.cx + p[0] * v.s, v.cy - p[1] * v.s] },
  };
  const CYCLE_DIST = 360; // world units travelled per cycle (for water flow)

  const COL = {
    R: { fill: '#fb923c', dark: '#c2410c', line: '#7c2d12' },
    L: { fill: '#38bdf8', dark: '#0284c7', line: '#0c4a6e' },
    skin: '#f6c7a0', skinFar: '#c98d66', skinLine: '#6b3f26',
    suit: '#1e3a8a', suitLine: '#93c5fd', cap: '#facc15', capLine: '#854d0e',
    goggle: '#0f172a', lens: '#67e8f9',
  };

  // ---------- helpers ----------
  function smoothPath(pts, closed) {
    if (pts.length < 2) return '';
    const n = pts.length;
    const g = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d + (closed ? 'Z' : '');
  }
  const poly = pts => pts.map(p => `${f1(p[0])},${f1(p[1])}`).join(' ');

  function limbSVG(pts, widths, fill, line, op = 1, extra = '') {
    let o = '', i_ = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      o += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${line}" stroke-width="${f1(widths[i] + 2.4)}" stroke-linecap="round"/>`;
      i_ += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${fill}" stroke-width="${f1(widths[i])}" stroke-linecap="round"/>`;
    }
    return `<g opacity="${f1(op)}" ${extra}>${o}${i_}</g>`;
  }

  // ---------- water / backgrounds ----------
  function surfaceSide(pose, v, T, flow) {
    const hx = pose.head.c[0];
    const pts = [];
    for (let px = -10; px <= v.w + 10; px += 10) {
      const x = (px - v.cx) / v.s;
      const z = 4.5 * Math.exp(-(((x - (hx + 18)) / 11) ** 2)) - 3.5 * Math.exp(-(((x - (hx - 10)) / 10) ** 2))
        + 1.5 * Math.exp(-(((x - (hx - 40)) / 14) ** 2))
        + 0.7 * Math.sin((x + flow) * 0.11) + 0.4 * Math.sin((x + flow * 1.3) * 0.27);
      pts.push([px, v.cy - z * v.s]);
    }
    return pts;
  }
  function surfaceFront(pose, v, T) {
    const hy = pose.head.c[1];
    const pts = [];
    for (let px = -10; px <= v.w + 10; px += 8) {
      const y = -(px - v.cx) / v.s;
      const dy = y - hy;
      const z = 3 * Math.exp(-((dy / 7) ** 2)) - 6 * Math.exp(-(((Math.abs(dy) - 12) / 6) ** 2))
        + 0.8 * Math.sin(y * 0.2 + T * 9) + 0.5 * Math.sin(y * 0.07 - T * 5);
      pts.push([px, v.cy - z * v.s]);
    }
    return pts;
  }

  function background(view, v, pose, T, opts) {
    const flow = T * CYCLE_DIST;
    let s = '';
    if (view === 'side') {
      s += `<rect width="${v.w}" height="${v.h}" fill="url(#gSky)"/>`;
      s += `<rect y="${v.cy}" width="${v.w}" height="${v.h - v.cy}" fill="url(#gWater)"/>`;
      // pool floor tiles
      const fy = v.h - 14;
      s += `<rect y="${fy}" width="${v.w}" height="14" fill="#0b3b5e"/>`;
      const step = 60 * v.s / 2.6;
      const off = ((flow * v.s) % step + step) % step;
      for (let x = -off; x < v.w; x += step) s += `<line x1="${f1(x)}" y1="${fy}" x2="${f1(x)}" y2="${v.h}" stroke="#0e5a8a" stroke-width="2"/>`;
      // flow lines
      for (let i = 0; i < 9; i++) {
        const y = v.cy + 30 + ((i * 37) % (v.h - v.cy - 50));
        const len = 30 + (i * 13) % 40;
        const sp = 1 + (i % 3) * 0.25;
        const span = v.w + 120;
        const x = ((((i * 211) - flow * v.s * sp) % span) + span) % span - 60;
        s += `<line x1="${f1(x)}" y1="${y}" x2="${f1(x + len)}" y2="${y}" stroke="#bae6fd" stroke-opacity="0.18" stroke-width="1.5" stroke-linecap="round"/>`;
      }
    } else if (view === 'front') {
      s += `<rect width="${v.w}" height="${v.h}" fill="url(#gSky)"/>`;
      s += `<rect y="${v.cy}" width="${v.w}" height="${v.h - v.cy}" fill="url(#gWater)"/>`;
      s += `<rect y="${v.h - 12}" width="${v.w}" height="12" fill="#0b3b5e"/>`;
      // particles streaming toward the viewer
      for (let i = 0; i < 14; i++) {
        const ph = frac(i * 0.137 + T * 1.6);
        const ang = i * 2.39, rad = 40 + ph * 160;
        const x = v.cx + Math.cos(ang) * rad, y = v.cy + 80 + Math.sin(ang) * rad * 0.5;
        if (y > v.cy + 6 && y < v.h - 12) s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(0.6 + ph * 1.8)}" fill="#bae6fd" opacity="${f1(0.35 * ph)}"/>`;
      }
    } else {
      s += `<rect width="${v.w}" height="${v.h}" fill="url(#gTop)"/>`;
      const step = 60 * v.s / 2.6;
      const off = ((flow * v.s) % step + step) % step;
      for (let x = -off; x < v.w; x += step) s += `<line x1="${f1(x)}" y1="0" x2="${f1(x)}" y2="${v.h}" stroke="#7dd3fc" stroke-opacity="0.12" stroke-width="1.5"/>`;
      s += `<rect x="0" y="${v.cy - 6}" width="${v.w}" height="12" fill="#0b3b5e" opacity="0.55"/>`; // lane line on floor
      // lane ropes
      for (const y of [10, v.h - 10]) {
        const sp = 18, o2 = ((flow * v.s) % sp + sp) % sp;
        for (let x = -o2; x < v.w; x += sp) s += `<circle cx="${f1(x)}" cy="${y}" r="5" fill="${Math.round((x + o2 + flow * v.s) / sp) % 4 === 0 ? '#ef4444' : '#f8fafc'}" opacity="0.8"/>`;
      }
      // caustics
      for (let i = 0; i < 12; i++) {
        const span = v.w + 100;
        const x = ((((i * 173) - flow * v.s) % span) + span) % span - 50;
        const y = 25 + (i * 53) % (v.h - 50);
        s += `<path d="M${f1(x)},${y} q12,-6 24,0 t24,0" stroke="#e0f2fe" stroke-opacity="0.13" fill="none" stroke-width="2"/>`;
      }
      // bow wake (drawn under the swimmer)
      const h = v.P(pose.head.c, v), wx = h[0] + 26, wy = h[1];
      s += `<path d="M${f1(wx)},${f1(wy)} q-60,-38 -190,-70 M${f1(wx)},${f1(wy)} q-60,38 -190,70" stroke="#f0f9ff" stroke-opacity="0.4" stroke-width="2.5" fill="none"/>`;
    }
    return s;
  }

  function waterOverlay(view, v, pose, T) {
    if (view === 'top') return '';
    const pts = view === 'side' ? surfaceSide(pose, v, T, T * CYCLE_DIST) : surfaceFront(pose, v, T);
    const top = smoothPath(pts, false);
    const fill = top + `L${v.w + 10},${v.h}L-10,${v.h}Z`;
    return `<path d="${fill}" fill="#0b6fb3" fill-opacity="0.30"/>`
      + `<path d="${top}" fill="none" stroke="#e0f2fe" stroke-width="2.2" stroke-opacity="0.9"/>`;
  }

  function bubbles(view, v, pose, T, params) {
    if (view === 'top') return '';
    let s = '';
    const step = 0.035, now = T / step;
    const m = pose.head.mouth;
    for (let k = Math.floor(now); k > now - 14; k--) {
      const tk = k * step, age = T - tk;
      if (M.breathAt(tk, params.breath).amt > 0.05) continue;
      const jit = Math.sin(k * 12.9898) * 43758.5453; const r = jit - Math.floor(jit);
      let p;
      if (view === 'side') p = [m[0] - age * CYCLE_DIST * 0.9 + r * 4, m[1], m[2] + age * 70 + r * 3];
      else p = [m[0], m[1] + (r - 0.5) * 10 + age * 20 * (r - 0.5), m[2] + age * 60];
      if (p[2] > -1) continue;
      const q = v.P(p, v);
      s += `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(1.2 + r * 2 + age * 6)}" fill="none" stroke="#e0f2fe" stroke-opacity="${f1(0.7 - age * 1.2)}" stroke-width="1.2"/>`;
    }
    return s;
  }

  // ---------- swimmer ----------
  function swimmerItems(view, v, pose, ghost) {
    const P = p => v.P(p, v);
    const s = v.s;
    const items = [];
    const roll = pose.st.roll;
    const depthOp = z => view === 'top' ? clamp(1 + z / 60, 0.62, 1) : 1;
    const key = p => view === 'side' ? -p[1] : view === 'front' ? p[0] : p[2];

    // torso
    if (view === 'side' || view === 'top') {
      const topPts = [], botPts = [];
      for (const sec of pose.torso) {
        const r = sec.r * D2R;
        const e = view === 'side'
          ? Math.hypot(sec.w * Math.sin(r), sec.d * Math.cos(r))
          : Math.hypot(sec.w * Math.cos(r), sec.d * Math.sin(r));
        const c = P(sec.c);
        topPts.push([c[0], c[1] - e * s]);
        botPts.push([c[0], c[1] + e * s]);
      }
      const pts = topPts.concat(botPts.reverse());
      const d = smoothPath(pts, true);
      const op = depthOp(pose.torso[2].c[2] + 8);
      items.push({ k: view === 'side' ? 0 : pose.torso[2].c[2] + 4, svg: ghost
        ? `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4"/>`
        : `<path d="${d}" fill="${COL.suit}" stroke="${COL.suitLine}" stroke-width="1.6" opacity="${f1(op)}"/>`
          + (view === 'top' ? `<path d="M${f1(topPts[2][0])},${f1(P(pose.torso[2].c)[1])} L${f1(topPts[6][0])},${f1(P(pose.torso[6].c)[1])}" stroke="#93c5fd" stroke-opacity="0.35" stroke-width="2"/>` : '') });
    } else {
      for (const i of [6, 4, 2]) {
        const sec = pose.torso[i];
        const c = P(sec.c);
        items.push({ k: sec.c[0], svg: ghost
          ? `<ellipse rx="${f1(sec.w * s)}" ry="${f1(sec.d * s)}" transform="translate(${f1(c[0])},${f1(c[1])}) rotate(${f1(sec.r)})" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4"/>`
          : `<ellipse rx="${f1(sec.w * s)}" ry="${f1(sec.d * s)}" transform="translate(${f1(c[0])},${f1(c[1])}) rotate(${f1(sec.r)})" fill="${COL.suit}" stroke="${COL.suitLine}" stroke-width="1.6"/>` });
      }
    }

    // neck
    {
      const a = P(pose.neck[0]), b = P(pose.neck[1]);
      items.push({ k: view === 'side' ? 0.1 : view === 'front' ? pose.neck[1][0] - 12 : pose.neck[1][2], svg: ghost ? '' :
        `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${COL.skinLine}" stroke-width="${f1(9 * s + 2)}" stroke-linecap="round"/>`
        + `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${COL.skin}" stroke-width="${f1(9 * s)}" stroke-linecap="round"/>` });
    }

    // legs
    for (const [leg, side] of [[pose.legR, 'R'], [pose.legL, 'L']]) {
      const pts = [leg.Hp, leg.K, leg.A, leg.F];
      const far = view === 'side' && side === 'R';
      const ws = [10 * s, 7.5 * s, 4.2 * s];
      const avg = pts.reduce((a, p) => a + key(p), 0) / pts.length;
      const sp = pts.map(P);
      if (ghost) {
        items.push({ k: avg, svg: `<polyline points="${poly(sp)}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>` });
      } else {
        items.push({ k: avg - (view === 'front' ? 30 : 0), svg: limbSVG(sp, ws, far ? COL.skinFar : COL.skin, COL.skinLine, depthOp(leg.A[2] + 8)) });
      }
    }

    // arms
    for (const [arm, side] of [[pose.armR, 'R'], [pose.armL, 'L']]) {
      const c = COL[side];
      const far = view === 'side' && side === 'R';
      const pts = [arm.S, arm.E, arm.W, arm.H];
      const sp = pts.map(P);
      const ws = [8 * s, 6.2 * s, 4.6 * s];
      const avg = (key(arm.E) + key(arm.W) + key(arm.H)) / 3;
      if (ghost) {
        items.push({ k: avg, svg: `<polyline points="${poly(sp)}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>` });
      } else {
        const z = (arm.E[2] + arm.H[2]) / 2;
        const handOutline = `<circle cx="${f1(sp[3][0])}" cy="${f1(sp[3][1])}" r="${f1(2.3 * s)}" fill="${far ? c.dark : c.fill}" stroke="${c.line}" stroke-width="1.2"/>`;
        items.push({ k: avg, svg: limbSVG(sp, ws, far ? c.dark : c.fill, c.line, depthOp(z)).replace('</g>', handOutline + '</g>') });
      }
    }

    // head
    {
      const h = pose.head, c = P(h.c), r = h.r * s;
      const vdir = view === 'side' ? [0, -1, 0] : view === 'front' ? [1, 0, 0] : [0, 0, 1];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      let svg;
      if (ghost) {
        svg = `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4"/>`;
      } else {
        svg = `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="${COL.cap}" stroke="${COL.capLine}" stroke-width="1.5"/>`;
        const fv = dot(h.face, vdir);
        if (fv > -0.35) {
          const fc = P([h.c[0] + h.face[0] * h.r * 0.55, h.c[1] + h.face[1] * h.r * 0.55, h.c[2] + h.face[2] * h.r * 0.55]);
          const rr = r * 0.62 * clamp(0.6 + fv * 0.5, 0.35, 1);
          svg += `<circle cx="${f1(fc[0])}" cy="${f1(fc[1])}" r="${f1(rr)}" fill="${COL.skin}" opacity="0.95"/>`;
        }
        // goggles
        for (const sgn of [1, -1]) {
          const ep = [0, 1, 2].map(i => h.c[i] + h.face[i] * h.r * 0.82 + h.crown[i] * h.r * 0.38 + h.eyeAx[i] * h.r * 0.36 * sgn);
          const vis = dot(h.face, vdir) * 0.7 + dot(h.eyeAx, vdir) * 0.5 * sgn;
          if (vis > -0.25 || view === 'side') {
            const q = P(ep);
            const behind = view === 'side' && (ep[1] - h.c[1]) > 2;
            svg += `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(2.6 * s)}" fill="${COL.goggle}" opacity="${behind ? 0.35 : 1}"/>`
              + (behind ? '' : `<circle cx="${f1(q[0] + 0.6 * s)}" cy="${f1(q[1] - 0.6 * s)}" r="${f1(1.3 * s)}" fill="${COL.lens}"/>`);
          }
        }
        if (view === 'front' && dot(h.face, vdir) > -0.2) {
          const mq = P(h.mouth);
          const ang = Math.atan2(h.eyeAx[2], -h.eyeAx[1]) / D2R;
          svg += `<ellipse rx="${f1(2.8 * s)}" ry="${f1(1.4 * s)}" transform="translate(${f1(mq[0])},${f1(mq[1])}) rotate(${f1(-ang)})" fill="#7f1d1d"/>`;
        }
      }
      items.push({ k: view === 'side' ? 0.2 : view === 'front' ? h.c[0] : h.c[2] + h.r, svg });
    }

    items.sort((a, b) => a.k - b.k);
    return items.map(i => i.svg).join('');
  }

  // ---------- annotation primitives ----------
  function arrow(a, b, color, w = 3, head = 9) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const bx = b[0] - ux * head, by = b[1] - uy * head;
    return `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(bx)}" y2="${f1(by)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`
      + `<polygon points="${f1(b[0])},${f1(b[1])} ${f1(bx - uy * head * 0.6)},${f1(by + ux * head * 0.6)} ${f1(bx + uy * head * 0.6)},${f1(by - ux * head * 0.6)}" fill="${color}"/>`;
  }
  let BOUNDS = [0, 0, 700, 320];
  function tag(x, y, text, color, fs = 12, anchor = 'middle') {
    const w = text.length * fs * 0.58 + 12, h = fs + 8;
    let x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    x0 = clamp(x0, BOUNDS[0] + 4, BOUNDS[0] + BOUNDS[2] - w - 4);
    y = clamp(y, BOUNDS[1] + h / 2 + 4, BOUNDS[1] + BOUNDS[3] - h / 2 - 4);
    return `<g class="tag"><rect x="${f1(x0)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(h / 2)}" fill="rgba(2,6,23,0.78)" stroke="${color}" stroke-width="1.2"/>`
      + `<text x="${f1(x0 + w / 2)}" y="${f1(y + fs * 0.36)}" font-size="${fs}" fill="#f8fafc" text-anchor="middle" font-weight="600">${text}</text></g>`;
  }
  function callout(pt, dx, dy, text, color = '#fde047', fs = 12) {
    const tx = pt[0] + dx, ty = pt[1] + dy;
    return `<line x1="${f1(pt[0])}" y1="${f1(pt[1])}" x2="${f1(tx)}" y2="${f1(ty)}" stroke="${color}" stroke-width="1.4"/>`
      + `<circle cx="${f1(pt[0])}" cy="${f1(pt[1])}" r="3.5" fill="${color}" stroke="#0f172a" stroke-width="1"/>`
      + tag(tx, ty, text, color, fs, dx > 8 ? 'start' : dx < -8 ? 'end' : 'middle');
  }

  // ---------- lab labels / vectors ----------
  function labels(view, v, pose, opts) {
    const P = p => v.P(p, v);
    const fs = opts.fs || 12;
    let s = '';
    const st = pose.st;
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

  function vectors(view, v, pose, opts) {
    const P = p => v.P(p, v);
    const st = pose.st;
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
        const c = P(pose.torso[3].c);
        const r = 62;
        const a0 = dir > 0 ? 200 : -20, a1 = dir > 0 ? 250 : -70;
        const p0 = [c[0] + r * Math.cos(a0 * D2R), c[1] + r * Math.sin(a0 * D2R)];
        const p1 = [c[0] + r * Math.cos(a1 * D2R), c[1] + r * Math.sin(a1 * D2R)];
        s += `<path d="M${f1(p0[0])},${f1(p0[1])} A${r},${r} 0 0 ${dir > 0 ? 1 : 0} ${f1(p1[0])},${f1(p1[1])}" fill="none" stroke="#a78bfa" stroke-width="3.5"/>`;
        const tan = dir > 0 ? [-(p1[1] - c[1]), p1[0] - c[0]] : [p1[1] - c[1], -(p1[0] - c[0])];
        const L = Math.hypot(tan[0], tan[1]);
        s += arrow(p1, [p1[0] + tan[0] / L * 2, p1[1] + tan[1] / L * 2], '#a78bfa', 1, 12);
        s += `<text x="${f1(c[0])}" y="${f1(c[1] + r + 18)}" font-size="${(opts.fs || 12) * 0.85}" fill="#c4b5fd" text-anchor="middle">hip-driven rotation</text>`;
      }
    }
    return s;
  }

  // Render a complete scene into an svg element.
  // opts: { params, labels, vectors, bubbles, ghost(params), annotate(ctx), viewBox, fs }
  function scene(view, T, opts = {}) {
    const v = VIEWS[view];
    BOUNDS = opts.bounds || [0, 0, v.w, v.h];
    const params = opts.params || {};
    const st = M.swimState(T, params);
    if (opts.override) Object.assign(st, opts.override(T, st));
    const pose = M.computePose(st);
    let s = background(view, v, pose, T, opts);
    if (opts.ghost) {
      const gst = M.swimState(T, opts.ghost);
      if (opts.override) Object.assign(gst, opts.override(T, gst));
      s += `<g opacity="0.55">${swimmerItems(view, v, M.computePose(gst), true)}</g>`;
    }
    s += swimmerItems(view, v, pose, false);
    s += waterOverlay(view, v, pose, T);
    if (opts.bubbles !== false) s += bubbles(view, v, pose, T, st.params);
    if (opts.labels) s += labels(view, v, pose, opts);
    if (opts.vectors) s += vectors(view, v, pose, opts);
    if (opts.annotate) {
      const ctx = { P: p => v.P(p, v), pose, st, v, fs: opts.fs || 12, callout: (p, dx, dy, t, c) => callout(p, dx, dy, t, c, opts.fs || 12), arrow, tag: (x, y, t, c, a) => tag(x, y, t, c, opts.fs || 12, a) };
      s += opts.annotate(ctx) || '';
    }
    return { svg: s, st, pose };
  }

  return { VIEWS, scene, COL, arrow, tag, callout };
})();
