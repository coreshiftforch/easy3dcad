/* モデルを読みこむ。
   ── 受けつけるのは STL / 3MF / GLB の3つだけ。
   ── 読み方は拡張子ではなく「先頭4バイト」で決める。
      ★拡張子は嘘をつく。3MF を .stl という名前で保存してしまう事故が実際にあった
        （なまえプレートアプリの出力が 3MF なのに .stl で保存されていた）。 */

import { STLLoader }   from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { GLTFLoader }  from 'three/examples/jsm/loaders/GLTFLoader.js';

/* この大きさを超えたら、読む前に知らせる（スマホのブラウザが落ちることがある） */
export const BIG_FILE = 50 * 1024 * 1024;

/* 3Dモデルでないファイル。先頭の数バイトで名前が分かるものは、名指しで断る。
   ★これがないと、写真を落としたときに「STLとして読めた」ことになってしまう
     （STLLoader は先頭が solid でなければ二進STLだと思いこんで、
       でたらめな数字を読む。実際に 4.6e+38 mm の物体ができた）。 */
const NOT_MODEL = [
  [[0x89, 0x50, 0x4e, 0x47], 'PNG画像'],
  [[0xff, 0xd8, 0xff],       'JPEG画像'],
  [[0x47, 0x49, 0x46, 0x38], 'GIF画像'],
  [[0x25, 0x50, 0x44, 0x46], 'PDF'],
  [[0x42, 0x4c, 0x45, 0x4e], 'Blenderのファイル（.blend）'],
  [[0x1f, 0x8b],             'gzipで固めたファイル'],
];

function matchSig(b, sig) {
  for (let i = 0; i < sig.length; i++) if (b[i] !== sig[i]) return false;
  return true;
}

/* OBJ かどうか。テキストの頭のほうに v / vn / f などの行があれば OBJ とみなす */
function looksLikeOBJ(b) {
  const txt = new TextDecoder('utf-8', { fatal: false }).decode(b.slice(0, 4096));
  return /^\s*(#|mtllib\s|o\s|g\s|v\s|vn\s|vt\s)/m.test(txt) && /^\s*v\s+[-\d.]/m.test(txt);
}

/* 先頭の数バイトで形式を決める */
function sniff(buf) {
  const b = new Uint8Array(buf);
  const head = new TextDecoder().decode(b.slice(0, 4));
  if (head.startsWith('PK')) return '3mf';   // ZIP＝3MF
  if (head === 'glTF')       return 'glb';
  for (const [sig, name] of NOT_MODEL) if (matchSig(b, sig)) return { bad: name };
  if (head.startsWith('{'))  return 'gltf';  // 分かれた形式。受けつけない
  if (looksLikeOBJ(b))       return 'obj';   // 受けつけない
  return 'stl';                              // 二進もアスキーも STLLoader が見分ける
}

/* STL の形をしているか確かめる。
   ★二進STLは「80バイトの見出し ＋ 三角形の枚数(4) ＋ 1枚50バイト」と決まっている。
     長さが合わないなら、それは STL ではない。 */
function checkSTL(buf) {
  const b = new Uint8Array(buf);
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.slice(0, 2048));
  if (/^\s*solid/i.test(head) && /facet\s+normal/i.test(head)) return;   // アスキーSTL
  const n = b.length >= 84 ? new DataView(buf).getUint32(80, true) : -1;
  if (n < 0 || b.length !== 84 + 50 * n)
    throw new Error('3Dモデルのファイルではないようです。STL / 3MF / GLB を選んでください');
}

/* 読みこんだメッシュを1本の座標配列にまとめる。
   ★入れ子のノードがそれぞれ位置と大きさを持っているので、必ず世界行列を焼きこむ。
   ★座標は getX/getY/getZ で読む。GLB の頂点は詰めて並んでいる（interleaved）ことがあり、
     生の array をそのままコピーすると法線や色まで混ざる。 */
