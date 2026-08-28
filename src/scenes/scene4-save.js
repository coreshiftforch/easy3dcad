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
  /* ★画面そのものは **4ページ共通の SaveScreen**（public/js/save.js）が持つ。
       ここが渡すのは「3Dの窓」「向きの切りかえ」「ファイルの作りかた」
       「部品の一覧」だけ。なまえプレート・QRと同じ見た目になる。 */
  root.innerHTML = '<div class="scene scene4"></div>';
  const host = document.createElement('div');
  host.className = 'viewer';
  host.style.cssText = 'position:absolute;inset:0';

  let lay = 'print';
  let fileName = safeName(model?.name) || 'clicker';
  let warn = '';                    // 閉じていない部品があるときの知らせ

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
      /* 暗い地に合わせた目盛りの色（なまえプレート／QRの床と同じ落ちつき） */
      plate = new THREE.GridHelper(w, w / 10, 0x64748b, 0x334155);
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
  /* 部品の一覧。★「閉じているか」は ここが最後の関所。
       数えるのは重い（三角形10万枚で1秒近く）ので、まず画面を出して
       あとから数えなおし、SaveScreen に入れ直す。 */
  let shut = null;                  // id → ひらいた辺の数（null＝まだ数えていない）
  function partList() {
    return parts.map(p => {
      const b = boundsOf(p.tris);
      const size = b.size.map(v => v.toFixed(1)).join(' × ');
      const n = shut && shut[p.id];
      const state = shut == null ? '調べています…' : (n ? `ひらいた辺 ${n}本` : '閉じている');
      return { name: p.label, note: `${size} mm ／ ${(p.tris.length / 9).toLocaleString()}枚 ／ ${state}` };
    });
  }
  function countShut() {
    setTimeout(() => {
      shut = {};
      let bad = 0;
      for (const p of parts) { const n = openEdges(p.tris); shut[p.id] = n; if (n) bad++; }
      warn = bad ? '⚠ 閉じていない部品があります。このまま印刷すると失敗することがあります' : '';
      SaveScreen.update({ parts: partList(), info: infoRows() });
    }, 60);
  }

  /* ── 出す ────────────────────────────────────── */
  const layNote = () => {
    /* ★ひっくり返す部品があるときだけ、そう書く（回らないのに「回す」と書かない） */
    const anyFlip = parts.some(p => p.flip);
    return lay === 'print'
      ? (anyFlip ? 'ひっくり返す部品はひっくり返して、' : '向きはモデルのまま。')
        + 'それぞれ底を台に置いて、横に並べる'
      : '組み立てた位置のまま出す。読みこみ直すとぴったり重なるので、確かめるのに向く';
  };
  const infoRows = () => [
    ['部品の数', `${parts.length}つ`],
    ['三角形', `${parts.reduce((n, p) => n + p.tris.length / 9, 0).toLocaleString()}枚`],
    ...(warn ? [['たしかめ', warn]] : []),
  ];

  function paint() { build(); }

  /* ★書き出しは **自分で落とす**（部品ごとに1枚ずつ出るので、
       SaveScreen に Blob を1つ返す形にはできない）。
       だから make は なにも返さず、SaveScreen は「保存した」とだけ出す。 */
  function openSave() {
    SaveScreen.open({
      title: '書き出し',
      name: fileName,
      preview: host,
      options: [{
        label: '向き', pick: lay, note: layNote(),
        items: [{ v: 'print', t: '印刷向き' }, { v: 'asis', t: 'モデルのまま' }],
        onPick: v => { lay = v; paint(); SaveScreen.update({ options: [{ note: layNote() }] }); },
      }],
      files: [
        { id: '3mf', ext: '3mf', label: '3MF でダウンロード',
          note: `${parts.length}つの部品が1ファイルに入る。mm で書けるので大きさがずれない`,
          make: async (base) => {
            download(await threeMF(laid().map(p => ({ label: p.label, tris: p.tris }))), `${base}.3mf`);
          } },
        { id: 'stl', ext: 'stl', label: 'STL でダウンロード',
          note: `部品ごとに1枚ずつ（${parts.length}枚）。どのソフトでも開ける`,
          make: async (base) => {
            const list = laid();
            /* ★続けて何枚も落とすと、ブラウザに止められることがある。少し間を空ける */
            for (let i = 0; i < list.length; i++) {
              download(stlBinary(list[i].tris, `${base} ${list[i].label}`), `${base}_${list[i].label}.stl`);
              if (i < list.length - 1) await new Promise(r => setTimeout(r, 350));
            }
          } },
      ],
      parts: partList(),
      info: infoRows(),
      howto: [
        '① そのまま平置きで印刷（サポートは要りません）',
        '② スイッチは、下パーツの四角い部屋へ 上から落としこみます',
        '③ 磁石を使う作りのときは、向き（N-S）をそろえて入れてください',
      ],
      onBack: () => onBack?.(),
    });
  }

  paint();
  openSave();
  countShut();

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
