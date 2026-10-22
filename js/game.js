/* TT Tile Link: the menu, the game, the HUD, input and the main loop.
   Screens: home (1 player, a race or 2 players; Teddy or Tommy; the level; the tiles; the starting level), play,
   pause, the result and the story card. The title screen plays a little board by itself, in the tiles you pick.
   - 1 PLAYER: levels that grow (bigger boards, more pictures, shapes with holes). Link pairs for points, more for
     links in a row. 🐣 EASY (the default, for Tommy, 5): big tiles and no clock. 🔥 NORMAL (for Teddy, 8): a relaxed
     clock that every link tops up a little. Your best score and the furthest level are kept per player and level.
   - RACE: you and a friend (🐸 Froggy on EASY, 🦊 Foxy on NORMAL) get the same board each; the first to clear it wins.
   - 2 PLAYERS: Teddy and Tommy race on the same two boards (W A S D + Space and the arrows + Enter, or tap).
   A board with no link left reshuffles by itself; the 🔀 button (X) mixes it whenever you like. Every board and every
   shuffle can be cleared (js/rules.js). Your brother (js/buddy.js) shows you a pair and its path.
   window.game is a test hook: see the README. */
(function () {
  'use strict';
  const TL = window.TL;
  const R = TL.rules;
  const ST = TL.stage;
  const S = Kit.sound;
  const $ = (id) => document.getElementById(id);
  const { rand } = Kit.gfx;

  const KEY = 'tileLinkTT.v1';
  const ZCH = 1.4; // the boys stand this far in front of the board
  const TILT = 0.16; // and lean back a little, so we see them a bit from above
  const MIN_PX = { easy: 50, normal: 40 }; // the smallest a tile may get (pixels across): a small screen gets fewer tiles
  const CPUS = {
    easy: { id: 'froggy', emoji: '🐸', name: 'FROGGY', color: '#3fb950', think: [5.5, 8], slip: 0.25, smart: 0.5 },
    normal: { id: 'foxy', emoji: '🦊', name: 'FOXY', color: '#ff6b2c', think: [3, 4.6], slip: 0.15, smart: 0.75 },
  };
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY', foxy: 'FOXY', froggy: 'FROGGY' };
  const nameOf = (id) => NAMES[id] || String(id).toUpperCase();
  const STREAK_GAP = 4; // seconds between links that still count as "in a row"

  const prefs = Object.assign(
    { mode: 'solo', who: 'teddy', levels: { teddy: 'easy', tommy: 'easy', two: 'easy' }, theme: 'zodiac', start: {}, reached: {}, best: {} },
    load(),
  );
  const G = {
    state: 'boot', mode: 'solo', who: 'teddy', diff: 'easy', theme: 'zodiac', lv: 1, score: 0, scoreAtStart: 0, streak: 0,
    lastLink: -99, clock: 0, time: 0, timeMax: 0, timing: false, tickAt: 0, sides: null, gen: 0, timers: [], held: false, last: 0,
    keyboard: false, result: null, wide: true, demo: null, wins: [0, 0], setupKey: '', count: 0, racing: false, picks: [],
    seed: 0, pausedFrom: null, story: -1, links: 0, shuffles: 0, autoShuffles: 0, spec: null, newBest: false,
  };
  const boys = { teddy: TL.makeActor(), tommy: TL.makeActor() };
  const pilots = {};
  let ui = null, flyers = null, bursts = null, art = null, views = null, spots = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* private mode */ }
  }
  const ctxKey = () => (prefs.mode === 'two' ? 'two' : prefs.who);
  const diffNow = () => prefs.levels[ctxKey()] || 'easy';
  const bestKey = () => `${G.who}:${G.diff}`;
  const reachedNow = () => Math.max(1, prefs.reached[`${prefs.who}:${diffNow()}`] || 1);
  const startNow = () => Math.min(reachedNow(), Math.max(1, prefs.start[`${prefs.who}:${diffNow()}`] || 1));

  const theme = () => TL.THEMES[G.theme];
  const tileOf = (kind) => theme().tiles[kind % theme().tiles.length];
  // a picture's name in the language we're playing in (the toast for a link)
  const tileName = (kind) => (Kit.lang.is('zh') ? `${tileOf(kind)[2]}！` : `${tileOf(kind)[1]}!`);

  // ---------------------------------------------------------------- who's playing

  function makeSides() {
    if (G.mode === 'two') return [side('teddy', 0), side('tommy', 1)];
    if (G.mode === 'race') return [side(G.who, 0), side(CPUS[G.diff].id, 1)];
    return [side(G.who, 0)];
  }
  function side(id, ix) {
    const human = !!boys[id];
    return {
      id, ix, name: nameOf(id), human, actor: human ? boys[id] : pilots[id], view: views[ix], b: null, rand: null, sel: -1,
      cursor: -1, pairs: 0, total: 0, done: false, stuck: false, cpu: human ? null : { wait: 2, a: -1, z: -1, cfg: CPUS[G.diff] },
    };
  }
  const kid = () => G.sides && G.sides[0];

  // ---------------------------------------------------------------- layout

  // Where the boards and the boys go, in screen pixels, inside `area`.
  function arrange(area) {
    const out = { boards: [] };
    const callH = ui.callBtn.getBoundingClientRect().height || 90;
    const W = ST.W, H = ST.H;
    const two = G.state !== 'home' && G.sides && G.sides.length === 2;
    if (G.state === 'home' || G.state === 'boot' || !G.sides) {
      // the title: the little board, the player beside it
      const sideW = Math.max(70, Math.min(220, area.w * 0.27));
      out.boards.push({ x: area.x + sideW, y: area.y, w: area.w - sideW, h: area.h });
      const h = Math.min(area.h * 0.55, sideW * 1.6);
      out.L = { x: area.x + sideW * 0.5, feet: area.y + area.h * 0.86, h };
      out.B = { x: area.x + sideW * 0.85, feet: out.L.feet, h: h * 0.85 };
      return out;
    }
    if (!two) {
      if (G.wide) {
        // the boys in a strip on the left, the call button's corner kept clear on the right
        const sideW = Math.max(84, Math.min(240, area.w * 0.18));
        const rightW = Math.min(150, callH + 24);
        out.boards.push({ x: area.x + sideW, y: area.y, w: area.w - sideW - rightW, h: area.h });
        const h = Math.min(area.h * 0.5, sideW * 1.5);
        const feet = area.y + area.h * 0.94;
        out.L = { x: area.x + sideW * 0.32, feet, h };
        out.B = { x: area.x + sideW * 0.78, feet: feet + h * 0.04, h: h * 0.95 };
      } else {
        // the boys in a strip along the bottom
        const strip = Math.max(100, Math.min(200, area.h * 0.2));
        out.boards.push({ x: area.x, y: area.y, w: area.w, h: area.h - strip });
        const h = strip * 0.92, feet = area.y + area.h - 6;
        out.L = { x: area.x + area.w * 0.3, feet, h };
        out.B = { x: area.x + area.w * 0.53, feet, h: h * 0.95 };
      }
      return out;
    }
    // two boards (a race): side by side on a wide screen, one above the other on a tall one, a name tag over each
    const tagH = 30;
    if (G.wide) {
      const sideW = Math.max(64, Math.min(170, area.w * 0.11)), gap = 18;
      const w = (area.w - sideW * 2 - gap) / 2;
      out.boards.push({ x: area.x + sideW, y: area.y + tagH, w, h: area.h - tagH });
      out.boards.push({ x: area.x + sideW + w + gap, y: area.y + tagH, w, h: area.h - tagH });
      const h = Math.min(area.h * 0.42, sideW * 1.7);
      const feet = area.y + area.h * 0.92;
      out.L = { x: area.x + sideW * 0.5, feet, h };
      out.R = { x: area.x + area.w - sideW * 0.5, feet: Math.min(feet, H - callH - 30), h };
      out.B = { x: area.x + sideW + Math.min(70, w * 0.15), feet, h: h * 0.9 };
    } else {
      const strip = Math.max(90, Math.min(170, area.h * 0.16));
      const bh = (area.h - strip - tagH * 2) / 2;
      out.boards.push({ x: area.x, y: area.y + tagH, w: area.w, h: bh });
      out.boards.push({ x: area.x, y: area.y + tagH * 2 + bh, w: area.w, h: bh });
      const h = strip * 0.92, feet = area.y + area.h - 6;
      out.L = { x: area.x + area.w * 0.26, feet, h };
      out.R = { x: area.x + area.w * 0.6, feet, h };
      out.B = { x: area.x + area.w * 0.43, feet, h: h * 0.95 };
    }
    return out;
  }

  function layout() {
    ST.resize();
    TL.fx.overlay.resize();
    const W = ST.W, H = ST.H;
    G.wide = W / H >= 1.15;
    document.body.dataset.tall = G.wide ? '0' : '1';
    let area;
    if (G.state === 'home' || G.state === 'boot') {
      area = G.wide ? { x: 56, y: 10, w: W * 0.48 - 66, h: H - 20 } : { x: 56, y: 8, w: W - 64, h: H * 0.38 - 14 };
    } else {
      const top = ui.hudtop.getBoundingClientRect().bottom + 8;
      area = G.wide ? { x: 56, y: top, w: W - 56 - 10, h: H - top - 10 } : { x: 8, y: top, w: W - 16, h: H - top - 6 };
    }
    spots = arrange(area);
    views[0].fit(spots.boards[0]);
    if (spots.boards[1]) views[1].fit(spots.boards[1]);
    placeActors();
    placeTags();
  }

  // a spot in pixels -> where an actor stands in the world, and his scale (a boy is about 2.1 tall, a friend 3.4)
  function spotWorld(sp, tall = 2.1) {
    const p = ST.toWorld(sp.x, sp.feet, ZCH);
    const s = (sp.h * ST.kAt(ZCH)) / tall;
    return { x: p.x, y: p.y, z: ZCH, scale: s };
  }
  function placeActors() {
    if (!spots) return;
    const show = new Set();
    const put = (actor, sp, isPilot) => {
      const w = spotWorld(sp, isPilot ? 3.4 : 2.1);
      actor.place(w.x, w.y, w.z);
      actor.setScale(w.scale);
      actor.visible = true;
      show.add(actor);
    };
    if (G.state === 'home' || G.state === 'boot' || !G.sides) put(boys[prefs.mode === 'two' ? 'teddy' : prefs.who], spots.L);
    else {
      put(G.sides[0].actor, spots.L);
      if (G.sides[1]) put(G.sides[1].actor, spots.R, !G.sides[1].human);
    }
    for (const a of [boys.teddy, boys.tommy, ...Object.values(pilots)]) if (!show.has(a)) a.visible = false;
    TL.buddy.relayout();
  }
  const actorScale = () => (spots ? spotWorld(spots.L).scale : 1);

  // the name tags over the boards in a race
  function placeTags() {
    const two = G.state !== 'home' && G.sides && G.sides.length === 2;
    for (let i = 0; i < 2; i++) {
      const el = ui.tags[i];
      el.classList.toggle('gone', !two || G.state === 'boot');
      if (!two) continue;
      const s = G.sides[i];
      const r = s.view.screenRect();
      el.style.left = `${(r.x0 + r.x1) / 2}px`;
      el.style.top = `${r.y0 - 2}px`;
      ui.tagFaces[i].src = art[s.id];
      ui.tagNames[i].textContent = s.name;
      el.classList.toggle('tommy', s.id === 'tommy');
    }
  }

  // ---------------------------------------------------------------- timers

  function after(secs, fn) {
    G.timers.push({ t: secs, fn, gen: G.gen });
  }
  function runTimers(dt) {
    const due = [];
    for (const tm of G.timers) {
      tm.t -= dt;
      if (tm.t <= 0) due.push(tm);
    }
    if (!due.length) return;
    G.timers = G.timers.filter((tm) => tm.t > 0);
    for (const tm of due) if (tm.gen === G.gen) tm.fn();
  }

  // ---------------------------------------------------------------- a game

  // From the menu (or the test hook): a run of levels (1 player) or a race.
  function startGame(opts = {}) {
    for (const k of ['mode', 'who', 'theme']) if (opts[k]) prefs[k] = opts[k];
    if (opts.level) prefs.levels[ctxKey()] = opts.level;
    if (opts.lv) prefs.start[`${prefs.who}:${diffNow()}`] = opts.lv;
    save();
    G.mode = prefs.mode;
    G.who = G.mode === 'two' ? 'teddy' : prefs.who;
    G.diff = diffNow();
    G.theme = prefs.theme;
    G.lv = G.mode === 'solo' ? opts.lv || startNow() : 1;
    G.score = 0;
    const key = [G.mode, G.who, G.diff].join(':');
    if (key !== G.setupKey) {
      G.setupKey = key;
      G.wins = [0, 0];
    }
    startLevel(opts.seed);
  }

  // A new board: this level again (1 player) or a new race.
  function startLevel(seed) {
    G.gen++;
    G.timers = [];
    TL.highFive.cancel(); // before the players change
    TL.buddy.dismiss();
    hideOverlays();
    G.sides = makeSides();
    if (G.mode !== 'two') TL.buddy.setFor(G.who);
    for (const s of G.sides) s.actor.react('idle');
    G.state = 'play';
    G.result = null;
    G.newBest = false;
    screen('play');
    hudMode(); // before the layout: the HUD's height decides where the board goes
    views[1].visible = G.sides.length > 1;
    if (G.sides.length < 2) views[1].clear();
    layout();
    // the board: the level's size, turned on its side on a tall screen, fewer tiles if they'd get too small
    const base = G.mode === 'solo' ? R.level(G.diff, G.lv) : Object.assign({}, R.RACE[G.diff]);
    const spec = fitSpec(base, spots.boards[0], MIN_PX[G.diff]);
    G.spec = spec;
    G.seed = seed !== undefined ? seed : Math.floor(Math.random() * 1e9);
    const pr = R.rng(G.seed);
    // which pictures: as many as the level wants, picked at random from the set
    G.picks = R.shuffled([...theme().tiles.keys()], pr).slice(0, Math.min(spec.kinds, theme().tiles.length));
    spec.kinds = G.picks.length;
    const g = R.generate(spec, R.rng(G.seed + 1));
    const board = R.clone(g.board);
    board.cells = board.cells.map((k) => (k < 0 ? -1 : G.picks[k]));
    for (const s of G.sides) {
      s.b = R.clone(board); // a race: the very same board each
      s.rand = R.rng(G.seed + 17 * (s.ix + 2));
      s.total = R.tiles(board) / 2;
      s.view.setBoard(s.b, G.theme, true);
      s.view.cursor(-1);
      s.view.color = s.id === 'tommy' ? '#ff9a3c' : '#ffd400';
    }
    Object.assign(G, { scoreAtStart: G.score, streak: 0, lastLink: -99, clock: 0, links: 0, shuffles: 0, autoShuffles: 0, timing: false, racing: false, count: 0 });
    // 🔥 NORMAL, 1 player: a relaxed clock, started once the tiles are down
    G.timeMax = G.mode === 'solo' && G.diff === 'normal' ? Math.round(30 + kid().total * 3.5) : 0;
    G.time = G.timeMax;
    G.tickAt = 10;
    const dealT = R.tiles(board) * 0.022 + 0.4;
    if (G.mode === 'solo') after(dealT, () => (G.timing = G.timeMax > 0));
    else {
      // the race's count-in: 3, 2, 1, GO!
      G.count = 3;
      const tick = () => {
        if (G.count > 0) {
          setCount(String(G.count));
          TL.sfx.count(false);
          G.count--;
          after(0.75, tick);
        } else {
          setCount('GO!');
          TL.sfx.count(true);
          G.racing = true;
          after(0.8, () => setCount(''));
        }
      };
      after(Math.max(0.3, dealT - 1.6), tick);
    }
    TL.fx.overlay.clear();
    flyers.clear();
    updateHud(true);
    S.music('play');
    if (G.mode === 'solo') toast(G.lv === 1 ? 'LINK THE PAIRS!' : `LEVEL ${G.lv}`, 'name');
  }

  // Fit a level's board to a rectangle of the screen: on its side when that's taller, fewer rows or columns when the
  // tiles would get too small to tap.
  function fitSpec(base, rect, minPx) {
    let { rows, cols } = base;
    if (rect.h > rect.w * 1.05 && cols > rows) [rows, cols] = [cols, rows];
    const px = (r, c) => Math.min(rect.w / ((c + 2) * ST.PX + 0.7), rect.h / ((r + 2) * ST.PY + 0.7)) * ST.PX;
    while (px(rows, cols) < minPx && rows * cols > 12) {
      if (rect.w / ((cols + 2) * ST.PX) < rect.h / ((rows + 2) * ST.PY)) cols--;
      else rows--;
    }
    return { rows, cols, kinds: Math.min(base.kinds, Math.floor((rows * cols) / 2)), shape: base.shape, n: base.n };
  }

  function setCount(t) {
    ui.count.innerHTML = t ? `<span>${t}</span>` : '';
  }

  // ---------------------------------------------------------------- picking and linking

  const canPick = (s) => G.state === 'play' && s && s.human && !s.done && (G.mode === 'solo' || G.racing) && !s.view.busy();

  // A tile tapped (or Enter on it). The first one lifts; the second either links, swaps to it (a different
  // picture), or puts them both down (the same picture that can't be joined in two turns).
  function pick(s, i) {
    if (!canPick(s)) return 'locked';
    if (!R.isTile(s.b, i)) {
      if (s.sel >= 0) {
        s.sel = -1;
        s.view.select(-1);
        TL.sfx.drop();
      }
      return 'empty';
    }
    if (s.sel < 0) {
      s.sel = i;
      s.view.select(i);
      TL.sfx.pick();
      return 'picked';
    }
    if (s.sel === i) {
      s.sel = -1;
      s.view.select(-1);
      TL.sfx.drop();
      return 'dropped';
    }
    if (s.b.cells[s.sel] !== s.b.cells[i]) {
      s.sel = i;
      s.view.select(i);
      TL.sfx.pick();
      return 'swapped';
    }
    return tryLink(s, s.sel, i) ? 'linked' : 'nope';
  }

  function tryLink(s, a, z) {
    const p = R.canLink(s.b, a, z);
    if (!p) {
      s.view.shake([a, z]);
      s.view.select(-1);
      s.sel = -1;
      TL.sfx.nope();
      if (s.human) {
        toast('TOO MANY TURNS!', 'nope');
        G.streak = 0;
      }
      s.actor.react('oops');
      return false;
    }
    const kind = s.b.cells[a];
    R.remove(s.b, a, z);
    s.view.link(a, z, p, flyers);
    s.sel = -1;
    s.pairs++;
    G.links++;
    const mid = s.view.worldOf(p[Math.floor(p.length / 2)]);
    if (s.human) {
      if (G.mode === 'solo') {
        G.streak = G.clock - G.lastLink < STREAK_GAP ? G.streak + 1 : 1;
        G.lastLink = G.clock;
        G.score += 10 + 5 * Math.min(G.streak - 1, 5);
        if (G.timing) G.time = Math.min(G.timeMax, G.time + 1);
        if (G.streak >= 3) toast(`${G.streak} IN A ROW!`, 'streak');
      }
      TL.sfx.link(G.mode === 'solo' ? G.streak : 1);
      toast(`${tileOf(kind)[0]} ${tileName(kind)}`, 'name');
      if (G.mode === 'solo' && G.streak >= 3) bursts.add('WOW!', mid.x, mid.y, mid.z + 1, 2.2 * s.view.s);
    } else TL.sfx.theirLink();
    s.actor.react(s.actor.mode === 'signature' ? 'hop' : 'cheer');
    if (s.ix === 0) TL.buddy.cheer();
    updateHud(false, s.ix);
    if (R.tiles(s.b) === 0) {
      s.done = true;
      after(0.5, () => finish(s));
    } else if (!R.hasMove(s.b)) {
      s.stuck = true;
      after(0.7, () => reshuffle(s, false));
    }
    return true;
  }

  // Mix the tiles: the 🔀 button (force), or by itself when no link is left. It always comes back clearable.
  function reshuffle(s, force) {
    if (!s.b || s.done || G.state !== 'play') return null;
    const r = R.settle(s.b, s.rand, true);
    s.b = r.board;
    s.view.shuffle(s.b);
    s.sel = -1;
    s.stuck = false;
    if (s.cpu) s.cpu.a = -1;
    TL.sfx.shuffle();
    if (force) G.shuffles++;
    else G.autoShuffles++;
    if (s.human) toast(force ? 'SHUFFLE!' : 'NO PAIRS LEFT! SHUFFLE!', 'shuffle');
    return r.how;
  }
  function shuffleButton() {
    const s = kid();
    if (G.mode !== 'solo' || !canPick(s)) return null;
    return reshuffle(s, true);
  }

  // ---------------------------------------------------------------- the friend's moves (a race)

  function cpuUpdate(dt) {
    if (!G.racing || G.state !== 'play') return;
    for (const s of G.sides) {
      if (s.human || s.done || s.stuck || s.view.busy()) continue;
      const c = s.cpu;
      c.wait -= dt;
      if (c.wait > 0) continue;
      if (c.a < 0) {
        // pick a pair: often a good one (the way to clear the board), sometimes any link at all
        let m = null;
        if (Math.random() < c.cfg.smart) m = R.hint(s.b);
        if (!m) {
          const all = R.moves(s.b);
          m = all.length ? all[Math.floor(Math.random() * all.length)] : null;
        }
        if (!m) {
          c.wait = 0.5;
          continue;
        }
        [c.a, c.z] = m;
        s.sel = c.a;
        s.view.select(c.a);
        s.actor.act('think', 0.8);
        c.wait = 0.55;
      } else {
        if (Math.random() < c.cfg.slip) {
          // a slip: the wrong partner, so she puts them down and has another look
          const same = [];
          s.b.cells.forEach((k, i) => k === s.b.cells[c.a] && i !== c.a && !R.path(s.b, c.a, i) && same.push(i));
          if (same.length) tryLink(s, c.a, same[Math.floor(Math.random() * same.length)]);
          else {
            s.sel = -1;
            s.view.select(-1);
            s.actor.react('oops');
          }
          c.wait = rand(...c.cfg.think) * 0.5;
        } else {
          tryLink(s, c.a, c.z);
          c.wait = rand(...c.cfg.think);
        }
        c.a = -1;
      }
    }
  }

  // ---------------------------------------------------------------- the end of a level or a race

  function finish(s) {
    if (G.state !== 'play') return;
    G.state = 'over';
    G.timing = false;
    G.racing = false;
    setCount('');
    TL.buddy.dismiss();
    for (const v of views) {
      v.select(-1);
      v.cursor(-1);
    }
    if (G.mode === 'solo') {
      // the level's clear: a bonus, and the clock's seconds left (🔥 NORMAL)
      const bonus = 50 + (G.timeMax ? Math.round(G.time) : 0);
      G.score += bonus;
      const key = bestKey();
      const best = prefs.best[key] || { score: 0, level: 0 };
      G.newBest = G.score > best.score;
      prefs.best[key] = { score: Math.max(best.score, G.score), level: Math.max(best.level, G.lv) };
      prefs.reached[key] = Math.max(prefs.reached[key] || 1, G.lv + 1);
      save();
      G.result = { kind: 'clear', level: G.lv, score: G.score, bonus, best: prefs.best[key].score, newBest: G.newBest };
      s.actor.react('over');
      TL.sfx.win();
      celebrate(s);
    } else {
      const loser = G.sides[1 - s.ix];
      G.wins[s.ix]++;
      G.result = { kind: 'race', winner: s.id, loser: loser.id, wins: G.wins.slice() };
      s.actor.react('over');
      loser.actor.react('sulk');
      if (s.human) TL.sfx.win();
      else TL.sfx.lose();
      celebrate(s);
    }
    updateHud();
    after(1.6, showResult);
  }

  function timeUp() {
    if (G.state !== 'play') return;
    G.state = 'over';
    G.timing = false;
    TL.buddy.dismiss();
    views[0].select(-1);
    const s = kid();
    s.actor.react('sulk');
    TL.sfx.lose();
    G.result = { kind: 'time', level: G.lv, left: R.tiles(s.b) / 2, score: G.score };
    toast("TIME'S UP!", 'nope');
    after(1.2, showResult);
  }

  // confetti from the winner's board, and stars over him
  function celebrate(s) {
    const r = s.view.screenRect();
    TL.fx.overlay.burst((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 50, ['🀄', '🧧', '🏮', '⭐', '🎉'], 1.2);
    TL.fx.overlay.rain(110);
    const p = s.actor.root.position, k = s.actor.scale;
    for (let i = 0; i < 12; i++) flyers.add(i % 3 ? '⭐' : '🎉', p.x, p.y + 2.2 * k, p.z, rand(-2.5, 2.5) * k, rand(2, 4) * k, rand(0.4, 0.6) * k, 1.3, rand(-3, 3), 4 * k);
  }

  function showResult() {
    if (G.state !== 'over' || !G.result) return;
    const r = G.result;
    const face = (id) => `<img class="${id}" src="${art[id]}" alt="">`;
    ui.oNext.classList.toggle('gone', r.kind !== 'clear');
    ui.oAgainWord.textContent = r.kind === 'time' ? 'TRY AGAIN' : 'PLAY AGAIN';
    ui.oBest.classList.remove('new');
    if (r.kind === 'clear') {
      ui.oFace.innerHTML = face(G.who);
      ui.oTitle.textContent = `LEVEL ${r.level} CLEAR!`;
      ui.oSub.innerHTML = `<span>SCORE ${r.score}</span><span>BONUS +${r.bonus}</span>`;
      ui.oBest.textContent = r.newBest ? 'NEW BEST!' : `BEST: ${r.best}`;
      ui.oBest.classList.toggle('new', r.newBest);
    } else if (r.kind === 'race') {
      ui.oFace.innerHTML = face(r.winner);
      ui.oTitle.textContent = `${nameOf(r.winner)} WINS!`;
      ui.oSub.innerHTML = `<span>GAMES WON: ${G.sides[0].name} ${r.wins[0]} · ${G.sides[1].name} ${r.wins[1]}</span>`;
      ui.oBest.textContent = '';
    } else {
      ui.oFace.innerHTML = face(G.who);
      ui.oTitle.textContent = "TIME'S UP!";
      ui.oSub.innerHTML = `<span>PAIRS LEFT: ${r.left}</span>`;
      ui.oBest.textContent = 'THE CLOCK GETS A SECOND BACK FOR EVERY PAIR!';
    }
    show(ui.gameOver, true);
    S.music('over');
  }

  function next() {
    if (G.state !== 'over' || !G.result || G.result.kind !== 'clear') return again();
    G.lv++;
    prefs.start[bestKey()] = G.lv;
    save();
    startLevel();
  }
  // this level (or race) again, from the score it started with
  function again() {
    if (G.mode === 'solo') G.score = G.result && G.result.kind === 'clear' ? G.score - G.result.score + G.scoreAtStart : G.scoreAtStart;
    startLevel();
  }

  // ---------------------------------------------------------------- your brother

  const buddyApi = {
    get flyers() { return flyers; },
    tilt: TILT,
    scale: () => actorScale(),
    spot() {
      const w = spotWorld(spots.B);
      return { x: w.x, y: w.y, z: ZCH + 0.3 };
    },
    player: () => kid().actor,
    toast: (t, c) => toast(t, c),
    over: () => G.state !== 'play' || !G.sides || kid().done,
    canPeek: () => canPick(kid()) && !kid().stuck,
    peek() {
      const s = kid();
      const m = R.hint(s.b);
      if (!m) return null;
      const pts = R.path(s.b, m[0], m[1]);
      s.sel = -1;
      s.view.select(-1);
      s.view.hint(m, pts);
      const w = s.view.worldOf(m[0]);
      return { pair: m.slice(), emoji: tileOf(s.b.cells[m[0]])[0], dx: w.x - TL.buddy.actor.root.position.x };
    },
    players: () => (G.sides || []).map((s) => s.actor),
    meet() {
      const [a, c] = G.sides.map((s) => s.actor.root.position);
      const mid = (a.x + c.x) / 2, gap = 0.55 * actorScale();
      return [{ x: mid - gap, z: a.z }, { x: mid + gap, z: c.z }];
    },
    homes() {
      const a = spotWorld(spots.L), c = spotWorld(spots.R);
      return [{ x: a.x, y: a.y, z: ZCH }, { x: c.x, y: c.y, z: ZCH }];
    },
  };

  // T, or the face button: call your brother (1 player, a race) or a high five (2 players)
  function call() {
    if (G.state !== 'play') return 'not now';
    if (G.mode === 'two') return TL.highFive.start();
    return TL.buddy.call();
  }

  // ---------------------------------------------------------------- the title's little board

  function demoStart() {
    const spec = G.wide ? { rows: 4, cols: 5, kinds: 6, shape: 'full' } : { rows: 3, cols: 6, kinds: 6, shape: 'full' };
    const pr = R.rng(Math.floor(Math.random() * 1e9));
    const picks = R.shuffled([...TL.THEMES[prefs.theme].tiles.keys()], pr).slice(0, spec.kinds);
    const b = R.generate(spec, pr).board;
    b.cells = b.cells.map((k) => (k < 0 ? -1 : picks[k]));
    G.theme = prefs.theme;
    G.demo = { b, t: 1.4, a: -1, z: -1, rand: pr };
    views[0].setBoard(b, G.theme, true);
    views[0].color = '#ffd400';
    views[1].clear();
    views[1].visible = false;
  }
  function demoUpdate(dt) {
    const d = G.demo;
    if (!d) return;
    d.t -= dt;
    if (d.t > 0 || views[0].busy()) return;
    if (R.tiles(d.b) === 0) return demoStart();
    if (d.a < 0) {
      const m = R.hint(d.b);
      if (!m) {
        d.b = R.settle(d.b, d.rand, true).board;
        views[0].shuffle(d.b);
        d.t = 1;
        return;
      }
      [d.a, d.z] = m;
      views[0].select(d.a);
      d.t = 0.55;
    } else {
      const p = R.canLink(d.b, d.a, d.z);
      R.remove(d.b, d.a, d.z);
      views[0].link(d.a, d.z, p, flyers);
      boys[prefs.mode === 'two' ? 'teddy' : prefs.who].react('hop');
      d.a = -1;
      d.t = R.tiles(d.b) === 0 ? 1.6 : 1.1;
    }
  }

  // ---------------------------------------------------------------- screens

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }
  function hideOverlays() {
    show(ui.gameOver, false);
    show(ui.pause, false);
  }
  function screen(name) {
    document.body.dataset.screen = name;
    show(ui.home, name === 'home');
    show(ui.hud, name === 'play');
    show(ui.callBtn, name === 'play');
    if (name !== 'play') hideOverlays();
    setCount('');
  }

  function goHome() {
    G.gen++;
    G.timers = [];
    TL.highFive.cancel(); // before the players leave
    G.state = 'home';
    G.sides = null;
    G.timing = false;
    G.racing = false;
    TL.buddy.dismiss();
    screen('home');
    for (const a of [boys.teddy, boys.tommy]) a.react('idle');
    syncMenu();
    layout();
    demoStart();
    layout();
    S.music('title');
  }

  // the menu shows the picks
  function syncMenu() {
    const mark = (seg, v) => {
      for (const b of seg.children) {
        b.classList.toggle('on', b.dataset.v === v);
        b.setAttribute('aria-checked', b.dataset.v === v ? 'true' : 'false');
        b.setAttribute('role', 'radio');
      }
    };
    mark(ui.segMode, prefs.mode);
    mark(ui.segWho, prefs.who);
    mark(ui.segLevel, diffNow());
    mark(ui.segSet, prefs.theme);
    const cpu = CPUS[diffNow()];
    ui.raceEmo.textContent = cpu.emoji;
    ui.raceWord.textContent = `RACE ${cpu.name}`;
    ui.segWho.style.display = prefs.mode === 'two' ? 'none' : '';
    ui.duo.style.display = prefs.mode === 'two' ? '' : 'none';
    ui.setName.textContent = TL.THEMES[prefs.theme].name;
    const solo = prefs.mode === 'solo';
    ui.lvPick.style.display = solo ? '' : 'none';
    const lv = startNow(), top = reachedNow();
    ui.lvWord.textContent = `LEVEL ${lv}`;
    ui.lvDown.disabled = lv <= 1;
    ui.lvUp.disabled = lv >= top;
  }
  function setPref(k, v) {
    if (k === 'level') prefs.levels[ctxKey()] = v;
    else prefs[k] = v;
    save();
    syncMenu();
    if (k === 'theme' || k === 'who' || k === 'mode') {
      if (k === 'theme') demoStart();
      placeActors();
    }
    TL.sfx.pick();
  }
  function stepLevel(d) {
    const key = `${prefs.who}:${diffNow()}`;
    prefs.start[key] = Math.max(1, Math.min(reachedNow(), startNow() + d));
    save();
    syncMenu();
    TL.sfx.step();
  }

  // ---------------------------------------------------------------- the story card

  const STORY = [
    { art: '🀄 〰️ 🀄', text: 'In China this game is called Lianliankan: "link, link, look!" Find two tiles that match and join them with a line. The line may turn two times at most.' },
    { art: '👵👴🀄👩👨', text: 'The tiles look like mahjong tiles. At holidays, families in China often play mahjong together round one table while the kids watch and cheer. Click, clack!' },
    { art: '🐭🐮🐯🐰🐲🐍', text: 'Every year in China has an animal. Twelve take turns: rat, ox, tiger, rabbit, dragon, snake, horse, goat, monkey, rooster, dog and pig. 2026 is the Year of the Horse 🐴!' },
    { art: '🏮🧧🥮', text: 'Red lanterns glow at the Lantern Festival. Red envelopes bring lucky money at Spring Festival. Round mooncakes are for the round full moon at the Mid-Autumn Festival.' },
  ];
  function openStory(on) {
    if (on) {
      G.story = 0;
      drawStory();
      show(ui.story, true);
    } else {
      G.story = -1;
      show(ui.story, false);
    }
    TL.sfx.pick();
  }
  function storyTurn(d) {
    const n = G.story + d;
    if (n < 0) return;
    if (n >= STORY.length) return openStory(false);
    G.story = n;
    drawStory();
    TL.sfx.step();
  }
  function drawStory() {
    if (G.story < 0) return;
    const p = STORY[G.story];
    ui.sArt.textContent = p.art;
    ui.sText.textContent = p.text;
    ui.sDots.innerHTML = STORY.map((s, i) => `<i class="${i === G.story ? 'on' : ''}"></i>`).join('');
    ui.sPrev.style.visibility = G.story === 0 ? 'hidden' : 'visible';
  }

  // ---------------------------------------------------------------- HUD and toasts

  // which HUD pieces show: 1 player's score and shuffle (and the clock on 🔥 NORMAL), or the race's two scores
  function hudMode() {
    const solo = G.mode === 'solo';
    ui.score1.classList.toggle('gone', !solo);
    ui.score2.classList.toggle('gone', solo);
    ui.clock.classList.toggle('gone', !(solo && G.diff === 'normal'));
    ui.shuffleBtn.classList.toggle('gone', !solo);
  }

  function updateHud(fresh = false, bumped = -1) {
    if (!G.sides) return;
    const solo = G.mode === 'solo';
    if (fresh) {
      if (G.mode === 'two') {
        ui.callFace.style.display = 'none';
        ui.callBtn.setAttribute('aria-label', 'High five!');
        ui.callBtn.title = 'High five! (T)';
        ui.callEmoji.textContent = '🙌';
      } else {
        ui.callFace.style.display = '';
        ui.callFace.src = art[Kit.roster.buddyFor(G.who)];
        ui.callBtn.setAttribute('aria-label', 'Call your brother');
        ui.callBtn.title = 'Call your brother (T)';
        ui.callEmoji.textContent = '';
      }
      if (solo) ui.face1.src = art[G.who];
      else {
        ui.faceL.src = art[G.sides[0].id];
        ui.faceR.src = art[G.sides[1].id];
        ui.faceL.className = G.sides[0].id;
        ui.faceR.className = G.sides[1].human ? G.sides[1].id : 'cpu';
      }
    }
    if (solo) {
      const s = kid();
      ui.lv1.textContent = G.lv;
      ui.left1.textContent = R.tiles(s.b) / 2;
      setNum(ui.pts1, G.score, bumped === 0);
      const best = prefs.best[bestKey()];
      ui.best1.textContent = Math.max(best ? best.score : 0, G.state === 'over' ? G.score : 0);
    } else {
      setNum(ui.scoreL, G.sides[0].pairs, bumped === 0);
      setNum(ui.scoreR, G.sides[1].pairs, bumped === 1);
    }
    drawClock();
  }
  function setNum(el, v, bump) {
    if (el.textContent !== String(v)) {
      el.textContent = v;
      if (bump) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    }
  }
  function drawClock() {
    if (!G.timeMax) return;
    ui.clockBar.style.width = `${Math.max(0, (G.time / G.timeMax) * 100)}%`;
    ui.clock.classList.toggle('low', G.time <= 10);
  }

  function toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    ui.toasts.appendChild(el);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
    setTimeout(() => el.remove(), cls === 'save' ? 2900 : 2000);
  }

  // ---------------------------------------------------------------- input

  // the keyboard's frame on a side's board: arrows move it to the next tile that way
  function moveCursor(s, dr, dc) {
    if (!s || !s.b) return;
    const b = s.b;
    const inside = (r, c) => r >= 1 && c >= 1 && r <= b.rows && c <= b.cols;
    G.keyboard = true;
    let i = s.cursor;
    if (i < 0 || (!R.isTile(b, i) && !dr && !dc)) {
      i = b.cells.findIndex((k) => k >= 0);
      if (i < 0) return;
    } else if (dr || dc) {
      const r0 = Math.floor(i / b.W), c0 = i % b.W;
      let found = -1;
      // straight that way first, then the rows (or columns) beside it, nearest first
      for (let off = 0; off <= Math.max(b.rows, b.cols) && found < 0; off++) {
        for (const sgn of off ? [1, -1] : [1]) {
          for (let k = 1; found < 0; k++) {
            const r = r0 + dr * k + (dr ? 0 : off * sgn), c = c0 + dc * k + (dc ? 0 : off * sgn);
            if (!inside(r, c)) break;
            if (R.isTile(b, r * b.W + c)) found = r * b.W + c;
          }
          if (found >= 0) break;
        }
      }
      if (found >= 0) i = found;
    }
    s.cursor = i;
    s.view.cursor(i);
    TL.sfx.step();
  }
  function keyPick(s) {
    if (!s) return;
    if (!G.keyboard || s.cursor < 0 || !R.isTile(s.b, s.cursor)) return moveCursor(s, 0, 0);
    pick(s, s.cursor);
  }

  function bindInput() {
    const firstGesture = () => S.init();
    addEventListener('pointerdown', firstGesture, { capture: true });
    addEventListener('keydown', firstGesture, { capture: true });

    ui.goPlay.addEventListener('click', () => startGame({}));
    ui.storyBtn.addEventListener('click', () => openStory(true));
    for (const [seg, k] of [[ui.segMode, 'mode'], [ui.segWho, 'who'], [ui.segLevel, 'level'], [ui.segSet, 'theme']]) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) setPref(k, b.dataset.v);
      });
    }
    ui.lvDown.addEventListener('click', () => stepLevel(-1));
    ui.lvUp.addEventListener('click', () => stepLevel(1));
    ui.pauseBtn.addEventListener('click', () => pause(true));
    ui.muteBtn.addEventListener('click', toggleMute);
    ui.shuffleBtn.addEventListener('click', shuffleButton);
    ui.callBtn.addEventListener('click', call);
    ui.oNext.addEventListener('click', next);
    ui.oAgain.addEventListener('click', again);
    ui.oHome.addEventListener('click', goHome);
    ui.pResume.addEventListener('click', () => pause(false));
    ui.pRestart.addEventListener('click', () => {
      pause(false);
      again();
    });
    ui.pHome.addEventListener('click', goHome);
    ui.sPrev.addEventListener('click', () => storyTurn(-1));
    ui.sNext.addEventListener('click', () => storyTurn(1));
    ui.sClose.addEventListener('click', () => openStory(false));

    ui.canvas.addEventListener('pointerdown', (e) => {
      if (G.state !== 'play' || !G.sides) return;
      for (const s of G.sides) {
        if (!s.human || !s.view.onTray(e.clientX, e.clientY)) continue;
        G.keyboard = false;
        s.view.cursor(-1);
        s.cursor = -1;
        pick(s, s.view.cellAt(e.clientX, e.clientY));
        return;
      }
    });
    ui.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || G.state !== 'play' || !G.sides) return;
      let on = false;
      for (const s of G.sides) {
        const i = s.human ? s.view.cellAt(e.clientX, e.clientY) : -1;
        const ok = i >= 0 && R.isTile(s.b, i) && canPick(s);
        s.view.hover(ok ? i : -1);
        on = on || ok;
      }
      ui.canvas.style.cursor = on ? 'pointer' : '';
    });
    ui.canvas.addEventListener('pointerleave', () => views.forEach((v) => v.hover(-1)));

    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (Kit.help && Kit.help.isOpen && Kit.help.isOpen()) return;
      const k = e.key.toLowerCase();
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      if (k === 'm') return toggleMute();
      if (G.story >= 0) {
        if (k === 'arrowright' || k === 'd' || k === 'enter' || k === ' ') storyTurn(1);
        else if (k === 'arrowleft' || k === 'a') storyTurn(-1);
        else if (k === 'escape' || k === 'b') openStory(false);
        return;
      }
      if (G.state === 'home') {
        if (k === 'enter' || k === ' ') startGame({});
        else if (k === '1') setPref('mode', 'solo');
        else if (k === '2') setPref('mode', 'race');
        else if (k === '3') setPref('mode', 'two');
        else if (k === 'w') setPref('who', prefs.who === 'teddy' ? 'tommy' : 'teddy');
        else if (k === 'l') setPref('level', diffNow() === 'easy' ? 'normal' : 'easy');
        else if (k === 'b') openStory(true);
        else if (k === 'arrowleft' || k === 'arrowright') {
          const order = TL.THEME_ORDER, ix = order.indexOf(prefs.theme);
          setPref('theme', order[(ix + (k === 'arrowright' ? 1 : order.length - 1)) % order.length]);
        } else if ((k === 'arrowup' || k === 'arrowdown') && prefs.mode === 'solo') stepLevel(k === 'arrowup' ? 1 : -1);
        return;
      }
      if (G.state === 'paused') {
        if (k === 'escape' || k === 'p' || k === 'enter' || k === ' ') pause(false);
        else if (k === 'r') {
          pause(false);
          again();
        }
        return;
      }
      if (G.state === 'over') {
        if (!G.result || ui.gameOver.classList.contains('hidden')) return;
        if (k === 'enter' || k === ' ') next();
        else if (k === 'r') again();
        else if (k === 'escape') goHome();
        return;
      }
      if (G.state !== 'play') return;
      if (k === 'p' || k === 'escape') return pause(true);
      if (k === 't') return call();
      if (k === 'r') return again();
      if (k === 'x') return shuffleButton();
      const two = G.mode === 'two';
      const p1 = G.sides[0], p2 = two ? G.sides[1] : G.sides[0];
      const wasd = { w: [-1, 0], a: [0, -1], s: [1, 0], d: [0, 1] };
      const arrows = { arrowup: [-1, 0], arrowleft: [0, -1], arrowdown: [1, 0], arrowright: [0, 1] };
      if (wasd[k]) moveCursor(p1, ...wasd[k]);
      else if (arrows[k]) moveCursor(p2, ...arrows[k]);
      else if (k === ' ') keyPick(p1);
      else if (k === 'enter') keyPick(p2);
    });
    addEventListener('resize', layout);
    document.addEventListener('visibilitychange', () => (document.hidden ? S.suspend() : S.resume()));
    Kit.lang.onChange(() => {
      for (const v of views) v.retexture();
      syncMenu();
      drawStory();
      if (G.state === 'over') showResult();
    });
  }

  function pause(on) {
    if (on && (G.state === 'play' || G.state === 'over')) {
      G.pausedFrom = G.state;
      G.state = 'paused';
      show(ui.gameOver, false);
      show(ui.pause, true);
      S.music('pause');
    } else if (!on && G.state === 'paused') {
      G.state = G.pausedFrom || 'play';
      show(ui.pause, false);
      if (G.state === 'over' && G.result) show(ui.gameOver, true);
      S.music(G.state === 'over' ? 'over' : 'play');
    }
  }

  function toggleMute() {
    const muted = S.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- the loop

  function step(dt, draw = true) {
    dt = Math.min(dt, 0.1);
    if ((innerWidth || 1) !== ST.W || (innerHeight || 1) !== ST.H) layout();
    const running = G.state !== 'paused' && G.state !== 'boot';
    if (running) {
      if (G.state === 'home') demoUpdate(dt);
      if (G.state === 'play') {
        G.clock += dt;
        if (G.timing) {
          G.time -= dt;
          if (G.time <= G.tickAt && G.time > 0) {
            G.tickAt = Math.ceil(G.time) - 1;
            TL.sfx.tick();
          }
          if (G.time <= 0) {
            G.time = 0;
            timeUp();
          }
          drawClock();
        }
        cpuUpdate(dt);
      }
      runTimers(dt);
      for (const v of views) if (v.visible) v.update(dt);
      flyers.update(dt);
      bursts.update(dt);
      for (const a of [boys.teddy, boys.tommy, ...Object.values(pilots)]) if (a.visible) a.update(dt);
      TL.buddy.update(dt);
      TL.highFive.update(dt);
    }
    TL.fx.overlay.update(dt);
    ui.callBtn.classList.toggle('here', TL.buddy.on || TL.highFive.on);
    if (draw) ST.render();
  }

  function frame(now) {
    const dt = G.last ? (now - G.last) / 1000 : 0.016;
    G.last = now;
    if (!G.held) step(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  // a friend's face for the HUD and the result: the emoji on a round tile (the boys' come from Kit.portraits)
  function emojiFace(emoji) {
    const [c, g] = Kit.gfx.makeCanvas(160, 160);
    g.font = `112px ${Kit.gfx.EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 80, 90);
    return c.toDataURL('image/png');
  }

  function boot() {
    const ids = [
      'home', 'hud', 'logo', 'goPlay', 'storyBtn', 'segMode', 'segWho', 'segLevel', 'segSet', 'setName', 'duo', 'duoA', 'duoB', 'raceEmo',
      'raceWord', 'lvPick', 'lvDown', 'lvUp', 'lvWord', 'pauseBtn', 'muteBtn', 'shuffleBtn', 'score1', 'face1', 'lv1', 'left1', 'pts1',
      'best1', 'score2', 'faceL', 'faceR', 'scoreL', 'scoreR', 'clock', 'clockBar', 'callBtn', 'callFace', 'callEmoji', 'count', 'toasts',
      'gameOver', 'oFace', 'oTitle', 'oSub', 'oBest', 'oNext', 'oAgain', 'oHome', 'pause', 'pResume', 'pRestart', 'pHome', 'story', 'sArt',
      'sText', 'sDots', 'sPrev', 'sNext', 'sClose',
    ];
    ui = { canvas: $('game'), hudtop: document.querySelector('.hudtop') };
    for (const id of ids) ui[id] = $(id);
    ui.oAgainWord = ui.oAgain.querySelector('.word');
    ui.tags = [$('tag0'), $('tag1')];
    ui.tagFaces = [$('tagFace0'), $('tagFace1')];
    ui.tagNames = [$('tagName0'), $('tagName1')];
    // the logo: "TT" small on top, the rest big
    const words = window.TL_TITLE.split(' ');
    ui.logo.querySelector('small').textContent = words.length > 1 ? words[0] : '';
    ui.logo.querySelector('big').textContent = words.length > 1 ? words.slice(1).join(' ') : words[0];
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    ST.init(ui.canvas);
    TL.fx.overlay.init($('fx'));
    views = [ST.makeView(), ST.makeView()];
    flyers = TL.fx.flyers(ST.scene, 90);
    bursts = TL.fx.bursts(ST.scene, 6);
    for (const id of ['teddy', 'tommy']) {
      boys[id].attach(ST.scene, flyers);
      boys[id].set(id, 1);
      boys[id].root.rotation.x = TILT;
      const tag = Kit.gfx.nameTag(nameOf(id), (Kit.roster.get(id) || {}).tag || '#2f7cf0');
      tag.position.y = 2.75;
      boys[id].person.root.add(tag);
    }
    for (const c of Object.values(CPUS)) {
      const p = TL.makePilot(c.id, c.emoji, c.name, c.color);
      p.attach(ST.scene, flyers);
      p.root.rotation.x = TILT;
      p.visible = false;
      pilots[c.id] = p;
    }
    art = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 160 });
    for (const c of Object.values(CPUS)) art[c.id] = emojiFace(c.emoji);
    for (const b of ui.segWho.children) b.querySelector('img').src = art[b.dataset.v];
    ui.duoA.src = art.teddy;
    ui.duoB.src = art.tommy;
    TL.buddy.init(buddyApi);
    bindInput();
    goHome();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hook

  function info() {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width ? { x0: Math.round(r.left), y0: Math.round(r.top), x1: Math.round(r.right), y1: Math.round(r.bottom) } : null;
    };
    const sides = G.sides && G.sides.map((s) => ({
      id: s.id, human: s.human, pairs: s.pairs, total: s.total, left: R.tiles(s.b) / 2, sel: s.sel, cursor: s.cursor, done: s.done,
      stuck: s.stuck, pose: s.actor.pose, board: s.view.screenRect(), tilePx: Math.round(s.view.px),
    }));
    return {
      state: G.state, mode: G.mode, who: G.who, diff: G.diff, theme: G.theme, lv: G.lv, spec: G.spec, score: G.score, streak: G.streak,
      time: +G.time.toFixed(1), timeMax: G.timeMax, timing: G.timing, racing: G.racing, links: G.links, shuffles: G.shuffles,
      autoShuffles: G.autoShuffles, result: G.result, wins: G.wins.slice(), sides, buddy: TL.buddy.info(), story: G.story,
      panel: !ui.gameOver.classList.contains('hidden') ? 'over' : !ui.pause.classList.contains('hidden') ? 'pause' : !ui.story.classList.contains('hidden') ? 'story' : null,
      hint: views[0].hintPair && views[0].hintPair.slice(),
      kitButtons: [rect($('kit-help-btn')), rect($('kit-lang-btn')), rect($('kit-sound-btn'))],
      callBtn: rect(ui.callBtn), hud: rect(ui.hudtop), shuffleBtn: rect(ui.shuffleBtn),
    };
  }

  // play side `ix`'s board to the end with good links, `secs` of game time between them
  function clearBoard(ix = 0, secs = 0.3) {
    const s = G.sides && G.sides[ix];
    for (let guard = 0; s && guard < 400 && G.state === 'play' && R.tiles(s.b) > 0; guard++) {
      game.step(0.5);
      if (!canPick(s)) continue;
      const m = R.hint(s.b);
      if (!m) continue;
      pick(s, m[0]);
      pick(s, m[1]);
      game.step(secs);
    }
    return info();
  }

  window.game = {
    // advance `secs` of game time in 1/60 s steps, drawing only the last (works while the pane is hidden)
    step(secs = 0.1) {
      const n = Math.max(1, Math.round(secs * 60));
      for (let i = 0; i < n; i++) step(1 / 60, i === n - 1);
      return info();
    },
    hold(on = true) { G.held = on; },
    // start({ mode: 'solo' | 'race' | 'two', who: 'teddy' | 'tommy', level: 'easy' | 'normal', theme, lv, seed })
    start(opts = {}) {
      startGame(opts);
      return info();
    },
    home: () => goHome(),
    // tap a cell (padded index) on side ix's board, as a finger would
    tap: (i, ix = 0) => pick(G.sides[ix], i),
    key: (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k })),
    call: () => call(),
    shuffle: () => shuffleButton(),
    pause: (on = true) => pause(on),
    again: () => again(),
    next: () => next(),
    story: (on = true) => openStory(on),
    timeUp: () => timeUp(),
    clearBoard,
    // a good pair on side ix's board, and the cells (for scripted tests)
    hint: (ix = 0) => R.hint(G.sides[ix].b),
    cells: (ix = 0) => G.sides[ix].b.cells.slice(),
    board: (ix = 0) => G.sides[ix].b,
    screenOf: (i, ix = 0) => G.sides[ix].view.screenOf(i),
    check: (opts = {}) => TL.check(opts),
    checkCanFail: (opts = {}) => TL.checkCanFail(opts),
    info,
    get G() { return G; },
    get R() { return R; },
    get prefs() { return prefs; },
  };

  let booted = false;
  const go = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
})();