function mergeFromObject(obj) {
  const geoms = [];
  obj.updateMatrixWorld(true);
  obj.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    geoms.push(g);
  });
  return mergeGeoms(geoms);
}

function mergeGeoms(geoms) {
  let n = 0;
  for (const g of geoms) n += g.attributes.position.count;
  const out = new Float32Array(n * 3);
  let o = 0;
  for (const g of geoms) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { out[o++] = p.getX(i); out[o++] = p.getY(i); out[o++] = p.getZ(i); }
  }
  return out;
}

function bbox(pos) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = pos[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

function parseGLB(buf) {
  return new Promise((res, rej) => {
    /* ★第2引数のパスは「外部ファイルを探す場所」。GLB は1ファイルに全部入っているので空でよい。
         .gltf（JSON＋.bin に分かれた形）はここで頂点が読めないので、そもそも受けつけない。 */
    new GLTFLoader().parse(buf, '', gltf => res(mergeFromObject(gltf.scene)),
      e => rej(new Error(/draco/i.test(String(e && e.message))
        ? 'DRACOで圧縮されたGLBは読めません。圧縮なしで書き出しなおしてください'
        : 'GLBとして読めませんでした')));
  });
}

/* file（File オブジェクト）を読んで、まとまった座標と寸法を返す */
export async function readModelFile(file) {
  const buf = await file.arrayBuffer();
  const format = sniff(buf);
  const notes = [];
  let pos;

  if (typeof format === 'object')
    throw new Error(`${format.bad}のようです。STL / 3MF / GLB を選んでください`);

  if (format === 'gltf')
    throw new Error('.gltf（JSONの形）は、頂点が別ファイル（.bin）に分かれているので読めません。'
                  + '.glb で書き出しなおしてください');

  if (format === 'obj')
    throw new Error('OBJは受けつけていません。STL か GLB で書き出しなおしてください');

  if (format === 'stl') {
    checkSTL(buf);
    const g = new STLLoader().parse(buf);
    pos = mergeGeoms([g]);
  } else if (format === '3mf') {
    let group;
    try { group = new ThreeMFLoader().parse(buf); }
    catch { throw new Error('3MFとして読めませんでした。ファイルが壊れているかもしれません'); }
    pos = mergeFromObject(group);
  } else {
    pos = await parseGLB(buf);
  }

  if (pos.length < 9) throw new Error('中に三角形がありませんでした');

  let box = bbox(pos);
  let max = Math.max(...box.size);

  /* ★最後に「ありえない大きさ」をはじく。壊れたファイルを読むと
       無限大や 1e+38 のような数字が入りこむ。100m を超える物は3Dプリンタに載らない。 */
  if (!Number.isFinite(max) || max <= 0 || max > 100000)
    throw new Error('中の数字がおかしくて、大きさが決まりませんでした。'
                  + 'ファイルが壊れているかもしれません');

  /* ★Blender の 3MF アドオンは transform を ×1000 で書く
       （unit="millimeter" なのに 1単位=1m として扱っている）。
       素直に読むと 20.4mm の部品が 20.4m になる。
       3Dプリンタに1mを超える物は載らないので、桁が違うと分かったら戻す。 */
  if (format === '3mf' && max > 2000) {
    for (let i = 0; i < pos.length; i++) pos[i] *= 0.001;
    box = bbox(pos); max = Math.max(...box.size);
    notes.push('Blenderが書いた3MFだったので、大きさを 1/1000 に直しました');
  }

  /* glTF は「1単位＝1メートル」が決まり。AIで作らせたモデルは高さ1〜2で来ることがある */
  if (format === 'glb' && max < 10)
    notes.push('GLBは 1単位＝1メートル の決まりです。大きさはあとの手順で合わせます');

  return {
    name: file.name,
    format,                                   // 'stl' | '3mf' | 'glb'
    positions: pos,
    triangles: pos.length / 9,
    size: box.size,                           // [x, y, z]
    notes,
  };
}
