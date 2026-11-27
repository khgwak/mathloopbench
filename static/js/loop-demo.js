document.addEventListener('DOMContentLoaded', function () {
  var root = document.getElementById('loop-demo');
  if (!root) return;

  var NS = 'http://www.w3.org/2000/svg';
  var BUDGET = 50, TRAVEL = 900;
  var SEEDS = ['Def 1', 'Axiom 1'];
  var DETAIL_ATTEMPTS = 4;
  var FF_FAILS = { 5: 'prover', 8: 'verifier', 11: 'prover', 14: 'prover', 17: 'verifier', 20: 'prover' };
  var FF_CONJ = [];
  for (var n = 4; n <= 22; n++) FF_CONJ.push({ n: n, fail: FF_FAILS[n] });
  var FF_CYCLE = 380;
  var REJECTED = ['Theorem 12', 'Theorem 19'];
  var MATCHES = [['Theorem 1', 0, 0], ['Theorem 6', 0, 2], ['Theorem 10', 1, 0],
    ['Theorem 13', 1, 2], ['Theorem 22', 2, 1]];
  var N_TARGETS = 9;

  var STEPS = [
    { stage: 0, kind: 'conj', round: 1, item: 'Conjecture 1', uses: ['Def 1', 'Axiom 1'], dur: 1800,
      cap: 'Round 1: the conjecturer proposes Conjecture 1, a statement not yet known to be true. The loop never sees the hidden targets.' },
    { stage: 1, kind: 'prove', round: 1, item: 'Conjecture 1', dur: 1500,
      cap: 'The prover writes a Lean proof of Conjecture 1. Every proving call costs one attempt from the budget.' },
    { stage: 2, kind: 'verify', round: 1, item: 'Conjecture 1', thm: 'Theorem 1', dur: 1500,
      cap: 'Lean checks the proof and accepts it: Conjecture 1 becomes Theorem 1.' },
    { stage: 3, kind: 'grow', round: 1, item: 'Conjecture 1', thm: 'Theorem 1', dur: 1400,
      cap: 'Theorem 1 joins the library, so later rounds can build on it.' },
    { stage: 0, kind: 'conj', round: 2, item: 'Conjecture 2', uses: ['Axiom 1'], dur: 1400,
      cap: 'Round 2: the conjecturer proposes Conjecture 2.' },
    { stage: 1, kind: 'fail', round: 2, item: 'Conjecture 2', dur: 2700,
      cap: 'The prover finds no proof, even after a repair turn. With no proof, Conjecture 2 is not added to the library, but both turns still count as attempts.' },
    { stage: 0, kind: 'conj', round: 3, item: 'Conjecture 3', uses: ['Theorem 1'], dur: 1500,
      cap: 'Round 3: building on Theorem 1, the conjecturer proposes Conjecture 3.' },
    { stage: 1, kind: 'prove', round: 3, item: 'Conjecture 3', dur: 1400,
      cap: 'The prover writes a proof of Conjecture 3 that uses Theorem 1.' },
    { stage: 2, kind: 'reject', round: 3, item: 'Conjecture 3', dur: 2200,
      cap: 'Lean rejects the proof. Conjecture 3 is not added to the library, but the attempt still counts.' },
    { stage: 4, kind: 'ff', dur: FF_CYCLE * FF_CONJ.length + 300,
      cap: 'The loop keeps running, round after round, until the proof budget is spent. Some conjectures fail along the way and are dropped.' },
    { stage: 5, kind: 'reveal', dur: 2000,
      cap: 'The budget is spent and the library is submitted. It is then compared with the hidden targets.' },
    { stage: 5, kind: 'replay', dur: 2600,
      cap: 'The scorer does not trust the loop\'s own checks: it replays the library in Lean and discards theorems that fail or rely on sorry or axioms outside the seed.' },
    { stage: 5, kind: 'match', dur: 4600,
      cap: 'A target counts as recovered when a library theorem matches it, either exactly or after a small fixed rewrite that Lean checks.' },
    { stage: 5, kind: 'curve', dur: 5500,
      cap: 'The fraction of targets recovered after b attempts is the recovery curve R(b). The final recall is its value at the full budget: here 5 of 9.' }
  ];
  var T = 0;
  STEPS.forEach(function (s) { s.t0 = T; T += s.dur; });
  function stepOf(kind, round) {
    return STEPS.filter(function (s) { return s.kind === kind && (round === undefined || s.round === round); })[0];
  }
  var FF = stepOf('ff'), REVEAL = stepOf('reveal'), REPLAY = stepOf('replay');
  var MATCH = stepOf('match'), CURVE = stepOf('curve');

  var attemptTimes = [];
  STEPS.forEach(function (s) {
    if (s.kind === 'prove') attemptTimes.push(s.t0 + TRAVEL);
    if (s.kind === 'fail') attemptTimes.push(s.t0 + TRAVEL, s.t0 + TRAVEL + 900);
  });
  var LIB = SEEDS.map(function (n) { return { name: n, at: -1, attempt: 0 }; });
  var GROW1 = stepOf('grow', 1);
  LIB.push({ name: GROW1.thm, at: GROW1.t0 + TRAVEL, attempt: 1 });
  FF_CONJ.forEach(function (c, i) {
    c.start = FF.t0 + i * FF_CYCLE;
    if (c.fail) return;
    var at = c.start + FF_CYCLE * .85;
    LIB.push({ name: 'Theorem ' + c.n, at: at,
      attempt: DETAIL_ATTEMPTS + Math.round((BUDGET - DETAIL_ATTEMPTS) * (at - FF.t0) / FF.dur) });
  });
  LIB.forEach(function (it, i) {
    it.check = REPLAY.t0 + 200 + i * (REPLAY.dur - 600) / LIB.length;
    it.rejected = REJECTED.indexOf(it.name) >= 0;
  });
  var byName = {};
  LIB.forEach(function (it, i) { it.index = i; byName[it.name] = it; });
  MATCHES.forEach(function (m, k) {
    m.start = MATCH.t0 + 200 + k * 850;
    m.done = m.start + 450;
    byName[m[0]].match = m;
  });

  var LAYOUTS = {
    wide: {
      view: [960, 400],
      agents: { conj: [40, 20, 230, 80], prover: [40, 160, 230, 80], verifier: [40, 300, 230, 80] },
      left: [20, 78, 270, 244],
      library: [320, 20, 410, 360],
      chip: function (i) { return [335 + (i % 3) * 132, 62 + Math.floor(i / 3) * 52, 118, 34]; },
      cell: function (l, j) { return [80 + j * 66, 130 + l * 62, 60, 48]; },
      levelX: 47, cellNames: true,
      arrows: { context: [[320, 60], [270, 60]], conj: [[155, 100], [155, 160]],
        prove: [[155, 240], [155, 300]], grow: [[270, 340], [320, 340]] },
      attempts: [760, 48, 180], badge: [760, 136, 'start'], recall: [760, 186, 'start'],
      plot: [760, 205, 180, 165]
    },
    narrow: {
      view: [400, 650],
      agents: { conj: [10, 20, 170, 80], prover: [10, 160, 170, 80], verifier: [10, 300, 170, 80] },
      left: [10, 78, 180, 244],
      library: [200, 20, 190, 360],
      chip: function (i) { return [208 + (i % 2) * 92, 60 + Math.floor(i / 2) * 38, 84, 30]; },
      cell: function (l, j) { return [52 + j * 44, 130 + l * 62, 38, 48]; },
      levelX: 30, cellNames: false, tokenScale: .9,
      arrows: { context: [[200, 60], [180, 60]], conj: [[95, 100], [95, 160]],
        prove: [[95, 240], [95, 300]], grow: [[180, 340], [200, 340]] },
      attempts: [10, 415, 380], badge: [390, 415, 'end'], recall: [390, 447, 'end'],
      plot: [10, 475, 380, 160]
    }
  };

  var svg = document.getElementById('loop-svg');
  var caption = document.getElementById('loop-caption');
  var iterLabel = document.getElementById('loop-iter');
  var stageButtons = root.querySelectorAll('.loop-stages button');
  var playButton = document.getElementById('loop-play');
  var narrowQuery = window.matchMedia('(max-width: 600px)');

  var L, R, time = 0, playing = true, visible = false, last = null, shownStep = -1;

  function el(tag, attrs, parent, text) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }
  function rect(parent, r, attrs) {
    return el('rect', Object.assign({ x: r[0], y: r[1], width: r[2], height: r[3] }, attrs || {}), parent);
  }
  function chip(parent, r, cls) {
    var g = el('g', { 'class': 'chip ' + cls }, parent);
    rect(g, r, { rx: 8 });
    var text = el('text', { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 + 5 }, g);
    return { g: g, text: text };
  }
  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function ease(x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function mid(r, dy) { return [r[0] + r[2] / 2, r[1] + (dy === undefined ? r[3] / 2 : dy)]; }
  function agentPos(k) { return mid(L.agents[k], 58); }
  function pointAlong(pts, f) {
    var lens = [], total = 0, i;
    for (i = 1; i < pts.length; i++) {
      var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(d); total += d;
    }
    var target = f * total;
    for (i = 0; i < lens.length; i++) {
      if (target <= lens[i] || i === lens.length - 1) {
        var u = lens[i] ? clamp(target / lens[i]) : 1;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
      }
      target -= lens[i];
    }
    return pts[pts.length - 1];
  }

  function build() {
    L = narrowQuery.matches ? LAYOUTS.narrow : LAYOUTS.wide;
    svg.setAttribute('viewBox', '0 0 ' + L.view[0] + ' ' + L.view[1]);
    svg.classList.toggle('is-narrow', narrowQuery.matches);
    svg.innerHTML = '';
    svg.setAttribute('text-anchor', 'middle');
    R = { arrows: {}, agents: {}, chips: [], cells: [], lines: [] };

    var defs = el('defs', {}, svg);
    ['idle', 'active'].forEach(function (kind) {
      var m = el('marker', { id: 'loop-head-' + kind, viewBox: '0 0 10 10', refX: 8, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', 'class': 'head-' + kind }, m);
    });

    R.loop = el('g', { 'class': 'loop-scene' }, svg);
    Object.keys(L.arrows).forEach(function (k) {
      var p = L.arrows[k];
      var path = el('path', { d: 'M' + p[0] + ' L' + p[1], 'class': 'arrow' }, R.loop);
      var dots = [0, 1, 2].map(function () { return el('circle', { r: 3.5, 'class': 'particle' }, R.loop); });
      R.arrows[k] = { path: path, dots: dots, pts: p };
    });
    var names = { conj: 'Conjecturer', prover: 'Prover', verifier: 'Verifier (Lean)' };
    Object.keys(L.agents).forEach(function (k) {
      var g = el('g', { 'class': 'agent agent-' + k }, R.loop);
      var r = L.agents[k];
      rect(g, r, { rx: 12 });
      el('text', { x: r[0] + r[2] / 2, y: r[1] + 28, 'class': 'node-label' }, g, names[k]);
      R.agents[k] = g;
    });
    R.ffDot = el('circle', { r: 7, 'class': 'ff-dot' }, R.loop);
    R.ffX = el('text', { 'class': 'ff-x' }, R.loop, '✗');

    R.score = el('g', { 'class': 'score-scene' }, svg);
    var lr = L.left;
    rect(R.score, lr, { rx: 12, 'class': 'targets-panel' });
    el('text', { x: lr[0] + lr[2] / 2, y: lr[1] + 28, 'class': 'node-label' }, R.score,
      L.cellNames ? 'Hidden targets' : 'Targets');
    var lib = L.library;
    rect(svg, lib, { rx: 12, 'class': 'library-panel' });
    el('text', { x: lib[0] + lib[2] / 2, y: lib[1] + 28, 'class': 'node-label' }, svg, 'Library');

    var gapX = (lr[0] + lr[2] + lib[0]) / 2;
    var chip0 = L.chip(0), perRow = 1;
    while (L.chip(perRow)[1] === chip0[1]) perRow++;
    var chipGap = L.chip(perRow)[1] - chip0[1] - chip0[3];
    var cell00 = L.cell(0, 0), cellGap = L.cell(1, 0)[1] - cell00[1] - cell00[3];
    MATCHES.forEach(function (m, k) {
      var i = byName[m[0]].index, a = L.chip(i), b = L.cell(m[1], m[2]), gx = gapX + (k - 2) * 3;
      var pts;
      if (i % perRow === 0) pts = [[a[0], a[1] + a[3] / 2]];
      else {
        var ax = a[0] + a[2] / 2, ay = a[1] + a[3] + chipGap / 2;
        pts = [[ax, a[1] + a[3]], [ax, ay]];
      }
      pts.push([gx, pts[pts.length - 1][1]]);
      if (m[2] === 2) pts.push([gx, b[1] + b[3] / 2], [b[0] + b[2], b[1] + b[3] / 2]);
      else {
        var bx = b[0] + b[2] / 2, by = b[1] - cellGap / 2;
        pts.push([gx, by], [bx, by], [bx, b[1]]);
      }
      var len = 0;
      for (var p = 1; p < pts.length; p++) {
        len += Math.abs(pts[p][0] - pts[p - 1][0]) + Math.abs(pts[p][1] - pts[p - 1][1]);
      }
      var line = el('path', { d: 'M' + pts.join(' L'), 'class': 'match-line' }, svg);
      line.setAttribute('stroke-dasharray', len);
      R.lines.push({ line: line, len: len, m: m });
    });

    R.cellLayer = el('g', { 'class': 'score-scene' }, svg);
    for (var l = 0; l < 3; l++) {
      var c0 = L.cell(l, 0);
      el('text', { x: L.levelX, y: c0[1] + c0[3] / 2 + 5, 'class': 'level-label' }, R.cellLayer, 'L' + (l + 1));
      for (var j = 0; j < 3; j++) {
        var cr = L.cell(l, j), cell = chip(R.cellLayer, cr, 'target-cell');
        cell.key = l + ',' + j;
        cell.text.textContent = (L.cellNames ? 'Target ' : 'T') + (l * 3 + j + 1);
        R.cells.push(cell);
      }
    }

    LIB.forEach(function (it, i) {
      var c = chip(svg, L.chip(i), 'lib-chip' + (it.at < 0 ? ' is-seed' : ''));
      c.text.textContent = it.name;
      R.chips.push(c);
    });

    var a = L.attempts;
    el('text', { x: a[0], y: a[1], 'text-anchor': 'start', 'class': 'side-label' }, svg, 'Proof attempts');
    R.attempts = el('text', { x: a[0], y: a[1] + 30, 'text-anchor': 'start', 'class': 'side-value' }, svg);
    rect(svg, [a[0], a[1] + 42, a[2], 8], { rx: 4, 'class': 'bar-track' });
    R.bar = rect(svg, [a[0], a[1] + 42, 0, 8], { rx: 4, 'class': 'bar-fill' });
    R.barW = a[2];
    R.badge = el('text', { x: L.badge[0], y: L.badge[1], 'text-anchor': L.badge[2], 'class': 'ff-badge' }, svg,
      '▶▶ fast-forward');
    R.recall = el('text', { x: L.recall[0], y: L.recall[1], 'text-anchor': L.recall[2], 'class': 'side-value' }, svg);

    var pr = L.plot;
    R.plot = el('g', { 'class': 'plot' }, svg);
    var ox = pr[0] + 34, oy = pr[1] + pr[3] - 24, w = pr[2] - 44, h = pr[3] - 40;
    R.plotBox = { ox: ox, oy: oy, w: w, h: h };
    el('path', { d: 'M' + ox + ',' + (oy - h) + ' V' + oy + ' H' + (ox + w), 'class': 'plot-axis' }, R.plot);
    el('text', { x: ox - 6, y: oy - h + 10, 'class': 'plot-tick', 'text-anchor': 'end' }, R.plot, '9/9');
    el('text', { x: ox - 6, y: oy + 4, 'class': 'plot-tick', 'text-anchor': 'end' }, R.plot, '0');
    el('text', { x: ox + w, y: oy + 18, 'class': 'plot-tick', 'text-anchor': 'end' }, R.plot, '50');
    el('text', { x: ox + w / 2, y: oy + 18, 'class': 'plot-tick' }, R.plot, 'attempts b');
    el('text', { x: ox + 6, y: oy - h + 2, 'class': 'plot-title', 'text-anchor': 'start' }, R.plot, 'R(b)');
    R.drops = MATCHES.map(function (m) { return byName[m[0]].attempt; })
      .sort(function (x, y) { return x - y; })
      .map(function (b, k) {
        var x = ox + w * b / BUDGET, nearEnd = x + 14 > ox + w;
        var g = el('g', {}, R.plot);
        el('line', { x1: x, y1: oy - h * k / N_TARGETS, x2: x, y2: oy, 'class': 'plot-drop' }, g);
        el('text', { x: nearEnd ? x - 2 : x + 2, y: oy - 3, 'class': 'plot-step',
          'text-anchor': nearEnd ? 'end' : 'start' }, g, String(b));
        return { b: b, g: g };
      });
    R.curve = el('path', { 'class': 'plot-curve' }, R.plot);

    R.token = el('g', { 'class': 'token' }, svg);
    R.tokenProof = el('g', {}, R.token);
    rect(R.tokenProof, [22, -15, 64, 30], { rx: 8 });
    R.tokenProofText = el('text', { x: 54, y: 5 }, R.tokenProof);
    R.tokenMain = el('g', {}, R.token);
    rect(R.tokenMain, [-52, -15, 104, 30], { rx: 8 });
    R.tokenText = el('text', { x: 0, y: 5 }, R.tokenMain);
  }

  function currentStep() {
    for (var i = STEPS.length - 1; i >= 0; i--) if (time >= STEPS[i].t0) return i;
    return 0;
  }

  function draw() {
    var si = currentStep(), s = STEPS[si], u = time - s.t0;

    if (si !== shownStep) {
      shownStep = si;
      caption.textContent = s.cap;
      iterLabel.textContent = s.round ? 'Round ' + s.round : (s.kind === 'ff' ? 'Fast-forward' : 'After the run');
      stageButtons.forEach(function (b) {
        var k = +b.dataset.stage;
        b.setAttribute('aria-pressed', k === s.stage);
        b.classList.toggle('is-done', k < s.stage);
        b.classList.toggle('is-failed', (s.kind === 'fail' || s.kind === 'reject') && k === s.stage);
        b.disabled = (s.round === 2 && (k === 2 || k === 3)) || (s.round === 3 && k === 3);
      });
    }
    var pressed = root.querySelector('.loop-stages button[aria-pressed="true"]');
    if (pressed) pressed.style.setProperty('--p', 100 * clamp(u / s.dur) + '%');

    var loopOp = 1 - clamp((time - REVEAL.t0) / 600);
    var scoreOp = clamp((time - REVEAL.t0 - 300) / 700);
    R.loop.style.opacity = loopOp;
    R.loop.style.display = loopOp > 0 ? '' : 'none';
    R.score.style.opacity = scoreOp;
    R.score.setAttribute('transform', 'translate(' + (-24 * (1 - scoreOp)) + ',0)');
    R.score.style.display = scoreOp > 0 ? '' : 'none';
    R.cellLayer.style.opacity = scoreOp;
    R.cellLayer.setAttribute('transform', R.score.getAttribute('transform'));
    R.cellLayer.style.display = R.score.style.display;
    R.plot.style.opacity = scoreOp;
    R.recall.style.opacity = scoreOp;

    var attempts = BUDGET;
    if (time < FF.t0) attempts = attemptTimes.filter(function (t) { return t <= time; }).length;
    else if (s === FF) attempts = DETAIL_ATTEMPTS + Math.round((BUDGET - DETAIL_ATTEMPTS) * u / s.dur);
    R.attempts.textContent = attempts + ' / ' + BUDGET;
    R.bar.setAttribute('width', R.barW * attempts / BUDGET);
    R.badge.style.opacity = s === FF ? .55 + .45 * Math.sin(u / 150) : 0;

    LIB.forEach(function (it, i) {
      var c = R.chips[i], cl = c.g.classList;
      c.g.style.visibility = time >= it.at ? 'visible' : 'hidden';
      cl.toggle('is-used', s.kind === 'conj' && s.uses.indexOf(it.name) >= 0);
      cl.toggle('is-new', it.at >= 0 && time >= it.at && time < it.at + 700);
      cl.toggle('is-checking', time >= it.check && time < it.check + 260);
      cl.toggle('is-rejected', it.rejected && time >= it.check);
      cl.toggle('is-matched', !!it.match && time >= it.match.done);
    });

    var recovered = 0;
    R.lines.forEach(function (ln) {
      var p = clamp((time - ln.m.start) / (ln.m.done - ln.m.start));
      ln.line.style.visibility = p > 0 ? 'visible' : 'hidden';
      ln.line.setAttribute('stroke-dashoffset', ln.len * (1 - p));
      if (time >= ln.m.done) recovered++;
    });
    R.cells.forEach(function (c) {
      var m = MATCHES.filter(function (x) { return x[1] + ',' + x[2] === c.key; })[0];
      c.g.classList.toggle('is-lit', !!(m && time >= m.done));
    });
    R.recall.textContent = 'Recall ' + recovered + ' / ' + N_TARGETS;

    var bMax = BUDGET * clamp((time - CURVE.t0) / 2200);
    var pb = R.plotBox, pts = [], level = 0;
    var steps = MATCHES.map(function (m) { return byName[m[0]].attempt; }).sort(function (x, y) { return x - y; });
    function px(b, r) { return (pb.ox + pb.w * b / BUDGET) + ',' + (pb.oy - pb.h * r / N_TARGETS); }
    if (bMax > 0) {
      pts.push(px(0, 0));
      steps.forEach(function (b) {
        if (b <= bMax) { pts.push(px(b, level)); level++; pts.push(px(b, level)); }
      });
      pts.push(px(bMax, level));
    }
    R.curve.setAttribute('d', pts.length ? 'M' + pts.join(' L') : '');
    R.drops.forEach(function (d) { d.g.style.visibility = bMax > 0 && d.b <= bMax ? 'visible' : 'hidden'; });

    var active = { conj: 'context', prove: 'conj', fail: 'conj', verify: 'prove', reject: 'prove', grow: 'grow' }[s.kind];
    Object.keys(R.arrows).forEach(function (k) {
      var a = R.arrows[k], on = s === FF || k === active;
      a.path.classList.toggle('is-active', on);
      a.path.setAttribute('marker-end', 'url(#loop-head-' + (on ? 'active' : 'idle') + ')');
      var speed = s === FF ? 250 : (on ? 700 : 2600);
      a.dots.forEach(function (d, i) {
        var f = ((time / speed) + i / a.dots.length) % 1, p = pointAlong(a.pts, f);
        d.setAttribute('cx', p[0]);
        d.setAttribute('cy', p[1]);
        d.setAttribute('class', 'particle' + (on ? ' is-active' : ''));
        d.style.opacity = (on ? 1 : .35) * Math.sin(Math.PI * f);
      });
    });
    var activeAgent = { conj: 'conj', prove: 'prover', fail: 'prover', verify: 'verifier', reject: 'verifier' }[s.kind];
    if (s.kind === 'prove' || s.kind === 'verify' || s.kind === 'fail' || s.kind === 'reject') {
      if (u < TRAVEL) activeAgent = s.kind === 'verify' || s.kind === 'reject' ? 'prover' : 'conj';
    }
    Object.keys(R.agents).forEach(function (k) {
      R.agents[k].classList.toggle('is-active', k === activeAgent || s === FF);
      R.agents[k].classList.toggle('is-failed', u > TRAVEL + 300 &&
        ((s.kind === 'fail' && k === 'prover') || (s.kind === 'reject' && k === 'verifier')));
    });

    var ffOp = 0, ffX = 0;
    if (s === FF) {
      var ci = Math.min(FF_CONJ.length - 1, Math.floor(u / FF_CYCLE)), c = FF_CONJ[ci];
      var lp = [agentPos('conj'), agentPos('prover'), agentPos('verifier'), L.arrows.grow[0], L.arrows.grow[1]];
      var f = clamp((time - c.start) / (FF_CYCLE * .85)), stopAt = 1;
      if (c.fail) stopAt = c.fail === 'prover' ? 1 / 3 : 2 / 3;
      var q = c.fail ? pointAlong(lp.slice(0, c.fail === 'prover' ? 2 : 3), clamp(f / stopAt)) : pointAlong(lp, f);
      var dead = c.fail && f >= stopAt;
      var burst = dead ? clamp((time - c.start - FF_CYCLE * .85 * stopAt) / (FF_CYCLE * .5)) : 0;
      R.ffDot.setAttribute('cx', q[0]);
      R.ffDot.setAttribute('cy', q[1]);
      R.ffDot.setAttribute('r', 7 + 8 * burst);
      R.ffDot.setAttribute('class', 'ff-dot' + (dead ? ' is-failed' : ''));
      ffOp = dead ? 1 - burst : (f < 1 ? 1 : 0);
      R.ffX.setAttribute('x', q[0] + 16);
      R.ffX.setAttribute('y', q[1] - 10);
      ffX = dead ? 1 - burst * .6 : 0;
    }
    R.ffDot.style.opacity = ffOp;
    R.ffX.style.opacity = ffX;

    var route = null, label = s.item, cls = '', op = 1, dx = 0;
    var proofP = 0, proofLabel = 'Proof', proofCls = '';
    var newSlot = s.thm ? mid(L.chip(byName[s.thm].index)) : null;
    if (s.kind === 'conj') { route = [agentPos('conj')]; op = clamp((u - 300) / 400); }
    if (s.kind === 'prove' || s.kind === 'fail') {
      route = [agentPos('conj')].concat(L.arrows.conj, [agentPos('prover')]);
      proofP = clamp((u - TRAVEL - 100) / 400);
    }
    if (s.kind === 'verify' || s.kind === 'reject') {
      route = [agentPos('prover')].concat(L.arrows.prove, [agentPos('verifier')]);
      proofP = 1;
      if (s.kind === 'verify' && u >= TRAVEL + 200) {
        label = s.thm + ' ✓'; cls = 'is-proved'; proofLabel = 'Proof ✓'; proofCls = 'is-proved';
      }
    }
    if (s.kind === 'reject' && u >= TRAVEL + 300) {
      var rej = u - TRAVEL - 300;
      proofLabel = 'Proof ✗'; proofCls = 'is-failed'; cls = 'is-failed';
      dx = rej < 500 ? Math.sin(rej / 25) * 6 * (1 - rej / 500) : 0;
      op = 1 - clamp((rej - 600) / 400);
    }
    if (s.kind === 'grow') {
      route = [agentPos('verifier')].concat(L.arrows.grow, [newSlot]);
      label = s.thm; cls = 'is-proved'; proofP = 1; proofLabel = 'Proof ✓'; proofCls = 'is-proved';
      op = u < TRAVEL ? 1 : 0;
    }
    if (s.kind === 'fail' && u >= TRAVEL + 400) {
      var after = u - TRAVEL - 400;
      if (after < 500) {
        proofLabel = 'Proof ✗'; proofCls = 'is-failed'; dx = Math.sin(after / 25) * 6 * (1 - after / 500);
      } else if (after < 900) {
        proofLabel = 'Proof ↻'; proofP = clamp((after - 500) / 250);
      } else {
        proofLabel = 'Proof ✗'; proofCls = 'is-failed'; cls = 'is-failed';
        op = 1 - clamp((after - 1000) / 400); dx = after < 1300 ? Math.sin(after / 25) * 4 : 0;
      }
    }
    if (route) {
      var pos = route.length === 1 ? route[0] : pointAlong(route, ease(clamp(u / TRAVEL)));
      R.token.setAttribute('transform', 'translate(' + (pos[0] + dx) + ',' + pos[1] + ')' +
        (L.tokenScale ? ' scale(' + L.tokenScale + ')' : ''));
      R.tokenMain.setAttribute('transform', 'translate(' + (-34 * proofP) + ',0)');
      R.tokenText.textContent = label;
      R.tokenMain.setAttribute('class', 'token-main ' + cls);
      R.tokenProof.setAttribute('transform', 'translate(' + (-16 * (1 - proofP)) + ',0)');
      R.tokenProof.style.opacity = proofP;
      R.tokenProofText.textContent = proofLabel;
      R.tokenProof.setAttribute('class', 'token-proof ' + proofCls);
    }
    R.token.style.opacity = route ? op : 0;
  }

  function holdPoint() {
    var s = STEPS[currentStep()];
    return s.t0 + s.dur - 1;
  }

  function tick(now) {
    var dt = last === null ? 0 : Math.min(100, now - last);
    last = now;
    if (playing) {
      time += dt;
      if (time >= T) time = 0;
    } else {
      time = Math.min(time + dt, Math.max(time, holdPoint()));
    }
    draw();
    if (visible) requestAnimationFrame(tick); else last = null;
  }

  function setPlaying(on) {
    playing = on;
    playButton.innerHTML = on ? '&#10074;&#10074; Pause' : '&#9654; Play';
    caption.setAttribute('aria-live', on ? 'off' : 'polite');
  }

  function goStep(i) {
    time = STEPS[(i + STEPS.length) % STEPS.length].t0;
    draw();
  }

  playButton.addEventListener('click', function () { setPlaying(!playing); });
  document.getElementById('loop-next').addEventListener('click', function () {
    setPlaying(false);
    goStep(currentStep() + 1);
  });
  document.getElementById('loop-restart').addEventListener('click', function () { goStep(0); });
  stageButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = +b.dataset.stage, round = STEPS[currentStep()].round || 1;
      var i = STEPS.findIndex(function (s) { return s.stage === k && (k >= 4 || s.round === round); });
      if (i < 0) i = STEPS.findIndex(function (s) { return s.stage === k; });
      setPlaying(false);
      goStep(i);
    });
  });

  var thresholds = [];
  for (var q = 0; q <= 20; q++) thresholds.push(q / 20);
  new IntersectionObserver(function (entries) {
    var e = entries[0], was = visible;
    var need = 0.75 * Math.min(e.boundingClientRect.height, e.rootBounds ? e.rootBounds.height : innerHeight);
    visible = e.intersectionRect.height >= need - 1;
    if (visible && !was) requestAnimationFrame(tick);
  }, { threshold: thresholds }).observe(root);

  narrowQuery.addEventListener('change', function () { build(); shownStep = -1; draw(); });

  build();
  setPlaying(true);
  draw();
});
