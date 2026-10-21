/* TT Tile Link: the rules, with no drawing, so they run in node too (tools/check.js).
   A board is rows x cols tiles with an empty ring round it (the border): a link may run through the ring.
   Cells are numbered in that padded grid: index = r * W + c, with W = cols + 2 and r from 0 to rows + 1.
   A cell holds -1 (empty) or the tile's kind (0, 1, 2 ... the game picks a picture for each kind).
   - path(b, a, z): the link between two cells, through empty cells only, turning at most twice. It returns the
     corner points [a, ..., z] (the fewest turns, then the shortest), or null.
   - canLink(b, a, z): two different tiles of the same kind with a path between them.
   - solve(b): a list of links that clears the whole board, or null (stuck, or it gave up looking).
   - generate(spec, rand): a new board that solve() can clear. A deal that can't be cleared is dealt again.
   - settle(b, rand): the same tiles, reshuffled until solve() can clear them (the shuffle button and a dead end).
   - build(): a board made by taking linkable pairs off a full one, so it can always be cleared (the last resort).
   TL.rules.sabotage plants one bug, for the check that proves the check can fail (js/check.js). */
(function (root) {
  'use strict';
  const TL = (root.TL = root.TL || {});

  // A seeded random number generator (mulberry32), so a race deals both players the same board.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function make(rows, cols) {
    const W = cols + 2, H = rows + 2;
    return { rows, cols, W, H, cells: new Array(W * H).fill(-1) };
  }
  const clone = (b) => ({ rows: b.rows, cols: b.cols, W: b.W, H: b.H, cells: b.cells.slice() });
  const at = (b, r, c) => r * b.W + c;
  const rc = (b, i) => [Math.floor(i / b.W), i % b.W];
  const tiles = (b) => b.cells.reduce((n, k) => n + (k >= 0 ? 1 : 0), 0);
  const isTile = (b, i) => i >= 0 && i < b.cells.length && b.cells[i] >= 0;

  // A board from rows of text, for tests: '.' is empty, any other letter a tile (A is kind 0, B kind 1 ...).
  function parse(lines) {
    const b = make(lines.length, lines[0].length);
    lines.forEach((row, r) => [...row].forEach((ch, c) => {
      b.cells[at(b, r + 1, c + 1)] = ch === '.' ? -1 : ch.charCodeAt(0) - 65;
    }));
    return b;
  }

  // ---------------------------------------------------------------- the link

  // (r, c) is inside the padded grid and empty
  function free(b, r, c) {
    if (TL.rules.sabotage === 'noBorder' && (r === 0 || c === 0 || r === b.H - 1 || c === b.W - 1)) return false;
    return r >= 0 && c >= 0 && r < b.H && c < b.W && b.cells[r * b.W + c] === -1;
  }
  // every cell strictly between (r1, c1) and (r2, c2), on one row or one column, is empty
  function clear(b, r1, c1, r2, c2) {
    if (TL.rules.sabotage === 'ghost') return r1 === r2 || c1 === c2;
    if (r1 === r2) {
      const s = c1 < c2 ? 1 : -1;
      for (let c = c1 + s; c !== c2 && c1 !== c2; c += s) if (!free(b, r1, c)) return false;
      return true;
    }
    if (c1 === c2) {
      const s = r1 < r2 ? 1 : -1;
      for (let r = r1 + s; r !== r2; r += s) if (!free(b, r, c1)) return false;
      return true;
    }
    return false;
  }
  const dist = (r1, c1, r2, c2) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

  // The way from a to z: [a, z] straight, [a, q, z] with one turn, [a, p, q, z] with two; null if it would take
  // more. Only the cells in between have to be empty (a and z themselves may hold anything: build() uses that).
  function path(b, a, z) {
    if (a === z) return null;
    const [ar, ac] = rc(b, a), [zr, zc] = rc(b, z);
    if ((ar === zr || ac === zc) && clear(b, ar, ac, zr, zc)) return [a, z];
    let best = null, bestLen = Infinity;
    // one turn, at the corner (ar, zc) or (zr, ac)
    for (const [qr, qc] of [[ar, zc], [zr, ac]]) {
      const q = at(b, qr, qc);
      if (q === a || q === z || !free(b, qr, qc)) continue;
      if (clear(b, ar, ac, qr, qc) && clear(b, qr, qc, zr, zc)) {
        const len = dist(ar, ac, qr, qc) + dist(qr, qc, zr, zc);
        if (len < bestLen) [best, bestLen] = [[a, q, z], len];
      }
    }
    if (best) return best;
    // two turns: out from a along its row or column to an empty p, across to q on z's row or column, then in to z
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      for (let pr = ar + dr, pc = ac + dc; free(b, pr, pc); pr += dr, pc += dc) {
        const [qr, qc] = dr === 0 ? [zr, pc] : [pr, zc];
        const q = at(b, qr, qc);
        if (q === z || (qr === pr && qc === pc) || !free(b, qr, qc)) continue;
        if (clear(b, pr, pc, qr, qc) && clear(b, qr, qc, zr, zc)) {
          const len = dist(ar, ac, pr, pc) + dist(pr, pc, qr, qc) + dist(qr, qc, zr, zc);
          if (len < bestLen) [best, bestLen] = [[a, at(b, pr, pc), q, z], len];
        }
      }
    }
    if (best || TL.rules.sabotage !== 'threeTurns') return best;
    // the planted bug: a third turn allowed (out from a, then any two-turn way from there)
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      for (let pr = ar + dr, pc = ac + dc; free(b, pr, pc); pr += dr, pc += dc) {
        const p = at(b, pr, pc);
        TL.rules.sabotage = '';
        const rest = p === z ? null : path(b, p, z);
        TL.rules.sabotage = 'threeTurns';
        if (rest) return [a, ...rest];
      }
    }
    return null;
  }
  const turns = (p) => (p ? p.length - 2 : -1);

  function canLink(b, a, z) {
    if (a === z || !isTile(b, a) || !isTile(b, z) || b.cells[a] !== b.cells[z]) return null;
    return path(b, a, z);
  }

  // where each kind's tiles are: Map kind -> [cells]
  function byKind(b) {
    const m = new Map();
    b.cells.forEach((k, i) => {
      if (k < 0) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(i);
    });
    return m;
  }

  // Every pair that can be linked right now (or the first `limit` of them).
  function moves(b, limit = Infinity) {
    const out = [];
    for (const list of byKind(b).values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (path(b, list[i], list[j])) {
            out.push([list[i], list[j]]);
            if (out.length >= limit) return out;
          }
        }
      }
    }
    return out;
  }
  const hasMove = (b) => moves(b, 1).length > 0;

  function remove(b, a, z) {
    b.cells[a] = -1;
    b.cells[z] = -1;
  }

  // ---------------------------------------------------------------- can the whole board be cleared?

  // A depth-first search for links that clear the board. Removing tiles only ever opens paths, so linking the last
  // two tiles of a kind is always safe: those are made straight away. Only kinds with four or more tiles left
  // (which two go together?) need a choice. Returns the links, or null when stuck or past `budget` positions.
  function solve(b0, budget = 6000) {
    const b = clone(b0), out = [], dead = new Set();
    let nodes = 0;
    const OUT = {};
    function rec() {
      if (++nodes > budget) throw OUT;
      const made = [];
      for (let again = true; again;) {
        again = false;
        for (const list of byKind(b).values()) {
          if (list.length === 2 && path(b, list[0], list[1])) {
            made.push([list[0], list[1], b.cells[list[0]]]);
            out.push([list[0], list[1]]);
            remove(b, list[0], list[1]);
            again = true;
          }
        }
      }
      const undo = () => {
        for (const [a, z, k] of made.reverse()) {
          b.cells[a] = b.cells[z] = k;
          out.pop();
        }
      };
      if (tiles(b) === 0) return true;
      const key = b.cells.join(',');
      if (!dead.has(key)) {
        for (const [a, z] of moves(b)) {
          const k = b.cells[a];
          remove(b, a, z);
          out.push([a, z]);
          if (rec()) return true;
          out.pop();
          b.cells[a] = b.cells[z] = k;
        }
        dead.add(key);
      }
      undo();
      return false;
    }
    try {
      return rec() ? out : null;
    } catch (e) {
      if (e === OUT) return null;
      throw e;
    }
  }

  // ---------------------------------------------------------------- making boards

  // The cells a level fills, in the padded grid (always an even number of them). Shapes: full, ring (a hole in
  // the middle), split (an empty column down the middle), diamond.
  function layout(rows, cols, shape = 'full') {
    const out = [];
    const mr = (rows - 1) / 2, mc = (cols - 1) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let on = true;
        if (shape === 'ring') on = !(Math.abs(r - mr) < rows / 5 && Math.abs(c - mc) < cols / 5);
        else if (shape === 'split') on = c !== Math.floor(cols / 2);
        else if (shape === 'diamond') on = Math.abs(r - mr) / (rows / 2) + Math.abs(c - mc) / (cols / 2) <= 1.2;
        if (on) out.push((r + 1) * (cols + 2) + c + 1);
      }
    }
    if (out.length % 2) {
      // an odd count: leave out the cell nearest the middle
      let best = 0, bd = Infinity;
      out.forEach((i, n) => {
        const r = Math.floor(i / (cols + 2)) - 1, c = (i % (cols + 2)) - 1;
        const d = Math.abs(r - mr) + Math.abs(c - mc);
        if (d < bd) [best, bd] = [n, d];
      });
      out.splice(best, 1);
    }
    return out;
  }

  // the kinds for n tiles from `kinds` pictures: pairs, as even a spread as can be
  function kindsFor(n, kinds) {
    const out = [];
    for (let p = 0; p < n / 2; p++) out.push(p % kinds, p % kinds);
    if (TL.rules.sabotage === 'oddDeal' && out.length > 2) out[out.length - 1] = (out[out.length - 1] + 1) % kinds; // a tile with no partner
    return out;
  }

  // Deal the kinds onto the cells at random.
  function deal(rows, cols, cells, kinds, rand) {
    const b = make(rows, cols);
    const ks = shuffled(kinds, rand);
    cells.forEach((i, n) => (b.cells[i] = ks[n]));
    return b;
  }

  // The sure way, used when dealing keeps failing: start with every cell full and take off two cells that could be
  // linked (ignoring the pictures), again and again, giving each pair taken off the same picture. Taking them off
  // in that order clears the board. Two cells can always be taken off: the topmost tile links over the top border
  // with the top tile of any other column, and tiles all in one column link round the side.
  function build(rows, cols, cells, kinds, rand) {
    // every kind comes in an even number, so sorted they pair off: one entry per pair
    const pairs = shuffled(kinds.slice().sort((x, y) => x - y).filter((k, i) => i % 2 === 0), rand);
    const b = make(rows, cols), out = make(rows, cols);
    for (const i of cells) b.cells[i] = 0;
    let left = shuffled(cells, rand);
    for (const k of pairs) {
      let done = false;
      for (const x of left) {
        const zs = left.filter((z) => z !== x && path(b, x, z));
        if (!zs.length) continue;
        const z = zs[Math.floor(rand() * zs.length)];
        out.cells[x] = out.cells[z] = k;
        b.cells[x] = b.cells[z] = -1;
        left = left.filter((y) => y !== x && y !== z);
        done = true;
        break;
      }
      if (!done) return null;
    }
    return out;
  }

  // The same tiles on the same cells, mixed up until they can all be cleared (and at least one link is there).
  // A board that's fine already is kept unless `force` (the shuffle button always mixes).
  function settle(b, rand, force = false) {
    const cells = [], kinds = [];
    b.cells.forEach((k, i) => {
      if (k >= 0) {
        cells.push(i);
        kinds.push(k);
      }
    });
    if (!cells.length) return { board: clone(b), tries: 0, how: 'empty' };
    if (!force && (TL.rules.sabotage === 'noReshuffle' || solve(b))) return { board: clone(b), tries: 0, how: 'kept' };
    for (let tries = 1; tries <= 30; tries++) {
      const nb = deal(b.rows, b.cols, cells, kinds, rand);
      if (TL.rules.sabotage === 'noReshuffle' || solve(nb, 3000)) return { board: nb, tries, how: 'shuffled' };
    }
    const built = build(b.rows, b.cols, cells, kinds, rand);
    return { board: built || deal(b.rows, b.cols, cells, kinds, rand), tries: 31, how: built ? 'built' : 'failed' };
  }

  // A new board for spec { rows, cols, kinds, shape }: dealt at random, dealt again until it can be cleared.
  function generate(spec, rand) {
    const cells = layout(spec.rows, spec.cols, spec.shape);
    const kinds = kindsFor(cells.length, Math.max(1, Math.min(spec.kinds, cells.length / 2)));
    const first = deal(spec.rows, spec.cols, cells, kinds, rand);
    const out = settle(first, rand);
    out.firstOk = out.how === 'kept';
    return out;
  }

  // A good link to show (your brother's help, the CPU's move): the first step of a way to clear the board, or
  // any link at all when no full clear was found.
  function hint(b) {
    const s = solve(b, 2500);
    if (s && s.length) return s[0];
    const m = moves(b, 1);
    return m.length ? m[0] : null;
  }

  // ---------------------------------------------------------------- levels

  // [rows, cols, kinds, shape] for each level, wide (rows <= cols). A tall screen turns the board on its side.
  const LEVELS = {
    easy: [[3, 4, 4, 'full'], [4, 4, 5, 'full'], [4, 5, 6, 'full'], [4, 6, 7, 'full'], [5, 6, 8, 'ring'], [6, 6, 9, 'full'], [6, 7, 10, 'split'], [6, 8, 10, 'full']],
    normal: [[5, 6, 9, 'full'], [6, 8, 11, 'full'], [6, 9, 12, 'split'], [7, 10, 14, 'ring'], [8, 10, 15, 'full'], [8, 12, 16, 'diamond'], [8, 12, 18, 'ring'], [8, 12, 20, 'full']],
  };
  const SHAPES = ['full', 'ring', 'split', 'diamond'];
  function level(diff, n) {
    const list = LEVELS[diff] || LEVELS.easy;
    const i = Math.max(0, n - 1);
    const [rows, cols, kinds, shape] = list[Math.min(i, list.length - 1)];
    // past the last level: the biggest board again, in turn with each shape
    return { rows, cols, kinds, shape: i < list.length ? shape : SHAPES[(i - list.length) % SHAPES.length], n };
  }
  // the race: one board each, the same for both
  const RACE = { easy: { rows: 4, cols: 4, kinds: 5, shape: 'full' }, normal: { rows: 5, cols: 6, kinds: 9, shape: 'full' } };

  TL.rules = {
    rng, shuffled, make, clone, parse, at, rc, tiles, isTile, free, path, turns, canLink, byKind, moves, hasMove, remove,
    solve, layout, kindsFor, deal, build, settle, generate, hint, level, LEVELS, RACE, sabotage: '',
  };
})(typeof window !== 'undefined' ? window : globalThis);
