/* シーン2：読みこんだモデルを3Dで見て、作りを選ぶ
   ── モデルはZ軸まわりにゆっくり回る（倒れない）。
   ── 下に「タイプ1／タイプ2／下パーツ生成」。選ぶと見本のプレビューが出る。
   ── 「戻る」でシーン1へ。 */

import * as THREE from 'three';
import { buildGeometry } from '../geom/model.js';
import { attachOrbit, resetButton, fullButton } from './orbit.js';
import { SWITCH_H, SWITCH_W } from '../geom/switch-mock.js';

/* ── 大きさの目安 ─────────────────────────────────
   ★ふだんは何も出さない。**範囲から外れたときだけ**知らせて、
     その場で直せるようにする（タイプを選ぶ前に気づけるように）。
   小さすぎ … いちばん細いところにスイッチ（15.6角）＋肉 1.6×2 が入らない
   大きすぎ … いちばん長いところが印刷できる大きさを超えていそう */
const WALL = 1.6;
const MIN_THIN = SWITCH_W + WALL * 2;      // 18.8
const MAX_LONG = 200;
/* おすすめ … いちばん長いところ＝スイッチの背 18.0 の4倍 ＝ 72mm。
   ★シーン3の①が既定にしている大きさと同じ。ここで変えたら、その値を①へ引きつぐ。 */
const NICE_LONG = SWITCH_H * 4;

export const TYPES = [
  { id: 'flush', label: 'タイプ1',     note: 'カップケーキ型。溝を彫って、上パーツがその中へ落ちこむ。外から見える分かれめは溝1本' },
  { id: 'case',  label: 'タイプ2',     note: '平面ひとつで切るだけ。切り口に十字の穴のついた柱を足して、下にスイッチの部屋を抜く' },
  { id: 'lower', label: '下パーツ生成', note: 'オブジェクトは切らない。底に穴を掘って、受けるおわんを下に作る' },
];

/* ── 見本の絵（切ったところを横から見た図） ────────────────
   ★どれも同じ「オブジェクトの輪郭」の上に、分かれめだけを描き分ける。
     形がそろっていると、ちがいが分かれめの形だけに見える。
   色は2つだけ。輪郭＝currentColor（薄いほう）、分かれめ＝アクセント色。 */
const BLOB = 'M160 26C198 26 222 54 222 92L222 150C222 168 196 178 160 178'
           + 'C124 178 98 168 98 150L98 92C98 54 122 26 160 26Z';

/* 図の外がわ。輪郭と、上下パーツの呼び名。
   ★下パーツ生成だけはオブジェクトを切らないので、呼び名を差しかえられるようにしてある */
const frame = (inner, top = '上パーツ', bottom = '下パーツ') =>
  `<svg class="ph" viewBox="0 0 320 200" role="img">
  <path d="${BLOB}" fill="currentColor" fill-opacity=".07"
        stroke="currentColor" stroke-width="2.2" opacity=".75"/>
  ${inner}
  <g fill="currentColor" font-size="11" opacity=".65" text-anchor="middle">
    <text x="46" y="70">${top}</text>
    <text x="46" y="158">${bottom}</text>
  </g>
</svg>`;

/* スイッチ（実物の四角い箱とステム）。x,y は箱の左上。h＝箱の高さ、
   stem＝箱の上から何ミリぶん上へ出るか（0＝出さない） */
const sw = (x, y, h, stem) => `<g fill="none" stroke="currentColor" stroke-width="1.8" opacity=".55">
    <rect x="${x}" y="${y}" width="40" height="${h}" rx="2"/>
    ${stem ? `<path d="M${x + 20} ${y} v-${stem}"/>` : ''}
  </g>`;

/* スイッチの部屋（下パーツに抜く四角）。破線 */
const room = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" opacity=".45"/>`;

/* 引き出し線＋文字 */
const call = (x1, y, x2, t) => `<path d="M${x1} ${y} H${x2}" fill="none"
    stroke="var(--accent)" stroke-width="1.4" opacity=".8"/>
  <text x="${x2 + 4}" y="${y + 4}" font-size="11" fill="var(--accent)">${t}</text>`;

