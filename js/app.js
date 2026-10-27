// UI: Stroke Lab, mini figures, filmstrip, mistakes, drills, checklist.
'use strict';

(() => {
  const { frac, smooth, clamp, lerp } = M;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ======================= CONTENT =======================
  const PHASE_TEXT = {
    spear: {
      desc: 'Fingertips have slipped in through the “mail slot” in front of the head. The arm now extends forward and slightly downward — powered by the hip rotating, not by reaching with the shoulder.',
      cues: ['Spear to a target ~20–30 cm below the surface', 'Stay on your own railroad track (shoulder width)', 'Opposite foot flicks down as the hand spears'],
    },
    lead: {
      desc: 'The extended arm stays long and quiet while the other arm pulls and recovers. This is the “skate” position: you are on your side, lengthening the vessel and gliding.',
      cues: ['Patient lead hand — don’t start the catch yet', 'Light, relaxed hand; don’t press down', 'Feel long from fingertips to toes'],
    },
    catch: {
      desc: 'The lead hand begins the stroke only when the recovering hand passes the head. Fingertips tip down and the elbow stays near the surface so the forearm and hand become one vertical paddle.',
      cues: ['High elbow — forearm drops below it', 'Hold your place in the water, don’t push it back', 'Begin the catch as the other hand enters'],
    },
    pull: {
      desc: 'With the paddle set, the body rotates and slides past the anchored hand. The hand travels under the chest, roughly under its own shoulder.',
      cues: ['Move the body past the hand', 'Pressure on palm and forearm, not just the hand', 'Rotation (hip drive) supplies the power'],
    },
    push: {
      desc: 'The hand accelerates back past the waist to finish near the thigh as the hip rotates out of the way.',
      cues: ['Finish at the thigh — no big flick upward', 'Hip rotates away to make room', 'Keep the stroke under the body, not wide'],
    },
    release: {
      desc: 'The hand slips out of the water near the hip, little finger first, with the elbow leading the arm out.',
      cues: ['Elbow exits first', 'No effort — just let go of the water', 'Shoulder is already high from the rotation'],
    },
    recovery: {
      desc: 'A relaxed swing forward. The elbow leads high, the forearm and hand hang loosely and travel close to the water. Recovery is rest for the arm.',
      cues: ['Swing a relaxed, “dead” forearm', 'Fingertips close to the water', 'Recover on your own side — don’t swing across'],
    },
    entry: {
      desc: 'The hand passes close to the head and enters roughly a forearm’s length ahead of it, fingertips first, as if sliding into a mail slot or a sleeve.',
      cues: ['Enter near the head, then extend underwater', 'Quiet entry — no splash, no slap', 'The lead hand is now starting its catch'],
    },
  };

  const MISTAKES = [
    { id: 'headUp', title: 'Lifting the head / looking forward', view: 'side', loop: [0, 1],
      why: 'Your head is heavy. Lift it and the seesaw tips: hips and legs sink, and you drag a much bigger hole through the water. Then you kick hard just to stay up.',
      fix: 'Release the head’s weight into the water. Look straight down, crown pointing at the far wall, a straight line from crown to tailbone.',
      drill: 'Superman Glide, Skate' },
    { id: 'flat', title: 'Swimming flat (no rotation)', view: 'front', loop: [0, 1],
      why: 'Without rotation, the shoulders fight the water, recovery has to swing wide, breathing needs a head lift, and you lose the big core muscles that power the stroke.',
      fix: 'Swim on your sides. Rotate shoulders and hips together, around 30–45° each way, from skate position to skate position.',
      drill: 'Skate, Sweet Spot, Zipper Switch' },
    { id: 'over', title: 'Over-rotating', view: 'front', loop: [0, 1],
      why: 'Rolling right onto your side (or past it) loses balance and stability. The lead arm often swings wide or crosses to catch you, and the kick scissors to compensate.',
      fix: 'Rotate just enough for the shoulder to clear the water. Think “skate on the side of your chest”, not “lie on your side”.',
      drill: 'Skate with a stable head; Spear Switch' },
    { id: 'cross', title: 'Crossover entry (tightrope swimming)', view: 'top', loop: [0, 1],
      why: 'Entering across the midline makes the body snake side to side, throws the hips out and narrows your base, which makes balance and rotation unstable.',
      fix: 'Enter and spear on two railroad tracks, each in line with its own shoulder. If anything, aim slightly wide.',
      drill: 'Skate (check hand position), Spear Switch' },
    { id: 'press', title: 'Pressing down / impatient lead hand', view: 'side', loop: [0, 1],
      why: 'Starting the pull straight away pushes water down, which lifts the head instead of moving you forward. You lose the long glide and front-quadrant timing (a “windmill” stroke).',
      fix: 'Patient lead hand: keep it extended until the recovering hand passes your head, then catch. Think “the recovering hand shakes hands with the lead hand”.',
      drill: 'Zipper Switch, Swing Switch' },
    { id: 'bigKick', title: 'Big, constant kicking', view: 'side', loop: [0, 1],
      why: 'Big kicks use the body’s largest muscles and burn a lot of oxygen for very little forward speed. Wide kicks also add drag. Often they’re there to hold up badly balanced hips.',
      fix: 'Fix balance first. Then use a compact 2-beat kick timed with the opposite hand’s spear, with the feet inside the body’s “shadow”.',
      drill: 'Superman Glide, 2-Beat Kick timing in Spear Switch' },
    { id: 'liftBreath', title: 'Lifting the head to breathe', view: 'side', loop: [0.45, 1.0],
      why: 'Lifting or tilting the head forward to get air sinks the hips and stalls you on every breath. The lead arm usually presses down to hold the head up.',
      fix: 'Roll to air: the head turns with the body’s rotation, one goggle stays in the water, and you breathe into the trough the bow wave makes beside your head.',
      drill: 'Skate with nod-to-breathe; Breathing Skate' },
  ];

  const DRILLS = [
    { id: 'superman', name: 'Superman Glide', goal: 'Balance and streamline',
      how: 'Push off face down with both arms extended at shoulder width. Release your head’s weight and glide without kicking. Notice how high your hips ride.',
      focal: 'Weightless head; hips rise as you lean on your chest.', view: 'side' },
    { id: 'sweet', name: 'Sweet Spot', goal: 'Balance on your side',
      how: 'On your side with both arms at your sides and a gentle kick, find the angle where you feel stable. Roll the face down; roll to air when you need it.',
      focal: 'Stable and supported, not lying flat on your side.', view: 'front' },
    { id: 'skate', name: 'Skate', goal: 'The core TI position',
      how: 'Lead arm extended on its railroad track and slightly down, the other arm at your side, body rolled about 30–45°, face down, gentle kick.',
      focal: 'Long from fingertips to toes; lead hand relaxed and still.', view: 'side' },
    { id: 'zipperSkate', name: 'Zipper Skate', goal: 'Compact, relaxed recovery',
      how: 'From Skate, slowly slide the trailing hand up along your side (like a zipper) to the armpit, keeping the elbow high. Slide back and repeat.',
      focal: 'Elbow leads; shoulder stays forward; balance stays stable.', view: 'side' },
    { id: 'zipperSwitch', name: 'Zipper Switch', goal: 'Timing and the patient lead hand',
      how: 'Zip the recovering hand forward, pause when it reaches the head, then switch: spear it forward as the lead hand catches and the body rotates to the other skate.',
      focal: 'Lead hand waits; the switch is one smooth whole-body move.', view: 'side' },
    { id: 'swingSwitch', name: 'Swing Switch', goal: 'Relaxed swinging recovery',
      how: 'Same as Zipper Switch but swing a relaxed arm forward above the water, elbow leading, hand hanging loose. Pause at the mail slot, then switch.',
      focal: 'Dead forearm, low hand, spear to the target.', view: 'front' },
    { id: 'spearSwitch', name: 'Spear Switch (Over-Switch)', goal: 'Connect rotation, spear and kick',
      how: 'Hold Skate for a moment, then take one complete stroke without pausing at the head. Spear and rotate together, with the opposite foot flicking.',
      focal: 'Spear and kick happen together, driving the rotation.', view: 'side' },
    { id: 'whole', name: 'Whole Stroke', goal: 'Put it all together',
      how: 'Swim easy lengths with ONE focal point at a time. Count strokes per length, and use a Tempo Trainer to control stroke rate.',
      focal: 'Quiet, long, and relaxed.', view: 'side' },
  ];

  const FILM = [
    { T: 0.25, cap: 'Right skate: right arm extended, body on its right side, left hand finishing at the thigh.' },
    { T: 0.40, cap: 'Left arm recovers, elbow high. The right lead hand stays patient.' },
    { T: 0.46, cap: 'Left hand passes the head → right hand starts its catch.' },
    { T: 0.52, cap: 'Switch: left hand spears, hips rotate, right foot flicks.' },
    { T: 0.75, cap: 'Left skate: left arm extended, right arm finishing at the thigh.' },
    { T: 0.90, cap: 'Right arm swings forward, relaxed. The left lead hand waits.' },
    { T: 0.96, cap: 'Right hand at the mail slot → left hand starts its catch.' },
    { T: 0.02, cap: 'Switch: right hand spears, hips rotate, left foot flicks.' },
  ];

  const CHECKLIST = {
    'Balance': ['Head weightless, looking straight down', 'Crown leads, spine in a straight line', 'Hips and heels near the surface without kicking hard'],
    'Streamline': ['Lead hand on its railroad track (shoulder width)', 'Spear slightly downward to a target', 'Patient lead hand: skate until the other hand passes the head', 'Legs stay inside the body’s shadow'],
    'Rotation & Propulsion': ['Rotate shoulders and hips together (30–45°)', 'Catch with a high elbow: forearm vertical', 'Hold your place and move the body past the hand', 'Finish at the thigh, release with the elbow'],
    'Recovery & Timing': ['Elbow leads, forearm relaxed', 'Hand passes close to the head and enters at the mail slot', '2-beat kick: opposite foot flicks with each spear'],
    'Breathing': ['Exhale steadily through the nose underwater', 'Roll to air with the body, one goggle in', 'Return the face down before the hand spears'],
  };

  // ======================= helpers =======================
  function seqT(keys, time) {
    const dur = keys[keys.length - 1][0];
    const t = ((time % dur) + dur) % dur;
    for (let i = 0; i < keys.length - 1; i++) {
      const [a, va] = keys[i], [b, vb] = keys[i + 1];
      if (t >= a && t <= b) return lerp(va, vb, b > a ? smooth((t - a) / (b - a)) : 1);
    }
    return keys[0][1];
  }
  const flutter = (time, side) => {
    const ph = Math.sin(time * 5 + (side > 0 ? 0 : Math.PI));
    return { th: 4 + ph * 3, k: 8 + Math.max(0, ph) * 8, active: false };
  };
  const staticPose = (o) => (T, st) => ({
    tA: o.tA, tB: o.tB, roll: o.roll, headRoll: o.headRoll ?? o.roll * 0.25,
    legR: flutter(T, 1), legL: flutter(T, -1),
    breath: { amt: 0, side: 0 },
  });

  const BODY_TEXT = st => {
    const r = Math.round(st.roll);
    const roll = Math.abs(r) < 4 ? 'flat' : `${Math.abs(r)}° — ${r > 0 ? 'left' : 'right'} side down`;
    const kick = st.legL.active ? 'left foot flicks (paired with the right spear)' : st.legR.active ? 'right foot flicks (paired with the left spear)' : 'legs quiet, streamlined in the body’s shadow';
    const br = st.breath.amt > 0.3 ? `turning to breathe ${st.breath.side > 0 ? 'right' : 'left'}, one goggle in the water` : st.breath.amt > 0 ? 'head turning…' : 'face down, exhaling bubbles';
    return { roll, kick, br };
  };

  // ======================= MINI FIGURE ENGINE =======================
  const figs = [];
  class Fig {
    constructor(el, cfg) {
      this.el = el; this.cfg = cfg;
      const v = R.VIEWS[cfg.view];
      this.vb = cfg.viewBox || [0, 0, v.w, v.h];
      el.innerHTML = `<svg viewBox="${this.vb.join(' ')}"></svg>`;
      el.style.aspectRatio = `${this.vb[2]} / ${this.vb[3]}`;
      el.style.setProperty('--ar', (this.vb[2] / this.vb[3]).toFixed(3));
      this.svg = el.firstChild;
      this.time = cfg.offset || 0;
      this.visible = false;
      this.fs = 12;
      this.playing = cfg.static === undefined;
      if (cfg.caption !== false && cfg.label) {
        const b = document.createElement('div'); b.className = 'fig-label'; b.textContent = cfg.label; el.appendChild(b);
      }
      if (this.playing) {
        const btn = document.createElement('button');
        btn.className = 'fig-pp'; btn.title = 'Pause / play'; btn.textContent = '❚❚';
        btn.onclick = () => { this.playing = !this.playing; btn.textContent = this.playing ? '❚❚' : '▶'; };
        el.appendChild(btn);
      }
      this.resize();
      this.draw();
    }
    resize() {
      const w = this.svg.clientWidth || 300;
      this.fs = clamp(12.5 * this.vb[2] / w, 9, 30);
    }
    T() {
      const c = this.cfg;
      if (c.static !== undefined) return c.static;
      if (c.seq) return seqT(c.seq, this.time);
      const [a, b] = c.loop || [0, 1];
      const dur = c.dur || 2.4 * (b - a) / (c.speed || 0.5);
      const u = frac(this.time / (dur * 1.18)) * 1.18;
      return a + (b - a) * Math.min(u, 1);
    }
    draw() {
      const c = this.cfg;
      const T = this.T();
      const out = R.scene(c.view, T, {
        params: c.params, override: c.override ? (t, st) => c.override(this.time, st, T) : null,
        labels: c.labels, vectors: c.vectors, bubbles: c.bubbles,
        ghost: c.ghost, annotate: c.annotate, fs: this.fs, bounds: this.vb,
      });
      this.svg.innerHTML = out.svg;
    }
    tick(dt) {
      if (!this.visible) return;
      if (this.playing) this.time += dt;
      this.draw();
    }
  }
  const io = new IntersectionObserver(es => es.forEach(e => { const f = e.target._fig; if (f) { f.visible = e.isIntersecting; if (f.visible) { f.resize(); f.draw(); } } }), { rootMargin: '80px' });
  function mountFig(el, cfg) {
    const f = new Fig(el, cfg);
    el._fig = f; figs.push(f); io.observe(el);
    return f;
  }

  // ---------------- anatomy figure configs ----------------
  const A = {}; // annotate fns
  const SIDE_CLOSE = [150, 0, 520, 320];
  const FIGS = {
    'head-good': { view: 'side', loop: [0.1, 0.4], speed: 0.25, viewBox: SIDE_CLOSE, label: 'Correct', bubbles: true,
      annotate: c => `<line x1="${c.P(c.pose.spineTop)[0]}" y1="${c.P(c.pose.spineTop)[1]}" x2="${c.P(c.pose.hipC)[0]}" y2="${c.P(c.pose.hipC)[1]}" stroke="#fde047" stroke-width="2" stroke-dasharray="6 5"/>`
        + c.callout(c.P(c.pose.spineTop), 20, -55, 'crown leads', '#fde047')
        + c.callout(c.P(c.pose.head.mouth), 30, 50, 'eyes look straight down', '#67e8f9')
        + c.callout(c.P(c.pose.hipC), -10, -70, 'hips at the surface', '#86efac') },
    'head-bad': { view: 'side', loop: [0.1, 0.4], speed: 0.25, viewBox: SIDE_CLOSE, label: 'Head lifted', params: { headUp: true },
      ghost: {}, annotate: c => c.callout(c.P(c.pose.head.c), 30, -60, 'head up, looking forward', '#f87171')
        + c.callout(c.P(c.pose.hipC), -10, 80, 'hips & legs sink → drag', '#f87171') },
    'balance': { view: 'side', static: 0.25, label: 'The body as a seesaw', viewBox: [0, 0, 700, 320],
      override: staticPose({ tA: 0.25, tB: 0.25, roll: 0, headRoll: 0 }),
      annotate: c => {
        const lung = c.P(c.pose.torso[3].c), hip = c.P(c.pose.torso[6].c);
        return c.arrow([lung[0], lung[1] + 10], [lung[0], lung[1] - 70], '#67e8f9', 4)
          + c.tag(lung[0], lung[1] - 85, 'buoyancy (air in lungs)', '#67e8f9')
          + c.arrow([hip[0], hip[1] - 10], [hip[0], hip[1] + 70], '#f87171', 4)
          + c.tag(hip[0], hip[1] + 85, 'weight (legs, hips)', '#f87171')
          + c.callout(c.P(c.pose.head.c), 30, -55, 'release head weight', '#fde047')
          + c.callout(c.P(c.pose.armR.H), -10, 60, 'arms forward = counterweight', '#fde047');
      } },
    'rotation': { view: 'front', loop: [0, 1], speed: 0.3, label: 'Head-on view', labels: true, vectors: true, params: { breath: 0 } },
    'rotation-top': { view: 'top', loop: [0, 1], speed: 0.3, label: 'From above: the body narrows as it rotates', params: { breath: 0 } },
    'skate-side': { view: 'side', static: 0.25, label: 'Skate (side view)',
      annotate: c => c.callout(c.P(c.pose.armR.H), 10, 55, 'lead arm long and slightly down', '#fb923c')
        + c.callout(c.P(c.pose.armL.H), -20, 60, 'other hand at the thigh', '#38bdf8')
        + c.callout(c.P(c.pose.head.c), 10, -60, 'face down, head still', '#fde047') },
    'skate-front': { view: 'front', static: 0.25, label: 'Skate (head-on)', labels: true,
      annotate: c => c.callout(c.P(c.pose.armL.S), -40, -50, 'shoulder clears the water', '#38bdf8') },
    'recovery-side': { view: 'side', loop: [0.28, 0.48], speed: 0.2, label: 'Left arm recovery',
      annotate: c => c.callout(c.P(c.pose.armL.E), -40, -40, 'elbow leads, high', '#38bdf8')
        + c.callout(c.P(c.pose.armL.H), 40, -30, 'relaxed hand near the water', '#38bdf8') },
    'recovery-front': { view: 'front', loop: [0.28, 0.48], speed: 0.2, label: 'Head-on',
      annotate: c => c.callout(c.P(c.pose.armL.E), 30, -30, 'rotation lifts the shoulder', '#38bdf8') },
    'spear-side': { view: 'side', loop: [0.40, 0.62], speed: 0.2, label: 'Entry & spear (left arm)', vectors: true,
      annotate: c => c.callout(c.P([c.pose.head.c[0] + 20, 0, 0]), 30, -60, 'enters a forearm’s length ahead of the head', '#34d399') },
    'spear-top': { view: 'top', loop: [0.40, 0.62], speed: 0.2, label: 'From above: railroad tracks', labels: true },
    'fq-side': { view: 'side', loop: [0, 1], speed: 0.25, label: 'Watch the front-quadrant box', labels: true, params: { breath: 0 } },
    'catch-side': { view: 'side', loop: [0.90, 1.14], speed: 0.18, label: 'Left arm catch', vectors: true,
      annotate: c => c.callout(c.P(c.pose.armL.E), 40, -40, 'elbow stays high', '#38bdf8')
        + c.callout(c.P(c.pose.armL.W), 50, 30, 'forearm + hand = one paddle', '#38bdf8') },
    'catch-front': { view: 'front', loop: [0.90, 1.14], speed: 0.18, label: 'Head-on',
      annotate: c => c.callout(c.P(c.pose.armL.H), 40, 20, 'hand under the shoulder line', '#38bdf8') },
    'pull-side': { view: 'side', loop: [1.04, 1.32], speed: 0.18, label: 'Left arm pull & push', vectors: true,
      annotate: c => c.callout(c.P(c.pose.armL.H), -30, 50, 'hand anchored, body moves past', '#38bdf8') },
    'pull-top': { view: 'top', loop: [1.04, 1.32], speed: 0.18, label: 'From above: stroke under the body',
      annotate: c => c.callout(c.P(c.pose.armL.H), 0, 50, 'finishes at the thigh', '#38bdf8') },
    'kick-side': { view: 'side', loop: [0, 1], speed: 0.22, label: '2-beat kick', vectors: true, params: { breath: 0 },
      annotate: c => {
        let s = '';
        for (const [leg, nm, arm] of [[c.pose.legL, 'left', 'right'], [c.pose.legR, 'right', 'left']]) {
          if (leg.active) s += c.tag(c.v.w / 2, 22, `${arm} hand spears ↔ ${nm} foot flicks`, '#fde047');
        }
        return s;
      } },
    'breath-front': { view: 'front', loop: [0.45, 1.0], speed: 0.2, label: 'Head-on: roll to air', labels: true, params: { breath: 2 },
      annotate: c => c.st.breath.amt > 0.8 ? c.callout(c.P(c.pose.head.mouth), 50, 40, 'mouth in the bow-wave trough', '#67e8f9') : '' },
    'breath-side': { view: 'side', loop: [0.45, 1.0], speed: 0.2, label: 'Side: head stays in line', params: { breath: 2 }, viewBox: SIDE_CLOSE,
      annotate: c => c.callout(c.P(c.pose.spineTop), 20, -60, c.st.breath.amt > 0.5 ? 'turn, don’t lift' : 'exhale underwater', '#67e8f9') },
  };

  // ---------------- drill figure configs ----------------
  const DRILL_FIGS = {
    superman: { override: staticPose({ tA: 0.25, tB: 0.25, roll: 0, headRoll: 0 }), static: 0.25 },
    sweet: { override: staticPose({ tA: 0.76, tB: 0.76, roll: -45, headRoll: -12 }), static: 0.25 },
    skate: { override: staticPose({ tA: 0.25, tB: 0.77, roll: -40 }), static: 0.25 },
    zipperSkate: { override: (time) => ({ ...staticPose({ tA: 0.25, roll: -40 })(time), tB: seqT([[0, 0.77], [1.0, 0.77], [2.6, 0.925], [3.2, 0.925], [4.6, 0.77]], time) }), static: 0.25 },
    zipperSwitch: { seq: [[0, 0.25], [1.2, 0.25], [2.8, 0.43], [3.5, 0.43], [4.3, 0.75], [5.5, 0.75], [7.1, 0.93], [7.8, 0.93], [8.6, 1.25]] },
    swingSwitch: { params: { swing: true }, seq: [[0, 0.25], [1.2, 0.25], [2.4, 0.43], [3.0, 0.43], [3.8, 0.75], [5.0, 0.75], [6.2, 0.93], [6.8, 0.93], [7.6, 1.25]] },
    spearSwitch: { seq: [[0, 0.25], [1.4, 0.25], [2.6, 0.75], [4.0, 0.75], [5.2, 1.25]] },
    whole: { loop: [0, 1], speed: 0.5 },
  };

  // ======================= STROKE LAB =======================
  const lab = {
    T: 0.25, playing: true, speed: 0.25, mistake: 'none', breath: 2,
    show: { labels: true, vectors: true, ghost: false, bubbles: true },
    views: { side: true, front: true, top: true },
    fs: {}, lastInfo: '', cycleDur: 2.0,
  };
  const labSvgs = { side: $('#lab-side svg'), front: $('#lab-front svg'), top: $('#lab-top svg') };
  for (const k in labSvgs) { const v = R.VIEWS[k]; labSvgs[k].setAttribute('viewBox', `0 0 ${v.w} ${v.h}`); }

  const labParams = () => ({ ...M.MISTAKES[lab.mistake], breath: lab.mistake === 'liftBreath' ? 2 : lab.breath });

  function labResize() {
    for (const k in labSvgs) {
      const w = labSvgs[k].clientWidth || 400;
      lab.fs[k] = clamp(12.5 * R.VIEWS[k].w / w, 9, 32);
    }
  }

  // Step points for prev/next
  const STEPS = [...new Set(M.PHASES.flatMap(p => [p.a, frac(p.a + 0.5)]).concat([0.25, 0.75]).map(x => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);

  function drawLab() {
    const params = labParams();
    let st;
    for (const k in labSvgs) {
      if (!lab.views[k]) continue;
      const out = R.scene(k, lab.T, {
        params, labels: lab.show.labels, vectors: lab.show.vectors, bubbles: lab.show.bubbles,
        ghost: lab.show.ghost && lab.mistake !== 'none' ? { breath: params.breath } : null, fs: lab.fs[k],
      });
      labSvgs[k].innerHTML = out.svg;
      st = out.st;
    }
    if (!st) st = M.swimState(lab.T, params);
    updateTimeline();
    updateInfo(st);
  }

  // ---------- timeline ----------
  const TL = { x0: 120, x1: 990, rows: ['Right arm', 'Left arm', 'Body roll', 'Kick', 'Breath'], rh: 24, gap: 8, top: 18 };
  const tlSvg = $('#timeline');
  const tx = t => TL.x0 + (TL.x1 - TL.x0) * t;
  const ry = i => TL.top + i * (TL.rh + TL.gap);
  let tlBreathKey = '';
  function buildTimeline() {
    const H = ry(TL.rows.length) + 6;
    tlSvg.setAttribute('viewBox', `0 0 1000 ${H}`);
    let s = '';
    for (let i = 0; i <= 10; i++) s += `<text x="${tx(i / 10)}" y="11" font-size="10" fill="#7dd3fc" text-anchor="middle">${i * 10}%</text>`;
    TL.rows.forEach((r, i) => s += `<text x="${TL.x0 - 10}" y="${ry(i) + TL.rh / 2 + 4}" font-size="13" fill="#cbd5e1" text-anchor="end">${r}</text>`);
    for (const [row, off] of [[0, 0], [1, 0.5]]) {
      for (const p of M.PHASES) {
        for (const [a, b] of splitWrap(p.a + off, p.b + off)) {
          s += `<rect class="tl-seg" x="${tx(a)}" y="${ry(row)}" width="${tx(b) - tx(a)}" height="${TL.rh}" fill="${p.color}" opacity="0.85"><title>${p.name}</title></rect>`;
          if (b - a > 0.07) s += `<text x="${(tx(a) + tx(b)) / 2}" y="${ry(row) + TL.rh / 2 + 4}" font-size="11" fill="#0f172a" text-anchor="middle" font-weight="700" pointer-events="none">${p.name.split(' —')[0]}</text>`;
        }
      }
    }
    // roll curve
    const y0 = ry(2) + TL.rh / 2;
    let d = '';
    for (let i = 0; i <= 200; i++) { const t = i / 200; const r = M.rollAt(t, 40); d += `${i ? 'L' : 'M'}${tx(t).toFixed(1)},${(y0 - r / 40 * (TL.rh / 2 - 2)).toFixed(1)}`; }
    s += `<rect x="${TL.x0}" y="${ry(2)}" width="${TL.x1 - TL.x0}" height="${TL.rh}" fill="#0f172a" opacity="0.6"/>`;
    s += `<line x1="${TL.x0}" y1="${y0}" x2="${TL.x1}" y2="${y0}" stroke="#334155"/>`;
    s += `<path d="${d}" fill="none" stroke="#a78bfa" stroke-width="2.5"/>`;
    s += `<text x="${TL.x1 + 4}" y="${ry(2) + 9}" font-size="9" fill="#94a3b8">L↓</text><text x="${TL.x1 + 4}" y="${ry(2) + TL.rh}" font-size="9" fill="#94a3b8">R↓</text>`;
    // kick
    s += `<rect x="${TL.x0}" y="${ry(3)}" width="${TL.x1 - TL.x0}" height="${TL.rh}" fill="#0f172a" opacity="0.6"/>`;
    for (const [t, nm] of [[0.02, 'L foot ↓'], [0.52, 'R foot ↓']]) {
      s += `<rect x="${tx(t - 0.03)}" y="${ry(3) + 3}" width="${tx(0.1) - tx(0)}" height="${TL.rh - 6}" rx="4" fill="#f8fafc" opacity="0.85"/><text x="${tx(t + 0.02)}" y="${ry(3) + TL.rh / 2 + 4}" font-size="11" fill="#0f172a" text-anchor="middle" font-weight="700">${nm}</text>`;
    }
    s += `<rect x="${TL.x0}" y="${ry(4)}" width="${TL.x1 - TL.x0}" height="${TL.rh}" fill="#0f172a" opacity="0.6"/><g id="tl-breath"></g>`;
    for (const st of STEPS) s += `<line x1="${tx(st)}" y1="${TL.top - 2}" x2="${tx(st)}" y2="${ry(TL.rows.length) - TL.gap + 2}" stroke="#fff" stroke-opacity="0.08"/>`;
    s += `<g id="tl-head"><line x1="0" y1="${TL.top - 4}" x2="0" y2="${ry(TL.rows.length) - TL.gap + 4}" stroke="#fff" stroke-width="2.5"/><polygon points="-6,${TL.top - 10} 6,${TL.top - 10} 0,${TL.top - 2}" fill="#fff"/></g>`;
    tlSvg.innerHTML = s;
    tlBreathKey = '';
  }
  function splitWrap(a, b) {
    if (b <= 1) return [[a, b]];
    if (a >= 1) return [[a - 1, b - 1]];
    return [[a, 1], [0, b - 1]];
  }
  function updateTimeline() {
    const t = frac(lab.T);
    $('#tl-head').setAttribute('transform', `translate(${tx(t).toFixed(1)},0)`);
    const p = labParams();
    const key = `${Math.floor(lab.T)}|${p.breath}`;
    if (key !== tlBreathKey) {
      tlBreathKey = key;
      const c = Math.floor(lab.T);
      let s = '', run = null;
      for (let i = 0; i <= 200; i++) {
        const b = M.breathAt(c + i / 200, p.breath);
        const on = b.amt > 0.05 ? b.side : 0;
        if (run && (on !== run.side || i === 200)) {
          s += `<rect x="${tx(run.a)}" y="${ry(4) + 3}" width="${tx(i / 200) - tx(run.a)}" height="${TL.rh - 6}" rx="4" fill="#67e8f9"/><text x="${(tx(run.a) + tx(i / 200)) / 2}" y="${ry(4) + TL.rh / 2 + 4}" font-size="11" fill="#0f172a" text-anchor="middle" font-weight="700">breathe ${run.side > 0 ? 'right' : 'left'}</text>`;
          run = null;
        }
        if (on && !run) run = { a: i / 200, side: on };
      }
      if (!p.breath) s = `<text x="${tx(0.5)}" y="${ry(4) + TL.rh / 2 + 4}" font-size="11" fill="#64748b" text-anchor="middle">no breathing in this cycle</text>`;
      else if (!s) s = `<text x="${tx(0.5)}" y="${ry(4) + TL.rh / 2 + 4}" font-size="11" fill="#64748b" text-anchor="middle">no breath this cycle (exhale)</text>`;
      $('#tl-breath').innerHTML = s;
    }
    $('#scrub').value = Math.round(t * 1000);
    $('#tpos').textContent = `${Math.round(t * 100)}%`;
  }
  function tlPointer(e) {
    const r = tlSvg.getBoundingClientRect();
    const vbx = (e.clientX - r.left) / r.width * 1000;
    const t = clamp((vbx - TL.x0) / (TL.x1 - TL.x0), 0, 0.999);
    lab.T = Math.floor(lab.T) + t;
    setPlaying(false);
    drawLab();
  }
  let tlDrag = false;
  tlSvg.addEventListener('pointerdown', e => { tlDrag = true; tlSvg.setPointerCapture(e.pointerId); tlPointer(e); });
  tlSvg.addEventListener('pointermove', e => { if (tlDrag) tlPointer(e); });
  tlSvg.addEventListener('pointerup', () => tlDrag = false);

  // ---------- info panel ----------
  function updateInfo(st) {
    const pA = M.phaseOf(st.tA), pB = M.phaseOf(st.tB);
    const b = BODY_TEXT(st);
    const key = [pA.id, pB.id, b.roll, b.kick, b.br, lab.mistake].join('|');
    if (key === lab.lastInfo) return;
    const phaseChanged = !lab.lastInfo.startsWith(pA.id + '|' + pB.id);
    lab.lastInfo = key;
    if (phaseChanged || !$('#info-arms').innerHTML) {
      $('#info-arms').innerHTML = [['Right arm', pA, R.COL.R.fill], ['Left arm', pB, R.COL.L.fill]].map(([nm, p, col]) => `
        <div class="arm-card" style="--c:${col}">
          <div class="arm-head"><span class="dot" style="background:${p.color}"></span><span class="arm-nm" style="color:${col}">${nm}</span><span class="arm-ph">${p.name}</span></div>
          <p>${PHASE_TEXT[p.id].desc}</p>
          <ul>${PHASE_TEXT[p.id].cues.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>`).join('');
    }
    $('#info-body').innerHTML = `
      <div><b>Rotation</b><span>${b.roll}</span></div>
      <div><b>Kick</b><span>${b.kick}</span></div>
      <div><b>Head</b><span>${b.br}</span></div>`;
    const mk = MISTAKES.find(m => m.id === lab.mistake);
    $('#info-mistake').innerHTML = mk ? `<div class="mk-card"><h4>⚠ Simulating: ${mk.title}</h4><p><b>Why it hurts:</b> ${mk.why}</p><p><b>Fix:</b> ${mk.fix}</p><p class="muted">Turn on “Ghost (correct form)” to compare.</p></div>` : '';
  }

  // ---------- controls ----------
  function setPlaying(p) { lab.playing = p; $('#btn-play').textContent = p ? '❚❚ Pause' : '▶ Play'; }
  $('#btn-play').onclick = () => setPlaying(!lab.playing);
  const stepTo = dir => {
    setPlaying(false);
    const c = Math.floor(lab.T), t = lab.T - c, eps = 0.002;
    if (dir > 0) { const n = STEPS.find(s => s > t + eps); lab.T = n !== undefined ? c + n : c + 1 + STEPS[0]; }
    else { const n = [...STEPS].reverse().find(s => s < t - eps); lab.T = n !== undefined ? c + n : c - 1 + STEPS[STEPS.length - 1]; }
    drawLab();
  };
  $('#btn-prev').onclick = () => stepTo(-1);
  $('#btn-next').onclick = () => stepTo(1);
  $('#btn-back').onclick = () => { setPlaying(false); lab.T -= 0.01; drawLab(); };
  $('#btn-fwd').onclick = () => { setPlaying(false); lab.T += 0.01; drawLab(); };
  $('#scrub').oninput = e => { setPlaying(false); lab.T = Math.floor(lab.T) + e.target.value / 1000; drawLab(); };
  $('#speed').onchange = e => lab.speed = +e.target.value;
  $('#breath').onchange = e => { lab.breath = +e.target.value; drawLab(); };
  $('#mistake').onchange = e => { lab.mistake = e.target.value; drawLab(); };
  for (const k of ['labels', 'vectors', 'ghost', 'bubbles']) $(`#opt-${k}`).onchange = e => { lab.show[k] = e.target.checked; drawLab(); };
  for (const k of ['side', 'front', 'top']) $(`#view-${k}`).onchange = e => {
    lab.views[k] = e.target.checked; $(`#lab-${k}`).hidden = !e.target.checked; labResize(); drawLab();
  };
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox') return;
    const r = $('#lab').getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (e.key === ' ') { e.preventDefault(); setPlaying(!lab.playing); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); lab.T += e.shiftKey ? 0.05 : 0.01; drawLab(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); lab.T -= e.shiftKey ? 0.05 : 0.01; drawLab(); }
    else if (e.key === ']' || e.key === '.') stepTo(1);
    else if (e.key === '[' || e.key === ',') stepTo(-1);
  });

  function gotoLab(T, mistake) {
    lab.T = T; setPlaying(false);
    if (mistake !== undefined) {
      lab.mistake = mistake; $('#mistake').value = mistake;
      if (mistake !== 'none') { lab.show.ghost = true; $('#opt-ghost').checked = true; }
    }
    drawLab();
    $('#lab').scrollIntoView({ behavior: 'smooth' });
  }
  $$('[data-goto]').forEach(b => b.onclick = () => gotoLab(+b.dataset.goto));

  // ======================= BUILD SECTIONS =======================
  $$('[data-fig]').forEach(el => { const cfg = FIGS[el.dataset.fig]; if (cfg) mountFig(el, cfg); });

  // filmstrip
  let filmView = 'side';
  const film = $('#film');
  film.innerHTML = FILM.map((f, i) => `
    <figure class="frame" data-i="${i}">
      <div class="frame-fig"></div>
      <figcaption><span class="num">${i + 1}</span>${f.cap}</figcaption>
      <button class="link" data-film="${i}">Open in Stroke Lab →</button>
    </figure>`).join('');
  const filmFigs = $$('.frame-fig', film);
  function drawFilm() {
    filmFigs.forEach((el, i) => {
      const v = R.VIEWS[filmView];
      el.innerHTML = `<svg viewBox="0 0 ${v.w} ${v.h}">${R.scene(filmView, FILM[i].T, { params: { breath: 0 }, labels: false, vectors: true, bubbles: false, fs: 22 }).svg}</svg>`;
    });
  }
  $$('[data-filmview]').forEach(b => b.onclick = () => {
    filmView = b.dataset.filmview; $$('[data-filmview]').forEach(x => x.classList.toggle('on', x === b)); drawFilm();
  });
  $$('[data-film]').forEach(b => b.onclick = () => gotoLab(FILM[+b.dataset.film].T, 'none'));
  drawFilm();

  // mistakes
  $('#mistakes-grid').innerHTML = MISTAKES.map(m => `
    <article class="card mistake">
      <h3>${m.title}</h3>
      <div class="pair">
        <div class="fig bad" data-mfig="${m.id}" data-variant="bad"></div>
        <div class="fig good" data-mfig="${m.id}" data-variant="good"></div>
      </div>
      <p><b class="bad-t">Why it hurts:</b> ${m.why}</p>
      <p><b class="good-t">Fix:</b> ${m.fix}</p>
      <p class="muted"><b>Drills:</b> ${m.drill}</p>
      <button class="btn small" data-mk="${m.id}">Simulate in Stroke Lab →</button>
    </article>`).join('');
  $$('[data-mfig]').forEach(el => {
    const m = MISTAKES.find(x => x.id === el.dataset.mfig);
    const bad = el.dataset.variant === 'bad';
    const params = bad ? { ...M.MISTAKES[m.id] } : { breath: m.id === 'liftBreath' ? 2 : 0 };
    if (bad && m.id !== 'liftBreath') params.breath = 0;
    mountFig(el, { view: m.view, loop: m.loop, speed: 0.3, params, label: bad ? '✗ Mistake' : '✓ Total Immersion', labels: m.view === 'top' || m.view === 'front', bubbles: false,
      viewBox: m.view === 'top' ? [200, 0, 500, 280] : undefined });
  });
  $$('[data-mk]').forEach(b => b.onclick = () => gotoLab(0.3, b.dataset.mk) || setPlaying(true));

  // drills
  $('#drills-list').innerHTML = DRILLS.map((d, i) => `
    <li class="card drill">
      <div class="drill-num">${i + 1}</div>
      <div class="fig" data-dfig="${d.id}"></div>
      <div class="drill-txt">
        <h3>${d.name} <span class="goal">${d.goal}</span></h3>
        <p>${d.how}</p>
        <p class="focal">🎯 ${d.focal}</p>
      </div>
    </li>`).join('');
  $$('[data-dfig]').forEach(el => {
    const d = DRILLS.find(x => x.id === el.dataset.dfig);
    const cfg = { view: d.view, ...DRILL_FIGS[d.id], viewBox: d.view === 'side' ? [10, 40, 680, 250] : [50, 30, 280, 280] };
    cfg.params = { breath: 0, ...(DRILL_FIGS[d.id].params || {}) };
    if (cfg.static !== undefined && cfg.override) { delete cfg.static; cfg.loop = [0.25, 0.25]; cfg.dur = 1; }
    mountFig(el, cfg);
  });

  // checklist
  const CK_KEY = 'ti-checklist-v1';
  const saved = JSON.parse(localStorage.getItem(CK_KEY) || '{}');
  $('#checklist').innerHTML = Object.entries(CHECKLIST).map(([grp, items]) => `
    <div class="ck-group"><h4>${grp}</h4>${items.map((it, i) => {
      const id = `${grp}-${i}`;
      return `<label class="ck"><input type="checkbox" data-ck="${id}" ${saved[id] ? 'checked' : ''}><span>${it}</span></label>`;
    }).join('')}</div>`).join('');
  const ckCount = () => { const all = $$('[data-ck]'); $('#ck-count').textContent = `${all.filter(c => c.checked).length} / ${all.length} felt in the water`; };
  $$('[data-ck]').forEach(c => c.onchange = () => { saved[c.dataset.ck] = c.checked; localStorage.setItem(CK_KEY, JSON.stringify(saved)); ckCount(); });
  $('#ck-reset').onclick = () => { $$('[data-ck]').forEach(c => c.checked = false); localStorage.removeItem(CK_KEY); for (const k in saved) delete saved[k]; ckCount(); };
  ckCount();

  // ======================= LOOP =======================
  buildTimeline();
  labResize();
  const ro = new ResizeObserver(() => { labResize(); figs.forEach(f => f.resize()); if (!lab.playing) drawLab(); });
  ro.observe(document.body);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (lab.playing) { lab.T += dt * lab.speed / lab.cycleDur; drawLab(); }
    for (const f of figs) f.tick(dt);
    requestAnimationFrame(frame);
  }
  drawLab();
  requestAnimationFrame(frame);
})();
