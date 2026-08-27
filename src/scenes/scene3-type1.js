/* シーン3・タイプ1（カップケーキ型）
   下パーツが器、上パーツがその中に落ちこむ形。あいだの溝が見える。

   フロー
     ① 大きさと向き     … 大きさ・向きと、クリッカーの位置の仮決め
     ② 溝を決める       … 同じ高さの閉じた輪を作る
     ③ 溝を作る         … 輪に幅を持たせて下へ押し出す（半透明の青で見せる）
     ④ クリッカーの位置  … 溝が決まったので、ここで本決め（ぴったりの高さが出せる）
     ⑤ 十字の穴         … 上パーツの底に、十字穴のついた柱を足す（2種類）
     ⑥ プレビュー       … 段のついた面（外へ→下へ→内へ）で2つに分けて、
                          クリックの動きと、ばらした形を見せる
   ★スイッチを入れる部屋（下パーツの四角い穴）は実測どおりに自動で決める。
     16.4mm角／上は溝の底まで／下はクリッカーの底まで。
   読みこんだモデルがすでに2つに分かれていたら、②〜⑤は飛ばして⑥だけ。 */

import * as THREE from 'three';
import { buildGeometry, transformed } from '../geom/model.js';
import { findNecks } from '../geom/necks.js';
import { SHAPES, USES_SIZE, makeLoop, scaleLoop } from '../geom/loop.js';
import { thin, sectionSegs, sectionSegsY, buildLoops, nestLoops, safeZ, pointInPoly } from '../geom/section.js';
import { grooveGeometry, offsetLoop, DEFAULT_SIDE, DEFAULT_FLOOR } from '../geom/groove.js';
import { splitByStep } from '../geom/split.js';
import { capUpper, capLower } from '../geom/caps.js';
import { cutRoom, roomBox, roomSquare, roomFits } from '../geom/room.js';
import { makeRim, rimAt, rimFlat, rimHeightFn, rimSmooth, rimClear } from '../geom/rim.js';
import { buildProfile, radiusAt, neckAt } from '../geom/profile.js';
import { makeSwitchMock, SWITCH_H, SWITCH_W, BELOW_PLATE, HOLE_DEPTH, TRAVEL } from '../geom/switch-mock.js';
import { makeGizmo, AXIS_VEC } from '../geom/gizmo.js';
import { makeBoss, bossSolid, holeDepth, BOSS, BOSS_TYPES, ENTRY } from '../geom/boss.js';

const FLOW = ['大きさと向き', '溝を決める', '溝を作る', 'クリッカーの位置',
              '十字の穴', 'プレビュー'];
const LAST = 6;                        // 作ってあるのは⑥まで
/* 下パーツにあける「スイッチの部屋」。実測（実物パーツ\実測.md）から
     逃げ 16.4角（プレートより上）／プレート開口 14.1角・厚1.3／空洞 15.2角×5.6 */
/* pole … 中心ポール（固定用の円柱）を受けるくぼみ。実物 φ3.85 × 3.3 */
const ROOM = { side: 16.4, plate: 14.1, pole: 4.4, poleH: 3.3 };
const RED  = 0xff3b30;
const BLUE = 0x2b6fd6;
const WALL = 1.6;                      // スイッチのまわりに要る最低限の肉
/* 開いたときの大きさ。スイッチのいちばん長いところ（背 18.0mm）の何倍にするか。
   ★読みこんだままの寸法だと、119mm の猫に 15.6mm のスイッチという不つりあいになる。 */
const START_RATIO = 4;

/* 虫眼鏡（＋／−）のしるし */
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

