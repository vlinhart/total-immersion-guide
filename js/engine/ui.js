// Shared page UI: Stroke Lab, timeline, info panel, animated figures, filmstrip, mistakes, drills, checklist.
// Driven entirely by the stroke's CONTENT object (js/<stroke>/content.js) and STROKE model.
'use strict';

(() => {
  const { frac, smooth, clamp, lerp } = G;
  const C = CONTENT;
  const t = C.t;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ======================= MINI FIGURE ENGINE =======================
  const figs = [];
  function seqT(keys, time) {
    const dur = keys[keys.length - 1][0];
    const tt = ((time % dur) + dur) % dur;
    for (let i = 0; i < keys.length - 1; i++) {
      const [a, va] = keys[i], [b, vb] = keys[i + 1];
      if (tt >= a && tt <= b) return lerp(va, vb, b > a ? smooth((tt - a) / (b - a)) : 1);
    }
    return keys[0][1];
  }
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
      if (cfg.label) {
        const b = document.createElement('div'); b.className = 'fig-label'; b.textContent = cfg.label; el.appendChild(b);
      }
      if (this.playing) {
        const btn = document.createElement('button');
        btn.className = 'fig-pp'; btn.title = t.figPause; btn.textContent = '❚❚';
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
        params: c.params, override: c.override ? (tt, st) => c.override(this.time, st, T) : null,
        labels: c.labels, vectors: c.vectors, bubbles: c.bubbles,
        ghost: c.ghost, annotate: c.annotate, fs: this.fs, bounds: this.vb, ...(c.sceneOpts || {}),
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

  // ======================= STROKE LAB =======================
  const ctrlEls = $$('#lab [data-param]');
  const parseVal = v => (v !== '' && !isNaN(+v)) ? +v : v;
  const lab = {
    T: C.defaultT ?? 0.25, playing: true, speed: 0.25, mistake: 'none',
    ctrl: Object.fromEntries(ctrlEls.map(el => [el.dataset.param, parseVal(el.value)])),
    show: { labels: true, vectors: true, ghost: false, bubbles: true },
    views: {}, fs: {}, lastInfo: '',
  };
  const labSvgs = {};
  for (const el of $$('#lab .view[data-view]')) {
    const k = el.dataset.view, v = R.VIEWS[k];
    const svg = $('svg', el);
    svg.setAttribute('viewBox', `0 0 ${v.w} ${v.h}`);
    svg.style.aspectRatio = `${v.w} / ${v.h}`;
    el.style.setProperty('--ar', (v.w / v.h).toFixed(3));
    labSvgs[k] = svg; lab.views[k] = true;
  }
  const labParams = () => ({ ...lab.ctrl, ...C.mistakeParams[lab.mistake] });
  const cycleDur = () => C.cycleDur(labParams());

  function labResize() {
    for (const k in labSvgs) {
      const w = labSvgs[k].clientWidth || 400;
      lab.fs[k] = clamp(12.5 * R.VIEWS[k].w / w, 9, 32);
    }
  }
  let STEPS = [];

  function drawLab() {
    const params = labParams();
    let st;
    for (const k in labSvgs) {
      if (!lab.views[k]) continue;
      const out = R.scene(k, lab.T, {
        params, labels: lab.show.labels, vectors: lab.show.vectors, bubbles: lab.show.bubbles,
        ghost: lab.show.ghost && lab.mistake !== 'none' ? { ...lab.ctrl } : null, fs: lab.fs[k],
      });
      labSvgs[k].innerHTML = out.svg;
      st = out.st;
    }
    if (!st) st = STROKE.swimState(lab.T, params);
    updateTimeline();
    updateInfo(st);
  }

  // ---------- timeline ----------
  const TL = { x0: 120, x1: 990, rh: 24, gap: 8, top: 18 };
  const tlSvg = $('#timeline');
  const tx = x => TL.x0 + (TL.x1 - TL.x0) * x;
  const ry = i => TL.top + i * (TL.rh + TL.gap);
  let tlRows = [], tlKey = '', tlDynKeys = [];
  function splitWrap(a, b) {
    if (b <= 1) return [[a, b]];
    if (a >= 1) return [[a - 1, b - 1]];
    return [[a, 1], [0, b - 1]];
  }
  const markSVG = (row, m, color) => `<rect x="${tx(m.a)}" y="${ry(row) + 3}" width="${tx(m.b) - tx(m.a)}" height="${TL.rh - 6}" rx="4" fill="${m.color || color || '#f8fafc'}" opacity="0.9"/><text x="${(tx(m.a) + tx(m.b)) / 2}" y="${ry(row) + TL.rh / 2 + 4}" font-size="11" fill="#0f172a" text-anchor="middle" font-weight="700" pointer-events="none">${m.text}</text>`;
  function buildTimeline() {
    const params = labParams();
    tlRows = C.tracks(params);
    STEPS = C.steps(params);
    const H = ry(tlRows.length) + 6;
    tlSvg.setAttribute('viewBox', `0 0 1000 ${H}`);
    let s = '';
    for (let i = 0; i <= 10; i++) s += `<text x="${tx(i / 10)}" y="11" font-size="10" fill="#7dd3fc" text-anchor="middle">${i * 10}%</text>`;
    tlRows.forEach((r, i) => {
      s += `<text x="${TL.x0 - 10}" y="${ry(i) + TL.rh / 2 + 4}" font-size="13" fill="#cbd5e1" text-anchor="end">${r.label}</text>`;
      if (r.type !== 'phases') s += `<rect x="${TL.x0}" y="${ry(i)}" width="${TL.x1 - TL.x0}" height="${TL.rh}" fill="#0f172a" opacity="0.6"/>`;
      if (r.type === 'phases') {
        for (const p of r.phases) for (const [a, b] of splitWrap(p.a + (r.offset || 0), p.b + (r.offset || 0))) {
          s += `<rect class="tl-seg" x="${tx(a)}" y="${ry(i)}" width="${tx(b) - tx(a)}" height="${TL.rh}" fill="${p.color}" opacity="0.85"><title>${p.name}</title></rect>`;
          if (b - a > (r.minLabel || 0.07)) s += `<text x="${(tx(a) + tx(b)) / 2}" y="${ry(i) + TL.rh / 2 + 4}" font-size="11" fill="#0f172a" text-anchor="middle" font-weight="700" pointer-events="none">${p.short || p.name.split(' —')[0]}</text>`;
        }
      } else if (r.type === 'curve') {
        const y0 = ry(i) + TL.rh / 2;
        let d = '';
        for (let j = 0; j <= 200; j++) { const x = j / 200; d += `${j ? 'L' : 'M'}${tx(x).toFixed(1)},${(y0 - r.fn(x) * (TL.rh / 2 - 2)).toFixed(1)}`; }
        s += `<line x1="${TL.x0}" y1="${y0}" x2="${TL.x1}" y2="${y0}" stroke="#334155"/>`;
        s += `<path d="${d}" fill="none" stroke="${r.color}" stroke-width="2.5"/>`;
        if (r.top) s += `<text x="${TL.x1 + 4}" y="${ry(i) + 9}" font-size="9" fill="#94a3b8">${r.top}</text>`;
        if (r.bottom) s += `<text x="${TL.x1 + 4}" y="${ry(i) + TL.rh}" font-size="9" fill="#94a3b8">${r.bottom}</text>`;
      } else if (r.type === 'marks') {
        for (const m of r.marks) s += markSVG(i, m, r.color);
      } else if (r.type === 'dynamic') {
        s += `<g id="tl-dyn-${i}"></g>`;
      }
    });
    for (const st of STEPS) s += `<line x1="${tx(st)}" y1="${TL.top - 2}" x2="${tx(st)}" y2="${ry(tlRows.length) - TL.gap + 2}" stroke="#fff" stroke-opacity="0.08"/>`;
    s += `<g id="tl-head"><line x1="0" y1="${TL.top - 4}" x2="0" y2="${ry(tlRows.length) - TL.gap + 4}" stroke="#fff" stroke-width="2.5"/><polygon points="-6,${TL.top - 10} 6,${TL.top - 10} 0,${TL.top - 2}" fill="#fff"/></g>`;
    tlSvg.innerHTML = s;
    tlDynKeys = [];
  }
  function updateTimeline() {
    const params = labParams();
    const key = JSON.stringify(params);
    if (key !== tlKey) { tlKey = key; buildTimeline(); }
    const x = frac(lab.T);
    $('#tl-head').setAttribute('transform', `translate(${tx(x).toFixed(1)},0)`);
    tlRows.forEach((r, i) => {
      if (r.type !== 'dynamic') return;
      const out = r.build(lab.T, params);
      if (out.key === tlDynKeys[i]) return;
      tlDynKeys[i] = out.key;
      $(`#tl-dyn-${i}`).innerHTML = out.marks.length
        ? out.marks.map(m => markSVG(i, m, r.color)).join('')
        : `<text x="${tx(0.5)}" y="${ry(i) + TL.rh / 2 + 4}" font-size="11" fill="#64748b" text-anchor="middle">${out.empty || ''}</text>`;
    });
    $('#scrub').value = Math.round(x * 1000);
    $('#tpos').textContent = `${Math.round(x * 100)}%`;
  }
  function tlPointer(e) {
    const r = tlSvg.getBoundingClientRect();
    const vbx = (e.clientX - r.left) / r.width * 1000;
    const x = clamp((vbx - TL.x0) / (TL.x1 - TL.x0), 0, 0.999);
    lab.T = Math.floor(lab.T) + x;
    setPlaying(false);
    drawLab();
  }
  let tlDrag = false;
  tlSvg.addEventListener('pointerdown', e => { tlDrag = true; tlSvg.setPointerCapture(e.pointerId); tlPointer(e); });
  tlSvg.addEventListener('pointermove', e => { if (tlDrag) tlPointer(e); });
  tlSvg.addEventListener('pointerup', () => tlDrag = false);

  // ---------- info panel ----------
  function updateInfo(st) {
    const cards = C.cards(st, labParams());
    const body = C.body(st, labParams());
    const cardKey = cards.map(c => c.phase.id).join('|');
    const key = [cardKey, JSON.stringify(body), lab.mistake].join('|');
    if (key === lab.lastInfo) return;
    const phaseChanged = !lab.lastInfo.startsWith(cardKey + '|');
    lab.lastInfo = key;
    if (phaseChanged || !$('#info-arms').innerHTML) {
      $('#info-arms').innerHTML = cards.map(c => `
        <div class="arm-card" style="--c:${c.color}">
          <div class="arm-head"><span class="dot" style="background:${c.phase.color}"></span><span class="arm-nm" style="color:${c.color}">${c.title}</span><span class="arm-ph">${c.phase.name}</span></div>
          <p>${c.desc}</p>
          <ul>${c.cues.map(x => `<li>${x}</li>`).join('')}</ul>
        </div>`).join('');
    }
    $('#info-body').innerHTML = body.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('');
    const mk = C.mistakes.find(m => m.id === lab.mistake);
    $('#info-mistake').innerHTML = mk ? `<div class="mk-card"><h4>${t.simulating} ${mk.title}</h4><p><b>${t.why}</b> ${mk.why}</p><p><b>${t.fix}</b> ${mk.fix}</p><p class="muted">${t.ghostHint}</p></div>` : '';
  }

  // ---------- controls ----------
  function setPlaying(p) { lab.playing = p; $('#btn-play').textContent = p ? t.pause : t.play; }
  $('#btn-play').onclick = () => setPlaying(!lab.playing);
  const stepTo = dir => {
    setPlaying(false);
    const c = Math.floor(lab.T), x = lab.T - c, eps = 0.002;
    if (dir > 0) { const n = STEPS.find(s => s > x + eps); lab.T = n !== undefined ? c + n : c + 1 + STEPS[0]; }
    else { const n = [...STEPS].reverse().find(s => s < x - eps); lab.T = n !== undefined ? c + n : c - 1 + STEPS[STEPS.length - 1]; }
    drawLab();
  };
  $('#btn-prev').onclick = () => stepTo(-1);
  $('#btn-next').onclick = () => stepTo(1);
  $('#btn-back').onclick = () => { setPlaying(false); lab.T -= 0.01; drawLab(); };
  $('#btn-fwd').onclick = () => { setPlaying(false); lab.T += 0.01; drawLab(); };
  $('#scrub').oninput = e => { setPlaying(false); lab.T = Math.floor(lab.T) + e.target.value / 1000; drawLab(); };
  $('#speed').onchange = e => lab.speed = +e.target.value;
  ctrlEls.forEach(el => el.onchange = () => { lab.ctrl[el.dataset.param] = parseVal(el.value); drawLab(); });
  $('#mistake').onchange = e => { lab.mistake = e.target.value; drawLab(); };
  for (const k of ['labels', 'vectors', 'ghost', 'bubbles']) $(`#opt-${k}`).onchange = e => { lab.show[k] = e.target.checked; drawLab(); };
  for (const el of $$('[data-viewtoggle]')) el.onchange = e => {
    const k = el.dataset.viewtoggle;
    lab.views[k] = e.target.checked; $(`#lab .view[data-view="${k}"]`).hidden = !e.target.checked; labResize(); drawLab();
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
  $$('[data-fig]').forEach(el => { const cfg = C.figs[el.dataset.fig]; if (cfg) mountFig(el, cfg); });

  // filmstrip
  let filmView = C.views[0];
  const film = $('#film');
  if (film) {
    film.innerHTML = C.film.map((f, i) => `
      <figure class="frame" data-i="${i}">
        <div class="frame-fig"></div>
        <figcaption><span class="num">${i + 1}</span>${f.cap}</figcaption>
        <button class="link" data-film="${i}">${t.openLab}</button>
      </figure>`).join('');
    const filmFigs = $$('.frame-fig', film);
    const drawFilm = () => filmFigs.forEach((el, i) => {
      const v = R.VIEWS[filmView];
      el.innerHTML = `<svg viewBox="0 0 ${v.w} ${v.h}">${R.scene(filmView, C.film[i].T, { params: C.filmParams, labels: false, vectors: true, bubbles: false, fs: 22 }).svg}</svg>`;
    });
    $$('[data-filmview]').forEach(b => b.onclick = () => {
      filmView = b.dataset.filmview; $$('[data-filmview]').forEach(x => x.classList.toggle('on', x === b)); drawFilm();
    });
    $$('[data-film]').forEach(b => b.onclick = () => gotoLab(C.film[+b.dataset.film].T, 'none'));
    drawFilm();
  }

  // mistakes
  $('#mistakes-grid').innerHTML = C.mistakes.map(m => `
    <article class="card mistake">
      <h3>${m.title}</h3>
      <div class="pair">
        <div class="fig bad" data-mfig="${m.id}" data-variant="bad"></div>
        <div class="fig good" data-mfig="${m.id}" data-variant="good"></div>
      </div>
      <p><b class="bad-t">${t.why}</b> ${m.why}</p>
      <p><b class="good-t">${t.fix}</b> ${m.fix}</p>
      <p class="muted"><b>${t.drills}</b> ${m.drill}</p>
      <button class="btn small" data-mk="${m.id}">${t.simulate}</button>
    </article>`).join('');
  $$('[data-mfig]').forEach(el => {
    const m = C.mistakes.find(x => x.id === el.dataset.mfig);
    const bad = el.dataset.variant === 'bad';
    mountFig(el, { view: m.view, loop: m.loop, speed: 0.3, label: bad ? t.badLabel : t.goodLabel, bubbles: false, ...C.mistakeFig(m, bad) });
  });
  $$('[data-mk]').forEach(b => b.onclick = () => { gotoLab(C.mistakeLabT ?? 0.3, b.dataset.mk); setPlaying(true); });

  // drills
  $('#drills-list').innerHTML = C.drills.map((d, i) => `
    <li class="card drill">
      <div class="drill-num">${i + 1}</div>
      <div class="fig" data-dfig="${d.id}" data-view="${d.view}"></div>
      <div class="drill-txt">
        <h3>${d.name} <span class="goal">${d.goal}</span></h3>
        <p>${d.how}</p>
        <p class="focal">🎯 ${d.focal}</p>
      </div>
    </li>`).join('');
  $$('[data-dfig]').forEach(el => mountFig(el, C.drillFig(C.drills.find(x => x.id === el.dataset.dfig))));

  // checklist
  const saved = JSON.parse(localStorage.getItem(C.checklistKey) || '{}');
  $('#checklist').innerHTML = Object.entries(C.checklist).map(([grp, items]) => `
    <div class="ck-group"><h4>${grp}</h4>${items.map((it, i) => {
      const id = `${grp}-${i}`;
      return `<label class="ck"><input type="checkbox" data-ck="${id}" ${saved[id] ? 'checked' : ''}><span>${it}</span></label>`;
    }).join('')}</div>`).join('');
  const ckCount = () => { const all = $$('[data-ck]'); $('#ck-count').textContent = t.felt(all.filter(c => c.checked).length, all.length); };
  $$('[data-ck]').forEach(c => c.onchange = () => { saved[c.dataset.ck] = c.checked; localStorage.setItem(C.checklistKey, JSON.stringify(saved)); ckCount(); });
  $('#ck-reset').onclick = () => { $$('[data-ck]').forEach(c => c.checked = false); localStorage.removeItem(C.checklistKey); for (const k in saved) delete saved[k]; ckCount(); };
  ckCount();

  // ======================= LOOP =======================
  labResize();
  const ro = new ResizeObserver(() => { labResize(); figs.forEach(f => f.resize()); if (!lab.playing) drawLab(); });
  ro.observe(document.body);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (lab.playing) { lab.T += dt * lab.speed / cycleDur(); drawLab(); }
    for (const f of figs) f.tick(dt);
    requestAnimationFrame(frame);
  }
  drawLab();
  requestAnimationFrame(frame);
})();