const ART = {
  /* タイプ1 … 段のついた面。輪の外は Zg、内は溝の底。上パーツの栓が器へ落ちこむ */
  flush: frame(`
    ${room(138, 148, 44, 26)}
    ${sw(142, 148, 26, 10)}
    <g fill="none" stroke="var(--accent)" stroke-width="3"
       stroke-linejoin="round" stroke-linecap="round">
      <path d="M99 104 H124 V146 H196 V104 H221"/>
    </g>
    ${call(226, 104, 258, '溝')}`),

  /* タイプ2 … 平面ひとつ。上パーツの底に柱が下がり、スイッチの開口へ入りこむ */
  case: frame(`
    ${room(136, 112, 48, 38)}
    ${sw(140, 112, 34, 0)}
    <g fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round">
      <path d="M99 112 H221"/>
    </g>
    <g fill="none" stroke="var(--accent)" stroke-width="2.4"
       stroke-linejoin="round" stroke-linecap="round">
      <path d="M150 112 V128 H170 V112"/>
    </g>
    ${call(226, 112, 258, '切り口')}
    ${call(174, 128, 214, '柱')}`),

  /* 下パーツ生成 … オブジェクトは切らない。底に穴を掘り、その下におわんを作る。
     ★分かれめの線を引かないことが、そのまま「切らない」の説明になっている。 */
  lower: frame(`
    ${room(138, 146, 44, 32)}
    ${sw(142, 150, 26, 0)}
    <g fill="none" stroke="var(--accent)" stroke-width="3"
       stroke-linejoin="round" stroke-linecap="round">
      <path d="M86 124 L86 164C86 182 116 190 160 190C204 190 234 182 234 164L234 124"/>
    </g>
    ${call(182, 162, 246, '掘った穴')}`,
    'オブジェクト', 'おわん'),
};

/* 下パーツ生成は、まだ中身が無いので仮の絵のまま */
function placeholder(t) {
  if (ART[t.id]) return ART[t.id];
  return `<svg class="ph" viewBox="0 0 320 200" role="img" aria-label="${t.label} の見本（仮）">
    <rect x="1" y="1" width="318" height="198" rx="14" fill="none"
          stroke="currentColor" stroke-width="2" stroke-dasharray="7 6" opacity=".45"/>
    <g fill="none" stroke="currentColor" stroke-width="2.5" opacity=".55"
       stroke-linejoin="round" stroke-linecap="round">
      <path d="M118 96l42-22 42 22-42 22z"/>
      <path d="M118 96v30l42 22 42-22V96"/>
      <path d="M160 118v30"/>
    </g>
    <text x="160" y="176" text-anchor="middle" font-size="13" fill="currentColor"
          opacity=".7">${t.label} の見本（仮画像）</text>
  </svg>`;
}

