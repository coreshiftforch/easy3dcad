/* 書き出し。三角形の並び（Float32Array・9個で1枚）から STL と 3MF を作る。

   ── STL（二進）は1ファイルに1つの形しか入らない。部品ごとに1枚ずつ。
   ── 3MF は1ファイルに複数の部品を名前つきで入れられる。単位も mm と書ける。
      中身は ZIP。3つのファイルを入れる：

        [Content_Types].xml   … 拡張子と中身の種類の対応
        _rels/.rels           … 「本体は /3D/3dmodel.model だよ」の案内
        3D/3dmodel.model      … 形そのもの（XML）

   ★三角形の向き（表裏）は STL も 3MF も同じ決まり。外から見て反時計まわり。
     こちらの形はもうそろっているので、並べかえない。
   ★3MF は同じ点を使いまわす形（点の一覧＋番号）なので、書く前に点をまとめる。
     まとめないとファイルが3倍になり、スライサーによっては「面がつながっていない」
     と言われる。 */

/* ── 三角形の並びを動かす ────────────────────────
   印刷向きに寝かせるときに使う。flip＝X軸まわりに180°回して上下をひっくり返す。
   ★鏡にしてはいけない（x を反転するなど）。裏返った形は印刷できない。
     180°の回転なら向きは保たれる。 */
export function layDown(tris, flip) {
  const out = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    out[i]     = tris[i];
    out[i + 1] = flip ? -tris[i + 1] : tris[i + 1];
    out[i + 2] = flip ? -tris[i + 2] : tris[i + 2];
  }
  return out;
}

/* 入れものの箱 */
export function boundsOf(tris) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = tris[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

/* ずらす */
export function moveBy(tris, d) {
  const out = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    out[i]     = tris[i]     + d[0];
    out[i + 1] = tris[i + 1] + d[1];
    out[i + 2] = tris[i + 2] + d[2];
  }
  return out;
}

/* ── 二進STL ──────────────────────────────────
   80バイトの見出し ＋ 枚数(4) ＋ 1枚50バイト（法線3＋点9＋おまけ2）。 */
export function stlBinary(tris, title = 'clicker-maker') {
  const n = tris.length / 9;
  const buf = new ArrayBuffer(84 + 50 * n);
  const dv = new DataView(buf);
  /* ★見出しは半角だけにする。日本語のまま入れると、多くのスライサーが
     ここをASCII扱いで表示するので文字化けする（印刷には関係ない飾りの欄）。 */
  const asciiTitle = String(title).replace(/[^\x20-\x7e]/g, '_').slice(0, 79) || 'model';
  const head = new TextEncoder().encode(asciiTitle);
  new Uint8Array(buf).set(head, 0);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let i = 0; i < tris.length; i += 9) {
    /* 法線は点の並びから出す。★長さ0（つぶれた三角形）のときは 0,0,0 のまま。
         0で割ると NaN になり、読めないファイルになる。 */
    const ax = tris[i+3] - tris[i],   ay = tris[i+4] - tris[i+1], az = tris[i+5] - tris[i+2];
    const bx = tris[i+6] - tris[i],   by = tris[i+7] - tris[i+1], bz = tris[i+8] - tris[i+2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) { nx /= len; ny /= len; nz /= len; } else { nx = ny = nz = 0; }
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, tris[i + k], true);
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
  return new Blob([buf], { type: 'model/stl' });
}

/* ── 点をまとめる（同じ場所の点を1つにする） ──────────
   ★1/1000mm でまとめる。それより細かくすると、計算の丸めのぶんだけ
     「ほんの少し違う点」が残って、面がつながらない。 */
