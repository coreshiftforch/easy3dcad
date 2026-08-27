/* シーン3・タイプ2（平面で切る）
   指定した平面ひとつでオブジェクトを切るだけの、いちばん単純な作り。
   上パーツ＝切り口より上（底に十字の穴を掘るだけ。柱もすきまも要らない）
   下パーツ＝切り口より下（上からクリッカーの入る穴を掘る）

   フロー
     ① 大きさと向き      … 大きさ（高さ mm）と向きを決める
     ② 切る高さ          … 分かれめの平面をひとつ決める
     ③ 柱の種類          … 上パーツの底に足す「十字穴のついた柱」（円柱／四角柱）
     ④ プレビュー        … 切って・穴をあけて、押す動きを見せる

   ★クリッカーの場所は決めない。②で切った輪の重心（切り口のまん中）に自動で置く。
   ★下パーツの穴（スイッチの部屋）も自動。16.4mm角 × 15.5mm ＋ 底にポールのくぼみ。

   ★スイッチの高さは②で自動的に決まる。押しきったとき「プレート → 上パーツの底」が
     6.6 なので、切り口から下へ 6.6＋8.9＝15.5mm のところがスイッチの底。
     さらに上パーツから出る十字の長さは 9.1−6.6＝ちょうど 2.5mm なので、
     切り口に深さ 2.5 の十字穴を直接掘るだけで済む（タイプ1の柱は使わない）。 */

import * as THREE from 'three';
import { buildGeometry, transformed } from '../geom/model.js';
import { makeSwitchMock, SWITCH_H, SWITCH_W, BELOW_PLATE, CAP_PRESSED, HOLE_DEPTH, TRAVEL }
  from '../geom/switch-mock.js';
import { findNecks } from '../geom/necks.js';
import { thin, sectionSegs, buildLoops, nestLoops, safeZ, pointInPoly } from '../geom/section.js';
import { makeGizmo, AXIS_VEC } from '../geom/gizmo.js';
import { makeBoss, bossSolid, bossPts, BOSS, BOSS_TYPES, ENTRY } from '../geom/boss.js';
import { PRESS_NOTE, BOSS_NOTE, travelNote } from './notes.js';
import { splitByStep, pickShellAt } from '../geom/split.js';
import { capFlat } from '../geom/caps.js';
import { roomBox, roomSquare, roomFits, cutRoom } from '../geom/room.js';

const FLOW = ['大きさと向き', '切る高さ', '穴の種類', 'プレビュー'];
const BUILT = 4;                       // 作ってあるのは④まで
const LAST = 4;                        // 最後のフロー。ここで「完成」→ 書き出しへ
/* 下パーツにあける「スイッチの部屋」。実測どおりで、決めるところはない（自動）。
   スイッチはここへ切り口の四角い穴から上から落としこむ。 */
const ROOM_SIDE = 16.4;
/* 底の中心ポール（固定用）を受けるくぼみ */
const POLE_D = 4.4, POLE_H = 3.3;
/* ★タイプ2の柱の寸法。タイプ1とちがい **底のすきまが無い**（上パーツの底が
     そのままスイッチの箱の上面に乗る）ので、
       柱の長さ … 入りこみ 4.0 だけ（タイプ1は ＋底のすきま 1.0 で 7.5）
       十字穴   … 下端から 6.5mm（＝十字穴 2.5 ＋ 入りこみ 4.0）
     boss.js の holeDepth は `len − floor` なので、floor に −2.5 を渡して
     6.5 を出している（タイプ2では floor は「上パーツの肉へ食いこむぶん」）。 */
const BOSS_DIM = { ...BOSS, len: ENTRY, floor: -2.5 };
const RED = 0xff3b30;
const AMBER = 0xf0c419;
const WALL = 1.6;                      // スイッチのまわりに要る最低限の肉
/* 切り口から下に要る厚み。ここにスイッチがまるごと入る */
const NEED_BELOW = CAP_PRESSED + BELOW_PLATE;   // 15.5
/* 開いたときの大きさ。スイッチのいちばん長いところ（背 18.0mm）の何倍にするか */
const START_RATIO = 4;
/* ①でスイッチの見本を置く高さ（底から）。タイプ1の①とそろえてある */
const START_Z = 10;

/* 虫眼鏡（＋／−）のしるし。タイプ1と同じ絵 */
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

