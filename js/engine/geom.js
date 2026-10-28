// Shared math & 3D helpers for the swimmer models.
// Body frame: x forward (head direction), y to swimmer's right, z up. Water surface at z = 0.
'use strict';

const G = (() => {
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const frac = t => t - Math.floor(t);
  const wrapHalf = d => d - Math.round(d); // -> [-0.5, 0.5)

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = (v, L = 1) => { const n = len(v) || 1; return scale(v, L / n); };

  function rotX(p, deg) { // roll: positive raises +y (right) side
    const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }
  function rotPitch(p, deg, px = -20) { // positive = hips down, head up
    const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
    const x = p[0] - px;
    return [px + x * c - p[2] * s, p[1], x * s + p[2] * c];
  }
  const dirAng = deg => [Math.cos(deg * D2R), 0, -Math.sin(deg * D2R)];

  // Two-bone IK: root S, target T, bone lengths L1, L2, pole = preferred direction of the middle joint.
  function ik(S, T, L1, L2, pole) {
    const v = sub(T, S);
    const d = clamp(len(v), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.01);
    const dir = norm(v);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    let p = sub(pole, scale(dir, dot(pole, dir)));
    if (len(p) < 1e-6) p = [0, 0, 1];
    p = norm(p);
    const M = add(add(S, scale(dir, a)), scale(p, h));
    return { M, E: add(S, scale(dir, d)) };
  }

  // Piecewise smoothstep between keyframes over a non-cyclic parameter (keys sorted by .t).
  // Values may be numbers or arrays of numbers.
  function sampleSmooth(keys, t) {
    if (t <= keys[0].t) return keys[0].v;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        const s = smooth((t - a.t) / ((b.t - a.t) || 1));
        return Array.isArray(a.v) ? a.v.map((x, j) => lerp(x, b.v[j], s)) : lerp(a.v, b.v, s);
      }
    }
    return keys[keys.length - 1].v;
  }

  // Cyclic Catmull-Rom/Hermite over keyframes [{t, ...fields}] with t in [0,1); `hold` key = zero tangent.
  function sampleCyclic(keys, t, fields) {
    t = frac(t);
    const n = keys.length;
    const at = i => { const w = Math.floor(i / n), k = keys[((i % n) + n) % n]; return { ...k, t: k.t + w }; };
    let i = n - 1;
    for (let j = 0; j < n; j++) if (keys[j].t <= t) i = j;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const dt = p2.t - p1.t;
    const s = (t - p1.t) / dt;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const one = (a0, a1, a2, a3) => {
      const m1 = p1.hold ? 0 : (a2 - a0) / (p2.t - p0.t) * dt;
      const m2 = p2.hold ? 0 : (a3 - a1) / (p3.t - p1.t) * dt;
      return (p1.hold && p2.hold) ? a1 : h00 * a1 + h10 * m1 + h01 * a2 + h11 * m2;
    };
    const out = {};
    for (const f of fields) {
      const v1 = p1[f];
      out[f] = Array.isArray(v1) ? v1.map((_, j) => one(p0[f][j], v1[j], p2[f][j], p3[f][j])) : one(p0[f], v1, p2[f], p3[f]);
    }
    return out;
  }

  return { D2R, clamp, lerp, smooth, frac, wrapHalf, add, sub, scale, dot, len, norm, rotX, rotPitch, dirAng, ik, sampleSmooth, sampleCyclic };
})();
