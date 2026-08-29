/* シーン0：モデルを作る
   ── シーン1で「モデルを作る」を押すと、ここへ来る。
   ── 板（土台）に 文字か QR を のせる／彫る だけの、小さなCAD。
      できたものを二進STLにして、読みこんだモデルとまったく同じ形で
      シーン2へ渡す。だから、この先の手順は1行も変えなくてよい。

   ★形を作るところは src/geom/make.js。ここは画面だけ。
   ★並びは4ページ共通の決めごとどおり「操作は左・3Dは右」。
     s3-body / views / panel は シーン3と同じ骨組みを使いまわしている
     （@media 900px の order がそのまま効く）。 */

import * as THREE from 'three';
import { SHAPES, FONTS, KEEP, buildMake, NGON_MIN, NGON_MAX, NGON_DEF } from '../geom/make.js';
import { stlBinary } from '../io/saveModel.js';
import { readModelFile } from '../io/loadModel.js';
import { SWITCH_W } from '../geom/switch-mock.js';
import { attachOrbit, resetButton } from './orbit.js';

/* いちばん薄いところが これより薄いと、スイッチ＋まわりの肉が入らない。
   ★シーン2の「小さすぎ」の判定と同じ値。ここで先に知らせておけば、
     シーン2で「このままでは作れません」と言われずに済む。 */
const WALL = 1.6;
const MIN_THICK = SWITCH_W + WALL * 2;      // 18.8

const DEF = {
  shape: 'keycap', width: 60, thick: 22, sides: NGON_DEF,
  deco: 'text', how: 'carve', depth: 1.2,
  text: 'ぽち', fontId: 'gothic', textPct: 80,
  url: 'https://example.com', ec: 'M', qrPct: 85,
};

/* 知らせを1行ぶんのHTMLにする。
   ★KEEP で囲まれたところは、打った字そのもの。ひらがなに開かれると
     「『猫』がありません」が「『ねこ』が…」になって意味が通らないので、
     data-no-kana で包んで kana.js に手を出させない。
   ★打った字がそのまま画面に出るので、記号は必ず逃がす（<>& を書かれても平気に）。 */
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const warnHTML = line => line.split(KEEP)
  .map((part, i) => (i % 2 ? `<span data-no-kana>${esc(part)}</span>` : esc(part))).join('');

const btns = (cls, list, on) => list.map(o =>
  `<button class="${cls}" type="button" data-v="${o.id}"${o.id === on ? ' aria-pressed="true"' : ''}>`
  + `${o.name}</button>`).join('');

