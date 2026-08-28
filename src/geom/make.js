/* ══════════════════════════════════════════════════════════════
   「モデルを作る」でつくる形

   板（土台）の上に、文字か QR を **のせる**か**彫る**。
   できあがりは三角形の並び（Float32Array・9個で1枚）で返す。
   これを二進STLにして readModelFile に通せば、読みこんだモデルと
   まったく同じものとして、そのあとの手順へ流せる。

   ── 立体の引き算（ブーリアン）は使わない ────────────────
   彫るときは、板を **2枚に分ける** だけでよい。

       のせる                     彫る
         ┌──┐ ┌─┐              ┌──┐    ┌─┐    ← 上の板（かたちの穴あき）
       ┌─┴──┴─┴─┐            ┌─┘    └────┘
       └──────────┘            └─────────────┘  ← 下の板

   ExtrudeGeometry は Shape の holes をそのまま抜いてくれるので、
   上の板に「文字のかたち」を穴として渡せば、それが彫った跡になる。
   引き算の計算を書かずに済み、面が壊れることもない。

   ★穴どうしが触れてはいけない。触れると三角形に切り分けるところ（earcut）が
     こわれる。QRのマス目は となりどうしがくっつくので、**上下にほんの少し
     すきま（マスの2%）を空けて**離してある。印刷の線の太さよりずっと細いので、
     刷ればつながる。
   ══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { parse as parseFont } from 'opentype.js';
import qrcode from 'qrcode-generator';

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];   // 日本語のURLも通す

const SEG = 40;          // 曲線を何本の直線で表すか
const FUSE = 0.4;        // のせるとき、土台にどれだけ食いこませるか（mm）

/* ── 土台のかたち ────────────────────────────────
   ratio … たて／よこ の比。inner … 文字やQRを置いてよい内がわの割合
   （まるい形ほど、四すみが使えないぶん小さくなる）。 */
export const SHAPES = [
  { id: 'round',  name: '四角',   ratio: 0.62, inner: 0.86 },
  { id: 'circle', name: 'まる',   ratio: 1.00, inner: 0.68 },
  { id: 'egg',    name: 'たまご', ratio: 0.68, inner: 0.70 },
  { id: 'hex',    name: '六角',   ratio: 0.88, inner: 0.74 },
];

/* ── 書体（public/fonts にある）─────────────────────
   ★public/ の中は Vite がさわらないので、束ねずに fetch で読む。
   ★はじめの5つは なまえプレートと同じもので、**ひらがな・カタカナ・英数字だけ**。
     漢字は入っていないので、漢字を打つと字が出ない。最後の「かんじ」だけは
     全部そろっているが 6MB あるので、選ばれたときにだけ読む。 */
export const FONTS = [
  { id: 'gothic', name: 'ゴシック',   file: '/fonts/gothic.ttf' },
  { id: 'maru',   name: 'まる',       file: '/fonts/maru.ttf' },
  { id: 'pop',    name: 'ふとポップ', file: '/fonts/pop.ttf' },
  { id: 'mincho', name: 'みんちょう', file: '/fonts/mincho.ttf' },
  { id: 'robo',   name: 'ドット',     file: '/fonts/robo.ttf' },
  { id: 'kanji',  name: 'かんじ',     file: '/fonts/IPAexGothic.ttf', heavy: true },
];

const fontCache = {};
export async function loadFont(id) {
  if (fontCache[id]) return fontCache[id];
  const f = FONTS.find(x => x.id === id) || FONTS[0];
  const res = await fetch(f.file);
  if (!res.ok) throw new Error(`書体（${f.name}）を読めませんでした`);
  return (fontCache[id] = parseFont(await res.arrayBuffer()));
}

/* ══ かたち（2次元）は、点の並びとして持つ ══════════════════
   { outer: [{x,y}…], holes: [[{x,y}…]…] }
   曲線のままだと動かしにくいので、はじめに点の並びへ落としてしまう。 */

const polyOf = shape => {
  const { shape: outer, holes } = shape.extractPoints(SEG);
  return {
    outer: outer.map(p => ({ x: p.x, y: p.y })),
    holes: holes.map(h => h.map(p => ({ x: p.x, y: p.y }))),
  };
};

const mapPoly = (p, f) => ({ outer: p.outer.map(f), holes: p.holes.map(h => h.map(f)) });

