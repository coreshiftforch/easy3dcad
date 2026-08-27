/* シーン3・下パーツ生成（おわん型）
   カップケーキの「包み紙」を作る枝。**オブジェクトは切らない**。
   読みこんだものがそのまま上パーツ（＝ケーキ）で、それを受けるおわんを新しく作る。

   フロー
     ① 大きさと向き   … 大きさ（高さ mm）と向きを決める
     ② おわん         … 包み方（包む／のせる）と柱のかたち、大きさ・厚み・すきま
     ③ プレビュー     … 押す動き・分解。「完成」で書き出しへ

   ★包み方が2つある。どちらを選ぶかで、オブジェクトの底の掘り方まで変わる。

     包む … おわんの中へ沈む。オブジェクトの底に 6.6 の穴＋その上に十字 2.5（＝9.1 要る）
     のせる … 平らな台にのせるだけ。オブジェクトの底は十字 2.5 だけ（低いものでも作れる）

   ★どのかたちも**まっすぐな柱**（上下で太さが変わらない）にしてある。
     オブジェクトは押すと 4mm 動くので、内がわが下でふくらんでいると引っかかる。
     まっすぐなら、いちばん太いところに合わせるだけで必ず抜ける。

                  ╱▔▔▔▔╲
                 │       │      ← 上パーツ＝読みこんだオブジェクト（切らない）
                 │  ┌─┐  │      ← 十字の穴   3.90 × 腕1.45 ・深さ 2.5
          ╭──────┤  └─┘  ├──╮
          │      │┌─────┐│  │   ← クリッカーを載せる穴 16.4角・深さ 6.6
          │      └┤ 上箱 ├┘  │      （上ハウジングがまるごと入る）
    プレート ─────┼──────┼────  ← おわんの底の面
          │      │ 胴5.6 │     │
          │      └┬────┬┘     │  ← 胴＋ポールは、おわんの底に掘る（8.9）
          ╰───────┴────┴───────╯

   ★だからオブジェクトの底には 6.6 ＋ 2.5 ＝ **9.1mm** ぶんの肉が要る
     （実測の「プレートから十字の先」そのもの）。
   ★柱は要らない。上ハウジングが 6.6mm まるごと中に入るので、それ自体が
     横ぶれの案内になる（タイプ2で柱が要ったのは、箱の上に乗るだけだったから）。 */

import * as THREE from 'three';
import { buildGeometry, transformed } from '../geom/model.js';
import { makeSwitchMock, SWITCH_H, SWITCH_W, BELOW_PLATE, CAP_PRESSED, HOLE_DEPTH, TRAVEL }
  from '../geom/switch-mock.js';
import { makeLoop, USES_SIZE } from '../geom/loop.js';
import { buildProfile } from '../geom/profile.js';
import { pointInPoly } from '../geom/section.js';
import { bowlSolid, digPocket } from '../geom/bowl.js';
import { BOSS } from '../geom/boss.js';
import { PRESS_NOTE, travelNote } from './notes.js';

const FLOW = ['大きさと向き', 'おわん', 'プレビュー'];
const BUILT = 3;                       // 作ってあるのは③まで
const LAST = 3;                        // 最後のフロー。ここで「完成」→ 書き出しへ
const WALL = 1.6;                      // スイッチのまわりに要る最低限の肉
/* クリッカーを載せる穴（逃げ）。上ハウジングがここへ入る */
const ROOM_SIDE = 16.4;
/* 押しきったとき、オブジェクトの底をおわんの床から何ミリ浮かせるか。
   ★0 にすると、押しきる前に底どうしが擦る。そのぶん穴は浅くなる。 */
const FLOOR_GAP = 0.5;
/* 「包む」ときにオブジェクトの底へ掘る深さ。
     クリッカーを載せる穴 ＝ 上ハウジング 6.6 − 浮かせるぶん 0.5 ＝ 6.1
     その上に十字の穴 2.5  → あわせて 8.6mm ぶんの肉が要る */
const RECESS  = CAP_PRESSED - 0.5;
const NEED_IN = RECESS + HOLE_DEPTH;
/* 開いたときの大きさ。スイッチのいちばん長いところ（背 18.0mm）の何倍にするか */
const START_RATIO = 4;
/* 「のせる」ときにオブジェクトの底に要る肉＝十字の穴だけ */
const NEED_ON = HOLE_DEPTH;
/* 包み方 */
const MODES = [
  { id: 'wrap', label: '包む',   note: 'おわんの中へ沈む。カップケーキの包み紙。横ぶれに強い' },
  { id: 'sit',  label: 'のせる', note: '平らな台にのせるだけ。低いオブジェクトでも作れる' },
];
/* 柱のかたち。★loop.js の SHAPES は使わない（タイプ1の②の一覧を変えたくない） */
const PILLARS = [
  { id: 'circle', label: '円柱' },
  { id: 'square', label: '四角柱' },
  { id: 'poly',   label: '多角形' },
  { id: 'along',  label: '縁に合わせる' },
  { id: 'free',   label: '自分で描く' },
];
const AMBER = 0xf0c419;
const RED   = 0xff3b30;

/* 虫眼鏡（＋／−）のしるし。タイプ1・2と同じ絵 */
const GLASS = kind => `<svg viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
  <path d="M12.6 12.6 L17.5 17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M6 8.5h5${kind === 'plus' ? 'M8.5 6v5' : ''}" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" fill="none"/>
</svg>`;

/* 窓ひとつぶんのHTML。回転の矢印と虫眼鏡を重ねてある */
const VIEW = k => [
  `      <div class="view ${k}"><span class="view-tag"></span>`,
  '        <svg class="spin-arrow" viewBox="0 0 100 100" aria-hidden="true" hidden>',
  '          <path d="M 50 16 A 34 34 0 1 1 16 50" fill="none" stroke="currentColor"',
  '                stroke-width="4" stroke-linecap="round"/>',
  '          <path d="M 7 53 L 25 53 L 16 34 Z" fill="currentColor"/>',
  '        </svg>',
  '        <div class="zoomer" hidden>',
  `          <button class="zoom out" type="button" aria-label="小さく">${GLASS('minus')}</button>`,
  '          <span class="zoom-pct">100%</span>',
  `          <button class="zoom in" type="button" aria-label="大きく">${GLASS('plus')}</button>`,
  '        </div>',
  '      </div>',
];

