// Prsa s hlavou nad vodou — obsah stránky: texty, stopy časové osy, obrázky, cvičení. Česky.
'use strict';

const CONTENT = (() => {
  const { frac, smooth, lerp, clamp } = G;
  R.COL.cap = '#f472b6'; R.COL.capLine = '#831843';
  const A0 = 1 - M.glideFrac(M.DEFAULTS); // aktivní část cyklu při dlouhém skluzu (0.65)
  const at = a => +(a * A0).toFixed(3);   // převod „aktivní fáze“ → čas cyklu T

  // ---------------- texty fází ----------------
  const ARM_TEXT = {
    out: {
      desc: 'Z natažení se ruce rozjedou od sebe, dlaně mírně ven. Jen kousek za šířku ramen, žádný velký kruh. Tohle ještě není silová fáze.',
      cues: ['Ruce těsně pod hladinou', 'Jen o něco šířeji než ramena', 'Klidně, bez trhnutí'],
    },
    in: {
      desc: 'Lokty zůstávají vysoko, předloktí a dlaně se opřou o vodu a stáhnou se dolů a dovnitř pod bradu, jako bys kreslil/a malé srdíčko. Ramena se přitom zvednou, a to je chvíle na nádech.',
      cues: ['Vysoké lokty, ruce vždy před rameny', 'Malé „srdíčko“, ne velký kruh', 'Nádech, když se ramena zvednou'],
    },
    fwd: {
      desc: 'Dlaně se setkají pod bradou a plynule vystřelí vpřed těsně pod hladinou, jako bys je strkal/a do úzké škvíry. Ústa se vracejí k hladině a paty se začínají přitahovat.',
      cues: ['Ruce u sebe, plynule vpřed', 'Pod hladinou nebo po ní, ne vysoko nad vodou', 'Hlava jde s rameny dolů, ne zvlášť'],
    },
    wait: {
      desc: 'Paže jsou natažené a čekají, až nohy dokončí kop. Tělo je dlouhé a úzké, takže kop má co posouvat.',
      cues: ['Paže natažené, ruce u sebe', 'Hlava v klidu, oči vpřed a mírně dolů', 'Nech kop, ať tě posune'],
    },
    glide: {
      desc: 'Paže i nohy jsou natažené a tělo klouže. Vydechuj ústy do vody a v duchu počítej „jedna, dva“. Skluz je odpočinek a zároveň nejlevnější rychlost.',
      cues: ['Výdech ústy do vody (bublinky)', 'Napočítej do dvou, pak další záběr', 'Krk dlouhý, brada lehce přitažená'],
    },
  };
  const LEG_TEXT = {
    rest: {
      desc: 'Nohy jsou natažené u sebe a v klidu, zatímco pracují paže. Kdyby teď kopaly, tlačily by proti záběru.',
      cues: ['Nohy u sebe, špičky natažené', 'Během záběru paží nekopej', 'Boky co nejvýš'],
    },
    draw: {
      desc: 'Paty se táhnou k hýždím. Kolena klesají jen tolik, kolik je nutné, a zůstávají zhruba na šířku boků. Přitažení je pomalé a uvolněné, je to odpočinková fáze nohou.',
      cues: ['Paty k zadku, ne kolena k bradě', 'Kolena na šířku boků', 'Pomalu a bez síly'],
    },
    turn: {
      desc: 'Chodidla se přitáhnou (špičky k holeni) a vytočí ven („kachní nohy“). Paty jsou teď širší než kolena a voda se opře o vnitřní stranu chodidel a holení.',
      cues: ['Špičky k holeni a ven', 'Paty šířeji než kolena', 'Teprve teď přijde síla'],
    },
    kick: {
      desc: 'Chodidla tlačí vodu dozadu, obloukem ven a zpět k sobě, jako švihnutí bičem. Kop dokonči propnutými koleny. Právě kop tě posouvá nejvíc.',
      cues: ['Tlač vnitřní stranou chodidel', 'Dozadu a obloukem, ne dolů', 'Rychle, ale plynule'],
    },
    close: {
      desc: 'Nohy se spojí, chodidla se natáhnou a celé tělo je v jedné linii, připravené na skluz.',
      cues: ['Dokonči kop, nohy u sebe', 'Špičky natažené', 'Hned do skluzu'],
    },
    glide: {
      desc: 'Nohy jsou natažené u sebe a odpočívají. Tělo klouže z energie kopu.',
      cues: ['Nohy u sebe, nehýbej s nimi', 'Užij si skluz', 'Další záběr až po „jedna, dva“'],
    },
  };

  const rhythmWord = st => st.gliding ? 'SKLUZ' : st.a < 0.22 ? 'ZÁBĚR' : st.a < 0.46 ? 'NÁDECH' : st.a < 0.66 ? '(příprava kopu)' : st.a < 0.94 ? 'KOP' : 'SKLUZ';

  // ---------------- chyby ----------------
  const MISTAKES = [
    { id: 'headBack', title: 'Záklon hlavy', view: 'side', loop: [0, 1],
      why: 'Vysoko zakloněná hlava přetěžuje krční páteř a bedra a stahuje boky ke dnu. Plaveš pak „do kopce“ a každé tempo je těžší.',
      fix: 'Dlouhý krk, brada lehce přitažená, oči vpřed a mírně dolů. Ústa smějí do vody, to je v pořádku. Oči a nos zůstanou nad hladinou.',
      drill: 'Kop s deskou, Počítaný skluz' },
    { id: 'together', title: 'Paže a nohy najednou', view: 'side', loop: [0, 1],
      why: 'Když kopeš během záběru, kop tlačí proti pažím, tělo se zastaví a plavání je namáhavé a trhané.',
      fix: 'Nejdřív paže (a nádech), potom nohy, potom skluz. Kop začíná, až když jsou paže skoro natažené.',
      drill: 'Počítaný skluz, Dva kopy na jeden záběr' },
    { id: 'widePull', title: 'Záběr až za ramena', view: 'below', loop: [0, 0.65],
      why: 'Ruce, které jedou až k bokům, se pak musí složitě vracet. Tělo se po každém záběru propadne a ramena se zbytečně namáhají.',
      fix: 'Ruce vždy před rameny: malé srdíčko pod bradou a hned vpřed.',
      drill: 'Paže s pullbuoyem, Sculling' },
    { id: 'noGlide', title: 'Žádný skluz', view: 'side', loop: [0, 1],
      why: 'Bez skluzu zahodíš rychlost z kopu a hned brzdíš dalším záběrem. Plavání je zbytečně rychlé a vyčerpávající.',
      fix: 'Po kopu napočítej ve skluzu „jedna, dva“. Delší skluz znamená méně temp a víc pohody.',
      drill: 'Počítaný skluz' },
    { id: 'kneesUnder', title: 'Kolena pod břicho', view: 'side', loop: [0.2, 0.62],
      why: 'Kolena přitažená pod břicho fungují jako brzdicí padák a stahují boky dolů.',
      fix: 'Paty k hýždím, kolena klesají jen málo a kyčle zůstávají otevřené.',
      drill: 'Ruce u boků, paty k prstům' },
    { id: 'pointedFeet', title: 'Natažené špičky při kopu', view: 'below', loop: [0.3, 0.65],
      why: 'Natažená chodidla vodou jen proklouznou a kop nemá do čeho tlačit. Posouvá tě hlavně skluz, ne kop.',
      fix: 'Před kopem přitáhni špičky k holeni a vytoč je ven. Tlač vnitřní stranou chodidla a holeně.',
      drill: 'Kop u zdi, Kop s deskou' },
    { id: 'screw', title: 'Nesouměrný („šroubový“) kop', view: 'below', loop: [0.3, 0.65],
      why: 'Jedna noha kope správně, druhá má špičku nataženou nebo vytočenou dovnitř. Tělo se kroutí, kop ztrácí sílu a koleno bývá přetížené.',
      fix: 'Obě chodidla přitáhni a vytoč souměrně. Kop si zkontroluj u zdi nebo na zádech, kde chodidla vidíš.',
      drill: 'Kop u zdi, Ruce u boků' },
  ];

  // ---------------- cvičení ----------------
  const wall = c => {
    const h = c.P(c.pose.armL.H), x = h[0] + 4;
    let s = `<rect x="${x}" y="${c.v.cy - 34}" width="${c.v.w - x + 400}" height="${c.v.h}" fill="#475569"/>`;
    s += `<rect x="${x - 2}" y="${c.v.cy - 38}" width="${c.v.w - x + 400}" height="8" fill="#94a3b8"/>`;
    for (let y = c.v.cy - 10; y < c.v.h; y += 26) s += `<line x1="${x}" y1="${y}" x2="${c.v.w + 400}" y2="${y}" stroke="#64748b"/>`;
    return s;
  };
  const board = c => {
    const h = c.P(c.pose.armL.H), s = c.v.s;
    return `<rect x="${h[0] - 26 * s}" y="${c.v.cy - 2 * s}" width="${36 * s}" height="${4 * s}" rx="${2 * s}" fill="#f472b6" stroke="#831843" stroke-width="1.5"/>`;
  };
  const buoy = c => {
    const a = c.pose.legL.Hp, b = c.pose.legL.K;
    const m = c.P([(a[0] * 0.55 + b[0] * 0.45), 0, (a[2] * 0.55 + b[2] * 0.45)]);
    return `<ellipse cx="${m[0]}" cy="${m[1]}" rx="${10 * c.v.s}" ry="${5.5 * c.v.s}" fill="#facc15" stroke="#854d0e" stroke-width="1.5"/>`;
  };
  const DRILLS = [
    { id: 'wall', name: 'Kop u zdi', goal: 'Tvar kopu', view: 'side',
      how: 'Drž se okraje bazénu (nebo žlábku) s nataženými pažemi, hlava nad vodou. Pomalu: paty k hýždím, špičky k holeni a ven, kop obloukem dozadu, nohy u sebe. Pauza.',
      focal: 'Paty šířeji než kolena, kop vnitřní stranou chodidel.' },
    { id: 'board', name: 'Kop s deskou', goal: 'Kop + skluz', view: 'side',
      how: 'Desku drž za přední konec, paže natažené. Hlava nad vodou je tady přirozená. Kop a pak napočítej „jedna, dva“ ve skluzu.',
      focal: 'Po každém kopu se nech dovézt.' },
    { id: 'heels', name: 'Ruce u boků, paty k prstům', goal: 'Úzká kolena', view: 'side',
      how: 'Plav kop s rukama podél těla. Při přitažení se snaž ťuknout patami do konečků prstů. Kolena přitom nesmí jít pod břicho ani do stran.',
      focal: 'Paty k zadku, kolena na šířku boků.' },
    { id: 'buoy', name: 'Paže s pullbuoyem', goal: 'Malý záběr + nádech', view: 'side',
      how: 'Pullbuoy mezi stehny, nohy v klidu. Plav jen pažemi: roztažení, srdíčko pod bradou s nádechem, vystřelení vpřed, krátký skluz.',
      focal: 'Ruce vždy před rameny, nádech při záběru dovnitř.' },
    { id: 'count', name: 'Počítaný skluz', goal: 'Rytmus', view: 'side',
      how: 'Celé plavání a v duchu si říkej: „záběr, nádech, kop, skluz, jedna, dva“. Pokud na „jedna, dva“ nezbude čas, zpomal.',
      focal: 'Nikdy paže a nohy najednou.' },
    { id: 'twoKicks', name: 'Dva kopy na jeden záběr', goal: 'Trpělivost a skluz', view: 'side',
      how: 'Jeden záběr paží, kop, skluz, a pak ještě jeden kop s nataženými pažemi a další skluz. Učí čekat s pažemi, dokud nohy nedokončí práci.',
      focal: 'Paže natažené a v klidu během druhého kopu.' },
    { id: 'scull', name: 'Sculling (vesla)', goal: 'Cit pro vodu', view: 'front',
      how: 'Paže před sebou kousek pod hladinou, dlaně jemně „kreslí“ ležatou osmičku ven a dovnitř. Nohy lehce kopou nebo jsou v pullbuoyi.',
      focal: 'Ucítit tlak vody na dlaních a předloktích.' },
    { id: 'whole', name: 'Celé plavání', goal: 'Vše dohromady', view: 'side',
      how: 'Plav v klidném tempu a vždy se soustřeď jen na JEDEN bod z kontrolního seznamu. Krátké úseky (25 m), pak odpočinek.',
      focal: 'Dlouhý krk, malé srdíčko, kop, skluz.' },
  ];
  const restLegs = { aLeg: 0 };
  const DRILL_FIGS = {
    wall: { loop: [0.25, 0.65], speed: 0.35, override: () => ({ a: 0, pitch: 4, depth: 0.5, armPh: M.GLIDE }), annotate: wall, viewBox: [10, 40, 680, 250] },
    board: { loop: [0.25, 1], speed: 0.45, override: () => ({ a: 0 }), annotate: board },
    heels: { loop: [0.25, 1], speed: 0.45, override: () => ({ a: 0, armKeys: M.ARM_SIDE }) },
    buoy: { loop: [0, 1], speed: 0.5, override: () => ({ ...restLegs }), annotate: buoy },
    count: { loop: [0, 1], speed: 0.5, labels: true },
    twoKicks: { loop: [0, 1], dur: 7, override: (time, st, T) => {
      const t = frac(T);
      if (t < 0.5) { const a = Math.min(1, t / 0.33); return { a, aLeg: a, gliding: a >= 1 }; }
      return { a: 0, aLeg: Math.min(1, 0.4 + 0.6 * (t - 0.5) / 0.3), pitch: 8, depth: -1.2 };
    } },
    scull: { view: 'front', loop: [0.8, 0.8], dur: 1, override: (time) => ({ a: frac(time * 0.7), armKeys: M.SCULL, aLeg: 0, pitch: 8, depth: -0.5 }) },
    whole: { loop: [0, 1], speed: 0.5 },
  };

  // ---------------- obrázky v anatomii ----------------
  const HEAD_BOX = [330, 10, 330, 190];
  const FIGS = {
    'head-good': { view: 'side', loop: [0, 1], speed: 0.3, viewBox: HEAD_BOX, label: 'Správně: dlouhý krk',
      annotate: c => c.callout(c.P(c.pose.head.eyes), 40, -40, 'oči nad hladinou', '#86efac')
        + c.callout(c.P(c.pose.head.mouth), 40, 40, c.st.inhaling ? 'nádech ústy' : 'ústa u hladiny', '#67e8f9')
        + c.callout(c.P(c.pose.neck[0]), -60, -50, 'krk v prodloužení zad', '#fde047') },
    'head-bad': { view: 'side', loop: [0, 1], speed: 0.3, viewBox: HEAD_BOX, label: 'Záklon hlavy', params: { headBack: true }, ghost: {},
      annotate: c => c.callout(c.P(c.pose.neck[0]), -60, -50, 'krk zalomený dozadu', '#f87171')
        + c.callout(c.P(c.pose.head.eyes), 40, -40, 'brada nahoru', '#f87171') },
    'body': { view: 'side', static: 0.8, label: 'Skluz: tělo mírně šikmo',
      annotate: c => {
        const a = c.P(c.pose.armL.H), f = c.P(c.pose.legL.F);
        return `<line x1="${a[0]}" y1="${a[1]}" x2="${f[0]}" y2="${f[1]}" stroke="#fde047" stroke-width="2" stroke-dasharray="7 6"/>`
          + c.callout(c.P(c.pose.hipC), -20, 70, 'boky níž než u kraulu → skluz je o to důležitější', '#fde047')
          + c.callout(c.P(c.pose.armL.H), -10, 55, 'paže natažené, ruce u sebe', '#38bdf8')
          + c.callout(c.P(c.pose.head.eyes), 30, -45, 'oči a nos nad vodou', '#86efac');
      } },
    'body-front': { view: 'front', static: 0.8, label: 'Zepředu: úzký profil' ,
      annotate: c => c.callout(c.P(c.pose.head.mouth), 70, 60, 'ústa těsně pod hladinou: výdech', '#38bdf8') },
    'bob-side': { view: 'side', loop: [0, 1], speed: 0.3, label: 'Houpání: ramena nahoru a dolů',
      annotate: c => {
        const sh = c.P(c.pose.armL.S), up = c.st.a > 0.2 && c.st.a < 0.5 && !c.st.gliding;
        return `<line x1="${sh[0] - 60}" y1="${c.v.cy - 5.2 * c.v.s}" x2="${sh[0] + 60}" y2="${c.v.cy - 5.2 * c.v.s}" stroke="#a78bfa" stroke-dasharray="4 4" opacity="0.6"/>`
          + c.callout(sh, -40, up ? -70 : 70, up ? 'ramena stoupají: nádech' : 'ramena klesají: skluz a výdech', '#a78bfa');
      } },
    'breath-side': { view: 'side', loop: [0, 1], speed: 0.25, viewBox: HEAD_BOX, label: 'Dech v rytmu záběru',
      annotate: c => {
        const ph = c.st.breathPh.id;
        const txt = ph === 'inhale' ? 'NÁDECH: ramena stoupají' : ph === 'lower' ? 'ústa se vracejí k hladině' : 'VÝDECH ústy do vody';
        return c.tag(c.v.cx + 20, 30, txt, ph === 'inhale' ? '#67e8f9' : '#38bdf8');
      } },
    'breath-front': { view: 'front', loop: [0, 1], speed: 0.25, label: 'Zepředu', labels: true },
    'out-front': { view: 'front', loop: [0, at(0.22)], speed: 0.15, label: 'Roztažení zepředu', vectors: true,
      annotate: c => c.callout(c.P(c.pose.armR.H), -10, 70, 'jen kousek za šířku ramen', '#fb923c') },
    'out-below': { view: 'below', loop: [0, at(0.22)], speed: 0.15, label: 'Zespodu', vectors: true, labels: true },
    'in-front': { view: 'front', loop: [at(0.18), at(0.46)], speed: 0.15, label: 'Záběr dovnitř zepředu', vectors: true,
      annotate: c => c.callout(c.P(c.pose.armL.E), 50, -40, 'loket vysoko', '#38bdf8') },
    'in-side': { view: 'side', loop: [at(0.18), at(0.46)], speed: 0.15, label: 'Z boku: nádech při záběru', vectors: true,
      annotate: c => c.callout(c.P(c.pose.armL.H), 40, 50, 'ruce stále před rameny', '#38bdf8') },
    'fwd-side': { view: 'side', loop: [at(0.4), at(0.7)], speed: 0.15, label: 'Vystřelení paží',
      annotate: c => c.callout(c.P(c.pose.armL.H), 20, 55, 'těsně pod hladinou, ruce u sebe', '#38bdf8') },
    'fwd-below': { view: 'below', loop: [at(0.4), at(0.7)], speed: 0.15, label: 'Zespodu', labels: true },
    'draw-side': { view: 'side', loop: [at(0.36), at(0.72)], speed: 0.15, label: 'Přitažení pat',
      annotate: c => c.callout(c.P(c.pose.legL.A), 10, -50, 'paty k hýždím', '#f8fafc')
        + c.callout(c.P(c.pose.legL.K), 30, 50, 'kolena jen mírně dolů', '#fde047') },
    'draw-below': { view: 'below', loop: [at(0.36), at(0.72)], speed: 0.15, label: 'Zespodu: kolena na šířku boků', labels: true },
    'kick-below': { view: 'below', loop: [at(0.6), at(1)], speed: 0.13, label: 'Bičový kop zespodu', labels: true, vectors: true },
    'kick-front': { view: 'front', loop: [at(0.6), at(1)], speed: 0.13, label: 'Bičový kop zepředu', vectors: true,
      annotate: c => c.st.legPh.id === 'turn' || c.st.legPh.id === 'kick' ? c.callout(c.P(c.pose.legR.F), -20, 40, 'chodidla ven', '#f8fafc') : '' },
    'kick-frog': { view: 'front', loop: [at(0.6), at(1)], speed: 0.13, label: 'Pro srovnání: žabí kop (širší)', params: { kick: 'frog' },
      annotate: c => c.callout(c.P(c.pose.legR.K), -20, 40, 'kolena široko', '#fde047') },
    'rhythm-side': { view: 'side', loop: [0, 1], speed: 0.3, label: 'Celý cyklus', labels: true, vectors: true,
      annotate: c => c.tag(c.v.w - 120, c.v.h - 40, rhythmWord(c.st), '#fde047') },
  };

  // ---------------- filmový pás ----------------
  const FILM = [
    { T: 0, cap: 'Začátek záběru: paže natažené, ústa ve vodě, výdech končí.' },
    { T: at(0.18), cap: 'Roztažení: ruce kousek za šířku ramen, dlaně ven.' },
    { T: at(0.34), cap: 'Záběr dovnitř: vysoké lokty, ramena stoupají, nádech.' },
    { T: at(0.45), cap: 'Ruce pod bradou, nádech končí. Paty se začínají zvedat.' },
    { T: at(0.6), cap: 'Paže vystřelují vpřed, paty se blíží k hýždím.' },
    { T: at(0.72), cap: 'Paže natažené, chodidla přitažená a vytočená ven.' },
    { T: at(0.84), cap: 'Kop: chodidla tlačí dozadu a obloukem k sobě.' },
    { T: 0.82, cap: 'Skluz: tělo dlouhé, výdech ústy do vody, „jedna, dva“.' },
  ];

  const CHECKLIST = {
    'Hlava a dech': ['Oči a nos nad hladinou, krk dlouhý', 'Brada lehce přitažená, žádný záklon', 'Nádech při záběru dovnitř', 'Výdech ústy do vody ve skluzu'],
    'Paže': ['Roztažení jen kousek za ramena', 'Vysoké lokty při záběru dovnitř', 'Ruce vždy před rameny, malé srdíčko', 'Ruce u sebe vystřelí vpřed pod hladinou'],
    'Nohy': ['Paty k hýždím, kolena na šířku boků', 'Kolena nejdou pod břicho', 'Špičky k holeni a vytočené ven', 'Kop dokončený, nohy u sebe'],
    'Rytmus': ['Záběr, nádech, kop, skluz, nikdy najednou', 'Ve skluzu napočítám „jedna, dva“', 'Plavu uvolněně, bez spěchu'],
  };

  // ---------------- časová osa ----------------
  const stepsFor = p => {
    const A = 1 - M.glideFrac({ ...M.DEFAULTS, ...p });
    const pts = [];
    for (const which of ['arms', 'legs']) for (const ph of M.phases(p, which)) pts.push(ph.a);
    pts.push(A + (1 - A) / 2);
    return [...new Set(pts.map(x => Math.round(frac(x) * 1000) / 1000))].sort((a, b) => a - b);
  };

  return {
    t: {
      pause: '❚❚ Pauza', play: '▶ Přehrát', openLab: 'Otevřít v laboratoři →', simulate: 'Simulovat v laboratoři →',
      badLabel: '✗ Chyba', goodLabel: '✓ Správně', why: 'Proč to vadí:', fix: 'Oprava:', drills: 'Cvičení:',
      simulating: '⚠ Simulace chyby:', ghostHint: 'Zapni „Duch (správný tvar)“ pro srovnání.', figPause: 'Pauza / přehrát',
      felt: (n, all) => `${n} / ${all} cítím ve vodě`,
    },
    views: ['side', 'front', 'below'],
    defaultT: at(0.34),
    mistakeLabT: 0,
    cycleDur: p => 1.7 / (1 - M.glideFrac({ ...M.DEFAULTS, ...p })),
    mistakeParams: M.MISTAKES,
    steps: stepsFor,
    tracks: p => {
      const A = 1 - M.glideFrac({ ...M.DEFAULTS, ...p });
      const hs = Array.from({ length: 101 }, (_, i) => M.shoulderHeight(i / 100, p));
      const lo = Math.min(...hs), hi = Math.max(...hs);
      return [
        { type: 'phases', label: 'Paže', phases: M.phases(p, 'arms'), minLabel: 0.06 },
        { type: 'phases', label: 'Nohy', phases: M.phases(p, 'legs'), minLabel: 0.06 },
        { type: 'phases', label: 'Dech', phases: M.phases(p, 'breath'), minLabel: 0.06 },
        { type: 'curve', label: 'Výška ramen', color: '#a78bfa', top: 'výš', bottom: 'níž',
          fn: x => { const i = Math.min(100, Math.round(x * 100)); return ((hs[i] - lo) / ((hi - lo) || 1)) * 2 - 1; } },
        { type: 'marks', label: 'Rytmus (cíl)', marks: [
          { a: 0, b: 0.22 * A, text: 'ZÁBĚR', color: '#fbbf24' },
          { a: 0.22 * A, b: 0.46 * A, text: 'NÁDECH', color: '#67e8f9' },
          { a: 0.72 * A, b: 0.94 * A, text: 'KOP', color: '#fca5a5' },
          { a: A, b: 1, text: 'SKLUZ', color: '#86efac' },
        ] },
      ];
    },
    cards: st => [
      ['Paže', st.armPh, R.COL.L.fill, ARM_TEXT],
      ['Nohy', st.legPh, '#f8fafc', LEG_TEXT],
    ].map(([title, phase, color, txt]) => ({ title, phase, color, desc: txt[phase.id].desc, cues: txt[phase.id].cues })),
    body: st => {
      const pose = STROKE.computePose(st);
      const h = pose.head;
      const eyes = h.eyes[2] > 0.5 ? 'oči nad hladinou' : 'oči u hladiny!';
      const mouth = h.mouth[2] < -0.5 ? 'ústa pod hladinou' : h.mouth[2] < 1 ? 'ústa u hladiny' : 'ústa nad vodou';
      return [
        ['Hlava', `${eyes}, ${mouth}`],
        ['Dech', st.breathPh.name],
        ['Rytmus', rhythmWord(st)],
        ['Sklon', `tělo ${Math.round(st.pitch)}° šikmo`],
      ];
    },
    figs: FIGS,
    film: FILM, filmParams: {},
    mistakes: MISTAKES,
    mistakeFig: (m, bad) => ({
      params: bad ? { ...M.MISTAKES[m.id] } : {}, labels: m.view !== 'side', sceneOpts: { minimal: true },
      ghost: bad && m.view === 'side' ? {} : undefined,
      viewBox: m.view === 'below' ? (m.id === 'widePull' ? [300, 0, 380, 300] : [20, 0, 400, 300]) : undefined,
    }),
    drills: DRILLS,
    drillFig: d => ({ view: d.view, bubbles: d.id === 'whole' || d.id === 'count', viewBox: d.view === 'side' ? [10, 30, 680, 260] : [40, 20, 300, 300], ...DRILL_FIGS[d.id] }),
    checklist: CHECKLIST, checklistKey: 'prsa-checklist-v1',
  };
})();