function bboxOf(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const q of p.outer) {
    if (q.x < x0) x0 = q.x;
    if (q.x > x1) x1 = q.x;
    if (q.y < y0) y0 = q.y;
    if (q.y > y1) y1 = q.y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/* 点の並び → THREE.Shape。extra には「外から足す穴」を渡せる（彫るとき） */
function shapeOf(poly, extra = []) {
  const s = new THREE.Shape(poly.outer.map(p => new THREE.Vector2(p.x, p.y)));
  for (const h of [...poly.holes, ...extra])
    s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, p.y))));
  return s;
}

/* ── 土台の輪郭 ──────────────────────────────── */
function baseShape(id, hw, hh) {
  const s = new THREE.Shape();
  if (id === 'circle' || id === 'egg') {
    s.absellipse(0, 0, hw, hh, 0, Math.PI * 2, false, 0);
  } else if (id === 'hex') {
    /* 平らな辺が上下に来る六角。とがった角が上だと押しにくい */
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const x = hw * Math.cos(a) / Math.cos(Math.PI / 6);
      const y = hh * Math.sin(a);
      i ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    s.closePath();
  } else {
    const r = Math.min(hw, hh) * 0.3;
    s.moveTo(-hw + r, -hh);
    s.lineTo(hw - r, -hh);  s.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
    s.lineTo(hw, hh - r);   s.absarc(hw - r,  hh - r, r, 0, Math.PI / 2, false);
    s.lineTo(-hw + r, hh);  s.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-hw, -hh + r); s.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  }
  return s;
}

/* ── 文字のかたち ────────────────────────────────
   opentype の道のり（path）を Shape に写す。y は上下がさかさま。 */
function pathToShapes(opPath) {
  const sp = new THREE.ShapePath();
  for (const c of opPath.commands) {
    if (c.type === 'M') sp.moveTo(c.x, -c.y);
    else if (c.type === 'L') sp.lineTo(c.x, -c.y);
    else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'Z' && sp.currentPath) sp.currentPath.autoClose = true;
  }
  return sp.toShapes(false);
}

/* 文字を、指定の箱（幅 bw・高さ bh）にちょうど収まる大きさで返す。中心そろえ。
   ★大きさを「％」で受けているのは、土台の大きさを変えても はみ出さないため。
     mm で持つと、土台を小さくしたとたんに文字がはみ出す。 */
function textPolys(font, text, bw, bh) {
  const NOMINAL = 100;
  const polys = pathToShapes(font.getPath(text, 0, 0, NOMINAL)).map(polyOf);
  if (!polys.length) return { polys: [], size: { w: 0, h: 0 } };
  const b = bboxOf(polys);
  if (!(b.w > 0 && b.h > 0)) return { polys: [], size: { w: 0, h: 0 } };
  const k = Math.min(bw / b.w, bh / b.h);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return {
    polys: polys.map(p => mapPoly(p, q => ({ x: (q.x - cx) * k, y: (q.y - cy) * k }))),
    size: { w: b.w * k, h: b.h * k },
  };
}

/* ── QR のかたち ─────────────────────────────────
   黒いマスを、横につながるだけつなげて長方形にする（面の数が減る）。
   上下は くっつかないよう ほんの少し詰める（冒頭★の理由）。 */
export function qrPolys(text, ec, side) {
  const q = qrcode(0, ec);
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const m = side / n;
  const gap = m * 0.02;
  const polys = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n;) {
      if (!q.isDark(r, c)) { c++; continue; }
      let c2 = c;
      while (c2 + 1 < n && q.isDark(r, c2 + 1)) c2++;
      const x0 = (c - n / 2) * m,          x1 = (c2 + 1 - n / 2) * m;
      const y0 = (n / 2 - r - 1) * m + gap, y1 = (n / 2 - r) * m - gap;
      polys.push({
        outer: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
        holes: [],
      });
      c = c2 + 1;
    }
  }
  return { polys, count: n, module: m };
}

/* ── 立体にする ────────────────────────────────── */
function extrude(shapes, depth, z) {
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: SEG });
  if (z) g.translate(0, 0, z);
  return g;
}

/* できた立体をぜんぶ1つの三角形の並びにまとめる */
function mergeTris(geos) {
  const parts = geos.map(g => (g.index ? g.toNonIndexed() : g).attributes.position.array);
  const out = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of parts) { out.set(a, o); o += a.length; }
  for (const g of geos) g.dispose();
  return out;
}