export function mountScene3Type2(root, { model, onBack, onDone } = {}) {
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
    `        <p class="note">切ったあと、切り口から下に ${NEED_BELOW.toFixed(1)}mm ぶんの肉が要る`
    + '（そこにスイッチがまるごと入る）</p>',
    '      </div>',
    '      <div class="sec-cut" hidden>',
    '        <p class="panel-h">切る高さ</p>',
    '        <div class="shapes">',
    '          <button class="shape-btn cut-btn on" type="button" data-id="neck">くびれに合わせる</button>',
    '          <button class="shape-btn cut-btn" type="button" data-id="free">自分で決める</button>',
    '        </div>',
    '        <label class="slabel">高さ<output class="out-height"></output></label>',
    '        <div class="hwrap"><input class="r-height" type="range" step="0.1"><div class="marks"></div></div>',
    '        <p class="note cut-note"></p>',
    '      </div>',
    '      <div class="sec-hole" hidden>',
    '        <p class="panel-h">十字穴のついた柱</p>',
    '        <div class="shapes">',
    BOSS_TYPES.map(t => `          <button class="shape-btn boss-btn${t.id === 'post' ? ' on' : ''}"`
      + ` type="button" data-id="${t.id}">${t.label}</button>`).join('\n'),
    '        </div>',
    '        <p class="note boss-note"></p>',
    `        <p class="note">${BOSS_NOTE}</p>`,
    '        <p class="note">下パーツの穴は自動。決めるところはない</p>',
    '      </div>',
    '      <div class="sec-preview" hidden>',
    '        <p class="panel-h">プレビュー</p>',
    '        <div class="btn-row">',
    '          <button class="split-btn" type="button">分解</button>',
    '          <button class="xray-btn" type="button">半透明</button>',
    '        </div>',
    `        <p class="note">${PRESS_NOTE}</p>`,
    '        <p class="note parts"></p>',
    `        <p class="note">${travelNote(TRAVEL, ROOM_SIDE, '上パーツ')}</p>`,
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

  /* スイッチ。②③は「ここに入る」を見せる目安なので、白い半透明で手前に描く。
     ★④は**実物大の本物らしい姿**にする（不透明・ちゃんと隠れる）。
       組んでいるあいだは下パーツの中なので見えず、分解すると穴に座って見える。 */
  const swMock = makeSwitchMock();
  scene.add(swMock);
  const [swMat, swEdge] = swMock.userData.mats;
  /* ステムだけ色を分けたいので、材料を1つ増やす（軸の色） */
  const swStemMat = swMat.clone();
  swMock.userData.stem.traverse(o => { if (o.isMesh) o.material = swStemMat; });
  swMock.userData.mats.push(swStemMat);

  /* 見た目を段に合わせる。②③＝白い半透明で手前／④＝不透明でちゃんと隠れる */
  function paintSwitchLook() {
    const solid = step === LAST;
    for (const [m, on, off] of [[swMat, 0x2f3742, 0xffffff], [swStemMat, 0x2b6fd6, 0xffffff]]) {
      m.color.setHex(solid ? on : off);
      m.transparent = !solid;
      m.opacity     = solid ? 1 : 0.30;
      m.depthTest   = solid;
      m.depthWrite  = solid;
      m.roughness   = solid ? 0.45 : 0.35;
      /* ★材料の transparent や depthTest を変えたら、作りなおしを頼むこと */
      m.needsUpdate = true;
    }
    swEdge.depthTest = solid;
    swEdge.opacity   = solid ? 0.85 : 0.55;
    swEdge.needsUpdate = true;
  }

  /* 切る高さをつかむ矢印（上下だけ）。
     ★これは L_MODEL に置く。0番のままだと「上から」の窓（②の輪切り）にも出て、
       真上から見た矢印が青い丸になって輪切りに重なる。
       まとまりに layers.set をしても子には移らないので、traverse で全部に当てる。 */
  const loopGizmo = makeGizmo(1, ['z']);
  loopGizmo.visible = false;
  scene.add(loopGizmo);

  /* ★赤い輪と白いスイッチは、どちらもモデルの肉の中にあるので
       depthTest を切って必ず手前に描く。 */
  const loopMat  = new THREE.LineBasicMaterial({ color: RED, depthTest: false, transparent: true });
  const sliceFill = new THREE.MeshBasicMaterial({ color: 0xc9d2dc, side: THREE.DoubleSide });
  const sliceEdge = new THREE.LineBasicMaterial({ color: 0x51606f });
  let loopLine = null, sliceGroup = null, sliceZ = null;

  /* ④で見せる、分けた2つのパーツ */
  const upMat = new THREE.MeshStandardMaterial({ color: 0xf0a668, roughness: 0.6 });
  const loMat = new THREE.MeshStandardMaterial({ color: 0xa8bccd, roughness: 0.6 });
  let upMesh = null, loMesh = null, splitInfo = null;

  /* ── 半透明（手前半分を透かす） ──────────────────
     ★同じ形を2つ描く。奥半分は不透明のまま、手前半分だけ薄い材料で描く。
       どちらを描くかは「材料ごとの切り取り面」で分ける（窓ごとではないので、
       レンダラの localClippingEnabled を立てておくこと）。
     ★奥半分は DoubleSide にする。切り口にふたはあるが、手前を抜いた断面は
       裏を描かないとすっぽ抜けて見える。 */
  const ghostMat = c => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.6, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const upGhostMat = ghostMat(0xf0a668), loGhostMat = ghostMat(0xa8bccd);
  let upGhost = null, loGhost = null, xray = false;
  /* 手前半分と奥半分を分ける面。向きは見ている方向から毎回そろえる（xrayPlanes） */
  const nearPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const farPlane  = new THREE.Plane(new THREE.Vector3(0,  1, 0), 0);
  /* まわして見ている向き（④のプレビュー） */
  const orbitAng = { az: 0, el: 0 };

  /* ③で足す「十字穴のついた柱」。モデルの肉の中にあるので手前に描く。
     ★これは穴のかたちを色ちがいで見せているだけで、掘ってはいない。
       書き出すときは bossSolid で本当に掘ること（④で入れる）。 */
  const bossMats = {
    body: new THREE.MeshStandardMaterial({ color: 0xf0a668, roughness: 0.6, depthTest: false }),
    hole: new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.5, depthTest: false }),
  };
  let bossGroup = null;

  /* スイッチの部屋の見本（自動）。モデルの肉の中にあるので手前に描く。
     ★入っていれば黄色、切り口からはみ出していれば赤。 */
  const holeMat = new THREE.MeshStandardMaterial({
    color: AMBER, roughness: 0.4, transparent: true, opacity: 0.30,
    side: THREE.DoubleSide, depthTest: false, depthWrite: false,
  });
  const holeEdge = new THREE.LineBasicMaterial({ color: AMBER, depthTest: false });
  let holeGroup = null;

  /* ★モデルと、あとで足す切り口の絵は窓ごとに出し分けたいので、レイヤーで分ける。
       0＝どの窓にも出すもの（スイッチの見本・赤い輪・矢印）、1＝モデル、2＝輪切りの絵、
       3＝上パーツ、4＝下パーツ。 */
  const L_MODEL = 1, L_SLICE = 2, L_UP = 3, L_LOW = 4;
  mesh.layers.set(L_MODEL);
  loopGizmo.traverse(o => o.layers.set(L_MODEL));

  /* ── 窓 ──────────────────────────────────────
     どれも平行投影（技術図に近い見え方）。
       front … 正面から（−Y の向きに見る）
       top   … 真上から
       x / y … その軸のはしから見る（回転が円に見える向き） */
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
    /* ★材料ごとの切り取り面（半透明のときに手前半分と奥半分を描き分ける）を効かせる */
    ren.localClippingEnabled = true;
    ren.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(ren.domElement);

    /* ★大きさを変えるとキャンバスの中身は消える。描く直前にまとめて直す */
    let sized = false, mmPerPx = 1, extraH = 0;
    /* まわして見るとき（④）の向き。null＝決まった向きのまま */
    let orbit = null;
    const eyeNow = () => {
      if (!orbit) return DIRS[kind].eye;
      const { az, el } = orbit;
      return [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)];
    };
    /* fixedBase > 0 のあいだは「1画素＝何mm」を固定する。
       ★これがないと、モデルを小さくしてもカメラが寄りなおすので、
         画面上の見た目がまったく変わらない（大きさを決めているのに分からない）。 */
    let fixedBase = 0, zoom = 1;

    function fit() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      ren.setSize(w, h, false);
      const d = { eye: eyeNow(), up: orbit ? [0, 0, 1] : DIRS[kind].up };
      const flat = !orbit && kind === 'top';
      /* ①は重心が原点なので、窓のまん中を原点にそろえる。
         回してもモデルがその場から動かない。②から先は底 z=0 に置きなおすので、
         そのときは見る先を高さの半分に上げる。 */
      const T = new THREE.Vector3();
      if (fixedBase) {
        mmPerPx = fixedBase / zoom;
      } else {
        /* スイッチの見本より小さいモデルでも、見本が切れないように広さを取る */
        const sx = Math.max(work.span.x, SWITCH_W);
        const sy = Math.max(work.span.y, SWITCH_W);
        const sz = Math.max(work.span.z, SWITCH_H) + extraH;
        /* まわすときは、どの向きでも切れないように長いほうで取る */
        const wide  = orbit ? Math.max(sx, sy) : (kind === 'x' ? sy : sx);
        const needH = flat ? sy : sz;                      // 画面の縦に来る寸法
        mmPerPx = Math.max(wide / w, needH / h) * 1.14;
        if (!flat) T.set(0, 0, sz / 2);
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
    const zoomBy = f => {
      zoom = Math.min(8, Math.max(0.2, zoom * f));
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
      /* 大きさを固定するか、モデルに合わせるか */
      setFixed(b) { fixedBase = b; zoomer.toggleAttribute('hidden', false); paintPct(); sized = false; },
      setAuto()   { fixedBase = 0; zoomer.toggleAttribute('hidden', true); sized = false; },
      setDir(k) { if (k !== kind) { kind = k; tagEl.textContent = DIRS[k].tag; sized = false; } },
      /* 窓ごとに、何を出すか。model＝モデル／slice＝輪切りの絵（0番はどちらでも出る） */
      setLayers(mode) {
        cam.layers.set(0);
        if (mode === 'slice') cam.layers.enable(L_SLICE);
        else if (mode === 'parts') { cam.layers.enable(L_UP); cam.layers.enable(L_LOW); }
        else cam.layers.enable(L_MODEL);
      },
      setTag(t) { tagEl.textContent = t; },
      /* 分けた2つが離れるぶん、画面に入れる高さを増やす */
      setExtraH(v) { if (v !== extraH) { extraH = v; sized = false; } },
      /* ④はドラッグでまわせる。az＝横まわり、el＝見おろし（ラジアン） */
      setOrbit(az, el) { orbit = { az, el }; sized = false; },
      clearOrbit() { if (orbit) { orbit = null; sized = false; } },
      eyeVec() { return new THREE.Vector3(...eyeNow()); },
      cam,
      /* 画面の座標 → −1〜1（当たり判定用） */
      ndc(ev) {
        const r = host.getBoundingClientRect();
        return { x: ((ev.clientX - r.left) / r.width) * 2 - 1,
                 y: -((ev.clientY - r.top) / r.height) * 2 + 1 };
      },
      /* 画面で動かした画素数 → モデルの座標での動き（平行投影なので素直に換算できる） */
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

  /* 「カチッ」のふきだし。正面の窓に重ねる */
  const clickPop = document.createElement('span');
  clickPop.className = 'click-pop';
  clickPop.textContent = 'カチッ';
  sideView.host.appendChild(clickPop);

  const easeOut = u => 1 - (1 - u) ** 3;
  const smooth  = u => u * u * (3 - 2 * u);

  /* 1回ぶんのクリック。押しきりで止まって、もどる。終わったら null */
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
    /* 離れているときは、まず組み立ててからクリックする */
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
    /* ★動きが終わったところで、画面に入れる高さを合わせなおす。
         動いている最中に変えると、寄り引きがガタつく。 */
    if (!anim) framed = Math.max(TRAVEL, lift);
    if (prev > ACT_RISE && lift <= ACT_RISE) popUntil = now + 380;
    clickPop.classList.toggle('on', now < popUntil);
    placeParts();
    paintSplitBtn();
  }

  /* 分けたパーツの置きかた。浮き（lift）1本から、沈みぶんと離れぶんを割り出す。
     ★柱は上パーツの一部（bossSolid でつないである）ので一緒に動く。 */
  function placeParts() {
    const rise = Math.min(lift, TRAVEL);
    placeSwitch();
    /* ★動くのは上パーツだけ。スイッチは下パーツの中にいるので、そのまま置く */
    swMock.userData.stem.position.z = rise;
    for (const m of [upMesh, upGhost]) if (m) m.position.z = lift;
    sideView.setExtraH(framed);
  }

  /* 離れていれば「組み立てる」、組んでいれば「分解」 */
  function paintSplitBtn() {
    $('.split-btn').textContent = lift > TRAVEL + 0.05 ? '組み立てる' : '分解';
  }

  /* 分解したときに離す高さ。柱が下パーツから抜けきるだけ上げる */
  function awayNow() {
    return Math.min(40, Math.max(8, ENTRY + 6));
  }

  /* 手前半分と奥半分を分ける面を、いま見ている向きにそろえる */
  function xrayPlanes() {
    const eye = sideView.eyeVec();
    const c = new THREE.Vector3(swPos.x, swPos.y, swPos.z + SWITCH_H / 2);
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

  /* ★④でまわすときは、明かりも一緒にまわす。置きっぱなしだと裏へまわった
       とたんに影の側ばかりになって、形が読めなくなる。 */
  function aimLight() {
    if (step !== LAST) return key.position.set(1, -1.4, 1.6);
    const a = orbitAng.az + 0.6, e = orbitAng.el + 0.5;
    key.position.set(Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e) + 0.6);
  }

  /* ── 部品 ────────────────────────────────────── */
  const $ = s => root.querySelector(s);
  const rTall = $('.r-tall'), rSpin = $('.r-spin');
  const rHeight = $('.r-height');
  const hint = $('.hint'), nextBtn = $('.next-btn');

  let step = 1;
  const ang = { x: 0, y: 0, z: 0 };    // 軸ごとの回した角（度）
  let axis = 'z';                      // いま選んでいる軸
  /* クリッカーの場所。x・y はまん中からのずれ、z はモデルの下端からの高さ。
     ★どれも決めるものではない。高さは②（切る高さ）から、XYは切り口の重心から
       自動で入る。①では見本を出さないので使わない。 */
  const swPos = { x: 0, y: 0, z: START_Z };
  let bossType = 'post';               // 'post'＝円柱／'square'＝四角柱

  /* ── ④の動き ──────────────────────────────────
     ★形は「押しきり」で作ってある。だから位置は「押しきりからどれだけ浮いているか」
       1本で表せる。
         浮き ≦ 4.0（TRAVEL） … スイッチが沈んでいるぶん。ステムも一緒に上がる
         浮き ＞ 4.0           … そこから先は、上パーツが離れていく
       何もしていないときは 4.0（＝指を離した状態）。 */
  const ACT_RISE = TRAVEL - 2.2;       // 2.2mm 沈んだところで鳴る（青軸の実測値）
  const CLICK = { press: 0.16, hold: 0.10, back: 0.22 };
  let lift = TRAVEL;                   // いまの浮き（mm）
  let anim = null;                     // 動きの予定。null＝止まっている
  let framed = TRAVEL;                 // 画面に入れておく高さ（毎フレーム変えるとガタつく）
  let popUntil = 0;
  let necks = [];                      // くびれ・段の候補（②に入るとき1回だけさがす）
  let cutMode = 'neck';                // 'neck'＝候補に合わせる／'free'＝自分で決める
  /* ★つまんで動かしているあいだの「吸いつく前」の高さ。
       矢印のドラッグは1フレームぶんの動きを足していく作りなので、足した先を
       そのまま候補へ引き戻すと、動かした量がどこにも溜まらない（＝ついてこない）。
       生の値をここに溜めて、吸いつきは「バーに書くとき」だけかける。 */
  let cutRaw = 0;
  /* クリッカー（穴・スイッチ・高さの矢印）を置く場所（XY）。
     ★②に入ったとき1回だけ決めて、そこから動かさない。毎回「切り口のまん中」を
       出しなおすと、高さを動かすたびに輪の形が変わって横へがくがく動く。 */
  let holeXY = null;
  /* ★同じ高さで2回切ると三角形をぜんぶ2回なめることになって、スライダがもたつく。
       1回だけ切って、輪郭と輪切りの絵の両方で使い回す。 */
  let cache = { z: null };

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
       計算しなおすと、倒しただけでモデルが大きくなってしまう。
       - 高さのバーを動かしたとき … いまの向きでその高さになる倍率を出す
       - 回したとき               … 倍率はそのまま。バーの表示だけ新しい高さに合わせる */
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

  /* スイッチの見本を、いまの場所へ置く。
     ★底は **境界箱の下端**を使う。①は重心（＝頂点の平均）を原点に置いているので、
       −span.z/2 は箱のまん中であって底ではない。重心が上寄りのモデルだと
       そこは本当の底より下になり、見本がオブジェクトからはみ出して出た。
       ②から先は底を z=0 に置きなおしてあるので、この値はそのまま 0 になる。 */
  function placeSwitch() {
    const floor = work.geo.boundingBox.min.z;
    swMock.position.set(swPos.x, swPos.y, floor + swPos.z + BELOW_PLATE);
  }

  /* ── 切り口（②） ─────────────────────────────
     その高さで切ったときの外まわりと、穴。1回だけ切って使い回す。 */
  function outlineFor(z) {
    if (cache.z === z) return cache;
    const outers = nestLoops(buildLoops(sectionSegs(work.positions, safeZ(work.positions, z))));
    let best = null;
    for (const o of outers) if (!best || o.a > best.a) best = o;
    cache = {
      z, outers,
      outline: best ? thin(best.pts) : null,
      holes: best ? best.holes : [],
    };
    return cache;
  }

  /* 赤い輪。正面から見ると、切る高さの横一本の線に見える */
  function drawLoop(pts, z) {
    if (loopLine) { scene.remove(loopLine); loopLine.geometry.dispose(); loopLine = null; }
    if (!pts || pts.length < 2) return;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = z; });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    loopLine = new THREE.LineLoop(g, loopMat);
    loopLine.renderOrder = 11;
    scene.add(loopLine);
  }

  function clearSlice() {
    if (!sliceGroup) return;
    scene.remove(sliceGroup);
    sliceGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    sliceGroup = null;
    sliceZ = null;
  }

  /* 「上から」の窓に出す、その高さの輪切りだけの絵。
     ★クリップで中を見せると、閉じていない殻は中身が抜ける。塗るほうが読みやすい。 */
  function buildSlice(z, outers) {
    if (sliceGroup && sliceZ === z) return;
    clearSlice();
    sliceGroup = new THREE.Group();
    sliceZ = z;
    const shapes = [];
    const line = pts => {
      const g = new THREE.BufferGeometry();
      const a = new Float32Array(pts.length * 3);
      pts.forEach((q, i) => { a[i*3] = q[0]; a[i*3+1] = q[1]; a[i*3+2] = z; });
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const o = new THREE.LineLoop(g, sliceEdge);
      o.layers.set(L_SLICE);
      sliceGroup.add(o);
    };
    for (const o of outers) {
      const sh = new THREE.Shape(o.pts.map(q => new THREE.Vector2(q[0], q[1])));
      for (const h of o.holes) sh.holes.push(new THREE.Path(h.map(q => new THREE.Vector2(q[0], q[1]))));
      shapes.push(sh);
      line(o.pts);
      for (const h of o.holes) line(h);
    }
    if (shapes.length) {
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shapes), sliceFill);
      m.position.z = z;
      m.layers.set(L_SLICE);
      sliceGroup.add(m);
    }
    scene.add(sliceGroup);
  }

  /* 三角形の並びをいくつでもつなぐ（かたまりの付けかえで3つ以上わたすことがある） */
  function joinF32(...parts) {
    const use = parts.filter(p => p && p.length);
    if (!use.length) return new Float32Array(0);
    if (use.length === 1) return use[0];
    let n = 0;
    for (const p of use) n += p.length;
    const out = new Float32Array(n);
    let w = 0;
    for (const p of use) { out.set(p, w); w += p.length; }
    return out;
  }

  /* その点が切り口の中（穴の外）にあるか */
  function inCut(q, outers) {
    for (const o of outers) {
      if (!pointInPoly(q, o.pts)) continue;
      for (const h of o.holes) if (pointInPoly(q, h)) return false;
      return true;
    }
    return false;
  }

  function clearSplit() {
    for (const m of [upMesh, loMesh, upGhost, loGhost]) if (m) scene.remove(m);
    if (upMesh) upMesh.geometry.dispose();
    if (loMesh) loMesh.geometry.dispose();
    upMesh = loMesh = upGhost = loGhost = null;
  }

  /* 平面ひとつで2つに分けて、切り口に平らなふたを1枚ずつ張る。
     頂点27万ぶん走るので、④に入ったときに1回だけ。 */
  function buildSplit() {
    clearSplit();
    const zg = +rHeight.value, cx = swPos.x, cy = swPos.y;
    const t0 = performance.now();
    /* ★ふたの外まわりは、切り分けと**同じ生の z** で切ること。
         safeZ でずらすと、ふたと殻のふちが合わずにすきまが出る。 */
    const outers = nestLoops(buildLoops(sectionSegs(work.positions, zg)));
    if (!outers.length) { splitInfo = null; return; }
    /* ★splitByStep は段のついた面ぜんぶを扱えるが、zBot と zTop を同じにして
         floor=0 を渡すと、輪の内と外で高さが変わらなくなる＝ただの平面カットになる。
         タイプ2のためだけに切り分けを書き直さなくてよい。 */
    const r = splitByStep(work.positions, outers[0].pts, outers[0].pts, zg, zg, 0, [zg, zg]);

    /* 柱は上パーツの一部。切り口に足あとの穴を空けて、柱の壁とつなぐ（1つの立体になる）。
       ★穴の辺と柱の壁の上の辺は同じ点でできていること（どちらも bossPts）。
         柱が切り口からはみ出すときは、つながずに ふたを張った柱を置くだけにする。 */
    const foot = bossPts(bossType, BOSS_DIM, 40).map(q => [q[0] + cx, q[1] + cy]);
    const footIn = foot.every(q => inCut(q, outers));
    const post = bossSolid(bossType, BOSS_DIM, zg, cx, cy, !footIn);
    /* ★ふたを張って閉じた殻にしてから、かたまりに分ける。
         U字のように腕が2本あるかたちだと、切り口より上が2つ以上に分かれる。
         クリッカーが入るのは1つだけなので、のこりは宙に浮いた部品になる。
         それらは下パーツにくっつけて、下から生えたままにする。 */
    const upShell = joinF32(r.upper, capFlat(outers, footIn ? foot : null, zg, false));
    const picked = pickShellAt(upShell, cx, cy);
    const upper = joinF32(picked.keep, post);

    /* ★下パーツはスイッチの部屋を抜く。抜く前に、ふたを張って閉じた立体にしておくこと
         （開いた殻のまま抜くと、壁を張る相手のふちが取れない）。
         切り口には、部屋の天井ぶんの四角い穴を空けておく。 */
    const box = roomBox(cx, cy, ROOM_SIDE, zg, zg - NEED_BELOW, POLE_D, POLE_H);
    /* ★部屋の四角が切り口におさまっていないと、穴が空かず壁だけが宙に浮く。
         そのときは部屋を作らずに、知らせるだけにする。 */
    const roomIn = roomSquare(box).every(q => inCut(q, outers));
    const lo0 = joinF32(r.lower, capFlat(outers, roomIn ? roomSquare(box) : null, zg, true));
    /* ★まわりの肉が足りないと、部屋は下まで突きぬける（そうしないと口が開く） */
    const fits = roomIn ? roomFits(lo0, box) : true;
    /* ★のこったかたまりは、部屋を抜いたあとに足す（部屋はクリッカーのある
         かたまりの下にあるので、こちらを切る必要はない）。 */
    const lower = joinF32(roomIn ? cutRoom(lo0, box) : lo0, ...picked.strays);

    splitInfo = {
      upper, lower, through: roomIn && !fits, narrow: !roomIn, footIn,
      strays: picked.strays.length,
      upperTris: upper.length / 9, lowerTris: lower.length / 9,
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
    upMesh = mk(upper, upMat, L_UP);
    loMesh = mk(lower, loMat, L_LOW);
    /* 透かし用。形は本体と同じものを使いまわす */
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

  /* ②に入るときに1回だけ候補をさがす（重いので毎回はやらない） */
  function refreshNecks() {
    necks = findNecks(work.positions, 0, work.span.z);
    $('.marks').innerHTML = necks.map(c => `<i style="left:${c.pct.toFixed(2)}%"></i>`).join('');
    rHeight.min = 0;
    rHeight.max = work.span.z.toFixed(1);
    setCutMode(necks.length ? 'neck' : 'free', true);
    holeXY = null;                     // 形が変わったので置きなおす
  }

  /* 「くびれに合わせる」と「自分で決める」の切りかえ。
     reset＝そのやり方での既定の高さに置きなおす */
  function setCutMode(m, reset) {
    cutMode = necks.length ? m : 'free';
    root.querySelectorAll('.cut-btn').forEach(b => b.classList.toggle('on', b.dataset.id === cutMode));
    root.querySelector('.cut-btn[data-id="neck"]').disabled = !necks.length;
    /* しるしは「くびれに合わせる」のときだけ。.marks は display を書いていないので
       ブラウザ既定の [hidden]{display:none} がそのまま効く */
    $('.marks').toggleAttribute('hidden', cutMode !== 'neck');
    if (!reset) return;
    const best = necks.slice().sort((a, b) => b.score - a.score)[0];
    rHeight.value = (cutMode === 'neck' && best
      ? best.pct / 100 * work.span.z
      : work.span.z * 0.45).toFixed(1);
    cutRaw = +rHeight.value;
  }

  /* 高さを入れる口。生の値を溜めて、バーには吸いついた値を書く */
  function setCut(raw) {
    cutRaw = Math.min(+rHeight.max, Math.max(+rHeight.min, raw));
    rHeight.value = snapCut(cutRaw).toFixed(1);
  }

  /* 近くに候補があれば吸いつく（「くびれに合わせる」のときだけ） */
  function snapCut(v) {
    if (cutMode !== 'neck' || !necks.length) return v;
    const tol = Math.max(1.5, work.span.z * 0.03);
    let best = v, bd = tol;
    for (const c of necks) {
      const z = c.pct / 100 * work.span.z;
      const d = Math.abs(z - v);
      if (d < bd) { bd = d; best = z; }
    }
    return best;
  }

  /* 切り口のまん中（多角形の重心）。穴はここに置く。
     ★点の平均だと、点が細かいところへ寄る。面積の重心のほうが「まん中」になる。 */
  function loopCentroid(pts) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
      const f = x0 * y1 - x1 * y0;
      a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    a *= 0.5;
    if (Math.abs(a) < 1e-9) {          // つぶれた輪。点の平均で逃げる
      let sx = 0, sy = 0;
      for (const q of pts) { sx += q[0]; sy += q[1]; }
      return [sx / pts.length, sy / pts.length];
    }
    return [cx / (6 * a), cy / (6 * a)];
  }

  /* 部屋の足あと（上から見た四角）。★辺のまん中も入れておく。
     角だけで見ると、細くくびれた形をすりぬけてしまう。 */
  function roomPts(cx, cy) {
    const h = ROOM_SIDE / 2, N = 8, out = [];
    for (let i = 0; i < N; i++) out.push([cx - h + ROOM_SIDE * i / N, cy - h]);
    for (let i = 0; i < N; i++) out.push([cx + h, cy - h + ROOM_SIDE * i / N]);
    for (let i = 0; i < N; i++) out.push([cx + h - ROOM_SIDE * i / N, cy + h]);
    for (let i = 0; i < N; i++) out.push([cx - h, cy + h - ROOM_SIDE * i / N]);
    return out;
  }

  /* その足あとが切り口に収まるか（穴の外に出ていないか） */
  function holeFits(sec, pts) {
    if (!sec.outline) return false;
    for (const q of pts) {
      if (!pointInPoly(q, sec.outline)) return false;
      for (const hole of sec.holes) if (pointInPoly(q, hole)) return false;
    }
    return true;
  }

  function clearHole() {
    if (!holeGroup) return;
    scene.remove(holeGroup);
    holeGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    holeGroup = null;
  }

  /* スイッチの部屋の見本を立てる。切り口から下へ NEED_BELOW、その下にポールのくぼみ。 */
  function drawRoom(cx, cy, zTop, ok) {
    clearHole();
    holeGroup = new THREE.Group();
    holeMat.color.setHex(ok ? AMBER : RED);
    holeEdge.color.setHex(ok ? AMBER : RED);
    const add = (geo, z0, h) => {
      const m = new THREE.Mesh(geo, holeMat);
      m.position.set(cx, cy, z0 + h / 2);
      m.renderOrder = 12;
      holeGroup.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), holeEdge);
      e.position.copy(m.position);
      e.renderOrder = 12;
      holeGroup.add(e);
    };
    const bot = zTop - NEED_BELOW;
    add(new THREE.BoxGeometry(ROOM_SIDE, ROOM_SIDE, NEED_BELOW), bot, NEED_BELOW);
    add(new THREE.CylinderGeometry(POLE_D / 2, POLE_D / 2, POLE_H, 24).rotateX(Math.PI / 2),
        bot - POLE_H, POLE_H);
    scene.add(holeGroup);
  }

  function clearBoss() {
    if (!bossGroup) return;
    scene.remove(bossGroup);
    bossGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    bossGroup = null;
  }

  /* 柱を立てる。上端は切り口（＝上パーツの底）。そこから下へ ENTRY だけ出る */
  function drawBoss(cx, cy, zTop) {
    clearBoss();
    bossGroup = makeBoss(bossType, BOSS_DIM, zTop, bossMats);
    bossGroup.position.set(cx, cy, 0);
    scene.add(bossGroup);
  }

  /* ── 描きなおし ───────────────────────────────── */
  function repaint() {
    const msgs = [];
    /* ★②で切る高さが決まると、スイッチの高さも決まる（切り口から下へ 15.5mm）。
         見本を置くより先に入れておくこと。あとで読むと1回遅れてずれる。 */
    if (step >= 2) swPos.z = Math.max(0, +rHeight.value - NEED_BELOW);
    /* ★①では出さない（大きさと向きを決めるだけの段なので、置く場所がない）。
         ★④は不透明の本物らしい姿。組んでいるあいだは下パーツの肉に隠れて見えず、
           分解するか半透明にすると出てくる（＝実物と同じ見えかた）。 */
    swMock.visible = step !== 1;
    paintSwitchLook();
    mesh.visible = step !== LAST;      // ④は分けた2つのほうを見せる
    placeSwitch();
    if (step < 2 || step > 3) { drawLoop(null); clearSlice(); }
    if (step !== 3) { clearHole(); clearBoss(); }
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
      /* ★切り口より下にスイッチが丸ごと入るので、全体はそれより高くないと切れない */
      if (work.span.z < NEED_BELOW + 2)
        msgs.push(`低すぎる。切り口から下に ${NEED_BELOW.toFixed(1)}mm が要るので、`
                + `どこで切ってもスイッチが底から出る`);
    } else if (step === 2 || step === 3) {
      const zg = +rHeight.value;
      const sec = outlineFor(zg);
      /* ★穴は切り口のまん中に置く。決めるところはないので、ここで入れてしまう。
           見本を置くより先に入れること（あとで読むと1回遅れてずれる）。
           ★場所は②に入ったとき1回だけ。高さを動かしても横へは動かさない。 */
      if (!holeXY && sec.outline) holeXY = loopCentroid(sec.outline);
      if (holeXY) [swPos.x, swPos.y] = holeXY;
      placeSwitch();
      drawLoop(sec.outline, zg);
      buildSlice(zg, sec.outers);
      /* 高さをつかむ矢印も、同じところ（穴の place）に立てる */
      loopGizmo.position.set(swPos.x, swPos.y, zg);
      loopGizmo.scale.setScalar(Math.max(work.span.x, work.span.y, work.span.z) * 0.22 || 8);

      $('.out-height').textContent = `${zg.toFixed(1)} mm（下から）`;
      const above = work.span.z - zg;
      $('.cut-note').textContent =
        `上パーツ ${above.toFixed(1)}mm ／ 下パーツ ${zg.toFixed(1)}mm`
      + ` ／ スイッチの底は 下から ${Math.max(0, zg - NEED_BELOW).toFixed(1)}mm`;

      /* スイッチの部屋（16.4mm角）が切り口に収まるか。②③で同じ見かた */
      const fits = holeFits(sec, roomPts(swPos.x, swPos.y));
      if (step === 3) {
        drawRoom(swPos.x, swPos.y, zg, fits);
        drawBoss(swPos.x, swPos.y, zg);
        $('.boss-note').textContent = bossType === 'square'
          ? `四角柱 ${BOSS_DIM.sqX} × ${BOSS_DIM.sqY}（実物のステム座そのもの）。`
            + '細い切り口にも入る'
          : `円柱 φ${BOSS_DIM.dia}（壁 0.95mm 均一で丈夫）`;
        if (sec.outline && !fits)
          msgs.push(`スイッチの部屋（${ROOM_SIDE}mm角）が切り口からはみ出している。`
                  + '切る高さを変えるか、①で大きくして');
      }

      if (!sec.outline)
        msgs.push('この高さでは切り口の輪が取れなかった。高さを少し変えて');
      /* ★スイッチは切り口より下へ 15.5mm 入る。そのぶん下になければ底から出る */
      if (zg < NEED_BELOW)
        msgs.push(`下が ${zg.toFixed(1)}mm しかない。切り口から下に ${NEED_BELOW.toFixed(1)}mm`
                + 'ないと、スイッチが底から出る');
      /* ★上パーツには十字の穴を 2.5mm 掘る。それだけの肉が要る */
      else if (above < HOLE_DEPTH + 1)
        msgs.push(`上パーツが ${above.toFixed(1)}mm しかない。`
                + `十字の穴（深さ ${HOLE_DEPTH.toFixed(1)}mm）が掘れない`);
      /* ★スイッチは切り口の穴から上から落としこむ。入口が狭いと入らない */
      else if (step === 2 && sec.outline && !fits)
        msgs.push(`切り口が ${ROOM_SIDE}mm角より狭い。`
                + 'スイッチを上から落としこめないので、高さを変えるか大きくして');
    } else if (step === LAST) {
      const zg = +rHeight.value;
      $('.parts').textContent = splitInfo
        ? `上パーツ ${splitInfo.upperTris.toLocaleString()} 枚 ／ `
          + `下パーツ ${splitInfo.lowerTris.toLocaleString()} 枚`
          + `（切り口 ${zg.toFixed(1)}mm・${splitInfo.ms}ms）`
        : '切り分けられなかった';
      if (!splitInfo) msgs.push('この高さでは切り分けられなかった。②で高さを変えて');
      else {
        if (splitInfo.narrow)
          msgs.push(`切り口が ${ROOM_SIDE}mm角より狭いので、スイッチの部屋を作っていない。`
                  + '②で高さを変えるか、①で大きくして');
        if (splitInfo.through)
          msgs.push('まわりの肉が足りないので、部屋が下まで突きぬけている');
        if (!splitInfo.footIn)
          msgs.push('柱が切り口からはみ出すので、上パーツとつないでいない'
                  + '（別のかたまりとして重ねてある）');
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
    $('.sec-cut').hidden  = step !== 2;
    $('.sec-hole').hidden = step !== 3;
    $('.sec-preview').hidden = step !== LAST;

    /* ①に入る／①を出るときは、置きなおし方（重心 or 底）が変わるので作りなおす */
    if ((step === 1) !== (from === 1)) rebuild('anchor');
    /* ①を出たら、その大きさ・向きで候補をさがしなおす */
    if (step === 2 && from === 1) refreshNecks();
    /* ★半透明は④だけのもの。③へ戻ったときに切り取り面が残っていると、
         上パーツが半分に切れたまま出る。 */
    if (step !== LAST && xray) { xray = false; applyXray(); }
    if (step === LAST) {
      buildSplit();
      /* ★④に入ったら、上パーツが持ち上がって外れるところを見せる。
           組んだ形（浮き0）から始めて、抜けきる高さまで1秒かけて上げる。 */
      const away = awayNow();
      stopAnim();
      lift = 0;
      framed = TRAVEL + away;
      ease(TRAVEL + away, 1.0);
      paintSplitBtn();
    } else {
      clearSplit(); splitInfo = null;
      stopAnim();
      lift = TRAVEL; framed = TRAVEL;
      sideView.setExtraH(0);
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
     ①では「その軸から見ている窓」に、回転の矢印を重ねる。
       X … 左＝正面／右＝X軸から（矢印は右）
       Y … 正面だけ（正面がそのままY軸から見た図なので、矢印は正面に）
       Z … 左＝正面／右＝上から（＝Z軸から、矢印は右） */
  const AXIS_VIEW = { x: 'x', y: null, z: 'top' };   // null＝正面がその軸から見た図
  function paintViews() {
    const inTurn = step === 1;
    /* ④は正面ひとつを大きく使う（上から見てもクリックの動きは見えない） */
    const right = inTurn ? AXIS_VIEW[axis] : step === LAST ? null : 'top';
    const solo  = right === null;
    /* ★窓を1つにするときは、入れもの（.col）ごと消す。中の窓を隠すだけだと
         入れものが場所を取ったままで、左の窓が半分の幅にしかならない。 */
    topView.host.toggleAttribute('hidden', solo);
    root.querySelector('.views').classList.toggle('solo', solo);
    /* ★出さない窓の向きは切りかえない。DIRS にない名前を渡すと落ちる */
    if (!solo) topView.setDir(right);

    /* ★SVG に .hidden = false と書いても消えない。hidden は HTMLElement の
         プロパティで、SVG要素にはないので、ただの野良プロパティになる。
         属性を直に付け外しする。 */
    sideArrow.toggleAttribute('hidden', !(inTurn && solo));
    topArrow.toggleAttribute('hidden',  !(inTurn && !solo));
    loopGizmo.visible = step === 2;
    /* ②③は「上から」の窓に輪切りだけを出す（モデルは出さない。形が読みやすい）。
       穴の見本は0番なので、輪切りの上に重なって見える。 */
    if (!solo) topView.setLayers(step === 2 || step === 3 ? 'slice' : 'model');
    sideView.setLayers(step === LAST ? 'parts' : 'model');
    /* ④はつかんでまわせる */
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
  root.querySelectorAll('.cut-btn').forEach(b => {
    b.onclick = () => { setCutMode(b.dataset.id, true); repaint(); };
  });
  /* ★バーは「つまみの場所」がそのまま値になる（絶対）ので、生の値はそれでよい。
       矢印のほうだけが足し算（相対）なので、そちらで cutRaw を伸ばしていく。 */
  rHeight.oninput = () => { setCut(+rHeight.value); repaint(); };
  root.querySelectorAll('.boss-btn').forEach(b => {
    b.onclick = () => {
      bossType = b.dataset.id;
      root.querySelectorAll('.boss-btn').forEach(o => o.classList.toggle('on', o === b));
      repaint();
    };
  });

  /* ── 矢印をつかんで動かす ─────────────────────
     平行投影なので、画面で動かした画素数をそのままモデルの動きに換算できる。
     それを軸の向きへ落として、その軸ぶんだけ動かす。 */
  const ray = new THREE.Raycaster();
  /* ★当たり判定もレイヤーを見る。0番から外したものを足したときに当たらなくなる */
  ray.layers.enableAll();
  let dragAxis = null, dragKind = null, dragView = null, lastPt = null;
  function attachDrag(view) {
    view.host.addEventListener('pointerdown', ev => {
      /* つかめる矢印は②の「切る高さ」だけ（Zの1本） */
      const target = step === 2 ? loopGizmo : null;
      if (!target) return;
      /* ★当たり判定の前に行列を更新する。ふだんは描くときに更新されるが、
           押した直後などまだ1枚も描いていないと古いままで、矢印が原点に
           大きさ1で置かれていることになり、いつまでも当たらない。 */
      view.cam.updateMatrixWorld();
      target.updateMatrixWorld(true);
      ray.setFromCamera(view.ndc(ev), view.cam);
      const hit = ray.intersectObjects(target.children, true)[0];
      if (!hit || !hit.object.userData.axis) return;
      dragAxis = hit.object.userData.axis;
      dragKind = target === loopGizmo ? 'cut' : 'pos';
      if (dragKind === 'cut') cutRaw = +rHeight.value;
      dragView = view;
      lastPt = [ev.clientX, ev.clientY];
      /* ★つかんだ指を追いかける。窓の外へ出ても離すまで効かせたい */
      try { view.host.setPointerCapture(ev.pointerId); } catch {}
      ev.preventDefault();
    });
    view.host.addEventListener('pointermove', ev => {
      if (!dragAxis || dragView !== view) return;
      const w = view.screenDelta(ev.clientX - lastPt[0], ev.clientY - lastPt[1]);
      lastPt = [ev.clientX, ev.clientY];
      const d = w.dot(AXIS_VEC[dragAxis]);
      if (dragKind === 'cut') setCut(cutRaw + d);
      repaint();
    });
    const end = ev => {
      if (dragView !== view) return;
      dragAxis = null;
      try { view.host.releasePointerCapture(ev.pointerId); } catch {}
    };
    view.host.addEventListener('pointerup', end);
    view.host.addEventListener('pointercancel', end);
  }
  for (const v of views) attachDrag(v);

  /* 分解／組み立て。④に入ったときと同じ「上へ外れる」動き */
  $('.split-btn').onclick = () => {
    stopAnim();
    if (lift > TRAVEL + 0.05) ease(TRAVEL, 0.6);
    else { framed = TRAVEL + awayNow(); ease(TRAVEL + awayNow(), 1.0); }
    repaint();
  };
  /* 半透明。手前半分を透かして、中の構造と穴を見せる */
  $('.xray-btn').onclick = () => { xray = !xray; applyXray(); repaint(); };

  rTall.oninput = () => { rebuild('tall'); repaint(); };
  rSpin.oninput = () => { ang[axis] = +rSpin.value; rebuild('turn'); repaint(); };
  root.querySelectorAll('.axis-btn').forEach(b => {
    b.onclick = () => {
      axis = b.dataset.axis;
      root.querySelectorAll('.axis-btn').forEach(o => o.classList.toggle('on', o === b));
      rSpin.value = ang[axis];
      paintViews();
      repaint();
    };
  });

  /* ④の窓は「つかんでまわす」と「押してカチッ」の両方。
     ★動かさずに離したときだけ押したことにする（まわしながら押されると鬱陶しい）。 */
  let orbiting = null;
  sideView.host.addEventListener('pointerdown', ev => {
    /* ★矢印をつかんだときは、まわさない（②）。当たり判定が先に走るのでゆずる */
    if (step !== LAST || dragAxis) return;
    orbiting = { x: ev.clientX, y: ev.clientY, moved: 0 };
    try { sideView.host.setPointerCapture(ev.pointerId); } catch {}
  });
  sideView.host.addEventListener('pointermove', ev => {
    if (!orbiting) return;
    const dx = ev.clientX - orbiting.x, dy = ev.clientY - orbiting.y;
    orbiting.x = ev.clientX; orbiting.y = ev.clientY;
    orbiting.moved += Math.abs(dx) + Math.abs(dy);
    /* ★「つかんで回す」向きにそろえる。右へ引いたらモデルも右へ回る＝
         カメラは左へまわるので、角度は引いた向きと逆に足す（上下は逆にしない）。 */
    orbitAng.az -= dx * 0.011;
    /* ★見おろしは ±80°まで。真上まで行くと上向きベクトルと重なって画が崩れる */
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
    /* 動かさずに離した＝押した。モデルに当たっていればカチッと沈む */
    sideView.cam.updateMatrixWorld();
    for (const m of [upMesh, loMesh]) m?.updateMatrixWorld();
    ray.setFromCamera(sideView.ndc(ev), sideView.cam);
    if (!ray.intersectObjects([upMesh, loMesh].filter(Boolean), false).length) return;
    startClick();
    repaint();
  };
  sideView.host.addEventListener('pointerup', endOrbit);
  sideView.host.addEventListener('pointercancel', endOrbit);

  /* 左上はタイプ選択（シーン2）へ。ひとつ前のフローへは「次へ」の左のボタン */
  $('.back-btn').onclick = () => onBack?.();
  $('.prev-btn').onclick = () => { if (step > 1) goto(step - 1); };
  nextBtn.onclick = () => {
    if (step < LAST) return goto(step + 1);
    if (!splitInfo || !splitInfo.upperTris || !splitInfo.lowerTris) return;
    /* ★書き出しのシーンには「部品の一覧」だけを渡す。作り方は渡さない。
         flip＝印刷するときひっくり返すか。タイプ1と同じく、どちらも回さない。 */
    onDone?.({
      parts: [
        { id: 'upper', label: '上パーツ', tris: splitInfo.upper, color: upMat.color.getHex(), flip: false },
        { id: 'lower', label: '下パーツ', tris: splitInfo.lower, color: loMat.color.getHex(), flip: false },
      ],
    });
  };

  let raf = 0;
  (function loop() {
    raf = requestAnimationFrame(loop);
    /* ★あとで書き出し（シーン4）へ移るとき、この画面は壊さずに外へ出す作りにする。
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
      for (const v of views) v.destroy();
      base.geo.dispose();
      if (work !== base) work.geo.dispose();
      meshMat.dispose();
      for (const m of swMock.userData.mats) m.dispose();
      swMock.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      for (const m of loopGizmo.userData.mats) m.dispose();
      loopGizmo.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      loopMat.dispose();
      holeMat.dispose();
      holeEdge.dispose();
      for (const m of Object.values(bossMats)) m.dispose();
      clearHole();
      clearBoss();
      clearSplit();
      upMat.dispose(); loMat.dispose();
      upGhostMat.dispose(); loGhostMat.dispose();
      clickPop.remove();
      sliceFill.dispose();
      sliceEdge.dispose();
      if (loopLine) loopLine.geometry.dispose();
      clearSlice();
    },
  };
}
