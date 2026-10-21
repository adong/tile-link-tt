/* TT Tile Link: the headless check of the rules in js/rules.js. It runs in the page (game.check()) and in node
   (node tools/check.js).
   1. paths: the link rule on hand-made boards with known answers: straight, one turn, two turns, round the border,
      walled in, and one that needs three turns (so it must NOT link).
   2. versus: the rule against a second, separate search (a breadth-first search over cells and directions that
      counts turns) on random boards: the same answer for every pair of the same kind, and every path the game
      returns is real (straight lines, only empty cells in between, at most two turns, the fewest turns).
   3. boards: every generated board (each level of both levels, wide and tall, a few deals each) can be cleared: its
      clearing is replayed link by link with the second search.
   4. reshuffle: a board that can't be cleared (and a dead end with no link at all) is reshuffled into one that can,
      with the same tiles on the same cells; the shuffle button's mix and the sure builder can be cleared too.
   5. games: bots link random pairs (which can walk into dead ends) through whole games: every game ends with an
      empty board, reshuffling where it got stuck.
   TL.checkCanFail() plants each bug in turn (TL.rules.sabotage) and the check has to fail every time. */
(function (root) {
  'use strict';
  const TL = (root.TL = root.TL || {});
  const R = () => TL.rules;

  // ---------------------------------------------------------------- the second search

  // The fewest turns from cell a to cell z through empty cells (a and z aside), or Infinity. Written apart from
  // rules.path(): it walks cell to cell in a direction, and turning costs one.
  function refTurns(b, a, z) {
    if (a === z) return Infinity;
    const W = b.W, H = b.H;
    const DR = [0, 0, 1, -1], DC = [1, -1, 0, 0];
    const best = new Map();
    let answer = Infinity;
    const ar = Math.floor(a / W), ac = a % W;
    let wave = [];
    for (let d = 0; d < 4; d++) wave.push([ar, ac, d, 0, true]);
    // process states in order of turns: buckets 0..3
    const buckets = [[], [], [], []];
    for (const s of wave) buckets[0].push(s);
    for (let t = 0; t < 4; t++) {
      const q = buckets[t];
      for (let i = 0; i < q.length; i++) {
        const [r, c, d] = q[i];
        for (let d2 = 0; d2 < 4; d2++) {
          const nt = t + (d2 === d ? 0 : 1);
          const first = r === ar && c === ac;
          const tt = first ? t : nt; // leaving a: any direction is free
          if (first && d2 !== d) continue;
          if (tt > 3) continue;
          const nr = r + DR[d2], nc = c + DC[d2];
          if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
          const n = nr * W + nc;
          if (n === z) {
            answer = Math.min(answer, tt);
            continue;
          }
          if (b.cells[n] !== -1) continue;
          const key = n * 4 + d2;
          if ((best.has(key) ? best.get(key) : Infinity) <= tt) continue;
          best.set(key, tt);
          buckets[tt].push([nr, nc, d2]);
        }
      }
    }
    return answer;
  }

  // Is p a real link from a to z on b: straight lines, only empty cells in between and at the corners, <= 2 turns?
  function realPath(b, p, a, z) {
    if (!p || p[0] !== a || p[p.length - 1] !== z || p.length < 2 || p.length > 4) return false;
    const W = b.W;
    for (let i = 0; i + 1 < p.length; i++) {
      const r1 = Math.floor(p[i] / W), c1 = p[i] % W, r2 = Math.floor(p[i + 1] / W), c2 = p[i + 1] % W;
      if (p[i] === p[i + 1] || (r1 !== r2 && c1 !== c2)) return false;
      const n = Math.abs(r1 - r2) + Math.abs(c1 - c2);
      for (let k = 1; k < n; k++) {
        const r = r1 + Math.sign(r2 - r1) * k, c = c1 + Math.sign(c2 - c1) * k;
        if (b.cells[r * W + c] !== -1) return false;
      }
      if (i > 0 && b.cells[p[i]] !== -1) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- the parts

  // hand-made boards: the two A tiles are tested; expected turns, or null for "no link"
  const CASES = [
    { name: 'side by side', grid: ['AA'], want: 0 },
    { name: 'straight across a gap', grid: ['A..A'], want: 0 },
    { name: 'straight down a column', grid: ['A', '.', 'A'], want: 0 },
    { name: 'blocked in a row: round by the border', grid: ['ABA'], want: 2 },
    { name: 'an L: one turn', grid: ['A.', 'BA'], want: 1 },
    { name: 'a Z through the middle: two turns', grid: ['A.B', 'B.B', 'B.A'], want: 2 },
    { name: 'a U round the left border', grid: ['AB', 'B.', 'AB'], want: 2 },
    { name: 'needs three turns: no link', grid: ['AB.', 'B.B', '.BA'], want: null },
    { name: 'walled in: no link', grid: ['BBBBB', 'BABBB', 'BB.BB', 'BBBAB', 'BBBBB'], want: null },
    { name: 'crossed pairs: no link', grid: ['AB', 'BA'], want: null },
    { name: 'over the top border, past a tile', grid: ['A.CA', 'BBBB'], want: 2 },
    { name: 'top border U over a wall', grid: ['ACCA', 'BBBB'], want: 2 },
  ];

  function checkCases(out) {
    for (const t of CASES) {
      const b = R().parse(t.grid);
      const as = [];
      b.cells.forEach((k, i) => k === 0 && as.push(i));
      const p = R().canLink(b, as[0], as[1]);
      const got = p ? R().turns(p) : null;
      const ok = got === t.want && (p === null || realPath(b, p, as[0], as[1]));
      out.n++;
      if (!ok) out.fail.push(`path: "${t.name}" gave ${got === null ? 'no link' : got + ' turns'}, wanted ${t.want === null ? 'no link' : t.want + ' turns'}`);
    }
    // a tile can't link with itself, nor with a different picture
    const b = R().parse(['AB']);
    out.n += 2;
    if (R().canLink(b, b.W + 1, b.W + 1)) out.fail.push('path: a tile linked with itself');
    if (R().canLink(b, b.W + 1, b.W + 2)) out.fail.push('path: two different pictures linked');
  }

  function checkVersus(out, rand, boards) {
    let pairs = 0, linked = 0;
    for (let n = 0; n < boards; n++) {
      const rows = 1 + Math.floor(rand() * 6), cols = 1 + Math.floor(rand() * 8);
      const b = R().make(rows, cols);
      const dens = 0.3 + rand() * 0.65, kinds = 1 + Math.floor(rand() * 3);
      for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) if (rand() < dens) b.cells[r * b.W + c] = Math.floor(rand() * kinds);
      const byK = R().byKind(b);
      for (const list of byK.values()) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i], z = list[j];
            const p = R().canLink(b, a, z);
            const ref = refTurns(b, a, z);
            pairs++;
            out.n++;
            if (p) linked++;
            const want = ref <= 2 ? ref : null, got = p ? R().turns(p) : null;
            if (got !== want) {
              if (out.fail.length < 40) out.fail.push(`versus: ${rows}x${cols} board, cells ${a}-${z}: the game says ${got === null ? 'no link' : got + ' turns'}, the second search ${want === null ? 'no link' : want + ' turns'}`);
            } else if (p && !realPath(b, p, a, z)) {
              if (out.fail.length < 40) out.fail.push(`versus: ${rows}x${cols} board, cells ${a}-${z}: the path isn't a real link`);
            }
          }
        }
      }
    }
    out.versus = { boards, pairs, linked };
  }

  // Replay a clearing with the second search; '' if it clears the board, else what went wrong.
  function replay(b0, links) {
    const b = R().clone(b0);
    if (!links) return 'no way to clear it';
    for (const [a, z] of links) {
      if (b.cells[a] < 0 || b.cells[a] !== b.cells[z]) return `link ${a}-${z} isn't two matching tiles`;
      if (refTurns(b, a, z) > 2) return `link ${a}-${z} needs more than two turns`;
      b.cells[a] = b.cells[z] = -1;
    }
    return R().tiles(b) === 0 ? '' : `${R().tiles(b)} tiles left over`;
  }
  // the kinds on a board, counted
  function tally(b) {
    const m = {};
    b.cells.forEach((k) => k >= 0 && (m[k] = (m[k] || 0) + 1));
    return m;
  }
  const sameTiles = (b1, b2) => JSON.stringify(tally(b1)) === JSON.stringify(tally(b2)) && b1.cells.every((k, i) => (k >= 0) === (b2.cells[i] >= 0));

  function checkBoards(out, rand, deals, levels, firstFail) {
    const how = { kept: 0, shuffled: 0, built: 0, failed: 0 };
    let boards = 0;
    for (const diff of ['easy', 'normal']) {
      for (let lv = 1; lv <= levels; lv++) {
        for (const tall of [false, true]) {
          for (let d = 0; d < deals; d++) {
            const spec = Object.assign({}, R().level(diff, lv));
            if (tall) [spec.rows, spec.cols] = [spec.cols, spec.rows];
            if (d % 2) spec.kinds = Math.min(spec.kinds, 12); // the zodiac has only 12 pictures
            const g = R().generate(spec, rand);
            how[g.how] = (how[g.how] || 0) + 1;
            boards++;
            out.n++;
            const cells = R().layout(spec.rows, spec.cols, spec.shape);
            const filled = g.board.cells.reduce((n, k, i) => n + (k >= 0 ? 1 : 0), 0);
            const odd = Object.values(tally(g.board)).some((c) => c % 2);
            let why = '';
            if (filled !== cells.length || cells.some((i) => g.board.cells[i] < 0)) why = 'the tiles aren\'t on the level\'s cells';
            else if (odd) why = 'a picture without a partner';
            else why = replay(g.board, R().solve(g.board));
            if (why) out.fail.push(`boards: ${diff} level ${lv}${tall ? ' (tall)' : ''} deal ${d + 1}: ${why}`);
            if (why && firstFail) return;
          }
        }
      }
    }
    out.boards = { boards, how };
  }

  function checkReshuffle(out, rand) {
    const dead = R().parse(['AB', 'BA']);
    out.n++;
    if (R().hasMove(dead) || R().solve(dead)) out.fail.push('reshuffle: the crossed board should be a dead end');
    // a dead end, a board with links that still can't be cleared, and a big muddle
    const tests = [['dead end', dead], ['bigger muddle', R().parse(['ABCD', 'BADC', 'CDAB', 'DCBA'])], ['small', R().parse(['ABA', 'CBC'])]];
    for (let i = 0; i < 6; i++) {
      const spec = R().level(i % 2 ? 'normal' : 'easy', 2 + i);
      tests.push([`level ${2 + i} muddle`, R().deal(spec.rows, spec.cols, R().layout(spec.rows, spec.cols, spec.shape), R().kindsFor(R().layout(spec.rows, spec.cols, spec.shape).length, spec.kinds), rand)]);
    }
    let reshuffled = 0;
    for (const [name, b] of tests) {
      for (const force of [false, true]) {
        const s = R().settle(b, rand, force);
        out.n++;
        if (s.how !== 'kept') reshuffled++;
        if (!sameTiles(b, s.board)) out.fail.push(`reshuffle: "${name}" came back with different tiles`);
        const why = replay(s.board, R().solve(s.board));
        if (why) out.fail.push(`reshuffle: "${name}"${force ? ' (shuffle button)' : ''} still can't be cleared: ${why}`);
      }
    }
    // the sure builder, on each shape and size
    for (const [rows, cols, shape] of [[6, 8, 'full'], [8, 12, 'full'], [7, 10, 'ring'], [6, 9, 'split'], [12, 8, 'diamond'], [3, 4, 'full']]) {
      const cells = R().layout(rows, cols, shape), kinds = R().kindsFor(cells.length, 7);
      const b = R().build(rows, cols, cells, kinds, rand);
      out.n++;
      if (!b) out.fail.push(`reshuffle: the builder gave up on a ${shape} board`);
      else {
        const why = sameTiles(b, R().deal(rows, cols, cells, kinds, rand)) ? replay(b, R().solve(b, 50000)) : 'the wrong tiles';
        if (why) out.fail.push(`reshuffle: a built ${shape} board can't be cleared: ${why}`);
      }
    }
    out.reshuffle = { boards: tests.length, reshuffled };
  }

  function checkGames(out, rand, games) {
    let links = 0, deadEnds = 0;
    for (let g = 0; g < games; g++) {
      const spec = R().level(g % 2 ? 'normal' : 'easy', 1 + (g % 6));
      let b = R().generate(spec, rand).board;
      let guard = 0, ok = true;
      while (R().tiles(b) > 0) {
        if (++guard > 400) {
          ok = false;
          break;
        }
        const m = R().moves(b);
        if (!m.length) {
          deadEnds++;
          b = R().settle(b, rand).board;
          continue;
        }
        const [a, z] = m[Math.floor(rand() * m.length)];
        if (refTurns(b, a, z) > 2) {
          out.fail.push(`games: game ${g + 1} offered a link that needs three turns`);
          ok = false;
          break;
        }
        R().remove(b, a, z);
        links++;
      }
      out.n++;
      if (!ok && !out.fail.some((f) => f.startsWith(`games: game ${g + 1} `))) out.fail.push(`games: game ${g + 1} (${spec.rows}x${spec.cols}) never ended: stuck with ${R().tiles(b)} tiles`);
    }
    out.games = { games, links, deadEnds };
  }

  // ---------------------------------------------------------------- the check

  function check(opts = {}) {
    const t0 = Date.now();
    const rand = R().rng(opts.seed || 20261021);
    const out = { n: 0, fail: [] };
    const was = R().sabotage;
    R().sabotage = opts.sabotage || '';
    try {
      // firstFail (the can-fail run): stop at the first part that fails
      const parts = [
        () => checkCases(out),
        () => checkVersus(out, rand, opts.versus || 300),
        () => checkBoards(out, rand, opts.deals || 2, opts.levels || 9, opts.firstFail),
        () => checkReshuffle(out, rand),
        () => checkGames(out, rand, opts.games || 40),
      ];
      for (const part of parts) {
        if (opts.firstFail && out.fail.length) break;
        part();
      }
    } catch (e) {
      out.fail.push('crashed: ' + (e && e.message));
    } finally {
      R().sabotage = was;
    }
    return { ok: out.fail.length === 0, checks: out.n, failures: out.fail.slice(0, 12), failed: out.fail.length, versus: out.versus, boards: out.boards, reshuffle: out.reshuffle, games: out.games, ms: Date.now() - t0, sabotage: opts.sabotage || null };
  }

  const SABOTAGES = ['threeTurns', 'noBorder', 'ghost', 'noReshuffle', 'oddDeal'];
  // Each planted bug must make the check fail (with fewer boards, so it's quick).
  function checkCanFail(opts = {}) {
    const caught = {};
    for (const s of SABOTAGES) {
      const r = check(Object.assign({ versus: 120, deals: 1, levels: 5, games: 12, firstFail: true }, opts, { sabotage: s }));
      caught[s] = r.ok ? 'NOT CAUGHT' : `caught (${r.failed} failures, e.g. ${r.failures[0]})`;
    }
    return { ok: Object.values(caught).every((v) => v.startsWith('caught')), caught };
  }

  TL.check = check;
  TL.checkCanFail = checkCanFail;
  TL.refTurns = refTurns;
  TL.SABOTAGES = SABOTAGES;
})(typeof window !== 'undefined' ? window : globalThis);