export function mountScene3Lower(root, { model, onBack, onDone } = {}) {
  /* 読みこんだそのままの形（Z上・底 z=0）。ここからは触らない */
  const base = buildGeometry(model);
  let work = base;                     // 大きさと向きをかけたあとの形

  const flowHTML = FLOW.map((t, i) =>
    `<li data-step="${i + 1}"${i + 1 > BUILT ? ' class="todo"' : ''}>`
    + `<b>${i + 1}</b><span>${t}</span></li>`).join('');

  root.innerHTML = [
    '<div class="scene scene3">',
    '  <div class="topbar">',
    '    <button class="back-btn" type="button">← タイプ選択</button>',
    `    <span class="file-name">${model.name}</span>`,
    '  </div>',
    '  <div class="s3-body">',
    `    <ol class="flow">${flowHTML}</ol>`,
    '    <div class="views">',
    ...VIEW('side'),
    '      <div class="col">',
    ...VIEW('top'),
    '      </div>',
    '    </div>',
    '    <div class="panel">',
    '      <div class="sec-size">',
    '        <p class="panel-h">大きさ</p>',
    '        <label class="slabel">オブジェクトの大きさ<output class="out-tall"></output></label>',
    '        <input class="r-tall" type="range" step="0.5">',
    '        <p class="note size-note"></p>',
    '        <p class="panel-h">向き</p>',
    '        <div class="axes">',
    '          <button class="axis-btn" data-axis="x" type="button">X</button>',
    '          <button class="axis-btn" data-axis="y" type="button">Y</button>',
    '          <button class="axis-btn on" data-axis="z" type="button">Z</button>',
    '        </div>',
    '        <label class="slabel">回す<output class="out-spin"></output></label>',
    '        <input class="r-spin" type="range" min="0" max="355" step="5" value="0">',
    '        <p class="note axis-note"></p>',
    `        <p class="note">オブジェクトは切らない。底に穴を掘るので、`
    + `「包む」なら ${NEED_IN.toFixed(1)}mm、「のせる」なら ${NEED_ON.toFixed(1)}mm ぶんの肉が要る</p>`,
    '      </div>',
    '      <div class="sec-bowl" hidden>',
    '        <p class="panel-h">包み方</p>',
    '        <div class="shapes">',
    MODES.map(m => `          <button class="shape-btn mode-btn${m.id === 'wrap' ? ' on' : ''}"`
      + ` type="button" data-id="${m.id}">${m.label}</button>`).join('\n'),
    '        </div>',
    '        <p class="note mode-note"></p>',
    '        <p class="panel-h">柱のかたち</p>',
    '        <div class="shapes">',
    PILLARS.map(t => `          <button class="shape-btn pil-btn${t.id === 'circle' ? ' on' : ''}"`
      + ` type="button" data-id="${t.id}">${t.label}</button>`).join('\n'),
    '        </div>',
    '        <div class="sides-row" hidden>',
    '          <label class="slabel">角の数<output class="out-sides"></output></label>',
    '          <input class="r-sides" type="range" min="3" max="16" step="1" value="6">',
    '        </div>',
    '        <label class="slabel">大きさ（半径）<output class="out-size"></output></label>',
    '        <input class="r-size" type="range" step="0.1">',
    '        <div class="wrap-row">',
    '          <label class="slabel">どこまで包むか<output class="out-wrap"></output></label>',
    '          <input class="r-wrap" type="range" step="0.5">',
    '        </div>',
    '        <label class="slabel">厚み<output class="out-wall"></output></label>',
    '        <input class="r-wall" type="range" min="0.8" max="5" step="0.1" value="1.6">',
    '        <label class="slabel">すきま<output class="out-gap"></output></label>',
    '        <input class="r-gap" type="range" min="0.1" max="1" step="0.05" value="0.2">',
    '        <p class="note bowl-note"></p>',
    '      </div>',
    '      <div class="sec-preview" hidden>',
    '        <p class="panel-h">プレビュー</p>',
    '        <div class="btn-row">',
    '          <button class="split-btn" type="button">分解</button>',
    '          <button class="xray-btn" type="button">半透明</button>',
    '        </div>',
    `        <p class="note">${PRESS_NOTE}</p>`,
    '        <p class="note parts"></p>',
    `        <p class="note">${travelNote(TRAVEL, ROOM_SIDE, 'オブジェクト')}</p>`,
    '      </div>',
    '      <p class="hint"></p>',
    '      <div class="go-row">',
    '        <button class="prev-btn" type="button">← 戻る</button>',
    '        <button class="next-btn" type="button">次へ</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n');

  /* ── 見せるもの ──────────────────────────────── */
  const scene = new THREE.Scene();
  /* ★明かりは全レイヤーで効かせる。three は「カメラのレイヤーに入っている明かり」
       しか集めないので、別レイヤーだけを映す窓を足したときに真っ黒になる。 */
  const sky = new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.2);
  sky.layers.enableAll();
  scene.add(sky);
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.layers.enableAll();
  key.position.set(1, -1.4, 1.6);
  scene.add(key);

  const meshMat = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.7, metalness: 0.03 });
  const mesh = new THREE.Mesh(work.geo, meshMat);
  scene.add(mesh);

  /* スイッチ。①では出さない（置くところがないので）。②から使う */
  const swMock = makeSwitchMock();
  scene.add(swMock);

  /* おわんの見本。半透明で、はみ出しているときは赤くする */
  const bowlMat = new THREE.MeshStandardMaterial({
    color: 0xa8bccd, roughness: 0.55, transparent: true, opacity: 0.42,
    side: THREE.DoubleSide,
  });
  const bowlEdge = new THREE.LineBasicMaterial({ color: 0x51606f, transparent: true, opacity: 0.7 });
  let bowlGroup = null;
  /* 上から見た輪（内がわ）。赤い線で出す */
  const loopMat = new THREE.LineBasicMaterial({ color: RED, depthTest: false, transparent: true });
  let loopLine = null;

  /* ③で見せる、できあがりの2つ */
  const upMat = new THREE.MeshStandardMaterial({ color: 0xf0a668, roughness: 0.6 });
  const loMat = new THREE.MeshStandardMaterial({ color: 0xa8bccd, roughness: 0.6 });
  let upMesh = null, loMesh = null, splitInfo = null;

  /* ── 半透明（手前半分を透かす） ──────────────────
     ★同じ形を2つ描く。奥半分は不透明のまま、手前半分だけ薄い材料で描く。
       どちらを描くかは「材料ごとの切り取り面」で分ける。 */
  const ghostMat = c => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.6, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const upGhostMat = ghostMat(0xf0a668), loGhostMat = ghostMat(0xa8bccd);
  let upGhost = null, loGhost = null, xray = false;
  const nearPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const farPlane  = new THREE.Plane(new THREE.Vector3(0,  1, 0), 0);
  const orbitAng = { az: 0, el: 0 };

  /* ★窓ごとに出し分けたいので、レイヤーで分ける。
       0＝どの窓にも出すもの（スイッチの見本）、1＝モデル、2＝おわん、
       3＝できあがりの上パーツ、4＝おわん（できあがり）。 */
  const L_MODEL = 1, L_BOWL = 2, L_UP = 3, L_LOW = 4;
  mesh.layers.set(L_MODEL);

  /* ── 窓 ──────────────────────────────────────
     どれも平行投影（技術図に近い見え方）。 */
  const DIRS = {
    front: { eye: [0, -1, 0], up: [0, 0, 1], tag: '正面から' },
    top:   { eye: [0, 0, 1],  up: [0, 1, 0], tag: '上から'   },
    x:     { eye: [1, 0, 0],  up: [0, 0, 1], tag: 'X軸から'  },
    y:     { eye: [0, 1, 0],  up: [0, 0, 1], tag: 'Y軸から'  },
  };

  function makeView(host, kind) {
    /* ★カメラは十分に遠くへ置く。近いと、当たり判定の光線が場面の途中から出てしまう */
    const FAR = 10000;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, FAR * 2);
    const tagEl = host.querySelector('.view-tag');

    const ren = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    ren.localClippingEnabled = true;
    ren.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(ren.domElement);

    /* ★大きさを変えるとキャンバスの中身は消える。描く直前にまとめて直す */
    let sized = false, mmPerPx = 1, extraH = 0;
    let orbit = null;                  // まわして見るとき（③）の向き
    const eyeNow = () => {
      if (!orbit) return DIRS[kind].eye;
      const { az, el } = orbit;
      return [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)];
    };
    /* fixedBase > 0 のあいだは「1画素＝何mm」を固定する。
       ★これがないと、モデルを小さくしてもカメラが寄りなおすので、
         画面上の見た目がまったく変わらない（大きさを決めているのに分からない）。 */
    let fixedBase = 0, zoom = 1;
    /* 見せたい高さの幅（null＝モデルの高さ）と、横に要る半径。
       ★おわんはオブジェクトより下（マイナス）へ伸びるので、モデルの高さだけで
         寄せると下が切れる。②から範囲を渡してもらう。 */
    let zRange = null, needR = 0;

    function fit() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      ren.setSize(w, h, false);
      const d = { eye: eyeNow(), up: orbit ? [0, 0, 1] : DIRS[kind].up };
      const flat = !orbit && kind === 'top';
      /* ①は重心が原点なので、窓のまん中を原点にそろえる。
         回してもモデルがその場から動かない。②から先は底 z=0 に置きなおす。 */
      const T = new THREE.Vector3();
      if (fixedBase) {
        mmPerPx = fixedBase / zoom;
      } else {
        /* スイッチの見本より小さいモデルでも、見本が切れないように広さを取る。
           おわんがモデルより太い／低いときは、そちらに合わせる。 */
        const sx = Math.max(work.span.x, SWITCH_W, needR * 2);
        const sy = Math.max(work.span.y, SWITCH_W, needR * 2);
        const lo = zRange ? zRange[0] : 0;
        const hi = zRange ? zRange[1] : Math.max(work.span.z, SWITCH_H);
        const sz = (hi - lo) + extraH;
        const wide  = orbit ? Math.max(sx, sy) : (kind === 'x' ? sy : sx);
        const needH = flat ? sy : sz;                      // 画面の縦に来る寸法
        /* ★虫眼鏡は寄せかたを決めたあとにかける（①と同じ向き。大きい％＝大きく見える） */
        mmPerPx = Math.max(wide / w, needH / h) * 1.14 / zoom;
        if (!flat) T.set(0, 0, (lo + hi) / 2);
      }
      cam.position.set(d.eye[0] * FAR + T.x, d.eye[1] * FAR + T.y, d.eye[2] * FAR + T.z);
      cam.up.set(...d.up);
      cam.lookAt(T);
      cam.left = -w * mmPerPx / 2; cam.right  =  w * mmPerPx / 2;
      cam.top  =  h * mmPerPx / 2; cam.bottom = -h * mmPerPx / 2;
      cam.updateProjectionMatrix();
      sized = true;
    }
    tagEl.textContent = DIRS[kind].tag;
    cam.layers.enable(L_MODEL);

    /* 虫眼鏡 */
    const zoomer = host.querySelector('.zoomer');
    const pctEl  = host.querySelector('.zoom-pct');
    const paintPct = () => { pctEl.textContent = `${Math.round(zoom * 100)}%`; };
    /* ★下限は 10%。おわんはモデルより下へ伸びるので、20% では引ききれないことがある */
    const zoomBy = f => {
      zoom = Math.min(8, Math.max(0.1, zoom * f));
      paintPct();
      sized = false;
    };
    host.querySelector('.zoom.in').onclick  = () => zoomBy(1.25);
    host.querySelector('.zoom.out').onclick = () => zoomBy(1 / 1.25);
    const ro = new ResizeObserver(() => { sized = false; });
    ro.observe(host);
    fit();
    return {
      host,
      render() { if (!sized) fit(); ren.render(scene, cam); },
      autoMmPerPx() { return mmPerPx; },
      reframe() { sized = false; },
      /* ★虫眼鏡はどの段でも出す。おわんが窓からはみ出したとき、引けないと困る */
      setFixed(b) { fixedBase = b; zoomer.toggleAttribute('hidden', false); paintPct(); sized = false; },
      setAuto()   { fixedBase = 0; zoomer.toggleAttribute('hidden', false); paintPct(); sized = false; },
      /* 見せたい高さの幅と、横に要る半径。null／0 でモデルに合わせる */
      setRange(lo, hi) {
        const same = zRange && zRange[0] === lo && zRange[1] === hi;
        if (!same) { zRange = lo === null ? null : [lo, hi]; sized = false; }
      },
      setRadius(r) { if (r !== needR) { needR = r; sized = false; } },
      setDir(k) { if (k !== kind) { kind = k; tagEl.textContent = DIRS[k].tag; sized = false; } },
      setTag(t) { tagEl.textContent = t; },
      setExtraH(v) { if (v !== extraH) { extraH = v; sized = false; } },
      setOrbit(az, el) { orbit = { az, el }; sized = false; },
      clearOrbit() { if (orbit) { orbit = null; sized = false; } },
      eyeVec() { return new THREE.Vector3(...eyeNow()); },
      setClip(pl) { ren.clippingPlanes = pl ? [pl] : []; },
      /* 窓ごとの出し分け。'bowl'＝おわんも／'parts'＝できあがりの2つだけ */
      setLayers(mode) {
        cam.layers.set(0);
        if (mode === 'parts') { cam.layers.enable(L_UP); cam.layers.enable(L_LOW); return; }
        cam.layers.enable(L_MODEL);
        if (mode === 'bowl') cam.layers.enable(L_BOWL); else cam.layers.disable(L_BOWL);
      },
      /* 画面の座標 → モデルの座標（上から見た窓でだけ使う）。
         真上から見ていて上が +Y なので、画面の下向きは −Y になる。 */
      toWorld(ev) {
        const r = host.getBoundingClientRect();
        return [(ev.clientX - r.left - r.width / 2) * mmPerPx,
                -(ev.clientY - r.top - r.height / 2) * mmPerPx];
      },
      get mmPerPx() { return mmPerPx; },
      cam,
      ndc(ev) {
        const r = host.getBoundingClientRect();
        return { x: ((ev.clientX - r.left) / r.width) * 2 - 1,
                 y: -((ev.clientY - r.top) / r.height) * 2 + 1 };
      },
      screenDelta(dx, dy) {
        cam.updateMatrixWorld();
        const right = new THREE.Vector3(), up = new THREE.Vector3();
        cam.matrixWorld.extractBasis(right, up, new THREE.Vector3());
        return right.multiplyScalar(dx * mmPerPx).add(up.multiplyScalar(-dy * mmPerPx));
      },
      destroy() { ro.disconnect(); ren.dispose(); ren.domElement.remove(); },
    };
  }
  const sideArrow = root.querySelector('.view.side .spin-arrow');
  const topArrow  = root.querySelector('.view.top .spin-arrow');
  const sideView  = makeView(root.querySelector('.view.side'), 'front');
  const topView   = makeView(root.querySelector('.view.top'),  'top');
  const views = [sideView, topView];

  /* ★フロー①の「1画素＝何mm」は、読みこんだそのままの大きさで1回だけ決めて固定する。
       2つの窓で同じ値を使うので、左右で見た目の大きさがそろう。 */
  const FIXED_MM_PER_PX = sideView.autoMmPerPx();

  /* ── 部品 ────────────────────────────────────── */
  const $ = s => root.querySelector(s);
  const rTall = $('.r-tall'), rSpin = $('.r-spin');
  const hint = $('.hint'), nextBtn = $('.next-btn');

  const rSize = $('.r-size'), rWrap = $('.r-wrap'), rWall = $('.r-wall');
  const rGap = $('.r-gap'), rSides = $('.r-sides');

  let step = 1;
  const ang = { x: 0, y: 0, z: 0 };    // 軸ごとの回した角（度）
  let axis = 'z';                      // いま選んでいる軸
  let mode = 'wrap';                   // 'wrap'＝包む／'sit'＝のせる
  let pillar = 'circle';               // 柱のかたち
  let freePts = null;                  // 「自分で描く」でなぞった線
  let prof = null;                     // 外まわりの一覧表（②に入ったとき1回）

  /* ── ③の動き ──────────────────────────────────
     ★形は「押しきり」で作ってある。位置は「押しきりからどれだけ浮いているか」1本で表す。 */
  const ACT_RISE = TRAVEL - 2.2;       // 2.2mm 沈んだところで鳴る（青軸の実測値）
  const CLICK = { press: 0.16, hold: 0.10, back: 0.22 };
  let lift = TRAVEL, anim = null, framed = TRAVEL, popUntil = 0;

  /* ★はしは広めに取る。回すと高さが変わるので、せまいとバーの表示が頭打ちして嘘になる */
  const baseMax = Math.max(base.span.x, base.span.y, base.span.z) || 1;
  rTall.min = 5;
  rTall.max = Math.max(baseMax * 1.6, 150).toFixed(1);
  /* 開いたときは、いちばん長いところがスイッチの背の START_RATIO 倍になる大きさにする。
     ★シーン2で大きさを直していたら（model.startLong）、そちらを引きつぐ。 */
  const startLong = model.startLong || SWITCH_H * START_RATIO;
  rTall.value = Math.min(+rTall.max,
    Math.max(+rTall.min, base.span.z * startLong / baseMax)).toFixed(1);

  /* ── ①をかけて、形を作りなおす ───────────────── */
  /* ★倍率は覚えておく。回すたびに「回したあとの高さ＝スライダの値」になるよう
       計算しなおすと、倒しただけでモデルが大きくなってしまう。 */
  let scale = 1;
  function rebuild(from) {
    const R = { rx: ang.x * Math.PI / 180, ry: ang.y * Math.PI / 180, rz: ang.z * Math.PI / 180 };
    /* ①のあいだは重心で置く（その場で回る）。②から先は底を z=0 に */
    const anchor = step === 1 ? 'center' : 'ground';
    if (from === 'tall') {
      const probe = transformed(base.positions, { scale: 1, ...R });
      scale = probe.span.z > 1e-6 ? (+rTall.value) / probe.span.z : 1;
      probe.geo.dispose();
    }

    if (work !== base) work.geo.dispose();
    work = transformed(base.positions, { scale, ...R, anchor });
    mesh.geometry = work.geo;
    if (from !== 'tall') rTall.value = work.span.z.toFixed(1);

    for (const v of views) v.reframe();
  }

  /* ── おわんの寸法 ─────────────────────────────
     オブジェクトの底を z=0 に置いた座標で返す。おわんは下（マイナス）へ伸びる。

       包む   … 底のすきま 0.5 の下がおわんの底の面。そこから下へ 8.9（胴＋ポール）
       のせる … オブジェクトの底がそのまま台の上面。そこから下へ 15.5（スイッチ全部）
     どちらも、そのさらに下に底板（厚み）が付く。 */
  function heights() {
    const wall = +rWall.value;
    /* おわんの内がわの床。「包む」はオブジェクトの底より FLOOR_GAP 下、
       「のせる」はオブジェクトの底そのもの（上ハウジングは台の中） */
    const floorTop = mode === 'wrap' ? -FLOOR_GAP : 0;
    const roomDeep = mode === 'wrap' ? BELOW_PLATE : CAP_PRESSED + BELOW_PLATE;
    const roomBot  = floorTop - roomDeep;                // 部屋の底（ポールの先）
    const bottom   = roomBot - wall;                     // おわんのいちばん下
    const rim      = mode === 'wrap' ? +rWrap.value : floorTop;
    /* プレートの上面（＝スイッチの見本の原点）。
       ★「包む」は上ハウジングがオブジェクトの穴へ入るので、床がそのままプレート面。
         「のせる」は**上ハウジングごと台の中**に入るので、床から 6.6 下がプレート面。
         ここを「包む」と同じ式にしていて、スイッチが台の上へ飛び出していた。 */
    const plateTop = mode === 'wrap' ? floorTop : floorTop - CAP_PRESSED;
    return { wall, floorTop, roomDeep, roomBot, bottom, rim, plateTop };
  }

  /* 内がわの輪（上から見たかたち）。★どれもまっすぐな柱にする */
  function innerLoop() {
    const gap = +rGap.value;
    if (pillar === 'free') {
      if (!freePts || freePts.length < 3) return null;
      return freePts;
    }
    if (pillar === 'along') {
      /* 縁に合わせる … 包む高さまでのあいだで、向きごとにいちばん太いところ。
         ★下からの累積ではなく「その範囲の最大」。まっすぐな柱なので、
           いちばん太いところに合わせれば必ず抜ける。 */
      if (!prof) return null;
      const { z0, dz, nz, na, r } = prof;
      const top = mode === 'wrap' ? +rWrap.value : work.span.z;
      const k1 = Math.min(nz - 1, Math.max(0, Math.round((top - z0) / dz)));
      const out = [];
      for (let a = 0; a < na; a++) {
        let m = 0;
        for (let k = 0; k <= k1; k++) m = Math.max(m, r[k * na + a]);
        const t = a * Math.PI * 2 / na;
        out.push([Math.cos(t) * (m + gap), Math.sin(t) * (m + gap)]);
      }
      return out;
    }
    return makeLoop(pillar, +rSize.value, 96, 0.3, +rSides.value);
  }

  /* 輪を重心から外へ広げる（厚みぶん）。
     ★「距離を一定に保つオフセット」は細い切れこみで自分と交わる。
       まっすぐな柱なので、重心から一定の割合で広げれば十分。 */
  function growLoop(pts, d) {
    let cx = 0, cy = 0;
    for (const q of pts) { cx += q[0]; cy += q[1]; }
    cx /= pts.length; cy /= pts.length;
    return pts.map(q => {
      const dx = q[0] - cx, dy = q[1] - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [q[0] + dx / len * d, q[1] + dy / len * d];
    });
  }

  const v2 = pts => pts.map(q => new THREE.Vector2(q[0], q[1]));

  function clearBowl() {
    if (bowlGroup) {
      scene.remove(bowlGroup);
      bowlGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      bowlGroup = null;
    }
    if (loopLine) { scene.remove(loopLine); loopLine.geometry.dispose(); loopLine = null; }
  }

  /* おわんの見本を立てる。ここでは「見せるだけ」。
     ★閉じた立体にするのは③（プレビュー）。ここは形を決めるための絵。 */
  function drawBowl(inner, h, ok) {
    clearBowl();
    if (!inner || inner.length < 3) return;
    bowlGroup = new THREE.Group();
    bowlMat.color.setHex(ok ? 0xa8bccd : RED);
    const outer = growLoop(inner, h.wall);
    const add = (geo, z) => {
      geo.translate(0, 0, z);
      const m = new THREE.Mesh(geo, bowlMat);
      m.layers.set(L_BOWL);
      bowlGroup.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), bowlEdge);
      e.layers.set(L_BOWL);
      bowlGroup.add(e);
    };
    const ex = (shape, depth) =>
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });

    /* 底板＋部屋のぶん（部屋はまだ抜かずに、外がわだけ見せる） */
    add(ex(new THREE.Shape(v2(outer)), h.floorTop - h.bottom), h.bottom);
    /* 壁（内がわを抜いた輪っかを立ちあげる） */
    if (h.rim > h.floorTop + 0.05) {
      const ring = new THREE.Shape(v2(outer));
      ring.holes.push(new THREE.Path(v2(inner).reverse()));
      add(ex(ring, h.rim - h.floorTop), h.floorTop);
    }
    scene.add(bowlGroup);

    /* 上から見たときの内がわの輪。赤い線で、オブジェクトとの合い方を見せる */
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(inner.length * 3);
    inner.forEach((q, i) => { arr[i*3] = q[0]; arr[i*3+1] = q[1]; arr[i*3+2] = h.rim; });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    loopLine = new THREE.LineLoop(g, loopMat);
    loopLine.renderOrder = 11;
    scene.add(loopLine);
  }

  /* オブジェクトが内がわの輪に収まっているか（包む高さまでのどこかで はみ出さないか）。
     ★まっすぐな柱なので、いちばん太いところだけ見ればよい。 */
  function objectFits(inner, top) {
    if (!inner || !prof) return true;
    const { z0, dz, nz, na, r } = prof;
    const k1 = Math.min(nz - 1, Math.max(0, Math.round((top - z0) / dz)));
    for (let a = 0; a < na; a++) {
      let m = 0;
      for (let k = 0; k <= k1; k++) m = Math.max(m, r[k * na + a]);
      const t = a * Math.PI * 2 / na;
      if (!pointInPoly([Math.cos(t) * m, Math.sin(t) * m], inner)) return false;
    }
    return true;
  }

  /* スイッチの部屋（16.4角）が内がわに収まっているか */
  function roomFitsIn(inner) {
    if (!inner) return false;
    const h = ROOM_SIDE / 2, N = 8;
    for (let i = 0; i < N; i++) {
      const t = ROOM_SIDE * i / N;
      for (const q of [[-h + t, -h], [h, -h + t], [h - t, h], [-h, h - t]])
        if (!pointInPoly(q, inner)) return false;
    }
    return true;
  }

  /* ── ③の動き ────────────────────────────────── */
  const clickPop = document.createElement('span');
  clickPop.className = 'click-pop';
  clickPop.textContent = 'カチッ';
  sideView.host.appendChild(clickPop);

  const easeOut = u => 1 - (1 - u) ** 3;
  const smooth  = u => u * u * (3 - 2 * u);

  function clickLift(t) {
    const { press, hold, back } = CLICK;
    if (t < press)               return TRAVEL * (1 - smooth(t / press));
    if (t < press + hold)        return 0;
    if (t < press + hold + back) return TRAVEL * smooth((t - press - hold) / back);
    return null;
  }
  function ease(to, dur, then = null) {
    anim = { kind: 'ease', t0: performance.now(), from: lift, to, dur, then };
    framed = Math.max(framed, to);
  }
  function startClick() {
    if (lift > TRAVEL + 0.01) return ease(TRAVEL, 0.45, { kind: 'click' });
    anim = { kind: 'click', t0: performance.now() };
  }
  function stopAnim() {
    anim = null;
    framed = Math.max(TRAVEL, lift);
    popUntil = 0;
    clickPop.classList.remove('on');
  }
  function tickAnim() {
    const now = performance.now();
    const prev = lift;
    if (anim.kind === 'ease') {
      const u = Math.min(1, (now - anim.t0) / 1000 / anim.dur);
      lift = anim.from + (anim.to - anim.from) * easeOut(u);
      if (u >= 1) { const nx = anim.then; anim = nx ? { ...nx, t0: now } : null; }
    } else {
      const v = clickLift((now - anim.t0) / 1000);
      lift = v === null ? TRAVEL : v;
      if (v === null) anim = null;
    }
    /* ★動きが終わったところで、画面に入れる高さを合わせなおす */
    if (!anim) framed = Math.max(TRAVEL, lift);
    if (prev > ACT_RISE && lift <= ACT_RISE) popUntil = now + 380;
    clickPop.classList.toggle('on', now < popUntil);
    placeParts();
    paintSplitBtn();
  }
  /* ★動くのはオブジェクトだけ。スイッチはおわんの中なので、そのまま置く */
  function placeParts() {
    const h = heights();
    swMock.position.set(0, 0, h.plateTop);
    swMock.userData.stem.position.z = Math.min(lift, TRAVEL);
    for (const m of [upMesh, upGhost]) if (m) m.position.z = lift;
    const v = views[0];
    v.setRange(h.bottom, Math.max(work.span.z, h.rim) + framed);
  }
  function paintSplitBtn() {
    $('.split-btn').textContent = lift > TRAVEL + 0.05 ? '組み立てる' : '分解';
  }
  /* 分解したときに離す高さ。縁から抜けきるだけ上げる */
  function awayNow() {
    const h = heights();
    return Math.min(60, Math.max(10, (h.rim - h.floorTop) + NEED_IN + 6));
  }
  function xrayPlanes() {
    const eye = sideView.eyeVec();
    const c = new THREE.Vector3(0, 0, work.span.z / 2);
    nearPlane.normal.copy(eye);
    nearPlane.constant = -c.dot(eye);
    farPlane.normal.copy(eye).negate();
    farPlane.constant = c.dot(eye);
  }
  function applyXray() {
    $('.xray-btn').classList.toggle('on', xray);
    xrayPlanes();
    for (const m of [upMat, loMat]) {
      m.clippingPlanes = xray ? [farPlane] : null;
      m.side = xray ? THREE.DoubleSide : THREE.FrontSide;
      /* ★切り取り面の枚数や side を変えたら、作りなおしを頼むこと */
      m.needsUpdate = true;
    }
    for (const m of [upGhost, loGhost]) if (m) m.visible = xray;
  }
  function aimLight() {
    if (step !== LAST) return key.position.set(1, -1.4, 1.6);
    const a = orbitAng.az + 0.6, e = orbitAng.el + 0.5;
    key.position.set(Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e) + 0.6);
  }

  function clearParts() {
    for (const m of [upMesh, loMesh, upGhost, loGhost]) if (m) scene.remove(m);
    if (upMesh) upMesh.geometry.dispose();
    if (loMesh) loMesh.geometry.dispose();
    upMesh = loMesh = upGhost = loGhost = null;
  }

  /* できあがりの2つを作る。③に入ったときに1回だけ。
     ★オブジェクトは切らない。底に止まり穴を掘るだけ（digPocket）。 */
  function buildParts() {
    clearParts();
    splitInfo = null;
    const h = heights();
    const inner = innerLoop();
    if (!inner || inner.length < 3) return;
    const t0 = performance.now();
    const dug = digPocket(work.positions, {
      recess: mode === 'wrap' ? RECESS : 0,
      deep: HOLE_DEPTH, side: ROOM_SIDE,
      arm: BOSS.arm, th: BOSS.th, cx: 0, cy: 0,
    });
    const bowl = bowlSolid({
      inner, outer: growLoop(inner, h.wall),
      bottom: h.bottom, floorTop: h.floorTop, rim: h.rim,
      roomMid: h.roomBot + POLE_H, roomBot: h.roomBot,
      side: ROOM_SIDE, poleR: POLE_D / 2, cx: 0, cy: 0,
    });
    if (!bowl) return;
    splitInfo = {
      upper: dug.tris, lower: bowl, dug: dug.ok, why: dug.why,
      upperTris: dug.tris.length / 9, lowerTris: bowl.length / 9,
      ms: Math.round(performance.now() - t0),
    };
    const mk = (arr, mat, layer) => {
      if (!arr.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.layers.set(layer);
      scene.add(m);
      return m;
    };
    upMesh = mk(splitInfo.upper, upMat, L_UP);
    loMesh = mk(splitInfo.lower, loMat, L_LOW);
    const share = (src, mat, layer) => {
      if (!src) return null;
      const m = new THREE.Mesh(src.geometry, mat);
      m.renderOrder = 6;
      m.layers.set(layer);
      scene.add(m);
      return m;
    };
    upGhost = share(upMesh, upGhostMat, L_UP);
    loGhost = share(loMesh, loGhostMat, L_LOW);
    applyXray();
  }

  /* ── 描きなおし ───────────────────────────────── */
  function repaint() {
    /* ★①では見本を出さない（置く場所がない）。
         ★③ではスイッチはおわんの中なので、ふだんは見えないのが正しい（半透明のときだけ）。 */
    swMock.visible = step !== 1 && (step !== LAST || xray);
    mesh.visible = step !== LAST;      // ③はできあがりのほうを見せる
    const msgs = [];
    if (step === 1) {
      $('.out-tall').textContent = `${(+rTall.value).toFixed(1)} mm`;
      $('.out-spin').textContent = `${ang[axis]}°（${axis.toUpperCase()}軸）`;
      $('.axis-note').textContent = {
        x: 'X軸は倒す・起こす。右の窓がX軸から見た図',
        y: 'Y軸は倒す・起こす。正面がそのままY軸から見た図なので、窓は1つ',
        z: 'Z軸は立てたまま回す。右の窓が上（＝Z軸）から見た図',
      }[axis];
      const [x, y, z] = [work.span.x, work.span.y, work.span.z].map(v => v.toFixed(1));
      const ratio = Math.max(work.span.x, work.span.y, work.span.z) / SWITCH_H;
      $('.size-note').textContent =
        `いま ${x} × ${y} × ${z} mm（スイッチの約 ${ratio.toFixed(1)} 倍）`
      + ` ／ スイッチは ${SWITCH_W} × ${SWITCH_W} × ${SWITCH_H} mm`;
      const thinnest = Math.min(work.span.x, work.span.y);
      if (thinnest < SWITCH_W + WALL * 2)
        msgs.push(`細すぎる。いちばん細いところが ${thinnest.toFixed(1)}mm で、`
                + `スイッチ（${SWITCH_W}mm角）＋肉 ${WALL}mm が入らない`);
      /* ★底に穴を掘るので、それだけの肉が要る。いちばん浅い「のせる」で見る */
      if (work.span.z < NEED_ON + 2)
        msgs.push(`低すぎる。底に十字の穴（${NEED_ON.toFixed(1)}mm）を掘ると突きぬける`);
      else if (work.span.z < NEED_IN + 2)
        msgs.push(`「包む」には低い（底に ${NEED_IN.toFixed(1)}mm 要る）。②で「のせる」を選んで`);
    } else if (step === 2) {
      const h = heights();
      const usesR = USES_SIZE(pillar);
      $('.sides-row').hidden = pillar !== 'poly';
      $('.wrap-row').hidden  = mode !== 'wrap';
      rSize.disabled = !usesR;
      $('.mode-note').textContent = MODES.find(m => m.id === mode).note;
      $('.out-sides').textContent = `${rSides.value} 角`;
      $('.out-wall').textContent  = `${(+rWall.value).toFixed(1)} mm`;
      $('.out-gap').textContent   = `${(+rGap.value).toFixed(2)} mm`;
      $('.out-wrap').textContent  = `${(+rWrap.value).toFixed(1)} mm（底から）`;
      $('.out-size').textContent  = usesR ? `${(+rSize.value).toFixed(1)} mm` : '—';

      const inner = innerLoop();
      const top = mode === 'wrap' ? +rWrap.value : work.span.z;
      const okObj = objectFits(inner, top);
      const okRoom = roomFitsIn(inner);
      drawBowl(inner, h, okObj && okRoom);
      /* スイッチを置く。「のせる」は上ハウジングごと台の中に入る */
      swMock.position.set(0, 0, h.plateTop);

      const outerR = inner ? Math.max(...inner.map(q => Math.hypot(q[0], q[1]))) : 0;
      /* ★おわんはオブジェクトより下へ伸びる。そこまで入るように寄せかたを渡す */
      for (const v of views) {
        v.setRange(h.bottom, Math.max(work.span.z, h.rim));
        v.setRadius(outerR + h.wall);
      }
      $('.bowl-note').textContent =
        `おわんの高さ ${(h.rim - h.bottom).toFixed(1)}mm`
      + `（底板 ${h.wall.toFixed(1)} ＋ 部屋 ${h.roomDeep.toFixed(1)}`
      + (mode === 'wrap' ? ` ＋ 包む ${(h.rim - h.floorTop).toFixed(1)}` : '')
      + `） ／ 外まわり 約 ${(outerR + h.wall).toFixed(1)}mm`;

      if (!inner)
        msgs.push(pillar === 'free'
          ? '「上から」の画面をなぞって、柱のかたちを描いてください'
          : 'かたちが取れなかった');
      else {
        if (!okRoom)
          msgs.push(`細すぎて、スイッチの部屋（${ROOM_SIDE}mm角）が入らない。`
                  + '大きさを上げるか、かたちを変えて');
        else if (!okObj)
          msgs.push(mode === 'wrap'
            ? 'オブジェクトが内がわからはみ出している。大きさを上げるか、包む高さを下げて'
            : 'オブジェクトが台からはみ出している。大きさを上げて');
        if (mode === 'wrap' && work.span.z < NEED_IN + 2)
          msgs.push(`「包む」には低い。底に ${NEED_IN.toFixed(1)}mm 要る`);
      }
    } else if (step === LAST) {
      $('.parts').textContent = splitInfo
        ? `上パーツ ${splitInfo.upperTris.toLocaleString()} 枚 ／ `
          + `おわん ${splitInfo.lowerTris.toLocaleString()} 枚（${splitInfo.ms}ms）`
        : '作れなかった';
      if (!splitInfo) {
        msgs.push('②のかたちでは作れなかった。部屋がはみ出していないか見て');
      } else if (!splitInfo.dug) {
        msgs.push(splitInfo.why === 'flat'
          ? 'オブジェクトの底が平らでないので、穴を掘っていない。'
            + '①で向きを変えて、平らな面を下にして'
          : `オブジェクトの底が狭くて、穴（${ROOM_SIDE}mm角）が入らない。`
            + '①で大きくするか、②で「のせる」にして');
      }
    }
    hint.textContent = msgs.join(' ／ ');
    hint.classList.toggle('warn', msgs.length > 0);
  }

  /* ── フローの進み ────────────────────────────── */
  function goto(n) {
    const from = step;
    step = n;
    root.querySelectorAll('.flow li').forEach(li =>
      li.classList.toggle('on', +li.dataset.step === step));
    $('.sec-size').hidden = step !== 1;
    $('.sec-bowl').hidden = step !== 2;
    $('.sec-preview').hidden = step !== LAST;

    /* ①に入る／①を出るときは、置きなおし方（重心 or 底）が変わるので作りなおす */
    if ((step === 1) !== (from === 1)) rebuild('anchor');
    /* ★外まわりの一覧表は②に入ったとき1回だけ（実測20ms）。
         向きごと・高さごとの太さがこれで引けるので、あとは動かしてもその場で返る。 */
    if (step === 2 && from === 1) {
      prof = buildProfile(work.positions, 0, 0);
      let big = 0;
      for (const v of prof.r) if (v > big) big = v;
      rSize.min = 3;
      rSize.max = (big * 1.6 + 10).toFixed(1);
      rSize.value = (big + 1.5).toFixed(1);
      rWrap.min = 1;
      rWrap.max = work.span.z.toFixed(1);
      rWrap.value = (work.span.z * 0.4).toFixed(1);
      freePts = null;
    }
    if (step !== 2) clearBowl();
    if (step !== 2 && step !== LAST) {
      for (const v of views) { v.setRange(null); v.setRadius(0); }
    }
    /* ★半透明は③だけのもの。②へ戻ったときに切り取り面が残っていると、
         上パーツが半分に切れたまま出る。 */
    if (step !== LAST && xray) { xray = false; applyXray(); }
    if (step === LAST) {
      buildParts();
      /* ★③に入ったら、オブジェクトが持ち上がって外れるところを見せる */
      const away = awayNow();
      stopAnim();
      lift = 0;
      framed = TRAVEL + away;
      ease(TRAVEL + away, 1.0);
      paintSplitBtn();
      const h = heights();
      const inner = innerLoop();
      const outerR = inner ? Math.max(...inner.map(q => Math.hypot(q[0], q[1]))) : 0;
      for (const v of views) v.setRadius(outerR + h.wall);
    } else {
      clearParts(); splitInfo = null;
      stopAnim();
      lift = TRAVEL; framed = TRAVEL;
    }
    paintViews();
    /* ★②から先はまだ無い。押せないようにして、わけを hint に出す */
    /* ★最後だけ「完成」。押すと書き出し（シーン4）へ移る */
    nextBtn.textContent = step === LAST ? '完成' : '次へ';
    nextBtn.disabled = false;
    $('.prev-btn').disabled = step === 1;
    repaint();
  }

  /* ── 窓の出し分け ─────────────────────────────
     ①では「その軸から見ている窓」に、回転の矢印を重ねる。 */
  const AXIS_VIEW = { x: 'x', y: null, z: 'top' };   // null＝正面がその軸から見た図
  function paintViews() {
    const inTurn = step === 1;
    /* ③は正面ひとつを大きく使う（上から見てもクリックの動きは見えない） */
    const right = inTurn ? AXIS_VIEW[axis] : step === LAST ? null : 'top';
    const solo  = right === null;
    /* ★窓を1つにするときは、入れもの（.col）ごと消す。中の窓を隠すだけだと
         入れものが場所を取ったままで、左の窓が半分の幅にしかならない。 */
    topView.host.toggleAttribute('hidden', solo);
    root.querySelector('.views').classList.toggle('solo', solo);
    if (!solo) topView.setDir(right);

    /* ★SVG に .hidden = false と書いても消えない。属性を直に付け外しする */
    sideArrow.toggleAttribute('hidden', !(inTurn && solo));
    topArrow.toggleAttribute('hidden',  !(inTurn && !solo));

    /* ②はおわんも、③はできあがりの2つだけ */
    for (const v of views) v.setLayers(step === LAST ? 'parts' : step === 2 ? 'bowl' : 'model');
    /* 「自分で描く」のあいだは、上の窓をなぞれることを見せる */
    topView.host.classList.toggle('drawing', step === 2 && pillar === 'free');
    /* ③はつかんでまわせる */
    sideView.host.classList.toggle('clickable', step === LAST);
    if (step === LAST) {
      sideView.setOrbit(orbitAng.az, orbitAng.el);
      sideView.setTag('まわして見る');
    } else { sideView.clearOrbit(); sideView.setTag(DIRS.front.tag); }
    aimLight();
    /* ①は大きさを固定（虫眼鏡つき）、②以降はモデルに合わせて寄る */
    for (const v of views) inTurn ? v.setFixed(FIXED_MM_PER_PX) : v.setAuto();
    for (const v of views) v.reframe();
  }

  /* ── 操作 ────────────────────────────────────── */
  root.querySelectorAll('.mode-btn').forEach(b => {
    b.onclick = () => {
      mode = b.dataset.id;
      root.querySelectorAll('.mode-btn').forEach(o => o.classList.toggle('on', o === b));
      repaint();
    };
  });
  root.querySelectorAll('.pil-btn').forEach(b => {
    b.onclick = () => {
      pillar = b.dataset.id;
      root.querySelectorAll('.pil-btn').forEach(o => o.classList.toggle('on', o === b));
      paintViews();
      repaint();
    };
  });
  for (const el of [rSize, rWrap, rWall, rGap, rSides]) el.oninput = () => repaint();

  /* ── 自分で描く（②のとき、「上から」の窓をなぞる） ── */
  let drawing = false;
  const onDown = ev => {
    if (step !== 2 || pillar !== 'free') return;
    drawing = true;
    freePts = [topView.toWorld(ev)];
    topView.host.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
    repaint();
  };
  const onMove = ev => {
    if (!drawing) return;
    const q = topView.toWorld(ev);
    const last = freePts[freePts.length - 1];
    /* 3画素ぶん動いたら点を足す。細かすぎる点はあとの計算を重くするだけ */
    if (Math.hypot(q[0] - last[0], q[1] - last[1]) < topView.mmPerPx * 3) return;
    freePts.push(q);
    repaint();
  };
  const onUp = ev => {
    if (!drawing) return;
    drawing = false;
    topView.host.releasePointerCapture?.(ev.pointerId);
    if (freePts.length < 3) freePts = null;
    repaint();
  };
  topView.host.addEventListener('pointerdown', onDown);
  topView.host.addEventListener('pointermove', onMove);
  topView.host.addEventListener('pointerup', onUp);
  topView.host.addEventListener('pointercancel', onUp);

  /* 分解／組み立て。③に入ったときと同じ「上へ外れる」動き */
  $('.split-btn').onclick = () => {
    stopAnim();
    if (lift > TRAVEL + 0.05) ease(TRAVEL, 0.6);
    else { framed = TRAVEL + awayNow(); ease(TRAVEL + awayNow(), 1.0); }
    repaint();
  };
  $('.xray-btn').onclick = () => { xray = !xray; applyXray(); repaint(); };

  /* ③の窓は「つかんでまわす」と「押してカチッ」の両方。
     ★動かさずに離したときだけ押したことにする。 */
  const ray = new THREE.Raycaster();
  ray.layers.enableAll();
  let orbiting = null;
  sideView.host.addEventListener('pointerdown', ev => {
    if (step !== LAST) return;
    orbiting = { x: ev.clientX, y: ev.clientY, moved: 0 };
    try { sideView.host.setPointerCapture(ev.pointerId); } catch {}
  });
  sideView.host.addEventListener('pointermove', ev => {
    if (!orbiting) return;
    const dx = ev.clientX - orbiting.x, dy = ev.clientY - orbiting.y;
    orbiting.x = ev.clientX; orbiting.y = ev.clientY;
    orbiting.moved += Math.abs(dx) + Math.abs(dy);
    /* ★「つかんで回す」向きにそろえる（引いた向きと逆にカメラをまわす） */
    orbitAng.az -= dx * 0.011;
    orbitAng.el = Math.max(-1.4, Math.min(1.4, orbitAng.el + dy * 0.011));
    sideView.setOrbit(orbitAng.az, orbitAng.el);
    aimLight();
    if (xray) xrayPlanes();
  });
  const endOrbit = ev => {
    if (!orbiting) return;
    const tap = orbiting.moved < 5;
    orbiting = null;
    try { sideView.host.releasePointerCapture(ev.pointerId); } catch {}
    if (!tap || step !== LAST || !upMesh) return;
    sideView.cam.updateMatrixWorld();
    for (const m of [upMesh, loMesh]) m?.updateMatrixWorld();
    ray.setFromCamera(sideView.ndc(ev), sideView.cam);
    if (!ray.intersectObjects([upMesh, loMesh].filter(Boolean), false).length) return;
    startClick();
    repaint();
  };
  sideView.host.addEventListener('pointerup', endOrbit);
  sideView.host.addEventListener('pointercancel', endOrbit);

  rTall.oninput = () => { rebuild('tall'); repaint(); };
  rSpin.oninput = () => { ang[axis] = +rSpin.value; rebuild('turn'); repaint(); };
  root.querySelectorAll('.axis-btn').forEach(b => {
    b.onclick = () => {
      axis = b.dataset.axis;
      root.querySelectorAll('.axis-btn').forEach(o => o.classList.toggle('on', o === b));
      paintViews();
      repaint();
    };
  });

  /* 左上はタイプ選択（シーン2）へ。ひとつ前のフローへは「次へ」の左のボタン */
  $('.back-btn').onclick = () => onBack?.();
  $('.prev-btn').onclick = () => { if (step > 1) goto(step - 1); };
  nextBtn.onclick = () => {
    if (step < LAST) return goto(step + 1);
    if (!splitInfo || !splitInfo.upperTris || !splitInfo.lowerTris) return;
    /* ★書き出しのシーンには「部品の一覧」だけを渡す。
         flip＝印刷するときひっくり返すか。どちらも底が平らなので回さない。 */
    onDone?.({
      parts: [
        { id: 'upper', label: '上パーツ', tris: splitInfo.upper, color: upMat.color.getHex(), flip: false },
        { id: 'lower', label: 'おわん',   tris: splitInfo.lower, color: loMat.color.getHex(), flip: false },
      ],
    });
  };

  let raf = 0;
  (function loop() {
    raf = requestAnimationFrame(loop);
    /* ★シーンを移るあいだ、この画面は壊さずに外へ出す作りにする。
         外れているあいだは描かない。 */
    if (!sideView.host.isConnected) return;
    if (anim) tickAnim();
    for (const v of views) v.render();
  })();

  rebuild('tall');
  goto(1);

  return {
    /* ── つづきから再開のための覚え書き ──────────────────
       ★1つずつ書き写すのではなく、操作パネルのつまみをまとめて覚える
         （window.Resume は clicker.html が <script> で読んでいる）。
       ★戻すときは値を入れて input を投げるので、いつもの処理が走る＝
         3Dも溝も付いてくる。②の「自分で描く」でなぞった線だけは
         つまみに出ないので戻らない（そこは描き直してもらう）。 */
    snapshot() {
      return { step, form: window.Resume?.readForm(root.querySelector('.panel')) };
    },
    restore(s) {
      if (!s) return;
      /* ★先に goto。あとから writeForm にすること。
           goto はフローに入るたびにバーの動く範囲を決め直すので、
           値を入れてから goto すると、その値が上書きされる
           （②の「大きさ（半径）」が 8.1 → 9.1 に戻ってしまった）。 */
      goto(Math.max(1, Math.min(LAST, s.step || 1)));
      window.Resume?.writeForm(root.querySelector('.panel'), s.form);
    },
    stepNow() { return step; },

    destroy() {
      cancelAnimationFrame(raf);
      topView.host.removeEventListener('pointerdown', onDown);
      topView.host.removeEventListener('pointermove', onMove);
      topView.host.removeEventListener('pointerup', onUp);
      topView.host.removeEventListener('pointercancel', onUp);
      clearBowl();
      clearParts();
      clickPop.remove();
      upMat.dispose(); loMat.dispose();
      upGhostMat.dispose(); loGhostMat.dispose();
      bowlMat.dispose();
      bowlEdge.dispose();
      loopMat.dispose();
      for (const v of views) v.destroy();
      base.geo.dispose();
      if (work !== base) work.geo.dispose();
      meshMat.dispose();
      for (const m of swMock.userData.mats) m.dispose();
      swMock.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    },
  };
}