/* ── 土台の寸法 ─────────────────────────────────── */
export function sizeOf(opt) {
  const sh = SHAPES.find(s => s.id === opt.shape) || SHAPES[0];
  const hw = opt.width / 2;
  return { sh, hw, hh: hw * sh.ratio };
}

/* ══ のせる／彫るもの（2次元のかたち）を決める ═════════════
   立体にする前の平たいかたち。検算からも呼べるように外へ出してある
   （面積が分かれば、彫ったあとの体積を紙の上で出せる）。 */
export async function decoPolys(opt) {
  const { sh, hw, hh } = sizeOf(opt);
  const info = { warn: [] };

  if (opt.deco === 'text' && opt.text.trim()) {
    const font = await loadFont(opt.fontId);
    const text = opt.text.trim();
    /* ★この書体に無い字は、黙って消える。打った本人には理由が分からないので知らせる。
         はじめの5つの書体は かな＋英数字だけで、漢字が入っていない。 */
    const miss = [...text].filter(c => font.charToGlyphIndex(c) === 0);
    if (miss.length)
      info.warn.push(`この書体に「${[...new Set(miss)].join('')}」がありません。`
                   + '書体を「かんじ」にすると出ます');
    const k = opt.textPct / 100;
    const t = textPolys(font, text, hw * 2 * sh.inner * k, hh * 2 * sh.inner * k);
    info.text = t.size;
    return { deco: t.polys, info };
  }

  if (opt.deco === 'qr' && opt.url.trim()) {
    const side = Math.min(hw, hh) * 2 * sh.inner * (opt.qrPct / 100);
    let qr;
    try {
      qr = qrPolys(opt.url.trim(), opt.ec, side);
    } catch {
      throw new Error('QRにできませんでした。URLが長すぎるかもしれません');
    }
    info.qr = { count: qr.count, module: qr.module, side };
    /* ★1マスが細いと、刷っても読みとれない。ノズルは ふつう 0.4mm */
    if (qr.module < 0.6)
      info.warn.push(`QRの1マスが ${qr.module.toFixed(2)}mm しかありません。`
                   + 'QRを大きくするか、URLを短くしてください');
    return { deco: qr.polys, info };
  }

  return { deco: [], info };
}

/* ══ 本体 ═══════════════════════════════════════════════════
   opt … { shape, width, thick, deco:'none'|'text'|'qr', how:'raise'|'carve',
           depth, text, fontId, textPct, url, ec, qrPct }
   返すもの … { positions, size, info }（info は画面に出す数字と注意） */
export async function buildMake(opt) {
  const { sh, hw, hh } = sizeOf(opt);
  const base = polyOf(baseShape(sh.id, hw, hh));
  const { deco, info } = await decoPolys(opt);

  /* 彫る深さは板の厚みを超えられない（超えると板に穴があく） */
  const depth = Math.max(0.2, Math.min(opt.depth, opt.thick - 0.8));
  if (deco.length && opt.how === 'carve' && opt.depth > depth)
    info.warn.push(`板が薄いので、彫る深さを ${depth.toFixed(1)}mm にしました`);

  /* ── 立体を組む ── */
  const geos = [];
  const raised = deco.length && opt.how === 'raise';
  if (!deco.length) {
    geos.push(extrude([shapeOf(base)], opt.thick, 0));
  } else if (opt.how === 'carve') {
    /* 下の板（穴なし）＋ 上の板（かたちの穴あき）＋ 穴の中に残る島
       ★島は「あ」の中の閉じたところなど。忘れると、そこだけ抜けおちる。 */
    geos.push(extrude([shapeOf(base)], opt.thick - depth, 0));
    geos.push(extrude([shapeOf(base, deco.map(d => d.outer))], depth, opt.thick - depth));
    const islands = deco.flatMap(d => d.holes);
    if (islands.length)
      geos.push(extrude(islands.map(h => shapeOf({ outer: h, holes: [] })),
                        depth, opt.thick - depth));
  } else {
    geos.push(extrude([shapeOf(base)], opt.thick, 0));
    geos.push(extrude(deco.map(d => shapeOf(d)), depth + FUSE, opt.thick - FUSE));
  }

  return {
    positions: mergeTris(geos),
    size: { x: hw * 2, y: hh * 2, z: opt.thick + (raised ? depth : 0) },
    info,
  };
}
