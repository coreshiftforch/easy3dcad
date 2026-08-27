/* シーン4：できた部品を書き出す（DL画面）

   ★タイプ1・タイプ2・下パーツ生成の**どこからでも来られる**ように、
     このシーンは「部品の一覧」しか知らない。作り方はいっさい持たない。

       parts = [{ id, label, tris(Float32Array), color, flip }]

     flip … その部品を印刷するとき、ひっくり返すと支柱が要らなくなるか。
            「こう寝かせると印刷しやすい」を知っているのは作ったシーンなので、
            向きの案はそちらから持ってくる（ここでは切りかえるだけ）。

   置き方は2つ。
     印刷向き … flip のものはひっくり返し、それぞれ底を z=0 に落として、横に並べる
     モデルのまま … 組み立てた位置のまま（読みこみ直すとぴったり重なる）

   ★画面に見えているものが、そのまま保存されるもの。見た目と中身をずらさない。 */

import * as THREE from 'three';
import { stlBinary, threeMF, layDown, boundsOf, moveBy, download, safeName }
  from '../io/saveModel.js';

const GAP = 6;                         // 並べるときのすきま（mm）

/* ひらいた辺（1回しか使われていない辺）を数える。0なら閉じた立体。
   ★ここは「印刷できる形か」の最後の関所。今までずっと手で確かめてきたものを、
     アプリの中でも見せる。 */
function openEdges(tris) {
  const q = (i) => `${Math.round(tris[i]*1e4)},${Math.round(tris[i+1]*1e4)},${Math.round(tris[i+2]*1e4)}`;
  const m = new Map();
  for (let i = 0; i < tris.length; i += 9) {
    for (let e = 0; e < 3; e++) {
      const ka = q(i + e * 3), kb = q(i + ((e + 1) % 3) * 3);
      if (ka === kb) continue;
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      m.set(id, (m.get(id) || 0) + 1);
    }
  }
  let n = 0;
  for (const v of m.values()) if (v === 1) n++;
  return n;
}

/* ★形式は選ばせない。「STLでDL」「3MFでDL」の2つのボタンで、
     押したほうがそのまま出るようにする（選んでから保存、の2手をなくす）。 */
const FMT = [
  { id: 'stl', label: 'STLでDL', note: 'どのソフトでも開ける' },
  { id: '3mf', label: '3MFでDL', note: '1ファイルに全部入る。mm で書けるので大きさがずれない' },
];