export function mountScene3Type1(root, { model, onBack, onDone } = {}) {
  /* 読みこんだそのままの形（Z上・底 z=0）。ここからは触らない */
  const base = buildGeometry(model);
  let work = base;                     // 大きさと向きをかけたあとの形

  const flowHTML = FLOW.map((t, i) =>
    `<li data-step="${i + 1}"><b>${i + 1}</b><span>${t}</span></li>`).join('');
  const bossHTML = BOSS_TYPES.map(t =>
    `<button class="boss-btn${t.id === 'post' ? ' on' : ''}" type="button" data-id="${t.id}"`
    + `${t.todo ? ' disabled' : ''}>${t.label}${t.todo ? '<i>これから</i>' : ''}</button>`).join('');
  const shapeHTML = SHAPES.map(s =>
    `<button class="shape-btn${s.id === 'circle' ? ' on' : ''}" type="button" data-id="${s.id}">${s.label}</button>`).join('');

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
    ...VIEW('third'),
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
    '      </div>',
    '      <div class="sec-loop" hidden>',
    '        <p class="panel-h">輪の形</p>',
    `        <div class="shapes">${shapeHTML}</div>`,
    '        <label class="slabel">大きさ（半径）<output class="out-size"></output></label>',
    '        <input class="r-size" type="range" step="0.1">',
    '        <div class="inset-row" hidden>',
    '          <label class="slabel">縮め<output class="out-inset"></output></label>',
    '          <input class="r-inset" type="range" min="20" max="90" step="1" value="90">',
    '        </div>',
    '        <div class="corner-row" hidden>',
    '          <label class="slabel">角の丸み<output class="out-corner"></output></label>',
    '          <input class="r-corner" type="range" min="0" max="100" step="1" value="30">',
    '        </div>',
    '        <label class="slabel">高さ<output class="out-height"></output></label>',
    '        <div class="hwrap"><input class="r-height" type="range" step="0.1"><div class="marks"></div></div>',
    '      </div>',
    '      <div class="sec-groove" hidden>',
    '        <p class="panel-h">溝の太さと深さ</p>',
    '        <label class="slabel">横のすきま<output class="out-width"></output></label>',
    '        <input class="r-width" type="range" min="0.05" max="1" step="0.05">',
    '        <label class="slabel">底のすきま<output class="out-floor"></output></label>',
    '        <input class="r-floor" type="range" min="0.2" max="3" step="0.1">',
    '        <label class="slabel">深さ<output class="out-depth"></output></label>',
    '        <input class="r-depth" type="range" step="0.1">',
    '        <p class="note depth-note"></p>',
    '        <button class="auto-depth" type="button" hidden>自動へ</button>',
    '        <button class="pro-btn" type="button">プロ編集</button>',
    '        <div class="pro-row" hidden>',
    '          <button class="neck-btn" type="button">くびれに合わせる</button>',
    '          <button class="hand-btn" type="button">手動調整</button>',
    '          <button class="flat-btn" type="button">平らに戻す</button>',
    '        </div>',
    '        <p class="note pro-note" hidden></p>',
    '      </div>',
    '      <div class="sec-boss" hidden>',
    '        <p class="panel-h">十字穴のついた柱</p>',
    `        <div class="bosses">${bossHTML}</div>`,
    '        <p class="note boss-note"></p>',
    '        <p class="note">太さも長さも実測どおりで決まる（変えられない）。'
    + '十字は 3.90 × 腕1.45。長さが要るときは上へ伸ばす（上パーツをえぐる）</p>',
    '      </div>',
    '      <div class="sec-preview" hidden>',
    '        <p class="panel-h">プレビュー</p>',
    '        <div class="btn-row">',
    '          <button class="split-btn" type="button">分解</button>',
    '          <button class="xray-btn" type="button">半透明</button>',
    '        </div>',
    '        <p class="note">モデルを押すと、カチッと沈む。半透明にすると中と穴が見える</p>',
    '        <p class="note parts"></p>',
    `        <p class="note">押しきった形で作っている。指を離すと上パーツが ${TRAVEL.toFixed(1)}mm 上がる。`
    + `スイッチの部屋は ${ROOM.side}mm角で自動（上は溝の底、底は胴の底。`
    + `そのまん中に中心ポールの φ${ROOM.pole} のくぼみ）</p>`,
    '      </div>',
    '      <div class="sec-pos" hidden>',
    '        <p class="panel-h">クリッカーの位置</p>',
    '        <button class="move-btn" type="button">移動</button>',
    '        <div class="pos-bars" hidden>',
    '          <label class="slabel">左右（X）<output class="out-px"></output></label>',
    '          <input class="r-px" type="range" step="0.1" value="0">',
    '          <label class="slabel">前後（Y）<output class="out-py"></output></label>',
    '          <input class="r-py" type="range" step="0.1" value="0">',
    '          <label class="slabel">高さ（Z）<output class="out-pz"></output></label>',
    '          <input class="r-pz" type="range" step="0.1" value="0">',
    '        </div>',
    '        <p class="note sw-note"></p>',
    '        <button class="fit-z" type="button" hidden>十字を溝の底に合わせる</button>',
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
       しか集めないので、0番に置いたままだと、別レイヤーだけを映す窓
       （⑤の「上パーツだけ」）が真っ黒になる。 */
  const sky = new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.2);
  sky.layers.enableAll();
  scene.add(sky);
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.layers.enableAll();
  key.position.set(1, -1.4, 1.6);
  scene.add(key);
  /* ★⑥でまわすときは、明かりも一緒にまわす。置きっぱなしだと裏へまわった
       とたんに影の側ばかりになって、形が読めなくなる。 */
  function aimLight() {
    if (step !== 6) return key.position.set(1, -1.4, 1.6);
    const a = orbitAng.az + 0.6, e = orbitAng.el + 0.5;
    key.position.set(Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e) + 0.6);
  }

  const meshMat = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.7, metalness: 0.03 });
  const mesh = new THREE.Mesh(work.geo, meshMat);
  scene.add(mesh);

  /* ★赤い輪・青い溝・白いスイッチは、どれも depthTest を切って必ず手前に描く。
       どれもモデルの肉の中にあるので、そのままだと見えない。 */
  const loopMat = new THREE.LineBasicMaterial({ color: RED, depthTest: false, transparent: true });
  /* ★溝は筒なので面が何枚も重なる。1枚は薄くしないと真っ青な帯になる */
  const grooveMat = new THREE.MeshStandardMaterial({
    color: BLUE, roughness: 0.4, transparent: true, opacity: 0.22,
    side: THREE.DoubleSide, depthTest: false, depthWrite: false,
  });
  let loopLine = null, grooveMesh = null;

  const upMat = new THREE.MeshStandardMaterial({ color: 0xf0a668, roughness: 0.6 });
  const loMat = new THREE.MeshStandardMaterial({ color: 0xa8bccd, roughness: 0.6 });
  let upMesh = null, loMesh = null, splitInfo = null;

  /* ── 半透明（手前半分を透かす） ──────────────────
     ★同じ形を2つ描く。奥半分は不透明のまま、手前半分だけ薄い材料で描く。
       どちらを描くかは「材料ごとの切り取り面」で分ける（窓ごとではないので、
       レンダラの localClippingEnabled を立てておくこと）。
     ★奥半分は DoubleSide にする。切り口にふたはないので、裏を描かないと
       中がすっぽ抜けて何も見えない。 */
  const ghostMat = c => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.6, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const upGhostMat = ghostMat(0xf0a668), loGhostMat = ghostMat(0xa8bccd);
  let upGhost = null, loGhost = null, xray = false;
  /* 手前半分と奥半分を分ける面。向きは見ている方向から毎回そろえる（xrayPlanes） */
  const nearPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const farPlane  = new THREE.Plane(new THREE.Vector3(0,  1, 0), 0);
  /* まわして見ている向き（⑥のプレビューと、③のプロ編集で共通） */
  const orbitAng = { az: 0, el: 0 };
  /* 左の窓をつかんでまわせる場面。
     ★プロ編集では、正面からだと向こうがわの点が手前の点に隠れてつかめない
       （点は depthTest なしで全部見えているので、光線は手前のほうに当たる）。
       まわせるようにして、はじめて12方向ぜんぶに手が届く。 */
  const canOrbit = () => step === 6 || (step === 3 && pro);

  /* ── プロ編集（分かれめを高さ方向にうねらせる） ─────
     ★うねりは「②で決めた高さからのずれ」で持つ。高さのバーを動かしても
       うねりの形はそのままついてくる。 */
  const rim = makeRim(12);
  let pro = false, hand = false, handIdx = -1;
  let prof = null;                     // 外まわりの一覧表（プロ編集に入ったとき1回）
  let rimLine = null, rimDots = null;
  /* ★角度を測るまん中。プロ編集に入ったときの輪の重心で固定する。
       毎回はかりなおすと、輪を動かしたとたんにうねりがねじれる。 */
  let rimC = [0, 0];
  const TAU = Math.PI * 2;

  /* 輪のまん中。角度はここから測る */
  function loopCenter(pts) {
    let x = 0, y = 0;
    for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  }
  /* その高さでの「分かれめの高さ」を返すもの（平らなら ただの数） */
  function rimFn(pts, z) {
    if (!pro || rimFlat(rim)) return z;
    return rimHeightFn(rim, z, rimC[0], rimC[1]);
  }

  /* うねりの行きすぎを止める。
       下 … 壁が 3mm は残るところまで（それより下げると受けが浅くなる）
       上 … モデルの上端の 1mm 手前まで */
  function clampRim(z, depth) {
    const lo = -(depth - 3), hi = work.span.z - z - 1;
    for (let i = 0; i < rim.n; i++)
      rim.dz[i] = Math.max(lo, Math.min(hi, rim.dz[i]));
  }

  /* 向きごとに、いちばん細い高さ（くびれ）へ合わせる */
  function fitNecks(z, depth) {
    if (!prof) return;
    const band = Math.max(4, work.span.z * 0.18);
    for (let i = 0; i < rim.n; i++)
      rim.dz[i] = neckAt(prof, i * TAU / rim.n, z, band) - z;
    rimSmooth(rim, 0.22);
    clampRim(z, depth);
  }

  /* 分かれめの線と、つまむ点。オブジェクトの表面にそって描く */
  const rimLineMat = new THREE.LineBasicMaterial({ color: RED, depthTest: false, transparent: true });
  const dotMat = new THREE.MeshBasicMaterial({ color: RED, depthTest: false });
  const dotOnMat = new THREE.MeshBasicMaterial({ color: 0x1d4ed8, depthTest: false });
  function clearRim() {
    for (const o of [rimLine, rimDots]) {
      if (!o) continue;
      scene.remove(o);
      o.traverse?.(c => { if (c.geometry) c.geometry.dispose(); });
      if (o.geometry) o.geometry.dispose();
    }
    rimLine = rimDots = null;
  }
  function drawRimLine(z) {
    clearRim();
    if (!pro || !prof) return;
    const N = 144;
    const arr = new Float32Array(N * 3);
    const at = th => {
      const zz = z + rimAt(rim, th);
      const r = radiusAt(prof, th, zz);
      return [rimC[0] + Math.cos(th) * r, rimC[1] + Math.sin(th) * r, zz];
    };
    for (let i = 0; i < N; i++) {
      const p = at(i * TAU / N);
      arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    rimLine = new THREE.LineLoop(g, rimLineMat);
    rimLine.renderOrder = 12;
    scene.add(rimLine);

    if (!hand) return;
    /* つまむ点。★当たり判定は見た目より大きめに取る（小さいと当たらない） */
    rimDots = new THREE.Group();
    const rad = Math.max(work.span.x, work.span.y, work.span.z) * 0.016;
    for (let i = 0; i < rim.n; i++) {
      const p = at(i * TAU / rim.n);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(rad, 14, 10),
        i === handIdx ? dotOnMat : dotMat);
      dot.position.set(p[0], p[1], p[2]);
      dot.renderOrder = 13;
      const grab = new THREE.Mesh(new THREE.SphereGeometry(rad * 2.6, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false }));
      grab.position.copy(dot.position);
      for (const o of [dot, grab]) { o.userData.idx = i; o.userData.axis = 'z'; }
      rimDots.add(dot, grab);
    }
    scene.add(rimDots);
  }
  upGhostMat.clippingPlanes = [nearPlane];
  loGhostMat.clippingPlanes = [nearPlane];

  /* ★切り取り面は「いま見ている向き」で決める。まわしたときにY固定のままだと、
       横から見ているのに前後で切れていて、何も透けなくなる。 */
  function xrayPlanes() {
    const eye = sideView.eyeVec();                  // カメラのほうを向くベクトル
    const c = new THREE.Vector3(swPos.x, swPos.y, swPos.z + SWITCH_H / 2);
    nearPlane.normal.copy(eye);                     // 手前がわ（カメラに近いほう）
    nearPlane.constant = -c.dot(eye);
    farPlane.normal.copy(eye).negate();
    farPlane.constant = c.dot(eye);
  }

  function applyXray() {
    xrayBtn.classList.toggle('on', xray);
    xrayPlanes();
    for (const m of [upMat, loMat]) {
      m.clippingPlanes = xray ? [farPlane] : null;
      m.side = xray ? THREE.DoubleSide : THREE.FrontSide;
      /* ★切り取り面の枚数や side を変えたら、作りなおしを頼むこと */
      m.needsUpdate = true;
    }
    for (const m of [upGhost, loGhost]) if (m) m.visible = xray;
  }

  const swMock = makeSwitchMock();
  scene.add(swMock);

  /* ⑤で足す「十字穴のついた柱」 */
  /* ★モデルの肉の中にあるので、depthTest を切って手前に描く（ほかの見本と同じ） */
  const bossMats = {
    body: new THREE.MeshStandardMaterial({ color: 0xf0a668, roughness: 0.6, depthTest: false }),
    hole: new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.5, depthTest: false }),
  };
  const bossDim = { ...BOSS };
  let bossType = 'post', bossGroup = null;

  /* 柱の「見せるだけ」の絵。zTop に null を渡すと消す。
     ★これは穴のかたちを色ちがいで見せているだけで、掘ってはいない。
       本物（十字穴をあけた立体）は上パーツの中に入っている（bossSolid）。
       だから**上パーツを出す窓には出さない**。二重になるうえ、⑥で分解したときに
       上パーツだけが動いて、こちらが置きざりになる。 */
  function drawBoss(zTop, cx, cy) {
    if (bossGroup) {
      scene.remove(bossGroup);
      bossGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      bossGroup = null;
    }
    if (zTop == null) return;
    bossGroup = makeBoss(bossType, bossDim, zTop, bossMats);
    bossGroup.position.set(cx, cy, 0);
    scene.add(bossGroup);
  }

  /* つかんで動かす矢印。長さ1で作っておき、いまのモデルの大きさに合わせて伸ばす */
  const gizmo = makeGizmo(1);
  gizmo.visible = false;
  scene.add(gizmo);

  /* 赤い輪の高さをつかむ矢印（上下だけ） */
  const loopGizmo = makeGizmo(1, ['z']);
  loopGizmo.visible = false;
  scene.add(loopGizmo);

  /* ★モデルと「輪切り」は、窓ごとに出し分けたい。ひとつの場面を3つの窓で描いているので、
       レイヤーで分ける。0＝どの窓にも出すもの、1＝モデル、2＝輪切り。 */
  const L_MODEL = 1, L_SLICE = 2, L_UP = 3, L_LOW = 4;
  mesh.layers.set(L_MODEL);
  const sliceFill = new THREE.MeshBasicMaterial({ color: 0xc9d2dc, side: THREE.DoubleSide });
  /* 断面に出す溝の切り口。重ならないので、はっきりした青でよい */
  const grooveCutMat = new THREE.MeshBasicMaterial({
    color: BLUE, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthTest: false,
  });
  const sliceEdge = new THREE.LineBasicMaterial({ color: 0x5b6774 });
  let sliceGroup = null, sliceZ = null;

  /* ⑤の縦の断面（十字を通る XZ）。②の輪切りと同じ見せ方で、塗り＋輪郭。
     ★平面で切って中を見せる（クリップ）やり方だと、閉じていない殻の中身が抜けて読めない。
       ②と同じく「切り口の輪」を作って塗るほうが分かりやすい。 */
  let vsliceGroup = null, vsliceKey = null;

  /* 輪を y=y0 の線で切ったときの x（左から順） */
  function crossX(loop, y0) {
    const xs = [];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      if ((a[1] - y0) * (b[1] - y0) > 0) continue;
      if (Math.abs(b[1] - a[1]) < 1e-12) continue;
      const t = (y0 - a[1]) / (b[1] - a[1]);
      if (t < 0 || t > 1) continue;
      xs.push(a[0] + (b[0] - a[0]) * t);
    }
    return xs.sort((p, q) => p - q);
  }

  function buildVSlice(y, gr) {
    const key = `${y}|${gr ? `${gr.side}|${gr.floor}|${gr.zTop}|${gr.depth}|${gr.pts.length}|${gr.hole ? gr.hole.length + ':' + gr.hole[0] : ''}` : ''}`;
    if (vsliceGroup && vsliceKey === key) return;
    clearVSlice();
    vsliceGroup = new THREE.Group();
    vsliceKey = key;
    const outers = nestLoops(buildLoops(sectionSegsY(work.positions, y)));
    const line = pts => {
      const g = new THREE.BufferGeometry();
      const a = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => { a[i*3] = p[0]; a[i*3+1] = y; a[i*3+2] = p[1]; });
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const o = new THREE.LineLoop(g, sliceEdge);
      o.layers.set(L_SLICE);
      vsliceGroup.add(o);
    };
    const shapes = [];
    for (const o of outers) {
      const sh = new THREE.Shape(o.pts.map(p => new THREE.Vector2(p[0], p[1])));
      for (const h of o.holes) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
      shapes.push(sh);
      line(o.pts);
      for (const h of o.holes) line(h);
    }
    if (shapes.length) {
      const g = new THREE.ShapeGeometry(shapes);
      /* XY で作った面を、XZ（縦）へ立てる */
      g.rotateX(Math.PI / 2);
      g.translate(0, y, 0);
      const m = new THREE.Mesh(g, sliceFill);
      m.layers.set(L_SLICE);
      vsliceGroup.add(m);
    }

    /* 溝の切り口。カップなので この面では
         左右の壁（2枚）＋ 底の板（1枚）の3つの長方形になる */
    if (gr) {
      const zBot = gr.zTop - gr.depth, zFloor = zBot + gr.floor;
      const xo = crossX(offsetLoop(gr.pts,  gr.side / 2), y);
      const xi = crossX(offsetLoop(gr.pts, -gr.side / 2), y);
      const rects = [];
      if (xo.length >= 2) {
        const oL = xo[0], oR = xo[xo.length - 1];
        /* 底の板は、柱が通るところを抜く（左右2枚に分かれる） */
        const xb = crossX(gr.hole || [], y);
        if (xb.length >= 2) {
          rects.push([oL, xb[0], zBot, zFloor]);
          rects.push([xb[xb.length - 1], oR, zBot, zFloor]);
        } else rects.push([oL, oR, zBot, zFloor]);
        if (xi.length >= 2) {
          const iL = xi[0], iR = xi[xi.length - 1];
          rects.push([oL, iL, zFloor, gr.zTop]);
          rects.push([iR, oR, zFloor, gr.zTop]);
        } else {
          rects.push([oL, oR, zFloor, gr.zTop]);
        }
      }
      for (const [x0, x1, z0, z1] of rects) {
        if (x1 - x0 < 1e-4 || z1 - z0 < 1e-4) continue;
        const sh = new THREE.Shape();
        sh.moveTo(x0, z0); sh.lineTo(x1, z0); sh.lineTo(x1, z1); sh.lineTo(x0, z1); sh.closePath();
        const g2 = new THREE.ShapeGeometry(sh);
        g2.rotateX(Math.PI / 2);
        g2.translate(0, y, 0);
        const m2 = new THREE.Mesh(g2, grooveCutMat);
        m2.layers.set(L_SLICE);
        m2.renderOrder = 12;
        vsliceGroup.add(m2);
      }
    }
    scene.add(vsliceGroup);
  }
  function clearVSlice() {
    if (!vsliceGroup) return;
    scene.remove(vsliceGroup);
    vsliceGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    vsliceGroup = null;
    vsliceKey = null;
  }

  function buildSlice(z, outers) {
    if (sliceGroup && sliceZ === z) return;
    if (sliceGroup) {
      scene.remove(sliceGroup);
      sliceGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    sliceGroup = new THREE.Group();
    sliceZ = z;
    const shapes = [];
    const line = pts => {
      const g = new THREE.BufferGeometry();
      const a = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => { a[i*3] = p[0]; a[i*3+1] = p[1]; a[i*3+2] = z; });
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const o = new THREE.LineLoop(g, sliceEdge);
      o.layers.set(L_SLICE);
      sliceGroup.add(o);
    };
    for (const o of outers) {
      const sh = new THREE.Shape(o.pts.map(p => new THREE.Vector2(p[0], p[1])));
      for (const h of o.holes) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
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

  /* スイッチを入れる部屋の寸法。実測どおりで、決めるところはない（⑤でも⑥でも同じ）。
     一辺は逃げの 16.4mm角、下端はクリッカーの底。上は溝の底まで（その上は上パーツ）。 */
  function roomNow() {
    return { side: ROOM.side, bot: swPos.z, pole: ROOM.pole, poleH: ROOM.poleH };
  }

  /* 下パーツにあける穴（黄色）。スイッチのかたちそのまま。
     ★上は「溝の底」まで。そこから上は上パーツの領分なので、抜いてはいけない。
     ★下も突きぬけない。底は「胴の底」で、そこから下はまん中の円柱（中心ポール）だけ。 */
  const roomMat = new THREE.MeshStandardMaterial({
    color: 0xe0a92c, roughness: 0.4, transparent: true, opacity: 0.24,
    side: THREE.DoubleSide, depthTest: false, depthWrite: false,
  });
  let roomMesh = null;
  function drawRoom(rm, zTop, cx, cy) {
    if (roomMesh) {
      scene.remove(roomMesh);
      roomMesh.traverse(o => o.geometry?.dispose());
      roomMesh = null;
    }
    if (!rm || zTop <= rm.bot) return;
    const zMid = Math.min(zTop, rm.bot + rm.poleH);
    roomMesh = new THREE.Group();
    const put = (g, z0, h) => {
      g.translate(cx, cy, z0 + h / 2);
      const m = new THREE.Mesh(g, roomMat);
      m.renderOrder = 9;
      roomMesh.add(m);
    };
    put(new THREE.BoxGeometry(rm.side, rm.side, zTop - zMid), zMid, zTop - zMid);
    if (zMid - rm.bot > 0.05)
      put(new THREE.CylinderGeometry(rm.pole / 2, rm.pole / 2, zMid - rm.bot, 24)
        .rotateX(Math.PI / 2), rm.bot, zMid - rm.bot);
    scene.add(roomMesh);
  }

  function clearSplit() {
    /* ★透かし用は本体と形を共有しているので、捨てるのは本体のときだけ */
    for (const m of [upGhost, loGhost]) if (m) scene.remove(m);
    upGhost = loGhost = null;
    for (const m of [upMesh, loMesh]) if (m) { scene.remove(m); m.geometry.dispose(); }
    upMesh = loMesh = null;
  }

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

  /* 柱の足あと。溝の底の板は、ここを抜いておく */
  function bossFoot(seg = 40) {
    if (bossType === 'square') {
      const a = bossDim.sqX / 2, b = bossDim.sqY / 2;
      return [[-a,-b],[a,-b],[a,b],[-a,b]].map(p => [p[0] + swPos.x, p[1] + swPos.y]);
    }
    const r = bossDim.dia / 2;
    const out = [];
    for (let i = 0; i < seg; i++) {
      const t = 2 * Math.PI * i / seg;
      out.push([swPos.x + Math.cos(t) * r, swPos.y + Math.sin(t) * r]);
    }
    return out;
  }

  function drawGroove(pts, z, side, floor, depth, hole = null) {
    if (grooveMesh) { scene.remove(grooveMesh); grooveMesh.geometry.dispose(); grooveMesh = null; }
    if (!pts || pts.length < 3) return;
    grooveMesh = new THREE.Mesh(
      grooveGeometry(pts, side, floor, rimFn(pts, z), z - depth, hole), grooveMat);
    /* ★断面の窓には立体のままでは出さない。手前と奥の壁が重なって濃くなるので、
         断面には「その面にある溝の切り口」だけを別に描く（buildVSlice） */
    grooveMesh.layers.set(L_MODEL);
    grooveMesh.renderOrder = 10;
    scene.add(grooveMesh);
  }

  /* ── 2つの窓 ───────────────────────────────── */
  /* 窓の見かた。どれも平行投影（技術図に近い見え方）。
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
    /* ★カメラは十分に遠くへ置く。近くに置くと、当たり判定の光線が場面の途中から
         出てしまい、それより奥（＝カメラ側）にあるものに当たらない。
         描くだけなら near を負にしてごまかせるが、つかむ操作は当たらなくなる
         （上から見る窓が z=1 にいて、z=8.9 のスイッチをつかめなかった）。 */
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
    /* まわして見るとき（⑥）の向き。null＝決まった向きのまま */
    let orbit = null;
    let box = null;               // 見せたいものの箱（null＝モデル全体）
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
      let c;                                                // 見る先の高さ
      const T = new THREE.Vector3();                        // 見る先
      if (fixedBase) {
        mmPerPx = fixedBase / zoom;
        /* ①は重心が原点なので、窓のまん中を原点にそろえる。
           回してもモデルがその場から動かない。 */
        c = 0;
      } else if (box) {
        /* 見せたいものだけに寄る（⑤の「上パーツだけ」の窓） */
        const sz3 = box.getSize(new THREE.Vector3());
        box.getCenter(T);
        mmPerPx = Math.max(Math.max(sz3.x, sz3.y) / w, sz3.z / h) * 1.25;
      } else {
        /* スイッチの見本より小さいモデルでも、見本が切れないように広さを取る */
        const sx = Math.max(work.span.x, SWITCH_W);
        const sy = Math.max(work.span.y, SWITCH_W);
        const sz = Math.max(work.span.z, SWITCH_H) + extraH;
        /* まわすときは、どの向きでも切れないように長いほうで取る */
        const wide  = orbit ? Math.max(sx, sy) : (kind === 'x' ? sy : sx);
        const needH = flat ? sy : sz;                       // 画面の縦に来る寸法
        mmPerPx = Math.max(wide / w, needH / h) * 1.14;
        c = flat ? 0 : sz / 2;
        T.set(0, 0, c);
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
      /* 画面の座標 → モデルの座標（上から見た窓でだけ使う）。
         真上から見ていて上が +Y なので、画面の下向きは −Y になる。 */
      toWorld(ev) {
        const r = host.getBoundingClientRect();
        return [(ev.clientX - r.left - r.width / 2) * mmPerPx,
                -(ev.clientY - r.top - r.height / 2) * mmPerPx];
      },
      get mmPerPx() { return mmPerPx; },
      get kind() { return kind; },
      /* モデルを見せるか、輪切りを見せるか（0番はどちらでも出る） */
      /* 窓ごとに、何を出すか。
           model … モデルと溝（0番のものも出る）
           slice … 切り口の絵（0番のものも出る）
           up    … 上パーツと柱だけ（0番は出さない＝スイッチも部屋も出ない）
           parts … 分けた2つのパーツ（⑥。0番のものも出る） */
      setLayers(mode) {
        if (mode === 'up') return cam.layers.set(L_UP);
        cam.layers.set(0);
        if (mode === 'slice') cam.layers.enable(L_SLICE);
        else if (mode === 'parts') { cam.layers.enable(L_UP); cam.layers.enable(L_LOW); }
        else cam.layers.enable(L_MODEL);
      },
      /* この箱がぴったり入るように寄る（null＝モデル全体に合わせる） */
      setBox(b) { box = b; sized = false; },
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
      reframe() { sized = false; },
      /* 大きさを固定するか、モデルに合わせるか */
      setFixed(base) { fixedBase = base; zoomer.toggleAttribute('hidden', false); paintPct(); sized = false; },
      setAuto() { fixedBase = 0; zoomer.toggleAttribute('hidden', true); sized = false; },
      autoMmPerPx() { return mmPerPx; },
      setDir(k) { if (k !== kind) { kind = k; tagEl.textContent = DIRS[k].tag; sized = false; } },
      setTag(t) { tagEl.textContent = t; },
      /* ★切って中を見せる。平面はレンダラごとに持てるので、窓ごとに切りかえられる */
      setClip(pl) { ren.clippingPlanes = pl ? [pl] : []; },
      setExtraH(v) { if (v !== extraH) { extraH = v; sized = false; } },
      /* ⑥はドラッグでまわせる。az＝横まわり、el＝見おろし（ラジアン） */
      setOrbit(az, el) { orbit = { az, el }; sized = false; },
      clearOrbit() { if (orbit) { orbit = null; sized = false; } },
      eyeVec() { return new THREE.Vector3(...eyeNow()); },
      destroy() { ro.disconnect(); ren.dispose(); ren.domElement.remove(); },
    };
  }
  const sideArrow = root.querySelector('.view.side .spin-arrow');
  const topArrow  = root.querySelector('.view.top .spin-arrow');
  const sideView  = makeView(root.querySelector('.view.side'),  'front');
  const topView   = makeView(root.querySelector('.view.top'),   'top');
  const thirdView = makeView(root.querySelector('.view.third'), 'x');
  const views = [sideView, topView, thirdView];

  /* ★フロー①の「1画素＝何mm」は、読みこんだそのままの大きさで1回だけ決めて固定する。
       2つの窓で同じ値を使うので、左右で見た目の大きさがそろう。 */
  const FIXED_MM_PER_PX = sideView.autoMmPerPx();

  /* ── ⑥の動き ──────────────────────────────────
     ★形は「押しきり」で作ってある。だから位置は「押しきりからどれだけ浮いているか」
       1本で表せる。
         浮き ≦ 4.0（TRAVEL） … スイッチが沈んでいるぶん。ステムも一緒に上がる
         浮き ＞ 4.0           … そこから先は、上パーツが受け口から抜けて離れていく
       何もしていないときは 4.0（＝指を離した状態）。 */
  const ACT_RISE = TRAVEL - 2.2;       // 2.2mm 沈んだところで鳴る（青軸の実測値）
  const CLICK = { press: 0.16, hold: 0.10, back: 0.22 };
  let lift = TRAVEL;                   // いまの浮き（mm）
  let anim = null;                     // 動きの予定。null＝止まっている
  let framed = TRAVEL;                 // 画面に入れておく高さ（毎フレーム変えるとガタつく）
  let popUntil = 0;

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
    if (t < press)              return TRAVEL * (1 - smooth(t / press));
    if (t < press + hold)       return 0;
    if (t < press + hold + back) return TRAVEL * smooth((t - press - hold) / back);
    return null;
  }

  /* から から へ、時間をかけて動かす。終わったら then を始める */
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
    /* 沈んでいく途中で作動点を通ったときだけ鳴らす */
    if (prev > ACT_RISE && lift <= ACT_RISE) popUntil = now + 380;
    clickPop.classList.toggle('on', now < popUntil);
    placeParts();
    paintSplitBtn();
  }

  /* 離れていれば「組み立てる」、組んでいれば「分解」 */
  function paintSplitBtn() {
    splitBtn.textContent = lift > TRAVEL + 0.05 ? '組み立てる' : '分解';
  }

  /* 上パーツ＋柱がぴったり入る箱。⑤の「上パーツだけ」の窓の寄りに使う */
  function upBox() {
    if (!upMesh) return null;
    const b = new THREE.Box3().setFromObject(upMesh);
    if (bossGroup) b.expandByObject(bossGroup);
    return b.isEmpty() ? null : b;
  }

  /* 分解したときに離す高さ。栓が受け口から抜けきるだけ上げる */
  function awayNow() {
    return Math.min(40, Math.max(8, +rDepth.value + 6));
  }

  let raf = 0;
  (function loop() {
    raf = requestAnimationFrame(loop);
    /* ★書き出し（シーン4）へ移るあいだ、この画面は壊さずに外へ出してある。
         外れているあいだは描かない（見えないものを描き続けても無駄なだけ）。 */
    if (!sideView.host.isConnected) return;
    if (anim) tickAnim();
    for (const v of views) v.render();
  })();

  /* ── 部品 ────────────────────────────────────── */
  const $ = s => root.querySelector(s);
  const rTall = $('.r-tall'), rSpin = $('.r-spin');
  const rSize = $('.r-size'), rHeight = $('.r-height');
  const rCorner = $('.r-corner'), cornerRow = $('.corner-row');
  const rInset = $('.r-inset'), insetRow = $('.inset-row');
  const rWidth = $('.r-width'), rFloor = $('.r-floor');
  const rDepth = $('.r-depth');
  const rPx = $('.r-px'), rPy = $('.r-py'), rPz = $('.r-pz');
  const moveBtn = $('.move-btn');
  const splitBtn = $('.split-btn'), xrayBtn = $('.xray-btn');
  const hint = $('.hint'), nextBtn = $('.next-btn');

  let step = 1;
  let shape = 'circle';
  let freePts = null;                  // 「自分で描く」でなぞった線
  const ang = { x: 0, y: 0, z: 0 };    // 軸ごとの回した角（度）
  let axis = 'z';                      // いま選んでいる軸
  let necks = [];
  /* クリッカーの位置。x・y はまん中からのずれ、z はモデルの下端からの高さ。
     ★はじめは底から 10mm 浮かせる（下パーツの底板ぶんの見当）。 */
  const START_Z = 10;
  const swPos = { x: 0, y: 0, z: START_Z };
  let moving = false;                  // 「移動」を押しているあいだ
  let cache = { z: null, outline: null, maxR: 0 };

  rWidth.value = DEFAULT_SIDE;
  rFloor.value = DEFAULT_FLOOR;
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
       計算しなおすと、倒しただけでモデルが大きくなってしまう（実際そうなっていた）。
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

    cache = { z: null, outline: null, maxR: 0 };
    prof = null;                       // 形が変わったので一覧表は作りなおし
    if (pro) { pro = false; hand = false; rimClear(rim); }
    refreshPosRange();
    for (const v of views) v.reframe();
  }

  /* 高さの候補さがしは重いので、②に入るときに1回だけ */
  function refreshNecks() {
    necks = findNecks(work.positions, 0, work.span.z);
    $('.marks').innerHTML = necks.map(c => `<i style="left:${c.pct.toFixed(2)}%"></i>`).join('');
    rHeight.min = 0;
    rHeight.max = work.span.z.toFixed(1);
    const best = necks.slice().sort((a, b) => b.score - a.score)[0];
    rHeight.value = ((best ? best.pct : 45) / 100 * work.span.z).toFixed(1);
    delete rSize.dataset.touched;
  }

  /* スイッチと矢印を、いまの位置へ置く。
     ★底は **境界箱の下端**を使う。①は重心（＝頂点の平均）を原点に置いているので、
       −span.z/2 は箱のまん中であって底ではない。重心が上寄りのモデルだと
       そこは本当の底より下になり、Zを0まで下げるとスイッチが底からはみ出す。
       ②から先は底を z=0 に置きなおしてあるので、この値はそのまま 0 になる。 */
  function placeSwitch() {
    const floor = work.geo.boundingBox.min.z;
    swMock.position.set(swPos.x, swPos.y, floor + swPos.z + BELOW_PLATE);
    gizmo.position.copy(swMock.position);
    /* ★矢印の長さは、そのときのモデルに合わせる。読みこんだときの寸法で作ると、
         小さくしたあとに矢印だけ巨大に残る。 */
    gizmo.scale.setScalar(Math.max(work.span.x, work.span.y, work.span.z) * 0.26 || 10);
  }

  /* ⑥のパーツの置きかた。浮き（lift）1本から、沈みぶんと離れぶんを割り出す。
     ★柱は上パーツの一部なので一緒に動く。スイッチのステムも沈むぶんだけ動く。 */
  function placeParts() {
    const rise  = Math.min(lift, TRAVEL);
    const apart = Math.max(0, lift - TRAVEL);
    placeSwitch();
    /* ★動くのは上パーツだけ。スイッチは下パーツの中にいるので、そのまま置く */
    swMock.userData.stem.position.z = rise;
    for (const m of [upMesh, upGhost]) if (m) m.position.z = lift;
    if (bossGroup) bossGroup.position.z = lift;
    if (loGhost) loGhost.position.z = 0;
    /* ★画面に入れる高さは、動きのあいだ変えない。毎フレーム変えると寄り引きがガタつく */
    sideView.setExtraH(framed);
  }

  function refreshPosRange() {
    const rx = Math.max(work.span.x, SWITCH_W) / 2 + 5;
    const ry = Math.max(work.span.y, SWITCH_W) / 2 + 5;
    rPx.min = (-rx).toFixed(1); rPx.max = rx.toFixed(1);
    rPy.min = (-ry).toFixed(1); rPy.max = ry.toFixed(1);
    rPz.min = 0;
    rPz.max = Math.max(1, work.span.z - SWITCH_H).toFixed(1);
    for (const [k, el] of [['x', rPx], ['y', rPy], ['z', rPz]]) {
      swPos[k] = Math.min(+el.max, Math.max(+el.min, swPos[k]));
      el.value = swPos[k];
    }
  }

  /* 十字の先が溝の底にちょうど届く高さ。合っていなければボタンで合わせられる */
  let fitZ = null;

  /* 位置の表示。fit が null のときは、まだ溝が決まっていない */
  function paintPos(fit) {
    fitZ = fit;
    /* ★離れているときだけボタンを出す。合っているなら出す意味がない */
    $('.fit-z').hidden = !(fit !== null && fit >= 0 && Math.abs(swPos.z - fit) > 0.05);
    $('.out-px').textContent = `${swPos.x.toFixed(1)} mm`;
    $('.out-py').textContent = `${swPos.y.toFixed(1)} mm`;
    $('.out-pz').textContent = swPos.z
      ? `${swPos.z.toFixed(1)} mm（下端から）` : '0.0 mm（下端に置く）';
    if (fit === null) { $('.sw-note').textContent = '溝を作ったあと（④）で、溝との合い方が出せる'; return; }
    if (rDepth.dataset.touched !== '1') {
      $('.sw-note').textContent =
        `溝の深さは自動で合わせている（いま ${(+rDepth.value).toFixed(1)}mm）。動かすと深さも変わる`;
      return;
    }
    const off = swPos.z - fit;
    $('.sw-note').textContent = fit < 0
      ? 'いまの溝だと、どう置いてもスイッチが底から出る'
      : `ぴったりは ${fit.toFixed(1)}mm（いまは ${Math.abs(off) < 0.05 ? 'ぴったり'
          : off > 0 ? `${off.toFixed(1)}mm 高い` : `${(-off).toFixed(1)}mm 低い`}）`;
  }

  /* ★切り口は「輪郭」と「輪切りの絵」の両方で使う。同じ高さで2回切ると、
       三角形9万枚ぶんの走査が2回になって、スライダがもたつく（実測150ms）。
       ここで1回だけ切って、両方で使い回す。 */
  function outlineFor(z) {
    if (cache.z === z) return cache;
    const outers = nestLoops(buildLoops(sectionSegs(work.positions, safeZ(work.positions, z))));
    let best = null;
    for (const o of outers) if (!best || o.a > best.a) best = o;
    const pts = best ? thin(best.pts) : null;
    /* まん中からいちばん遠い／近いところ。近いほうが「内接する輪」の目安になる */
    let m = 0, n = Infinity;
    if (pts) for (const p of pts) {
      const d = Math.hypot(p[0], p[1]);
      if (d > m) m = d;
      if (d < n) n = d;
    }
    cache = { z, outers, outline: pts, maxR: m, minR: pts ? n : 0 };
    return cache;
  }

  /* 溝の深さは、クリッカーの位置から自動で決める。
     ★合わせ先は「カップの一番下」（底の板の厚み＝溝の幅 を含めた下端）。そこが十字の先に当たる。

         溝の底（カップの下端）＝ 十字の先 ＝ クリッカーの高さ ＋ 18.0
         溝の深さ ＝ 溝の高さ − 溝の底

     18.0 は押し込んだときのスイッチの背（プレートより下 8.9 ＋ プレートから十字の先 9.1）。
     人が深さのバーを動かしたら、そのまま手の値を使う。 */
  function autoDepth(z) {
    return Math.max(3, z - (swPos.z + SWITCH_H));
  }
  function depthNow(z) {
    if (rDepth.dataset.touched === '1') return +rDepth.value;
    const d = autoDepth(z);
    rDepth.value = d.toFixed(1);
    return d;
  }

  /* 輪がまるごと切り口の内がわにいるか */
  function inside(loopPts, outline) {
    if (!outline || !loopPts) return true;
    for (const p of loopPts) if (!pointInPoly(p, outline)) return false;
    return true;
  }

  function currentPts(sec, r) {
    if (shape === 'along') {
      if (!sec.outline) return null;
      return scaleLoop(sec.outline, +rInset.value / 100);
    }
    if (shape === 'free')  return freePts;
    return makeLoop(shape, r, 96, +rCorner.value / 100);
  }

  /* 段のついた面で2つに分けて、切り口にふたを張る。
     頂点27万ぶん走るので、⑥に入ったときに1回だけ。 */
  function buildSplit(withRoom = true) {
    clearSplit();
    const z = +rHeight.value, depth = depthNow(z);
    const side = +rWidth.value, floor = +rFloor.value;
    const pts = currentPts(outlineFor(z), +rSize.value);
    if (!pts || pts.length < 3) { splitInfo = null; return; }
    const t0 = performance.now();
    const zBot = z - depth;
    const plug   = offsetLoop(pts, -side / 2);   // 栓の外まわり（上パーツ）
    const socket = offsetLoop(pts,  side / 2);   // 受け口の内まわり（下パーツ）
    const [cx, cy] = loopCenter(pts);
    const zTop = rimFn(pts, z);
    /* うねりの届く幅を渡しておくと、そこから外れた三角形を一気にはじける */
    let dlo = 0, dhi = 0;
    for (const v of rim.dz) { dlo = Math.min(dlo, v); dhi = Math.max(dhi, v); }
    const r = splitByStep(work.positions, plug, socket, zTop, zBot, floor,
      [z + dlo, z + dhi]);
    /* ★ふたの輪っかの外まわりは、その高さのモデルの切り口。
         safeZ でずらした高さではなく、切り分けと同じ生の z で切ること。
         ずらすと、ふたと殻のふちが合わずにすきまが出る。
       ★うねっているときは平らな板では張れないので、殻を切ったときに出た
         「ふちの線」を使う（rimUp / rimLo）。 */
    const flat = rimFlat(rim);
    const outers = flat ? nestLoops(buildLoops(sectionSegs(work.positions, z))) : [];
    /* ★柱（十字穴のついたもの）は上パーツの一部。画面では別のかたまりとして
         描いているが、書き出すものには入れないと ただのカップが出てしまう。
         栓の底に足あとの穴を空けて、柱の壁とつなぐ（1つの立体になる）。
       ★柱が栓からはみ出すときは、穴が空かず壁だけ浮く。そのときはつながず、
         ふたを張った柱を横に置くだけにする（重なっていても印刷はできる）。 */
    const foot = bossFoot();
    const footIn = foot.every(p => pointInPoly(p, plug));
    const post = bossSolid(bossType, bossDim, zBot + floor, swPos.x, swPos.y, !footIn);
    const upper = joinF32(joinF32(r.upper,
      capUpper(outers, plug, zTop, zBot + floor, flat ? null : { segs: r.rimUp, cx, cy },
        footIn ? foot : null)), post);
    /* ★下パーツはスイッチの部屋を抜く。抜く前に、ふたを張って閉じた立体にしておくこと
         （開いた殻のまま抜くと、壁を張る相手のふちが取れない）。
         器の床には、部屋の天井ぶんの四角い穴を空けておく。 */
    const rm = roomNow();
    const box = roomBox(swPos.x, swPos.y, rm.side, zBot, rm.bot, rm.pole, rm.poleH);
    /* ★スイッチは受け口から落としこむので、部屋の四角が受け口の内がわに
         おさまっていないと入らない。おさまっていないまま器の床に穴を空けると、
         穴が床からはみ出て空かず、壁だけが宙に浮く（口が4本開いた）。
         そのときは部屋を作らずに、知らせるだけにする。 */
    const roomIn = roomSquare(box).every(p => pointInPoly(p, socket));
    const cutIt = withRoom && roomIn;
    /* ⑤は上パーツしか映さないので、部屋を抜くのは⑥に入ったときだけ */
    const lo0 = joinF32(r.lower, capLower(outers, socket, zTop, zBot,
      flat ? null : { segs: r.rimLo, cx, cy }, cutIt ? roomSquare(box) : null));
    /* ★肉が足りないと、部屋は下まで突きぬける（そうしないと口が開く）。
         そのときは知らせる。 */
    const fits = cutIt ? roomFits(lo0, box) : true;
    const lower = cutIt ? cutRoom(lo0, box) : lo0;
    splitInfo = {
      upper, lower, through: cutIt && !fits, narrow: withRoom && !roomIn,
      upperTris: upper.length / 9, lowerTris: lower.length / 9,
      capTris: (upper.length - r.upper.length) / 9,
      ms: Math.round(performance.now() - t0),
    };
    const mk = (arr, mat) => {
      if (!arr.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      scene.add(m);
      return m;
    };
    upMesh = mk(splitInfo.upper, upMat);
    loMesh = mk(splitInfo.lower, loMat);
    /* ★上パーツだけを出す窓（⑤）があるので、上と下は別のレイヤーに分ける */
    for (const m of [upMesh]) if (m) m.layers.set(L_UP);
    for (const m of [loMesh]) if (m) m.layers.set(L_LOW);
    /* 透かし用。形は本体と同じものを使いまわす */
    const share = (src, mat) => {
      if (!src) return null;
      const m = new THREE.Mesh(src.geometry, mat);
      m.renderOrder = 6;
      scene.add(m);
      return m;
    };
    upGhost = share(upMesh, upGhostMat);
    loGhost = share(loMesh, loGhostMat);
    if (upGhost) upGhost.layers.set(L_UP);
    if (loGhost) loGhost.layers.set(L_LOW);
    applyXray();
  }

  /* 三角形の並びを2つつなぐ */
  function joinF32(a, b) {
    if (!b.length) return a;
    const out = new Float32Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length);
    return out;
  }

  /* ── 描きなおし ───────────────────────────────── */
  function repaint() {
    const msgs = [];
    /* ★柱の寸法は、深さの自動計算より先に取りこむこと。
         あとで読むと、深さが柱の長さを1回遅れて見ることになる。 */
    /* 柱の長さ＝底のすきま ＋ 十字穴2.5 ＋ 入りこみ4.0。太さは実測のまま */
    bossDim.floor = +rFloor.value;
    bossDim.len = bossDim.floor + HOLE_DEPTH + ENTRY;
    mesh.visible = step !== 6;          // ⑥は分けた2つのパーツのほうを見せる
    /* ★⑥では、スイッチの見本は中にあるので見えないのが正しい。
         半透明にしたときだけ、中の構造として見せる。 */
    swMock.visible = step !== 6 || xray;
    /* ★柱は⑥では本物の形（上パーツの一部）。手前に描かず、ちゃんと隠れさせる。
         ⑤まではモデルの肉の中の見本なので、手前に描く。 */
    for (const m of Object.values(bossMats))
      if (m.depthTest !== (step === 6)) { m.depthTest = step === 6; m.needsUpdate = true; }
    if (step !== 5 && step !== 6 && roomMesh) {
      scene.remove(roomMesh); roomMesh.geometry.dispose(); roomMesh = null;
    }
    if (step < 5 && bossGroup) {
      scene.remove(bossGroup);
      bossGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      bossGroup = null;
    }
    if (bossGroup) bossGroup.visible = step >= 5;

    if (step === 1) {
      drawLoop(null); drawGroove(null);
      placeSwitch();
      paintPos(null);
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
      if (work.span.z < SWITCH_H + 6)
        msgs.push(`低すぎる。スイッチの全高 ${SWITCH_H}mm が入らない`);
    } else {
      const z = +rHeight.value;
      const sec = outlineFor(z);
      const useSize = USES_SIZE(shape);
      if (step === 2) {
        rSize.disabled = !useSize;
        /* ★輪は切り口の内がわに収める。上限は「その形が切り口をはみ出さない大きさ」。
             形ごとに、半径1で作ったときの外まわりの伸び（円なら1、四角なら√2）で割る。
             既定はそこから壁のぶん（1.6mm）内へ入れた大きさ。 */
        if (useSize) {
          let k = 1;
          for (const p of makeLoop(shape, 1, 96, +rCorner.value / 100))
            k = Math.max(k, Math.hypot(p[0], p[1]));
          /* ★ちょうど輪郭に触れる大きさを上限にすると、いちばん端で
               「はみ出している」と出てしまう（境目の判定はあいまい）。
               輪郭から 0.5mm 内へ引いたうえで、さらに 5% 余裕をとる。 */
          const lim = Math.max(2, (sec.minR - 0.5) / k * 0.95);
          rSize.min = 1;
          rSize.max = lim.toFixed(1);
          if (rSize.dataset.touched !== '1')
            rSize.value = Math.max(1, lim - WALL / k).toFixed(1);
          else if (+rSize.value > lim) rSize.value = lim.toFixed(1);
        }
      }
      const r = +rSize.value;
      const pts = currentPts(sec, r);
      const depth = depthNow(z);

      drawLoop(step === 6 ? null : pts, z);
      if (step !== 3) clearRim();
      $('.out-size').textContent   = useSize ? `${r.toFixed(1)} mm` : '—';
      $('.out-height').textContent = `${z.toFixed(1)} mm（下から）`;
      cornerRow.hidden = !(step === 2 && shape === 'round');
      insetRow.hidden  = !(step === 2 && shape === 'along');
      $('.out-corner').textContent = `${(r * +rCorner.value / 100).toFixed(1)} mm`;
      const ins = +rInset.value;
      /* ★上限は90%。輪郭そのまま（100%）だと外に縁が残らず、上パーツを受ける壁ができない */
      $('.out-inset').textContent =
        `${ins}%（外まわり 約${(sec.maxR * ins / 100).toFixed(1)}mm）`;

      if (step === 2) {
        drawGroove(null);
        placeSwitch();
        buildSlice(z, sec.outers);
        /* 赤い輪の高さをつかむ矢印。輪のまん中に立てる */
        let lx = 0, ly = 0;
        if (pts && pts.length) {
          for (const p of pts) { lx += p[0]; ly += p[1]; }
          lx /= pts.length; ly /= pts.length;
        }
        loopGizmo.position.set(lx, ly, z);
        loopGizmo.scale.setScalar(Math.max(work.span.x, work.span.y, work.span.z) * 0.22 || 8);
        if (shape === 'free' && !freePts)
          msgs.push('「上から」の画面をなぞって、輪を描いてください');
        else if (!sec.outline)
          msgs.push('この高さでは切り口の輪が取れなかった。高さを少し変えて');
        /* ★輪は切り口の内がわにいること。外へ出ると、外がわに縁が残らないので
             上パーツを受ける壁ができない（ただのZgでの水平カットになる）。
             「沿った形」は輪郭そのものなので、外へふくらませたときだけ見る。 */
        else if (pts && (shape !== 'along' || +rInset.value > 100) && !inside(pts, sec.outline))
          msgs.push('輪がオブジェクトの外にはみ出している。'
                  + '外がわに縁が残らないので、上パーツを受ける壁ができない');
        /* ★スイッチは上パーツの底より下へ 19.5mm 出る。そのぶん肉がないと底から突き出る。
             はじめ「下に7mmあれば足りる」と出していたが、それは間違いだった。 */
        if (z - depth < SWITCH_H)
          msgs.push(`スイッチが底から出る。溝の高さは 深さ＋${SWITCH_H}mm `
                  + `（いまなら ${(depth + SWITCH_H).toFixed(1)}mm）以上ほしい`);
      } else if (step === 5) {
        /* 柱は上パーツの底にくっつけて、下へ伸ばす。
           上パーツの底＝カップの底の板の上面＝溝の底 ＋ 幅 */
        const gap  = +rFloor.value;
        const zBot = z - depth + gap;
        drawBoss(zBot, swPos.x, swPos.y);
        /* ★溝の底の板は、柱が通るところを抜く。抜かないと板が柱を突きぬける */
        const foot = bossFoot();
        drawGroove(pts, z, +rWidth.value, gap, depth, foot);
        /* 下パーツにあける穴も、黄色の半透明で見せる。上は溝の底まで */
        const rm5 = roomNow();
        drawRoom(rm5, z - depth, swPos.x, swPos.y);
        /* 断面は十字のまん中を通す。溝はこの面にある切り口だけを描く */
        buildVSlice(swPos.y, { pts, side: +rWidth.value, floor: gap, zTop: z, depth, hole: foot });
        /* ★柱はこの repaint で作りなおしているので、寄りもここで取りなおす。
             paintViews のときはまだ前の柱のままで、下端が切れる。 */
        if (!moving) topView.setBox(upBox());
        const size = bossType === 'square'
          ? `${bossDim.sqX.toFixed(1)} × ${bossDim.sqY.toFixed(1)}` : `φ${bossDim.dia.toFixed(1)}`;
        /* ★穴の天井が十字の先に当たる深さまで掘る。入りこむぶんだけ深くなる */
        $('.boss-note').textContent =
          `${size} × 長さ ${bossDim.len.toFixed(1)}mm（底のすきま ${gap.toFixed(1)} ＋ 十字穴 `
        + `${HOLE_DEPTH} ＋ 入りこみ ${ENTRY.toFixed(1)}）。`
        + `十字穴は ${holeDepth(bossDim).toFixed(1)}mm 掘って、天井が十字の先に当たる`;
      } else if (step === 4) {
        /* 溝が決まったので、ぴったりの高さが出せる */
        placeSwitch();
        paintPos(z - depth - SWITCH_H);
        drawGroove(pts, z, +rWidth.value, +rFloor.value, depth);
      } else if (step === 3) {
        const side = +rWidth.value, floor = +rFloor.value;
        if (pro) clampRim(z, depth);
        drawGroove(pts, z, side, floor, depth);
        drawRimLine(z);
        $('.pro-btn').classList.toggle('on', pro);
        $('.pro-row').hidden = !pro;
        $('.pro-note').hidden = !pro;
        $('.hand-btn').classList.toggle('on', hand);
        if (pro) {
          let lo = 0, hi = 0;
          for (const v of rim.dz) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
          $('.pro-note').textContent = rimFlat(rim)
            ? '分かれめは平ら。「くびれに合わせる」か「手動調整」で、首などに沿わせられる'
            : `分かれめのうねり ${lo.toFixed(1)} 〜 ${hi.toFixed(1)}mm`
              + (hand ? '／赤い点をつかんで上下に動かす（上からの窓で選べる）' : '');
          if (depth + lo < 5)
            msgs.push('うねりを下げすぎ。いちばん低いところで壁が5mmを切る');
        }
        $('.out-width').textContent = `${side.toFixed(2)} mm（栓と受け口のあいだ）`;
        $('.out-floor').textContent = `${floor.toFixed(1)} mm（栓の底と器の床）`;
        const auto = rDepth.dataset.touched !== '1';
        $('.out-depth').textContent = `${depth.toFixed(1)} mm${auto ? '（自動）' : ''}`;
        $('.depth-note').textContent = auto
          ? 'クリッカーの位置に合わせて、溝の底が十字のてっぺんに来るようにしている。'
          + 'バーを動かすと手で決められる'
          : '手で決めた深さ。自動に戻すには「自動へ」を押す';
        $('.auto-depth').hidden = auto;
        if (auto && depth <= 3.05)
          msgs.push('クリッカーが高すぎて、溝がほとんど掘れない。'
                  + '④で下げるか、溝の高さを上げて');
        if (z - depth < SWITCH_H)
          msgs.push(`深すぎる。溝の底より下に ${SWITCH_H}mm ないとスイッチが底から出る`);
        if (depth < 7)
          msgs.push('7mm より浅いと、押しきったとき上パーツが溝から抜ける');
        if (side > 0.4)
          msgs.push(`横のすきま ${side.toFixed(2)}mm はゆるい（実測のちょうどよさは 0.20mm）。カタつく`);
        if (side < 0.15)
          msgs.push(`横のすきま ${side.toFixed(2)}mm はきつい。印刷のふくらみで入らないことがある`);
      } else if (step === 6) {
        /* できあがりのプレビュー。段のついた面で分けた2つのパーツと、
           下パーツにあける「スイッチの部屋」を見せる。 */
        drawGroove(null);
        /* ★⑥では柱は上パーツの中にある。別に描くと二重になる */
        drawBoss(null);
        const rm = roomNow();
        /* 部屋も中のものなので、半透明のときだけ見せる */
        if (xray) drawRoom(rm, z - depth, swPos.x, swPos.y);
        else drawRoom(null);
        placeParts();
        paintSplitBtn();
        if (splitInfo)
          $('.parts').textContent =
            `上パーツ ${splitInfo.upperTris.toLocaleString()}枚 ／ `
          + `下パーツ ${splitInfo.lowerTris.toLocaleString()}枚`
          + `（ふたと部屋こみ・${splitInfo.ms}ms）`;
        if (splitInfo && (!splitInfo.upperTris || !splitInfo.lowerTris))
          msgs.push('片がわが空っぽ。輪の大きさか高さを見なおして');
        if (splitInfo?.narrow)
          msgs.push(`受け口がスイッチより狭くて入らない。②で輪を大きくして`
                  + `（${ROOM.side}mm角がおさまる太さが要る）`);
        if (splitInfo?.through)
          msgs.push('まわりの肉が足りず、部屋が下まで突きぬけた。'
                  + 'モデルを大きくするか、クリッカーを上げて');
        /* 部屋の上は溝の底まで。そこから下に 18.0mm ないとスイッチが上へはみ出す */
        if (rm.bot + SWITCH_H > z - depth + 0.05)
          msgs.push(`スイッチが溝の底より上へ出る。深さを浅くするか、クリッカーを下げて`);
      }
    }

    hint.className = msgs.length ? 'hint warn' : 'hint';
    const ok = { 1: 'この大きさならスイッチが入る', 2: 'この高さなら溝を回せる',
                 3: 'この深さで掘れる', 4: 'この位置でよければ次へ',
                 5: 'この柱でよければ次へ',
                 6: 'モデルを押すとカチッと沈む。「分解」でばらせる' };
    hint.textContent = msgs.join(' ／ ') || ok[step] || '';
  }

  /* ── フローの進み ────────────────────────────── */
  function goto(n) {
    const from = step;
    step = n;
    root.querySelectorAll('.flow li').forEach(li =>
      li.classList.toggle('on', +li.dataset.step === step));
    $('.sec-size').hidden   = step !== 1;
    $('.sec-loop').hidden   = step !== 2;
    $('.sec-groove').hidden = step !== 3;
    $('.sec-pos').hidden    = !(step === 1 || step === 4);
    $('.sec-boss').hidden   = step !== 5;
    $('.sec-preview').hidden = step !== 6;

    /* ①に入る／①を出るときは、置きなおし方（重心 or 底）が変わるので作りなおす */
    if ((step === 1) !== (from === 1)) rebuild('anchor');
    if (step === 2 && from === 1) refreshNecks();        // ①を出たら候補を出しなおす
    if (step === 3) {
      rDepth.min = 3;
      rDepth.max = Math.max(8, +rHeight.value).toFixed(1);
    }
    /* ★半透明は⑥だけのもの。⑤へ戻ったときに切り取り面が残っていると、
         上パーツが半分に切れたまま出る。 */
    if (step !== 6 && xray) { xray = false; applyXray(); }
    if (step === 5) buildSplit(false);   // 「上パーツだけ」の窓に要る（部屋はまだ抜かない）
    else if (step === 6) {
      buildSplit();
      /* ★⑥に入ったら、上パーツが持ち上がって外れるところを見せる。
           組んだ形（浮き0）から始めて、抜けきる高さまで1秒かけて上げる。 */
      const away = awayNow();
      stopAnim();
      lift = 0;
      framed = TRAVEL + away;
      ease(TRAVEL + away, 1.0);
    } else if (step !== 5) {
      clearSplit(); splitInfo = null;
      stopAnim();
      lift = TRAVEL; framed = TRAVEL;
      sideView.setExtraH(0);
    }
    paintViews();
    /* ★最後だけ「完成」。押すと書き出し（シーン4）へ移る */
    nextBtn.textContent = step === LAST ? '完成' : '次へ';
    $('.prev-btn').disabled = step === 1;
    topView.host.classList.toggle('drawing', step === 2 && shape === 'free');
    repaint();
  }

  /* ── 窓の出し分け ─────────────────────────────
     ①では「その軸から見ている窓」に、回転の矢印を重ねる。
       X … 左＝正面／右＝X軸から（矢印は右）
       Y … 正面だけ（正面がそのままY軸から見た図なので、矢印は正面に）
       Z … 左＝正面／右＝上から（＝Z軸から、矢印は右）
     ②以降は 左＝正面／右＝上から。矢印は出さない。 */
  const AXIS_VIEW = { x: 'x', y: null, z: 'top' };   // null＝正面がその軸から見た図
  function paintViews() {
    const inTurn = step === 1;
    const inPos  = step === 1 || step === 4;
    const move   = inPos && moving;
    /* 「移動」のあいだは 左＝正面／右上＝上から／右下＝X軸から の3画面。
       ひとつの窓で2方向ずつ動かせるので、3つで X・Y・Z すべてに手が届く。 */
    /* ⑤は右を上下に割る：上＝上パーツだけ（十字の穴が見える向き）／下＝十字を通る断面 */
    const cut = step === 5 && !move;
    const three = move || cut;
    root.querySelector('.views').classList.toggle('three', three);
    thirdView.host.toggleAttribute('hidden', !three);

    /* ⑥は正面ひとつを大きく使う（上から見てもクリックの動きは見えない） */
    const right = move ? 'top'
                : inTurn ? AXIS_VIEW[axis]
                : step === 6 ? null
                : cut ? 'front' : 'top';
    const solo  = right === null;
    topView.host.toggleAttribute('hidden', solo);
    /* ★窓を1つにするときは、入れもの（.col）ごと消す。中の窓を隠すだけだと
         入れものが場所を取ったままで、左の窓が半分の幅にしかならない。 */
    root.querySelector('.views').classList.toggle('solo', solo);
    /* ★出さない窓の向きは切りかえない。DIRS にない名前を渡すと落ちる */
    if (!solo && !cut) topView.setDir(right);
    if (move) thirdView.setDir('x');
    if (cut) {
      /* 右上＝上パーツだけを下からのぞく。十字の穴が手前に来る向き */
      topView.setOrbit(0.55, -0.95);
      topView.setTag('上パーツだけ（下から）');
      topView.setBox(upBox());
      thirdView.setDir('front');
      thirdView.setTag('十字を通る断面（XZ）');
    } else {
      topView.clearOrbit();
      topView.setBox(null);
      /* ★向きが同じだと setDir は何もしないので、⑤のラベルが残る。ここで戻す */
      if (!solo) topView.setTag(DIRS[right].tag);
      clearVSlice();
    }

    /* ★SVG に .hidden = false と書いても消えない。hidden は HTMLElement の
         プロパティで、SVG要素にはないので、ただの野良プロパティになる。
         属性を直に付け外しする。 */
    const arrow = inTurn && !move;
    sideArrow.toggleAttribute('hidden', !(arrow && solo));
    topArrow.toggleAttribute('hidden', !(arrow && !solo));
    gizmo.visible = move;
    loopGizmo.visible = step === 2;
    /* ②は輪切り、⑤は縦の断面。どちらもモデルの代わりに切り口だけを見せる */
    topView.setLayers(step === 2 ? 'slice' : cut ? 'up' : 'model');
    sideView.setLayers(step === 6 ? 'parts' : 'model');
    thirdView.setLayers(cut ? 'slice' : 'model');
    moveBtn.classList.toggle('on', moving);
    sideView.host.classList.toggle('clickable', canOrbit());
    if (canOrbit()) {
      sideView.setOrbit(orbitAng.az, orbitAng.el);
      sideView.setTag(step === 6 ? 'まわして見る' : '正面から（まわせる）');
    } else { sideView.clearOrbit(); sideView.setTag(DIRS.front.tag); }
    aimLight();
    /* バーは「移動」を押しているあいだだけ出す */
    $('.pos-bars').hidden = !move;

    /* ①は大きさを固定（虫眼鏡つき）、②以降はモデルに合わせて寄る */
    for (const v of views) inTurn ? v.setFixed(FIXED_MM_PER_PX) : v.setAuto();
    for (const v of views) v.reframe();
  }

  /* ── 操作 ────────────────────────────────────── */
  moveBtn.onclick = () => { moving = !moving; paintViews(); repaint(); };
  /* 分解／組み立て。⑥に入ったときと同じ「上へ外れる」動き */
  splitBtn.onclick = () => {
    stopAnim();
    if (lift > TRAVEL + 0.05) ease(TRAVEL, 0.6);
    else { framed = TRAVEL + awayNow(); ease(TRAVEL + awayNow(), 1.0); }
    repaint();
  };
  /* 半透明。手前半分を透かして、中の構造と穴を見せる */
  xrayBtn.onclick = () => { xray = !xray; applyXray(); repaint(); };
  for (const [k, el] of [['x', rPx], ['y', rPy], ['z', rPz]])
    el.oninput = () => { swPos[k] = +el.value; repaint(); };

  /* ── 矢印をつかんで動かす ─────────────────────
     平行投影なので、画面で動かした画素数をそのままモデルの動きに換算できる。
     それを軸の向きへ落として、その軸ぶんだけ動かす。 */
  const ray = new THREE.Raycaster();
  /* ★当たり判定もレイヤーを見る。⑤の窓のために上下パーツを 0番から外したので、
       ここを全レイヤーにしておかないと、⑥でモデルを押しても当たらなくなる。 */
  ray.layers.enableAll();
  let dragAxis = null, dragView = null, dragKind = null, lastPt = null;
  function attachDrag(view) {
    view.host.addEventListener('pointerdown', ev => {
      /* つかめる矢印は、段によって変わる。
           ①④＋「移動」… クリッカーの位置（X・Y・Z）
           ②            … 赤い輪の高さ（Zだけ） */
      const target = (moving && (step === 1 || step === 4)) ? gizmo
                   : step === 2 ? loopGizmo
                   : (step === 3 && pro && hand && rimDots) ? rimDots : null;
      if (!target) return;
      /* ★当たり判定の前に行列を更新する。ふだんは描くときに更新されるが、
           押した直後などまだ1枚も描いていないと古いままで、
           矢印が原点に大きさ1で置かれていることになり、いつまでも当たらない。 */
      view.cam.updateMatrixWorld();
      target.updateMatrixWorld(true);
      ray.setFromCamera(view.ndc(ev), view.cam);
      const hit = ray.intersectObjects(target.children, true)[0];
      if (!hit || !hit.object.userData.axis) return;
      dragAxis = hit.object.userData.axis;
      dragKind = target === gizmo ? 'pos' : target === loopGizmo ? 'loop' : 'rim';
      if (dragKind === 'rim') { handIdx = hit.object.userData.idx; repaint(); }
      dragView = view;
      lastPt = [ev.clientX, ev.clientY];
      /* ★つかんだ指を追いかける。窓の外へ出ても離すまで効かせたい。
           使えない場面（合成したイベントなど）では投げるので、包んでおく。 */
      try { view.host.setPointerCapture(ev.pointerId); } catch {}
      ev.preventDefault();
    });
    view.host.addEventListener('pointermove', ev => {
      if (!dragAxis || dragView !== view) return;
      const w = view.screenDelta(ev.clientX - lastPt[0], ev.clientY - lastPt[1]);
      lastPt = [ev.clientX, ev.clientY];
      const d = w.dot(AXIS_VEC[dragAxis]);
      if (dragKind === 'rim') {
        /* ★上からの窓では上下の動きが取れない（d が0になる）。選ぶだけになる */
        if (handIdx >= 0 && d) rim.dz[handIdx] += d;
      } else if (dragKind === 'loop') {
        rHeight.value = Math.min(+rHeight.max, Math.max(+rHeight.min, +rHeight.value + d));
      } else {
        const el = { x: rPx, y: rPy, z: rPz }[dragAxis];
        const v = Math.min(+el.max, Math.max(+el.min, swPos[dragAxis] + d));
        swPos[dragAxis] = v;
        el.value = v;
      }
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

  /* ⑥の窓は「つかんでまわす」と「押してカチッ」の両方。
     ★動かさずに離したときだけ押したことにする（まわしながら押されると鬱陶しい）。 */
  let orbiting = null;
  sideView.host.addEventListener('pointerdown', ev => {
    /* ★点をつかんだときは、まわさない。矢印・点の当たり判定（attachDrag）が
         先に走って dragAxis を立てるので、それを見てゆずる。 */
    if (!canOrbit() || dragAxis) return;
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
    if (!tap || step !== 6 || !upMesh) return;
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

  /* ── プロ編集 ─────────────────────────────────
     分かれめ（Zg）を、向きごとに上下へずらせるようにする。 */
  $('.pro-btn').onclick = () => {
    pro = !pro;
    if (pro) {
      const pts = currentPts(outlineFor(+rHeight.value), +rSize.value);
      rimC = pts && pts.length ? loopCenter(pts) : [0, 0];
      /* ★一覧表は入ったときに1回だけ。作っておけば、あとは動かしてもその場で返る */
      const t0 = performance.now();
      prof = buildProfile(work.positions, rimC[0], rimC[1]);
      prof.ms = Math.round(performance.now() - t0);
    } else { hand = false; handIdx = -1; }
    repaint();
  };
  $('.neck-btn').onclick = () => {
    fitNecks(+rHeight.value, depthNow(+rHeight.value));
    repaint();
  };
  $('.hand-btn').onclick = () => { hand = !hand; repaint(); };
  $('.flat-btn').onclick = () => { rimClear(rim); handIdx = -1; repaint(); };

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

  root.querySelectorAll('.shape-btn').forEach(b => {
    b.onclick = () => {
      shape = b.dataset.id;
      root.querySelectorAll('.shape-btn').forEach(o => o.classList.toggle('on', o === b));
      topView.host.classList.toggle('drawing', shape === 'free');
      repaint();
    };
  });
  rSize.oninput   = () => { rSize.dataset.touched = '1'; repaint(); };
  rCorner.oninput = () => repaint();
  rInset.oninput  = () => repaint();
  rHeight.oninput = () => repaint();
  rWidth.oninput  = () => repaint();
  rFloor.oninput  = () => repaint();
  rDepth.oninput  = () => { rDepth.dataset.touched = '1'; repaint(); };
  $('.auto-depth').onclick = () => { delete rDepth.dataset.touched; repaint(); };
  $('.fit-z').onclick = () => {
    if (fitZ === null) return;
    swPos.z = Math.min(+rPz.max, Math.max(+rPz.min, fitZ));
    rPz.value = swPos.z;
    repaint();
  };
  root.querySelectorAll('.boss-btn').forEach(b => {
    b.onclick = () => {
      bossType = b.dataset.id;
      root.querySelectorAll('.boss-btn').forEach(o => o.classList.toggle('on', o === b));
      repaint();
    };
  });

  /* ── 自分で描く（②のとき、「上から」の窓をなぞる） ── */
  let drawing = false;
  const onDown = ev => {
    if (step !== 2 || shape !== 'free') return;
    drawing = true;
    freePts = [topView.toWorld(ev)];
    topView.host.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
    repaint();
  };
  const onMove = ev => {
    if (!drawing) return;
    const p = topView.toWorld(ev);
    const q = freePts[freePts.length - 1];
    /* 3画素ぶん動いたら点を足す。細かすぎる点はあとの計算を重くするだけ */
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < topView.mmPerPx * 3) return;
    freePts.push(p);
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

  /* 左上はタイプ選択（シーン2）へ。ひとつ前のフローへは「次へ」の左のボタン */
  $('.back-btn').onclick = () => onBack?.();
  $('.prev-btn').onclick = () => { if (step > 1) goto(step - 1); };
  nextBtn.onclick = () => {
    if (step < LAST) return goto(step + 1);
    if (!splitInfo || !splitInfo.upperTris || !splitInfo.lowerTris) return;
    /* ★書き出しのシーンには「部品の一覧」だけを渡す。作り方は渡さない
         （タイプ2・下パーツ生成からも同じシーンへ来られるように）。
       flip＝印刷するときひっくり返すか。★タイプ1は**どちらも回さない**
         （向きはモデルのまま横に並べるだけ）。仕組みだけ残してある。 */
    onDone?.({
      parts: [
        { id: 'upper', label: '上パーツ', tris: splitInfo.upper, color: upMat.color.getHex(), flip: false },
        { id: 'lower', label: '下パーツ', tris: splitInfo.lower, color: loMat.color.getHex(), flip: false },
      ],
    });
  };

  rebuild('tall');
  goto(1);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      topView.host.removeEventListener('pointerdown', onDown);
      topView.host.removeEventListener('pointermove', onMove);
      topView.host.removeEventListener('pointerup', onUp);
      topView.host.removeEventListener('pointercancel', onUp);
      for (const v of views) v.destroy();
      base.geo.dispose();
      if (work !== base) work.geo.dispose();
      meshMat.dispose();
      loopMat.dispose();
      grooveMat.dispose();
      clearSplit();
      upMat.dispose();
      loMat.dispose();
      upGhostMat.dispose();
      loGhostMat.dispose();
      for (const m of swMock.userData.mats) m.dispose();
      for (const g of [gizmo, loopGizmo]) {
        for (const m of g.userData.mats) m.dispose();
        g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      for (const m of Object.values(bossMats)) m.dispose();
      if (bossGroup) bossGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      clearVSlice();
      grooveCutMat.dispose();
      roomMat.dispose();
      if (roomMesh) roomMesh.geometry.dispose();
      sliceFill.dispose();
      sliceEdge.dispose();
      if (sliceGroup) sliceGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      swMock.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      if (loopLine) loopLine.geometry.dispose();
      if (grooveMesh) grooveMesh.geometry.dispose();
    },
  };
}
