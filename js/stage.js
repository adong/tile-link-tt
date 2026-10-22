/* TT Tile Link: the 3D table. One Three.js scene seen straight on: one board (or two, for a race) of mahjong-style
   tiles on a red lacquer tray with a gold rim, and the boys (js/actor.js) in front. The page behind is the room
   (CSS), so the canvas is see-through.
   - Layout works in screen pixels: view.fit(rect) sizes a board to fill a rectangle of the screen. The camera looks
     straight down -z, so toWorld(px, py, z) and toScreen() map the two exactly.
   - A tile: an ivory slab on a jade-green back (like a real mahjong tile), its picture painted on the front.
   - The tray covers the empty ring round the tiles too, so a link that runs round the outside shows on it.
   - TL.stage.makeView() is one board: setBoard() lays out the tiles (they drop in, one after another), select(),
     link() (the path zips along, the two tiles pop off), shake() (no link), shuffle() (every tile spins round
     and comes back as its new picture), hint() (your brother's pair and its path, glowing), cursor() (the
     keyboard's frame) and hover() (the tile under the mouse lifts a little). */
(function () {
  'use strict';
  const T = THREE;
  const TL = (window.TL = window.TL || {});
  const { makeCanvas, roundRect, toTexture, EMOJI_FONT, FONT } = Kit.gfx;

  const CW = 1, CH = 1.3, GAP = 0.06, PX = CW + GAP, PY = CH + GAP; // a tile, and the pitch of the grid
  const TD = 0.26, BD = 0.14, BEV = 0.05, BASE = BD + 3 * BEV; // the ivory part's depth, the green back's depth, the bevel; the tile's lift off the tray
  const FRONT = TD + BEV + 0.004; // where the picture sits (in front of the bevel)
  const FOV = 30, TAN = Math.tan((FOV * Math.PI) / 360), D = 60;

  const S = { W: 1, H: 1 };
  let renderer = null, scene = null, camera = null, sun = null;
  let tileGeo = null, backGeo = null, faceGeo = null, ivory = null, jade = null, glowTex = null, ringTex = null, dotTex = null;
  const faceCache = new Map();
  const views = [];

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(FOV, 1, 1, 200);
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    scene.add(new T.HemisphereLight('#fff8ee', '#d8b8a0', 0.8));
    sun = new T.DirectionalLight('#fff3e0', 0.8);
    sun.position.set(-14, 20, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 3;
    const sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 90;
    scene.add(sun);

    const shape = roundShape(CW - 2 * BEV, CH - 2 * BEV, 0.1);
    tileGeo = new T.ExtrudeGeometry(shape, { depth: TD, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 5 });
    backGeo = new T.ExtrudeGeometry(shape, { depth: BD, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 5 });
    backGeo.translate(0, 0, -BD - BEV * 2);
    const face = roundShape(CW - 0.1, CH - 0.1, 0.1);
    faceGeo = new T.ShapeGeometry(face, 5);
    const pos = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (CW - 0.1) + 0.5, pos.getY(i) / (CH - 0.1) + 0.5);
    ivory = Kit.gfx.std('#fbf3dc', { roughness: 0.38 });
    jade = Kit.gfx.std('#1f9a6a', { roughness: 0.35 });
    glowTex = makeGlow();
    ringTex = makeRing();
    dotTex = Kit.gfx.glowTexture ? Kit.gfx.glowTexture() : null;
    resize();
  }

  function roundShape(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // a soft glow, to sit behind a tile (picked: gold; your brother's pair: white-blue, tinted by the material)
  function makeGlow() {
    const [c, g] = makeCanvas(256, 320);
    g.shadowColor = 'rgba(255, 255, 255, 1)';
    g.shadowBlur = 36;
    g.fillStyle = 'rgba(255, 255, 255, 1)';
    for (let k = 0; k < 3; k++) {
      roundRect(g, 48, 52, 160, 216, 26);
      g.fill();
    }
    return toTexture(c);
  }
  // the keyboard's frame: a thick rounded ring
  function makeRing() {
    const [c, g] = makeCanvas(256, 320);
    g.lineWidth = 22;
    g.strokeStyle = '#ffffff';
    roundRect(g, 16, 16, 224, 288, 34);
    g.stroke();
    return toTexture(c);
  }

  // ---------------------------------------------------------------- the pictures

  // A tile's front: ivory, a thin coloured frame, the picture big in the middle, and in 中文 mode (zodiac and
  // 中国 tiles) the 中文 label small at the top. Drawn once per picture and language, and kept.
  function faceTexture(themeId, kind) {
    const theme = TL.THEMES[themeId];
    const tile = theme.tiles[kind % theme.tiles.length];
    const zh = theme.label && Kit.lang && Kit.lang.is('zh');
    const key = `${themeId}:${kind}:${zh ? 'zh' : 'en'}`;
    if (faceCache.has(key)) return faceCache.get(key);
    const [c, g] = makeCanvas(256, 332);
    const grad = g.createLinearGradient(0, 0, 0, 332);
    grad.addColorStop(0, '#fffaf0');
    grad.addColorStop(1, '#f6ead0');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 332);
    g.lineWidth = 7;
    g.strokeStyle = theme.accent;
    g.globalAlpha = 0.55;
    roundRect(g, 14, 14, 228, 304, 26);
    g.stroke();
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (zh) {
      const label = tile[3] || tile[2];
      g.font = `bold ${label.length > 2 ? 40 : 50}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
      g.fillStyle = '#c8241c';
      g.fillText(label, 128, 62);
    }
    g.font = `${zh ? 148 : 172}px ${EMOJI_FONT}`;
    g.fillText(tile[0], 128, zh ? 198 : 172);
    const tex = toTexture(c);
    tex.anisotropy = 4;
    faceCache.set(key, tex);
    return tex;
  }

  // The tray's top: red lacquer, lighter in the middle, a gold line inset all round with little corner knots.
  const trayCache = new Map();
  function trayTexture(w, h) {
    const key = `${w.toFixed(2)}x${h.toFixed(2)}`;
    if (trayCache.has(key)) return trayCache.get(key);
    const ppu = 48, cw = Math.round(w * ppu), ch = Math.round(h * ppu);
    const [c, g] = makeCanvas(cw, ch);
    const grad = g.createRadialGradient(cw / 2, ch * 0.45, 10, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    grad.addColorStop(0, '#c4302c');
    grad.addColorStop(1, '#8e1a1e');
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);
    // a faint diamond lattice
    g.strokeStyle = 'rgba(255, 200, 120, 0.07)';
    g.lineWidth = 2;
    for (let x = -ch; x < cw + ch; x += 28) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + ch, ch); g.stroke();
      g.beginPath(); g.moveTo(x, ch); g.lineTo(x + ch, 0); g.stroke();
    }
    // the gold inset line and corner knots
    const m = 10;
    g.strokeStyle = '#f1c453';
    g.lineWidth = 3;
    roundRect(g, m, m, cw - 2 * m, ch - 2 * m, 16);
    g.stroke();
    g.fillStyle = '#f1c453';
    for (const [x, y] of [[m, m], [cw - m, m], [m, ch - m], [cw - m, ch - m]]) {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillRect(-7, -7, 14, 14);
      g.restore();
    }
    const tex = toTexture(c);
    trayCache.set(key, tex);
    return tex;
  }

  // ---------------------------------------------------------------- the screen

  function resize() {
    if (!renderer) return;
    S.W = Math.max(1, innerWidth);
    S.H = Math.max(1, innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(S.W, S.H, false);
    camera.aspect = S.W / S.H;
    camera.updateProjectionMatrix();
  }
  // world units per pixel at depth z (in front of the board at z = 0)
  const kAt = (z = 0) => (2 * (D - z) * TAN) / S.H;
  function toWorld(px, py, z = 0) {
    const k = kAt(z);
    return new T.Vector3((px - S.W / 2) * k, (S.H / 2 - py) * k, z);
  }
  const tmpV = new T.Vector3();
  function toScreen(v) {
    tmpV.copy(v).project(camera);
    return { x: (tmpV.x + 1) * 0.5 * S.W, y: (1 - tmpV.y) * 0.5 * S.H };
  }

  // ---------------------------------------------------------------- one board

  function makeView() {
    const group = new T.Group();
    scene.add(group);
    const tray = new T.Mesh(new T.ShapeGeometry(roundShape(1, 1, 0.3), 6), new T.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 }));
    tray.receiveShadow = true;
    const rim = new T.Mesh(new T.ShapeGeometry(roundShape(1, 1, 0.4), 6), Kit.gfx.std('#d9a441', { roughness: 0.3, metalness: 0.45 }));
    rim.position.z = -0.06;
    rim.receiveShadow = true;
    group.add(rim, tray);
    // the keyboard's frame
    const cur = new T.Mesh(new T.PlaneGeometry(CW * 1.22, CH * 1.2), new T.MeshBasicMaterial({ map: ringTex, color: '#ffd400', transparent: true, depthWrite: false, depthTest: false }));
    cur.renderOrder = 30;
    cur.visible = false;
    group.add(cur);
    // the path: up to three segments and four round joints, in two colours (a link; your brother's hint)
    const paths = { link: makePath('#ffd84a', 0.2), hint: makePath('#7ff4ff', 0.17) };
    group.add(paths.link.root, paths.hint.root);

    const v = {
      group, b: null, theme: 'zodiac', tiles: new Map(), rows: 0, cols: 0, W: 0, H: 0, s: 1, px: 40, rect: null,
      sel: -1, cursorAt: -1, hoverAt: -1, hint: null, hintT: 0, linkT: 0, color: '#ffd400', t: 0,
    };
    views.push(v);

    function makePath(color, width) {
      const root = new T.Group();
      const mat = new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false });
      const glowMat = new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false, opacity: 0.35 });
      const segs = [], joints = [];
      for (let i = 0; i < 3; i++) {
        const glow = new T.Mesh(new T.PlaneGeometry(1, 1), glowMat);
        const core = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
        glow.renderOrder = 24;
        core.renderOrder = 25;
        root.add(glow, core);
        segs.push({ glow, core });
      }
      for (let i = 0; i < 4; i++) {
        const j = new T.Mesh(new T.CircleGeometry(width * 0.95, 16), mat);
        j.renderOrder = 25;
        root.add(j);
        joints.push(j);
      }
      root.visible = false;
      return { root, mat, glowMat, segs, joints, width, pts: null, grow: 1 };
    }

    // cell (padded index) -> the board's own x, y
    function local(i) {
      const r = Math.floor(i / v.W), c = i % v.W;
      return { x: (c - (v.W - 1) / 2) * PX, y: ((v.H - 1) / 2 - r) * PY };
    }

    function makeTile(i, kind) {
      const g = new T.Group();
      const lift = new T.Group();
      const body = new T.Mesh(tileGeo, ivory);
      body.castShadow = true;
      const back = new T.Mesh(backGeo, jade);
      back.castShadow = true;
      const face = new T.Mesh(faceGeo, new T.MeshStandardMaterial({ roughness: 0.4, map: faceTexture(v.theme, kind) }));
      face.position.z = FRONT;
      const glow = new T.Mesh(new T.PlaneGeometry(CW * 1.6, CH * 1.5), new T.MeshBasicMaterial({ map: glowTex, color: '#ffd400', transparent: true, depthWrite: false, opacity: 0 }));
      glow.position.z = 0.02;
      glow.renderOrder = 1;
      glow.visible = false;
      lift.add(back, body, face);
      lift.position.z = BASE;
      g.add(glow, lift);
      const p = local(i);
      g.position.set(p.x, p.y, 0);
      group.add(g);
      return {
        i, kind, g, lift, face, glow, sel: 0, selWant: 0, hover: 0, drop: -1, dropDelay: 0, pop: -1, shake: -1, spin: -1, spinKind: kind,
        spinDelay: 0, hint: 0, gone: false,
      };
    }
    function disposeTile(t) {
      group.remove(t.g);
      t.face.material.dispose();
      t.glow.material.dispose();
      t.glow.geometry.dispose();
    }

    // A new board (the rules' board b): the tray grows to fit, the tiles drop in one after another when `deal`.
    function setBoard(b, theme, deal = true) {
      for (const t of v.tiles.values()) disposeTile(t);
      v.tiles.clear();
      v.b = b;
      v.theme = theme;
      v.rows = b.rows;
      v.cols = b.cols;
      v.W = b.W;
      v.H = b.H;
      v.sel = -1;
      v.hint = null;
      paths.link.root.visible = paths.hint.root.visible = false;
      const tw = v.W * PX + 0.3, th = v.H * PY + 0.3;
      tray.geometry.dispose();
      tray.geometry = new T.ShapeGeometry(roundShape(tw, th, 0.45), 6);
      const uv = tray.geometry.attributes.uv, pos = tray.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) / tw + 0.5, pos.getY(k) / th + 0.5);
      tray.material.map = trayTexture(tw, th);
      tray.material.needsUpdate = true;
      rim.geometry.dispose();
      rim.geometry = new T.ShapeGeometry(roundShape(tw + 0.36, th + 0.36, 0.6), 6);
      let n = 0;
      b.cells.forEach((k, i) => {
        if (k < 0) return;
        const t = makeTile(i, k);
        if (deal) {
          t.drop = 0;
          t.dropDelay = n * 0.022;
          t.g.visible = false;
        }
        v.tiles.set(i, t);
        n++;
      });
      if (v.rect) fit(v.rect);
    }

    // Fit the board into a rectangle of the screen (pixels).
    function fit(rect) {
      v.rect = rect;
      if (!v.W) return;
      const k = kAt(0);
      const tw = v.W * PX + 0.7, th = v.H * PY + 0.7;
      v.s = Math.max(0.01, Math.min((rect.w * k) / tw, (rect.h * k) / th));
      const c = toWorld(rect.x + rect.w / 2, rect.y + rect.h / 2, 0);
      group.position.set(c.x, c.y, 0);
      group.scale.setScalar(v.s);
      v.px = (PX * v.s) / k;
    }

    // the cell under screen point (px, py): a padded index inside the tiles' area, or -1
    function cellAt(px, py) {
      if (!v.W) return -1;
      const w = toWorld(px, py, 0);
      const x = (w.x - group.position.x) / v.s, y = (w.y - group.position.y) / v.s;
      const c = Math.round(x / PX + (v.W - 1) / 2), r = Math.round((v.H - 1) / 2 - y / PY);
      if (r < 1 || c < 1 || r > v.rows || c > v.cols) return -1;
      return r * v.W + c;
    }
    // is screen point (px, py) on this board's tray at all?
    function onTray(px, py) {
      if (!v.W) return false;
      const w = toWorld(px, py, 0);
      const x = (w.x - group.position.x) / v.s, y = (w.y - group.position.y) / v.s;
      return Math.abs(x) <= (v.W * PX) / 2 + 0.3 && Math.abs(y) <= (v.H * PY) / 2 + 0.3;
    }
    // a cell's centre in the world (in front of the tiles), for flyers and the brother's pointing
    function worldOf(i, out = new T.Vector3()) {
      const p = local(i);
      out.set(p.x, p.y, FRONT + BD + 0.4);
      return group.localToWorld(out);
    }
    function screenOf(i) {
      group.updateMatrixWorld(true);
      return toScreen(worldOf(i));
    }

    function select(i) {
      if (v.sel >= 0 && v.tiles.has(v.sel)) v.tiles.get(v.sel).selWant = 0;
      v.sel = i;
      if (i >= 0 && v.tiles.has(i)) v.tiles.get(i).selWant = 1;
    }

    function drawPath(P, pts, z) {
      P.pts = pts;
      P.root.visible = !!pts;
      if (!pts) return;
      const w = P.width;
      for (let k = 0; k < 3; k++) {
        const s = P.segs[k];
        const on = k + 1 < pts.length;
        s.core.visible = s.glow.visible = on;
        if (!on) continue;
        const a = local(pts[k]), b = local(pts[k + 1]);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const horiz = Math.abs(b.y - a.y) < 1e-6;
        for (const [m, wide] of [[s.core, w], [s.glow, w * 2.6]]) {
          m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
          m.scale.set(horiz ? len + wide * 0.2 : wide, horiz ? wide : len + wide * 0.2, 1);
        }
      }
      P.joints.forEach((j, k) => {
        j.visible = k < pts.length;
        if (!j.visible) return;
        const p = local(pts[k]);
        j.position.set(p.x, p.y, z);
      });
    }

    // A link: the path zips out, then the two tiles pop off the board with stars.
    function link(a, z, pts, flyers) {
      drawPath(paths.link, pts, FRONT + BD + 0.6);
      paths.link.mat.opacity = 1;
      paths.link.glowMat.opacity = 0.4;
      v.linkT = 0.5;
      for (const i of [a, z]) {
        const t = v.tiles.get(i);
        if (!t) continue;
        t.selWant = 1;
        t.pop = 0;
        t.gone = true;
        if (flyers) {
          const w = worldOf(i);
          for (let k = 0; k < 5; k++) flyers.add(k % 2 ? '✨' : '⭐', w.x, w.y, w.z + 1, Kit.gfx.rand(-2, 2) * v.s, Kit.gfx.rand(1, 3) * v.s, 0.55 * v.s, 0.7, Kit.gfx.rand(-4, 4), 4 * v.s);
        }
      }
      if (v.sel === a || v.sel === z) v.sel = -1;
      if (v.hint && (v.hint[0] === a || v.hint[0] === z || v.hint[1] === a || v.hint[1] === z || !v.tiles.has(v.hint[0]))) clearHint();
    }

    function shake(list) {
      for (const i of list) {
        const t = v.tiles.get(i);
        if (t) t.shake = 0;
      }
    }

    // Shuffle: every tile spins round once, and turns up as the picture b now says.
    function shuffle(b) {
      v.b = b;
      let n = 0;
      for (const [i, t] of v.tiles) {
        if (t.gone) continue;
        t.spin = 0;
        t.spinDelay = (n++ % 12) * 0.03;
        t.spinKind = b.cells[i];
      }
      select(-1);
      clearHint();
    }

    // Your brother's pair: both tiles glow and the path between them shows, until it's linked (or cleared).
    function hint(pair, pts) {
      v.hint = pair;
      v.hintT = 0;
      for (const t of v.tiles.values()) t.hint = 0;
      for (const i of pair) if (v.tiles.has(i)) v.tiles.get(i).hint = 1;
      drawPath(paths.hint, pts, FRONT + BD + 0.5);
    }
    function clearHint() {
      if (v.hint) for (const i of v.hint) if (v.tiles.has(i)) v.tiles.get(i).hint = 0;
      v.hint = null;
      paths.hint.root.visible = false;
    }

    function cursor(i) {
      v.cursorAt = i;
      cur.visible = i >= 0;
      if (i >= 0) {
        const p = local(i);
        cur.position.set(p.x, p.y, FRONT + BD + 0.3);
      }
    }
    function hover(i) {
      v.hoverAt = i;
    }

    // Re-draw the pictures (the language changed: the 中文 labels come and go).
    function retexture() {
      for (const t of v.tiles.values()) {
        t.face.material.map = faceTexture(v.theme, t.spin >= 0 && t.spin > 0.5 ? t.spinKind : t.kind);
        t.face.material.needsUpdate = true;
      }
    }

    function update(dt) {
      v.t += dt;
      const kk = 1 - Math.exp(-18 * dt);
      for (const [i, t] of v.tiles) {
        // dealt: drop in from in front of the board, with a little bounce
        if (t.drop >= 0) {
          t.dropDelay -= dt;
          if (t.dropDelay <= 0) {
            t.g.visible = true;
            t.drop += dt / 0.32;
            const u = Math.min(1, t.drop);
            const e = 1 - Math.pow(1 - u, 3);
            t.g.position.z = (1 - e) * 6 + Math.sin(u * Math.PI) * 0.4;
            t.g.rotation.x = (1 - e) * -0.6;
            if (u >= 1) {
              t.drop = -1;
              t.g.position.z = 0;
              t.g.rotation.x = 0;
              if (TL.sfx) TL.sfx.clack(i);
            }
          }
        }
        t.sel += (t.selWant - t.sel) * kk;
        const hov = i === v.hoverAt && !t.gone ? 1 : 0;
        t.hover += (hov - t.hover) * kk;
        let z = t.sel * 0.45 + t.hover * 0.15, sc = 1 + t.sel * 0.08, rz = 0, ry = 0;
        // picked: a gold glow; your brother's pair: a pulsing blue-white glow
        const hintGlow = t.hint ? 0.55 + 0.45 * Math.sin(v.t * 7) : 0;
        if (t.hint) {
          z += 0.2 + 0.12 * Math.sin(v.t * 7);
          t.glow.material.color.set('#7ff4ff');
        } else t.glow.material.color.set(v.color);
        const gl = Math.max(t.sel, hintGlow);
        t.glow.visible = gl > 0.02;
        t.glow.material.opacity = gl;
        if (t.shake >= 0) {
          t.shake += dt;
          rz = Math.sin(t.shake * 40) * 0.16 * Math.exp(-t.shake * 6);
          if (t.shake > 0.5) t.shake = -1;
        }
        if (t.spin >= 0) {
          t.spinDelay -= dt;
          if (t.spinDelay <= 0) {
            const was = t.spin;
            t.spin += dt / 0.42;
            if (was < 0.5 && t.spin >= 0.5) {
              t.kind = t.spinKind;
              t.face.material.map = faceTexture(v.theme, t.kind);
              t.face.material.needsUpdate = true;
            }
            ry = Math.min(1, t.spin) * Math.PI * 2;
            z += Math.sin(Math.min(1, t.spin) * Math.PI) * 0.8;
            if (t.spin >= 1) {
              t.spin = -1;
              ry = 0;
            }
          }
        }
        if (t.pop >= 0) {
          t.pop += dt / 0.4;
          const u = Math.min(1, t.pop);
          sc = u < 0.3 ? 1.08 + u * 0.8 : Math.max(0.001, 1.32 * (1 - (u - 0.3) / 0.7));
          z += u * 1.5;
          rz = u * 1.2 * (i % 2 ? 1 : -1);
          if (u >= 1) {
            disposeTile(t);
            v.tiles.delete(i);
            continue;
          }
        }
        t.lift.position.z = BASE + z;
        t.lift.scale.setScalar(sc);
        t.lift.rotation.set(0, ry, rz);
      }
      // the link's path fades; the hint's breathes
      if (v.linkT > 0) {
        v.linkT -= dt;
        const o = Math.max(0, Math.min(1, v.linkT / 0.25));
        paths.link.mat.opacity = o;
        paths.link.glowMat.opacity = 0.4 * o;
        if (v.linkT <= 0) paths.link.root.visible = false;
      }
      if (paths.hint.root.visible) {
        v.hintT += dt;
        paths.hint.mat.opacity = 0.75 + 0.25 * Math.sin(v.t * 7);
        paths.hint.glowMat.opacity = 0.25 + 0.15 * Math.sin(v.t * 7);
      }
      if (cur.visible) cur.material.opacity = 0.75 + 0.25 * Math.sin(v.t * 6);
    }

    // everything still moving (the deal, pops, spins)?
    function busy() {
      for (const t of v.tiles.values()) if (t.drop >= 0 || t.pop >= 0 || t.spin >= 0) return true;
      return false;
    }

    function clear() {
      for (const t of v.tiles.values()) disposeTile(t);
      v.tiles.clear();
      v.b = null;
      v.W = 0;
      paths.link.root.visible = paths.hint.root.visible = false;
      cur.visible = false;
    }

    Object.assign(v, { setBoard, fit, cellAt, onTray, worldOf, screenOf, select, link, shake, shuffle, hint, clearHint, cursor, hover, retexture, update, busy, clear });
    Object.defineProperty(v, 'visible', { get: () => group.visible, set: (on) => (group.visible = on) });
    return v;
  }

  function render() {
    if (renderer) renderer.render(scene, camera);
  }

  TL.stage = {
    init, resize, render, makeView, toWorld, toScreen, kAt, faceTexture,
    get W() { return S.W; },
    get H() { return S.H; },
    get scene() { return scene; },
    get camera() { return camera; },
    views,
    PX, PY,
  };
})();