export function mountScene2(root, { model, onBack, onConfirm } = {}) {
  root.innerHTML = `
    <div class="scene scene2">
      <div class="topbar">
        <button class="back-btn" type="button">← 戻る</button>
        <span class="file-name">${model.name}</span>
      </div>
      <div class="split">
        <div class="left">
          <div class="viewer"></div>
        </div>
        <div class="right" aria-hidden="true">
          <div class="preview"></div>
          <div class="confirm-bar"><button class="ok-btn" type="button">確定</button></div>
        </div>
      </div>
      <div class="size-fix" hidden>
        <p class="sf-msg"></p>
        <label class="slabel">いちばん長いところ<output class="out-long"></output></label>
        <input class="r-long" type="range" step="1">
        <div class="sf-row">
          <button class="sf-auto" type="button">おすすめ（${NICE_LONG.toFixed(0)}mm）にする</button>
          <span class="note sf-note"></span>
        </div>
      </div>
      <div class="choices">
        ${TYPES.map(t => `<button class="type-btn" type="button" data-id="${t.id}">${t.label}</button>`).join('')}
      </div>
    </div>`;
  /* ★右がわは消さずに幅0で置いておく。display:none だと開くときに動きがつかない。
     ★作りを選ぶボタンは .split の外（画面の下いっぱい）に置く。左カラムの中に入れると
       右がわが開いたぶんだけ縮んで、三分割にならない。 */

  const scene2  = root.querySelector('.scene2');
  const host    = root.querySelector('.viewer');
  const right   = root.querySelector('.right');
  const preview = root.querySelector('.preview');

  /* ── 3D ──────────────────────────────────────── */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100000);
  camera.up.set(0, 0, 1);                       // ★Zが上の世界

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1, -1.4, 1.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-1.2, 0.8, 0.4);
  scene.add(key, fill);

  /* Z上にそろえ、底を z=0、XYの中心を原点に置いた形にしてもらう */
  const { geo, span } = buildGeometry(model);
  const reach = Math.max(span.x, span.y, span.z) || 1;

  /* ── 大きさの知らせ ───────────────────────────
     ★読みこんだままの寸法で見る。ここで決めた「いちばん長いところ」は
       model.startLong に入れて、シーン3の①が初期値として使う。 */
  const baseLong = Math.max(span.x, span.y, span.z) || 1;
  const baseThin = Math.min(span.x, span.y);
  const tooSmall = baseThin * (NICE_LONG / baseLong) < MIN_THIN && baseThin < MIN_THIN;
  const tooBig   = baseLong > MAX_LONG;
  const sizeFix = root.querySelector('.size-fix');
  const rLong = root.querySelector('.r-long');
  if (tooSmall || tooBig) {
    rLong.min = 10;
    rLong.max = Math.max(300, Math.ceil(baseLong * 1.2));
    rLong.value = Math.round(baseLong);
    root.querySelector('.sf-msg').textContent = tooBig
      ? `読みこんだモデルは いちばん長いところが ${baseLong.toFixed(1)}mm あります。`
        + '大きすぎるかもしれません。'
      : `読みこんだモデルは いちばん細いところが ${baseThin.toFixed(1)}mm しかありません。`
        + `スイッチ（${SWITCH_W}mm角）＋肉 ${WALL}mm が入らないので、このままでは作れません。`;
    sizeFix.toggleAttribute('hidden', false);
    const paintLong = () => {
      const v = +rLong.value;
      const thin = baseThin * v / baseLong;
      root.querySelector('.out-long').textContent = `${v} mm`;
      root.querySelector('.sf-note').textContent =
        `いちばん細いところは ${thin.toFixed(1)}mm になる`
        + (thin < MIN_THIN ? `（${MIN_THIN.toFixed(1)}mm 要る）` : '');
      model.startLong = v;
    };
    rLong.oninput = paintLong;
    root.querySelector('.sf-auto').onclick = () => {
      rLong.value = Math.round(NICE_LONG);
      paintLong();
    };
    paintLong();
  }

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xd9dee6, roughness: 0.62, metalness: 0.04, flatShading: false,
  }));
  scene.add(mesh);

  const target = new THREE.Vector3(0, 0, span.z / 2);
  /* 入ってきたときの向き（少し上から）と、落ちつく向き（斜め前） */
  const dirFar  = new THREE.Vector3(0.30, -0.60, 0.74).normalize();
  const dirNear = new THREE.Vector3(0.42, -0.84, 0.34).normalize();

  /* ★つかんでまわせる。まわしはじめたら、ひとりでに回るのは止める
       （両方いっぺんに動くと、どっちが自分の操作か分からない）。 */
  const orb = attachOrbit(host, { dir: dirNear.toArray(), onChange: place });
  resetButton(host, () => { orb.reset(); mesh.rotation.z = 0; place(); });
  fullButton(host);          /* 右下：画面いっぱいで見る */
  host.classList.add('has-full');

  /* ── 入りのアニメーション ───────────────────────
     遠くから作業スペースへ寄っていく。1秒ちょっとで落ちつく。 */
  const INTRO = 1.1;          // 秒
  const AWAY  = 3.6;          // はじめは何倍の遠さから来るか
  /* ★「動きを減らす」設定の人には、寄っていく動きも回転も見せない */
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let introT = calm ? INTRO : 0;
  const easeOut = x => 1 - Math.pow(1 - x, 3);

  let baseDist = 1;
  const dirNow = new THREE.Vector3();

  /* 窓の形に合わせて寄る距離を決める。
     ★モデルはZ軸まわりに回るので、横に要る広さは「幅」ではなく
       中心からの半径で見る（回ったときにはみ出さないように）。 */
  function frame() {
    const halfV = Math.tan(camera.fov * Math.PI / 360);
    const halfH = halfV * camera.aspect;
    const radius = Math.hypot(span.x, span.y) / 2 || 1;
    baseDist = Math.max((span.z / 2) / halfV, radius / halfH) * 1.3 + radius;
    place();
  }

  function place() {
    const k = introT >= INTRO ? 1 : easeOut(introT / INTRO);
    const dist = baseDist * (AWAY + (1 - AWAY) * k);
    if (orb && orb.moved) dirNow.fromArray(orb.dir());
    else dirNow.copy(dirFar).lerp(dirNear, k).normalize();
    camera.position.copy(target).addScaledVector(dirNow, dist);
    camera.lookAt(target);
    camera.near = Math.max(baseDist / 500, 0.05);
    camera.far  = baseDist * AWAY * 4 + reach * 4;
    camera.updateProjectionMatrix();
  }

  /* ★大きさを変えると、キャンバスの中身はいったん真っ白に消える。
       ResizeObserver の中でそのまま setSize すると、次の描画までのあいだに
       消えたままの一枚が画面に出てしまう（右がわが開くとき、モデルが一瞬消えた）。
       「大きさが変わった」とだけ覚えておいて、描く直前にまとめて直す。 */
  let sized = false;
  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frame();
    sized = true;
  }
  const ro = new ResizeObserver(() => { sized = false; });
  ro.observe(host);
  fit();

  /* ゆっくり回す。1周およそ24秒 */
  const SPIN = calm ? 0 : (Math.PI * 2) / 24;
  /* ★THREE.Clock は廃止予定。Timer は update() を呼んでから getDelta() を読む */
  const timer = new THREE.Timer();
  let raf = 0;
  (function loop() {
    raf = requestAnimationFrame(loop);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);   // タブを離れて戻ったとき飛ばない
    if (!sized) fit();                            // 消えたまま出さないよう、描く直前に直す
    if (!orb.moved) mesh.rotation.z += SPIN * dt;   // まわしはじめたら 止める
    if (introT < INTRO) { introT = Math.min(INTRO, introT + dt); place(); }
    renderer.render(scene, camera);
  })();

  /* ── 作りを選ぶ ───────────────────────────────────
     選ぶと右がわが開く。3Dの窓はそのぶん細くなるので、モデルは左へ寄っていく。
     ★カメラの寄りは「高さ」で決まっていることが多いので、細くなっても
       モデルの大きさは変わらない（はみ出すときだけ引く）。 */
  let picked = null;
  root.querySelectorAll('.type-btn').forEach(b => {
    b.onclick = () => {
      picked = TYPES.find(t => t.id === b.dataset.id);
      root.querySelectorAll('.type-btn').forEach(o => o.classList.toggle('on', o === b));
      preview.innerHTML = `
        <div class="ph-box">${placeholder(picked)}</div>
        <p class="ph-label">${picked.label}</p>
        <p class="ph-note">${picked.note}</p>`;
      scene2.classList.add('picked');
      right.setAttribute('aria-hidden', 'false');
    };
  });

  root.querySelector('.ok-btn').onclick = () => { if (picked) onConfirm?.(picked); };

  root.querySelector('.back-btn').onclick = () => onBack?.();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      orb.dispose();
      ro.disconnect();
      geo.dispose();
      mesh.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