export function mountScene0(root, { onBack, onMade } = {}) {
  root.innerHTML = `
    <div class="scene scene0">
      <div class="topbar">
        <button class="back-btn" type="button">← 戻る</button>
        <span class="file-name">モデルを作る</span>
      </div>
      <div class="s3-body">
        <div class="views">
          <div class="view"><span class="view-tag">できる形</span></div>
        </div>
        <div class="panel">
          <p class="panel-h">かたち（上へのばして柱にする）</p>
          <div class="shapes many k-shape">${btns('shape-btn', SHAPES, DEF.shape)}</div>
          <div class="sec-ngon" hidden>
            <label class="slabel">角の数<output class="o-sides"></output></label>
            <input class="r-sides" type="range" min="${NGON_MIN}" max="${NGON_MAX}" step="1"
                   value="${DEF.sides}">
          </div>
          <label class="slabel">よこ幅<output class="o-width"></output></label>
          <input class="r-width" type="range" min="25" max="120" step="1" value="${DEF.width}">
          <label class="slabel">厚み<output class="o-thick"></output></label>
          <input class="r-thick" type="range" min="6" max="45" step="0.5" value="${DEF.thick}">
          <p class="note n-thick"></p>

          <p class="panel-h">のせるもの</p>
          <div class="shapes k-deco">${btns('shape-btn',
            [{ id: 'none', name: 'なし' }, { id: 'text', name: '文字' }, { id: 'qr', name: 'QR' }],
            DEF.deco)}</div>

          <div class="sec-text">
            <label class="slabel">文字</label>
            <input class="i-text" type="text" maxlength="20" value="${DEF.text}"
                   placeholder="なまえなど">
            <p class="panel-h">書体</p>
            <div class="shapes k-font">${btns('shape-btn', FONTS, DEF.fontId)}</div>
            <p class="note">「かんじ」いがいは かな と 英数字だけ。
               「かんじ」は大きいので、はじめの1回だけ数秒かかる</p>
            <label class="slabel">文字の大きさ<output class="o-tpct"></output></label>
            <input class="r-tpct" type="range" min="30" max="100" step="1" value="${DEF.textPct}">
          </div>

          <div class="sec-qr" hidden>
            <label class="slabel">URL</label>
            <input class="i-url" type="text" maxlength="300" value="${DEF.url}"
                   placeholder="https://…">
            <label class="slabel">QRの大きさ<output class="o-qpct"></output></label>
            <input class="r-qpct" type="range" min="40" max="100" step="1" value="${DEF.qrPct}">
            <p class="panel-h">よごれへの強さ</p>
            <div class="shapes k-ec">${btns('shape-btn',
              [{ id: 'M', name: 'ふつう' }, { id: 'Q', name: 'つよい' }], DEF.ec)}</div>
            <p class="note">つよいほど、少しかすれても読める。そのぶんマスが細かくなる</p>
          </div>

          <div class="sec-how">
            <p class="panel-h">のせ方</p>
            <div class="shapes k-how">${btns('shape-btn',
              [{ id: 'carve', name: '彫る' }, { id: 'raise', name: 'のせる' }], DEF.how)}</div>
            <label class="slabel">深さ／高さ<output class="o-depth"></output></label>
            <input class="r-depth" type="range" min="0.4" max="3" step="0.1" value="${DEF.depth}">
          </div>

          <div class="panel-foot">
            <p class="hint h-size"></p>
            <p class="hint warn h-warn" hidden></p>
            <div class="go-row"><button class="next-btn make-go" type="button">これで作る →</button></div>
          </div>
        </div>
      </div>
    </div>`;

  const q = s => root.querySelector(s);
  const host = q('.view');
  const secText = q('.sec-text'), secQr = q('.sec-qr'), secHow = q('.sec-how');
  const secNgon = q('.sec-ngon');
  const hSize = q('.h-size'), hWarn = q('.h-warn'), goBtn = q('.make-go');

  /* えらんだもの。ボタンの組は aria-pressed で持つ（resume.js がそれを見る） */
  const pickOf = sel => q(sel).querySelector('[aria-pressed="true"]')?.dataset.v;
  root.querySelectorAll('.shapes').forEach(g => {
    g.addEventListener('click', e => {
      const b = e.target.closest('.shape-btn');
      if (!b) return;
      g.querySelectorAll('.shape-btn').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      g.querySelectorAll('.shape-btn').forEach(o => o.classList.toggle('on', o === b));
      paint();
    });
    g.querySelectorAll('.shape-btn').forEach(o =>
      o.classList.toggle('on', o.getAttribute('aria-pressed') === 'true'));
  });

  const opts = () => ({
    shape: pickOf('.k-shape'),
    sides: +q('.r-sides').value,
    width: +q('.r-width').value,
    thick: +q('.r-thick').value,
    deco:  pickOf('.k-deco'),
    how:   pickOf('.k-how'),
    depth: +q('.r-depth').value,
    text:  q('.i-text').value,
    fontId: pickOf('.k-font'),
    textPct: +q('.r-tpct').value,
    url:   q('.i-url').value,
    ec:    pickOf('.k-ec'),
    qrPct: +q('.r-qpct').value,
  });

  /* ── 3Dの窓 ─────────────────────────────────── */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
  camera.up.set(0, 0, 1);                       // ★Zが上の世界
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1, -1.4, 1.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-1.2, 0.8, 0.4);
  scene.add(key, fill);

  const mat = new THREE.MeshStandardMaterial({ color: 0xd9dee6, roughness: 0.62, metalness: 0.04 });
  let mesh = null, span = { x: 60, y: 40, z: 20 };

  /* ★つかんでまわせる。まわしはじめたら、ひとりでに回るのは止める */
  const HOME_DIR = [0.34, -0.78, 0.52];
  const orb = attachOrbit(host, { dir: HOME_DIR, onChange: () => frame() });
  resetButton(host, () => { orb.reset(); if (mesh) mesh.rotation.z = 0; frame(); });

  function frame() {
    const halfV = Math.tan(camera.fov * Math.PI / 360);
    const halfH = halfV * camera.aspect;
    /* Z軸まわりに回るので、横に要る広さは幅ではなく中心からの半径で見る */
    const radius = Math.hypot(span.x, span.y) / 2 || 1;
    const dist = Math.max((span.z / 2) / halfV, radius / halfH) * 1.25 + radius;
    const target = new THREE.Vector3(0, 0, span.z / 2);
    camera.position.copy(target)
      .addScaledVector(new THREE.Vector3(...orb.dir()).normalize(), dist);
    camera.lookAt(target);
    camera.near = Math.max(dist / 500, 0.05);
    camera.far = dist * 6;
    camera.updateProjectionMatrix();
  }
  /* ★大きさが変わった瞬間にキャンバスは白く消える。描く直前にまとめて直す
     （シーン2と同じ理由） */
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

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPIN = calm ? 0 : (Math.PI * 2) / 26;
  const timer = new THREE.Timer();
  let raf = 0;
  (function loop() {
    raf = requestAnimationFrame(loop);
    timer.update();
    if (!sized) fit();
    const dt = Math.min(timer.getDelta(), 0.1);
    if (mesh && !orb.moved) mesh.rotation.z += SPIN * dt;   // まわしはじめたら 止める
    renderer.render(scene, camera);
  })();

  /* ── 作り直し ─────────────────────────────────
     つまみを動かすたびに呼ばれる。書体の読みこみが入ることがあるので、
     ★重なって走らないようにする（あとから来たぶんは1回にまとめる）。 */
  let made = null;          // いま画面に出ている形（これで作る で使う）
  let busy = false, pending = false;

  async function build() {
    if (busy) { pending = true; return; }
    busy = true;
    goBtn.disabled = true;
    /* ★書体を読むのに数秒かかることがある（「かんじ」は6MB）。
         そのあいだ画面が止まって見えるので、少し待たされるときだけ知らせる。
         いつも出すと、つまみを動かすたびに ちらついて読めない。 */
    const slow = setTimeout(() => { hSize.textContent = '作っています…'; }, 300);
    try {
      const o = opts();
      const m = await buildMake(o);
      made = { opt: o, positions: m.positions };
      span = m.size;

      if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
      /* 底を z=0、中心を原点に。シーン2以降と同じ置きかた */
      geo.computeBoundingBox();
      geo.translate(0, 0, -geo.boundingBox.min.z);
      geo.computeVertexNormals();
      mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      frame();

      const warn = [...m.info.warn];
      if (o.thick < MIN_THICK)
        warn.push(`厚みが ${o.thick}mm です。スイッチ（${SWITCH_W}mm角）＋肉 ${WALL}mm×2 で`
                + ` ${MIN_THICK}mm ないと、この先で作れません`);
      hSize.textContent = `できる大きさ　${span.x.toFixed(0)} × ${span.y.toFixed(0)}`
        + ` × ${span.z.toFixed(1)} mm`
        + (m.info.qr ? `　／　QR ${m.info.qr.count}×${m.info.qr.count}マス`
                     + `（1マス ${m.info.qr.module.toFixed(2)}mm）` : '');
      hWarn.innerHTML = warn.map(warnHTML).join('<br>');
      hWarn.toggleAttribute('hidden', !warn.length);
    } catch (e) {
      made = null;
      hSize.textContent = '';
      hWarn.textContent = String(e && e.message || e);
      hWarn.toggleAttribute('hidden', false);
    } finally {
      clearTimeout(slow);
      busy = false;
      goBtn.disabled = !made;
      if (pending) { pending = false; build(); }
    }
  }

  /* つまみの数字を出す＋出す欄を切りかえる。作り直しは少し待ってからまとめて */
  let wait = 0;
  function paint() {
    const o = opts();
    /* ★「8角」と書くと ひらがなで「8かど」と読ませてしまう。数だけ出す */
    q('.o-sides').textContent = `${o.sides}つ`;
    q('.o-width').textContent = `${o.width} mm`;
    q('.o-thick').textContent = `${o.thick.toFixed(1)} mm`;
    q('.o-tpct').textContent  = `${o.textPct} %`;
    q('.o-qpct').textContent  = `${o.qrPct} %`;
    q('.o-depth').textContent = `${o.depth.toFixed(1)} mm`;
    q('.n-thick').textContent = o.thick < MIN_THICK
      ? `スイッチが入るには ${MIN_THICK}mm 要る` : '';
    /* 角の数のバーは、多角形をえらんだときだけ出す */
    secNgon.toggleAttribute('hidden', o.shape !== 'ngon');
    secText.toggleAttribute('hidden', o.deco !== 'text');
    secQr.toggleAttribute('hidden', o.deco !== 'qr');
    secHow.toggleAttribute('hidden', o.deco === 'none');
    clearTimeout(wait);
    wait = setTimeout(build, 140);
  }
  for (const ev of ['input', 'change']) root.querySelector('.panel').addEventListener(ev, paint);
  paint();

  /* ── できたものを、読みこんだモデルとして渡す ───────────
     ★二進STLに書いてから readModelFile に通す。こうすると
       「読みこんだモデル」とまったく同じ形（name / positions / size / notes）で
       出てくるので、シーン2から先はどちらで来たのかを気にしなくてよい。 */
  goBtn.onclick = async () => {
    if (!made) return;
    goBtn.disabled = true;
    try {
      const buf = await stlBinary(made.positions, 'easy3dcad-make').arrayBuffer();
      const file = new File([buf], 'つくったモデル.stl', { type: 'model/stl' });
      const info = await readModelFile(file);
      /* key は「同じものか」を見るためだけのもの。つまみの中身から作れば、
         中身が変わったときだけ IndexedDB を書きなおす（数MBを毎回書かない）。 */
      onMade?.(info, { name: file.name, type: file.type, buf,
                       key: 'make:' + JSON.stringify(made.opt) });
    } catch (e) {
      hWarn.textContent = `作れませんでした：${String(e && e.message || e)}`;
      hWarn.toggleAttribute('hidden', false);
      goBtn.disabled = false;
    }
  };

  q('.back-btn').onclick = () => onBack?.();

  return {
    /* つづきから で戻すとき。つまみを入れると input が飛ぶので、
       そのあとの作り直しは paint がまとめて面倒を見る。 */
    restore(form) { Resume.writeForm(q('.panel'), form); },
    destroy() {
      cancelAnimationFrame(raf);
      orb.dispose();
      clearTimeout(wait);
      ro.disconnect();
      if (mesh) mesh.geometry.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