function weld(tris) {
  const at = new Map();
  const xs = [], ys = [], zs = [];
  const idx = new Uint32Array(tris.length / 3);
  for (let i = 0, t = 0; i < tris.length; i += 3, t++) {
    const x = tris[i], y = tris[i + 1], z = tris[i + 2];
    const k = `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
    let v = at.get(k);
    if (v === undefined) {
      v = xs.length;
      at.set(k, v);
      xs.push(x); ys.push(y); zs.push(z);
    }
    idx[t] = v;
  }
  return { xs, ys, zs, idx };
}

/* 小数は3桁で足りる（1/1000mm）。「1.500」より「1.5」のほうが軽い */
const num = v => {
  const s = v.toFixed(3);
  return s.replace(/\.?0+$/, '') || '0';
};

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 3MF の本体（XML）。parts＝[{ label, tris }] */
function modelXML(parts) {
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  out.push('<model unit="millimeter" xml:lang="ja-JP"');
  out.push(' xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n');
  out.push('<metadata name="Application">clicker-maker</metadata>\n');
  out.push('<resources>\n');
  parts.forEach((p, i) => {
    const { xs, ys, zs, idx } = weld(p.tris);
    out.push(`<object id="${i + 1}" type="model" name="${esc(p.label)}"><mesh><vertices>`);
    for (let v = 0; v < xs.length; v++)
      out.push(`<vertex x="${num(xs[v])}" y="${num(ys[v])}" z="${num(zs[v])}"/>`);
    out.push('</vertices><triangles>');
    for (let t = 0; t < idx.length; t += 3) {
      /* ★つぶれた三角形（同じ点が2つ）は書かない。スライサーが弾くことがある */
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (a === b || b === c || a === c) continue;
      out.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
    }
    out.push('</triangles></mesh></object>\n');
  });
  out.push('</resources>\n<build>\n');
  parts.forEach((p, i) => out.push(`<item objectid="${i + 1}"/>\n`));
  out.push('</build>\n</model>\n');
  return out.join('');
}

const CONTENT_TYPES =
`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;

const RELS =
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rel0" Target="/3D/3dmodel.model"
 Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

/* ── ZIP（3MFの入れもの） ─────────────────────── */

/* CRC32。表を1回だけ作る */
let crcTable = null;
function crc32(u8) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* 縮める。使えないブラウザでは null（そのまま入れる） */
async function deflateRaw(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const w = cs.writable.getWriter();
    w.write(u8); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  } catch { return null; }
}

/* ZIP を組み立てる。files＝[{ name, data(Uint8Array) }] */
async function zip(files) {
  const enc = new TextEncoder();
  const parts = [];                 // 本体（そのまま Blob に並べる）
  const dir = [];                   // 中央目録
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const packed = await deflateRaw(f.data);
    const body = packed && packed.length < f.data.length ? packed : f.data;
    const method = body === packed ? 8 : 0;

    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);            // 要る版
    head.setUint16(6, 0, true);             // ふらぐ
    head.setUint16(8, method, true);
    head.setUint16(10, 0, true);            // 時刻（0でよい）
    head.setUint16(12, 0x21, true);         // 日付（1980-01-01）
    head.setUint32(14, crc, true);
    head.setUint32(18, body.length, true);
    head.setUint32(22, f.data.length, true);
    head.setUint16(26, name.length, true);
    head.setUint16(28, 0, true);
    parts.push(head.buffer, name, body);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);              // 作った版
    cd.setUint16(6, 20, true);              // 要る版
    cd.setUint16(8, 0, true);
    cd.setUint16(10, method, true);
    cd.setUint16(12, 0, true);
    cd.setUint16(14, 0x21, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, body.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);         // この入れものの頭がどこか
    dir.push(cd.buffer, name);

    offset += 30 + name.length + body.length;
  }

  let dirSize = 0;
  for (const d of dir) dirSize += d.byteLength;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...dir, end.buffer], { type: 'model/3mf' });
}

/* parts＝[{ label, tris }] を1つの3MFにする */
export async function threeMF(parts) {
  const enc = new TextEncoder();
  return zip([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels',         data: enc.encode(RELS) },
    { name: '3D/3dmodel.model',    data: enc.encode(modelXML(parts)) },
  ]);
}

/* ── 保存 ────────────────────────────────────── */

/* ★消すのはすぐではなく、あとで。すぐ消すと保存が始まる前に消えることがある */
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ファイル名に使えない字を落とす */
export const safeName = s =>
  (String(s).replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'clicker');