export function mountScene4(root, { model, parts, onBack } = {}) {
  root.innerHTML = `
    <div class="scene scene4">
      <div class="topbar">
        <button class="back-btn" type="button">← 戻る</button>
        <span class="file-name">${model?.name ?? ''}</span>
      </div>
      <div class="split">
        <div class="left">
          <div class="viewer"></div>
        </div>
        <div class="right">
          <div class="panel">
            <p class="panel-h">向き</p>
            <div class="shapes lay">
              <button class="shape-btn" type="button" data-lay="print">印刷向き</button>
              <button class="shape-btn" type="button" data-lay="asis">モデルのまま</button>
            </div>
            <p class="note lay-note"></p>
          </div>
          <div class="panel">
            <p class="panel-h">名前</p>
            <input class="fname" type="text" spellcheck="false">
            <p class="note files"></p>
          </div>
          <div class="panel parts-panel">
            <p class="panel-h">部品</p>
            <div class="part-list"></div>
          </div>
          <p class="hint save-hint"></p>
          <div class="confirm-bar">
            ${FMT.map(f => `<button class="ok-btn" type="button" data-fmt="${f.id}">${f.label}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  const $ = s => root.querySelector(s);
  const host = $('.viewer');
  const nameEl = $('.fname');
  const hint = $('.save-hint');

  let lay = 'print';
  nameEl.value = safeName(model?.name);

  /* ── 保存する形にそろえる ───────────────────────
     ★ここが「見えているもの＝保存されるもの」の一本道。
       画面もファイルも、必ずこの返り値から作る。 */
  function laid() {
    if (lay === 'asis') return parts.map(p => ({ ...p, tris: p.tris }));
    let x = 0;
    return parts.map(p => {
      const t0 = p.flip ? layDown(p.tris, true) : p.tris;
      const b = boundsOf(t0);
      /* 底を z=0 に落として、XYのまん中を自分の原点に置く */
      const c = [-(b.lo[0] + b.hi[0]) / 2, -(b.lo[1] + b.hi[1]) / 2, -b.lo[2]];
      const w = b.size[0];
      const tris = moveBy(t0, [c[0] + x + w / 2, c[1], c[2]]);
      x += w + GAP;
      return { ...p, tris };
    });
  }

  /* ── 3D ──────────────────────────────────────── */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100000);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1, -1.4, 1.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-1.2, 0.8, 0.4);
  scene.add(key, fill);

  /* 印刷向きのときだけ、下に台を敷く（底が z=0 に乗っていることが見える） */
  let plate = null;
  let meshes = [];
  const target = new THREE.Vector3();
  let reach = 50;

  function build() {
    for (const m of meshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    meshes = [];
    const list = laid();
    const box = new THREE.Box3();
    for (const p of list) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.tris, 3));
      g.computeVertexNormals();
      g.computeBoundingBox();
      box.union(g.boundingBox);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: p.color ?? 0xd9dee6, roughness: 0.6, metalness: 0.04,
      }));
      scene.add(m);
      meshes.push(m);
    }
    box.getCenter(target);
    const size = box.getSize(new THREE.Vector3());
    reach = Math.max(size.x, size.y, size.z) || 50;

    if (plate) { scene.remove(plate); plate.geometry.dispose(); plate.material.dispose(); plate = null; }
    if (lay === 'print') {
      const w = Math.ceil(Math.max(size.x, size.y) * 1.6 / 10) * 10;
      plate = new THREE.GridHelper(w, w / 10, 0xc3cbd6, 0xe2e7ee);
      /* ★GridHelper は XZ 平面に寝ている。こちらは Z が上なので起こす */
      plate.rotation.x = Math.PI / 2;
      plate.position.set(target.x, target.y, 0);
      plate.material.transparent = true;
      plate.material.opacity = 0.85;
      scene.add(plate);
    }
    place();
  }

  /* つかんでまわす。⑥と同じで「引いた向きへモデルが回る」 */
  const ang = { az: 0.6, el: 0.5 };
  let dist = 100;
  function place() {
    const halfV = Math.tan(camera.fov * Math.PI / 360);
    const halfH = halfV * (camera.aspect || 1);
    dist = Math.max(reach / 2 / halfV, reach / 2 / halfH) * 1.5 + reach * 0.3;
    const e = [Math.sin(ang.az) * Math.cos(ang.el), -Math.cos(ang.az) * Math.cos(ang.el), Math.sin(ang.el)];
    camera.position.set(target.x + e[0] * dist, target.y + e[1] * dist, target.z + e[2] * dist);
    camera.lookAt(target);
    camera.near = Math.max(dist / 500, 0.05);
    camera.far = dist * 4 + reach * 4;
    camera.updateProjectionMatrix();
  }

  let sized = false;
  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    place();
    sized = true;
  }
  const ro = new ResizeObserver(() => { sized = false; });
  ro.observe(host);

  let raf = 0;
  (function loop() {
    raf = requestAnimationFrame(loop);
    if (!sized) fit();
    renderer.render(scene, camera);
  })();

  host.classList.add('clickable');
  let grab = null;
  host.addEventListener('pointerdown', ev => {
    grab = { x: ev.clientX, y: ev.clientY };
    try { host.setPointerCapture(ev.pointerId); } catch {}
  });
  host.addEventListener('pointermove', ev => {
    if (!grab) return;
    ang.az -= (ev.clientX - grab.x) * 0.011;
    ang.el = Math.max(-1.4, Math.min(1.4, ang.el + (ev.clientY - grab.y) * 0.011));
    grab = { x: ev.clientX, y: ev.clientY };
    place();
  });
  const stop = ev => {
    if (!grab) return;
    grab = null;
    try { host.releasePointerCapture(ev.pointerId); } catch {}
  };
  host.addEventListener('pointerup', stop);
  host.addEventListener('pointercancel', stop);

  /* ── 部品の表 ───────────────────────────────── */
  function paintParts() {
    $('.part-list').innerHTML = parts.map(p => {
      const b = boundsOf(p.tris);
      const size = b.size.map(v => v.toFixed(1)).join(' × ');
      return `<div class="part-row">
        <i style="background:#${(p.color ?? 0xd9dee6).toString(16).padStart(6, '0')}"></i>
        <b>${p.label}</b>
        <span>${size} mm ／ ${(p.tris.length / 9).toLocaleString()}枚</span>
        <em class="shut" data-id="${p.id}">調べています…</em>
      </div>`;
    }).join('');
    /* ★数えるのは重い（三角形10万枚で1秒近く）。画面を出してから後回しでやる */
    setTimeout(() => {
      let bad = 0;
      for (const p of parts) {
        const n = openEdges(p.tris);
        if (n) bad++;
        const el = root.querySelector(`.shut[data-id="${p.id}"]`);
        if (el) {
          el.textContent = n ? `ひらいた辺 ${n}本` : '閉じている';
          el.className = `shut ${n ? 'ng' : 'ok'}`;
        }
      }
      if (bad) hint.textContent = '閉じていない部品がある。このまま印刷すると失敗することがある';
      paintHint();
    }, 60);
  }

  function paintHint() {
    if (hint.textContent.includes('閉じていない')) { hint.className = 'hint warn save-hint'; return; }
    hint.className = 'hint save-hint';
  }

  /* ── 出す ────────────────────────────────────── */
  /* ★どちらのボタンを押すと何が出るか、両方まとめて出しておく */
  function paintFiles() {
    const base = safeName(nameEl.value) || 'clicker';
    const stl = parts.map(p => `${base}_${p.label}.stl`).join(' ／ ');
    $('.files').textContent = '';
    for (const [k, v] of [['STL', `${stl}（${FMT[0].note}）`],
                          ['3MF', `${base}.3mf（${parts.length}つの部品が1ファイルに入る）`]]) {
      const el = document.createElement('span');
      el.className = 'file-line';
      el.textContent = `${k} … ${v}`;
      $('.files').appendChild(el);
    }
  }

  function paint() {
    root.querySelectorAll('.lay .shape-btn').forEach(b => b.classList.toggle('on', b.dataset.lay === lay));
    /* ★ひっくり返す部品があるときだけ、そう書く（回らないのに「回す」と書かない） */
    const anyFlip = parts.some(p => p.flip);
    $('.lay-note').textContent = lay === 'print'
      ? (anyFlip ? 'ひっくり返す部品はひっくり返して、' : '向きはモデルのまま。')
        + 'それぞれ底を台に置いて、横に並べる'
      : '組み立てた位置のまま出す。読みこみ直すとぴったり重なるので、確かめるのに向く';
    paintFiles();
    build();
  }

  root.querySelectorAll('.lay .shape-btn').forEach(b => {
    b.onclick = () => { lay = b.dataset.lay; paint(); };
  });
  nameEl.oninput = paintFiles;

  /* 押したボタンの形式でそのまま出す。
     ★作っているあいだは両方とも押せなくする（二重に落ちると止められる）。 */
  const okBtns = [...root.querySelectorAll('.ok-btn')];
  for (const btn of okBtns) {
    const kind = btn.dataset.fmt;
    const label = FMT.find(f => f.id === kind).label;
    btn.onclick = async () => {
      const base = safeName(nameEl.value) || 'clicker';
      const list = laid();
      for (const b of okBtns) b.disabled = true;
      btn.textContent = '作っています…';
      try {
        if (kind === '3mf') {
          download(await threeMF(list.map(p => ({ label: p.label, tris: p.tris }))), `${base}.3mf`);
          hint.textContent = '3MF を保存した';
        } else {
          /* ★続けて何枚も落とすと、ブラウザに止められることがある。少し間を空ける */
          for (let i = 0; i < list.length; i++) {
            download(stlBinary(list[i].tris, `${base} ${list[i].label}`), `${base}_${list[i].label}.stl`);
            if (i < list.length - 1) await new Promise(r => setTimeout(r, 350));
          }
          hint.textContent = `STL を ${list.length}枚 保存した`;
        }
        hint.className = 'hint save-hint';
      } catch (e) {
        hint.textContent = `保存できなかった：${e.message}`;
        hint.className = 'hint warn save-hint';
      }
      for (const b of okBtns) b.disabled = false;
      btn.textContent = label;
    };
  }

  $('.back-btn').onclick = () => onBack?.();

  paint();
  paintParts();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); }
      if (plate) { plate.geometry.dispose(); plate.material.dispose(); }
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
