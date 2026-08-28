/* ══════════════════════════════════════════════════════════════
   「モデルを作る」でつくる形

   **かたち（断面）を上へ積み上げた柱**が基本。その上に、文字か QR を
   **のせる**か**彫る**。できあがりは三角形の並び（Float32Array・9個で1枚）。
   これを二進STLにして readModelFile に通せば、読みこんだモデルと
   まったく同じものとして、そのあとの手順へ流せる。

   ── 積みかた ────────────────────────────────────────────
   高さちがいの「リング」を並べて、となりどうしを面でつなぐ。
   リングは断面を中心に向かって縮めたもの。縮めぐあいを変えるだけで、
   まっすぐな柱も、先すぼまりのキーキャップも、同じやり方で作れる。

       柱                 キーキャップ
       ┌──────┐          ╭────╮   ← 上のふちを丸める（リングを細かく）
       │      │         ╱      ╲  ← だんだん縮める（taper）
       │      │        │        │
       └──────┘        └────────┘

   ── 立体の引き算（ブーリアン）は使わない ────────────────
   彫るときは、柱を **z＝(高さ−深さ) で2つに割る** だけでよい。
   上がわの短い柱に、文字のかたちの穴をまっすぐ通す。

   ★穴は縮めない。まっすぐ下ろす。だから彫れる量はいつも
     「字の面積 × 深さ」ぴったりになり、検算で確かめられる。
   ★穴どうしが触れてはいけない。触れると三角形に切り分けるところ（earcut）が
     こわれる。QRのマス目は となりどうしがくっつくので、**上下にほんの少し
     すきま（マスの2%）を空けて**離してある。印刷の線の太さよりずっと細いので、
     刷ればつながる。
   ══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { parse as parseFont } from 'opentype.js';
import qrcode from 'qrcode-generator';

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];   // 日本語のURLも通す

/* 知らせの中で「打った字をそのまま見せたいところ」を囲む印。
   ★ひらがな切替（kana.js）は画面の文字をかたっぱしから開くので、
     「この書体に『猫』がありません」が「…『ねこ』が…」になってしまう。
     それでは何の字の話か分からない。ここを囲んでおけば、画面がわが
     data-no-kana で包んで、その中だけ変換されずに残る。 */
export const KEEP = '\u0001';

const SEG  = 40;         // 曲線を何本の直線で表すか
export const FUSE = 0.4; // のせるとき、土台にどれだけ食いこませるか（mm）
const RING = 5;          // 上のふちを丸めるときの、リングの数

/* ══ かたち（断面）═══════════════════════════════════════════
   inner  … 文字やQRを置いてよい内がわの割合（まるい形ほど、四すみが
            使えないぶん小さい）
   taper  … てっぺんで、断面を何倍まで縮めるか（1＝まっすぐな柱）
   fillet … 上のふちを丸める高さ（高さに対する割合）

   ★形そのものは なまえプレート（public/nameplate.html の makeBaseShapes）
     から持ってきた。あちらは平たい板、こちらは柱にする、という違いだけ。
   ★2つ以上のかたちでできている形（ねこ・くるま等）は、**はじめの1つを「顔」**
     として、文字やQRはそこにだけ彫る。顔からはみ出す穴は earcut がこわせない
     ので、置いてよい場所を1つにしぼっている。 */
export const SHAPES = [
  /* キーボードのキーを1つ抜いてきたような形。先すぼまりで、上のふちが丸い。
     クリッカーにするなら いちばん それらしいので、はじめに置いてある */
  { id: 'keycap',  name: 'キーキャップ', inner: 0.80, taper: 0.80, fillet: 0.16 },
  { id: 'round',   name: '四角',       inner: 0.86 },
  { id: 'square',  name: '正方形',     inner: 0.84 },
  { id: 'longrect',name: '長四角',     inner: 0.88 },
  { id: 'circle',  name: 'まる',       inner: 0.68 },
  { id: 'ellipse', name: 'たまご',     inner: 0.70 },
  { id: 'hexagon', name: '六角',       inner: 0.74 },
  { id: 'octagon', name: '八角',       inner: 0.74 },
  { id: 'triangle',name: '三角',       inner: 0.50 },
  { id: 'diamond', name: 'ひしがた',   inner: 0.52 },
  { id: 'star',    name: '星',         inner: 0.44 },
  { id: 'heart',   name: 'ハート',     inner: 0.56 },
  { id: 'onigiri', name: 'おにぎり',   inner: 0.52 },
  { id: 'web',     name: 'くもの巣',   inner: 0.62 },
  { id: 'cloud',   name: 'くも',       inner: 0.62 },
  { id: 'fish',    name: 'さかな',     inner: 0.52 },
  { id: 'cat',     name: 'ねこ',       inner: 0.62 },
  { id: 'car',     name: 'くるま',     inner: 0.66 },
  { id: 'train',   name: 'でんしゃ',   inner: 0.70 },
  { id: 'flower',  name: 'はな',       inner: 0.46 },
  { id: 'clover',  name: 'クローバー', inner: 0.44 },
  { id: 'ribbon',  name: 'リボン',     inner: 0.52 },
  { id: 'bubble',  name: 'ふきだし',   inner: 0.74 },
];

/* ── 書体（public/fonts にある）─────────────────────
   ★public/ の中は Vite がさわらないので、束ねずに fetch で読む。
   ★はじめの5つは なまえプレートと同じもので、**ひらがな・カタカナ・英数字だけ**。
     漢字は入っていないので、漢字を打つと字が出ない。最後の「かんじ」だけは
     全部そろっているが 6MB あるので、選ばれたときにだけ読む。 */
export const FONTS = [
  { id: 'gothic', name: 'ゴシック',   file: './fonts/gothic.ttf' },
  { id: 'maru',   name: 'まる',       file: './fonts/maru.ttf' },
  { id: 'pop',    name: 'ふとポップ', file: './fonts/pop.ttf' },
  { id: 'mincho', name: 'みんちょう', file: './fonts/mincho.ttf' },
  { id: 'robo',   name: 'ドット',     file: './fonts/robo.ttf' },
  { id: 'kanji',  name: 'かんじ',     file: './fonts/IPAexGothic.ttf', heavy: true },
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

/* 面積（時計まわりでも正の数で返す） */
const areaOf = pts => {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

/* ══ かたちを描く道具（なまえプレートから）════════════════ */

/* 角を丸めた多角形。とがりを丸めないと、印刷したとき折れる */
function roundedPoly(verts, radiusFn) {
  const n = verts.length;
  const s = new THREE.Shape();
  const V = p => new THREE.Vector2(p[0], p[1]);
  for (let i = 0; i < n; i++) {
    const prev = V(verts[(i - 1 + n) % n]), cur = V(verts[i]), next = V(verts[(i + 1) % n]);
    const r = typeof radiusFn === 'function' ? radiusFn(i) : radiusFn;
    const toPrev = prev.clone().sub(cur), toNext = next.clone().sub(cur);
    const rr = Math.min(r, toPrev.length() * 0.5, toNext.length() * 0.5);
    const a = cur.clone().add(toPrev.setLength(rr));
    const b = cur.clone().add(toNext.setLength(rr));
    if (i === 0) s.moveTo(a.x, a.y); else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  s.closePath();
  return s;
}

const rect = (w, h, r, cx = 0, cy = 0) => roundedPoly([
  [cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2],
  [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2],
], r);

const ell = (cx, cy, rx, ry) => {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
};

/* とがりの数だけ角のある多角形（六角・八角） */
const ngon = (n, r, round, turn = 0) => roundedPoly(
  Array.from({ length: n }, (_, i) => {
    const a = turn + i * Math.PI * 2 / n;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }), round);

/* かたちを返す。face＝文字やQRを置く「顔」。extras＝そこに足すだけのもの */
function shapeParts(id) {
  switch (id) {
    case 'square':   return [rect(112, 112, 18)];
    case 'longrect': return [rect(170, 52, 16)];
    case 'circle':   return [ell(0, 0, 56, 56)];
    case 'ellipse':  return [ell(0, 0, 84, 58)];
    case 'hexagon':  return [ngon(6, 62, 12)];
    case 'octagon':  return [ngon(8, 62, 12, Math.PI / 8)];
    case 'triangle': return [roundedPoly([[0, 62], [-58, -40], [58, -40]], 16)];
    case 'diamond':  return [roundedPoly([[0, 66], [56, 0], [0, -66], [-56, 0]], 14)];
    case 'onigiri':  return [roundedPoly([[0, 60], [-64, -44], [64, -44]], 22)];
    case 'star': {
      const outR = 74, inR = 34, n = 5, verts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = Math.PI / 2 + i * Math.PI / n;
        verts.push([Math.cos(a) * (i % 2 === 0 ? outR : inR), Math.sin(a) * (i % 2 === 0 ? outR : inR)]);
      }
      return [roundedPoly(verts, i => (i % 2 === 0 ? 16 : 11))];
    }
    case 'heart': {
      /* ベジェで描く素直なハート。もとの数字は y が下向きなので、ここで反転する */
      const s = new THREE.Shape(), sc = 4;
      const H = (x, y) => [x * sc, (-y + 2) * sc];
      s.moveTo(...H(-1, 17.2));
      s.bezierCurveTo(...H(-6, 10), ...H(-16, 8), ...H(-16, -2));
      s.bezierCurveTo(...H(-16, -10), ...H(-8, -14), ...H(0, -6));
      s.bezierCurveTo(...H(8, -14), ...H(16, -10), ...H(16, -2));
      s.bezierCurveTo(...H(16, 8), ...H(6, 10), ...H(1, 17.2));
      s.quadraticCurveTo(...H(0, 18), ...H(-1, 17.2));
      return [s];
    }
    case 'web': {
      /* 外に8つの とがり、あいだを内へ へこませたシルエット */
      const s = new THREE.Shape(), n = 8, R = 66, DIP = 0.7;
      const tip = i => { const a = Math.PI / 2 + i * Math.PI * 2 / n; return [Math.cos(a) * R, Math.sin(a) * R]; };
      const dip = i => { const a = Math.PI / 2 + (i + 0.5) * Math.PI * 2 / n; return [Math.cos(a) * R * DIP, Math.sin(a) * R * DIP]; };
      s.moveTo(...tip(0));
      for (let i = 0; i < n; i++) s.quadraticCurveTo(...dip(i), ...tip(i + 1));
      return [s];
    }
    case 'cloud':
      return [rect(118, 44, 22),
        ...[[-60, -2, 18], [-34, 12, 24], [2, 18, 28], [38, 12, 25], [62, -2, 18]]
          .map(([cx, cy, r]) => ell(cx, cy, r, r))];
    case 'fish':
      return [ell(8, 0, 62, 40), roundedPoly([[-28, 0], [-80, 36], [-80, -36]], 10)];
    case 'cat':
      return [ell(0, -4, 56, 48),
        roundedPoly([[-50, 8], [-34, 56], [-6, 24]], 7),
        roundedPoly([[50, 8], [34, 56], [6, 24]], 7)];
    case 'car':
      return [rect(152, 46, 14, 0, 2), rect(84, 42, 14, -8, 32),
        ell(-46, -26, 21, 21), ell(46, -26, 21, 21)];
    case 'train':
      return [rect(160, 76, 14, 0, 6),
        ell(-60, -30, 17, 17), ell(-30, -30, 17, 17),
        ell(30, -30, 17, 17), ell(60, -30, 17, 17)];
    case 'flower':
      return [ell(0, 0, 30, 30),
        ...Array.from({ length: 5 }, (_, i) => {
          const a = Math.PI / 2 + i * Math.PI * 2 / 5;
          return ell(Math.cos(a) * 38, Math.sin(a) * 38, 27, 27);
        })];
    case 'clover':
      return [rect(48, 48, 12),
        ...[[0, 36], [0, -36], [-36, 0], [36, 0]].map(([cx, cy]) => ell(cx, cy, 30, 30))];
    case 'ribbon':
      return [rect(44, 44, 10),
        roundedPoly([[-10, -17], [-78, -40], [-78, 40], [-10, 17]], 10),
        roundedPoly([[10, 17], [78, 40], [78, -40], [10, -17]], 10)];
    case 'bubble':
      return [rect(154, 86, 26, 0, 8), roundedPoly([[-46, -26], [-58, -74], [-6, -30]], 6)];
    case 'keycap':  return [rect(120, 120, 20)];
    default:        return [rect(158, 90, 16)];      // 'round'（四角）
  }
}

/* えらんだ形を、よこ幅 width mm にそろえて返す。
   face … 文字やQRを置く「顔」（はじめの1つ）／extras … 足すだけのもの */
function baseOf(id, width) {
  const parts = shapeParts(id).map(polyOf);
  const b = bboxOf(parts);
  const k = width / b.w;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const fix = p => mapPoly(p, q => ({ x: (q.x - cx) * k, y: (q.y - cy) * k }));
  const all = parts.map(fix);
  return { face: all[0], extras: all.slice(1), size: { x: b.w * k, y: b.h * k } };
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

/* ══ 立体にする ══════════════════════════════════════════
   リング … [{ s, z }]。s＝断面を中心に向かって何倍に縮めるか。

   ★縮めるのは「中心に向かって」なので、ふちからの距離が同じだけ減る
     わけではない（角のほうが多く減る）。まるい形なら正しく、四角なら
     角がすこし多めに落ちる。見た目の丸みとしては十分なので、そうしている。 */
function ringsFor(h, sh, halfW) {
  const st = sh.taper ?? 1;
  const r  = (sh.fillet ?? 0) * h;
  const sAt = z => 1 + (st - 1) * (z / h);
  if (!(r > 0)) return [{ s: 1, z: 0 }, { s: st, z: h }];
  const out = [{ s: 1, z: 0 }, { s: sAt(h - r), z: h - r }];
  for (let i = 1; i <= RING; i++) {
    const a = (i / RING) * Math.PI / 2;
    const z = h - r + r * Math.sin(a);
    out.push({ s: sAt(z) - (r * (1 - Math.cos(a))) / halfW, z });
  }
  return out;
}

/* リングの列を z＝cut で2つに割る（彫るときに使う）。
   ちょうどの高さのリングが無ければ、あいだを取って足す。 */
function splitRings(rings, cut) {
  const low = [], high = [];
  for (let i = 0; i < rings.length; i++) {
    const a = rings[i];
    if (a.z <= cut + 1e-9) low.push(a);
    if (a.z >= cut - 1e-9) high.push(a);
    const b = rings[i + 1];
    if (b && a.z < cut && b.z > cut) {
      const t = (cut - a.z) / (b.z - a.z);
      const mid = { s: a.s + (b.s - a.s) * t, z: cut };
      low.push(mid); high.push(mid);
    }
  }
  return { low, high };
}

/* 断面 poly を、リングにそって積み上げた立体。
   through … まっすぐ下ろす穴（縮めない）。上下のふたにも同じ穴があく。 */
function stack(poly, rings, through = []) {
  /* ★終わりの点が始めの点と同じなら、先に落としておく。
       THREE.ShapeUtils.triangulateShape は中でこれを**勝手に取りのぞく**ので、
       こちらが持っている点の並びと1つずれる。ふたの三角形が別の点を指して、
       ほんの少しだけ形がくずれる（彫った量が合わないことで見つけた）。 */
  const dedup = pts => (pts.length > 1
    && Math.abs(pts[0].x - pts.at(-1).x) < 1e-9
    && Math.abs(pts[0].y - pts.at(-1).y) < 1e-9 ? pts.slice(0, -1) : pts);
  /* three の決まりに合わせる … 外は時計まわり、穴は反時計まわり */
  const cw = pts => (THREE.ShapeUtils.isClockWise(pts) ? pts : pts.slice().reverse());
  const ccw = pts => (THREE.ShapeUtils.isClockWise(pts) ? pts.slice().reverse() : pts);
  const outer = cw(dedup(poly.outer));
  const holes = [...poly.holes, ...through].map(h => ccw(dedup(h)));

  const faces = THREE.ShapeUtils.triangulateShape(
    outer.map(p => new THREE.Vector2(p.x, p.y)),
    holes.map(h => h.map(p => new THREE.Vector2(p.x, p.y))));

  /* リングごとの点。外だけ縮め、穴はそのまま */
  const at = (ring, p, isHole) =>
    ({ x: isHole ? p.x : p.x * ring.s, y: isHole ? p.y : p.y * ring.s, z: ring.z });

  const list = [];                                   // ふたを張るときの点の並び
  for (const p of outer) list.push({ p, hole: false });
  for (const h of holes) for (const p of h) list.push({ p, hole: true });

  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  /* 下のふた（下向き）と上のふた（上向き）
     ★向きは「外から見て反時計まわり」。まちがえると立体がうら返り、
       検算の体積が負の数になる（そこで気づける）。 */
  const lo = rings[0], hi = rings[rings.length - 1];
  for (const [i, j, k] of faces) {
    tri(at(lo, list[k].p, list[k].hole), at(lo, list[j].p, list[j].hole), at(lo, list[i].p, list[i].hole));
    tri(at(hi, list[i].p, list[i].hole), at(hi, list[j].p, list[j].hole), at(hi, list[k].p, list[k].hole));
  }

  /* よこの壁。輪ごとに、となりのリングとのあいだを四角でつなぐ */
  const loops = [{ pts: outer, hole: false }, ...holes.map(h => ({ pts: h, hole: true }))];
  for (const { pts, hole } of loops) {
    for (let r = 0; r + 1 < rings.length; r++) {
      const r0 = rings[r], r1 = rings[r + 1];
      for (let i = 0, n = pts.length; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const a0 = at(r0, a, hole), b0 = at(r0, b, hole);
        const a1 = at(r1, a, hole), b1 = at(r1, b, hole);
        tri(a0, b1, b0);
        tri(a0, a1, b1);
      }
    }
  }
  return pos;
}

/* まっすぐな柱（文字やQRを のせる ときに使う） */
const post = (poly, z0, z1) => stack(poly, [{ s: 1, z: z0 }, { s: 1, z: z1 }]);

/* ══ のせる／彫るもの（2次元のかたち）═══════════════════════
   立体にする前の平たいかたち。検算からも呼べるように外へ出してある
   （面積が分かれば、彫ったあとの体積を紙の上で出せる）。 */
export async function decoPolys(opt) {
  const sh = SHAPES.find(s => s.id === opt.shape) || SHAPES[0];
  const base = baseOf(sh.id, opt.width);
  const fb = bboxOf([base.face]);
  const info = { warn: [] };

  /* 文字やQRは **てっぺんの面**に乗る。先すぼまりの形では、その面のぶんだけ
     置ける場所がせまい。いちばん上のリングの縮めぐあいをかけておく。 */
  const top = ringsFor(opt.thick, sh, Math.max(fb.w, fb.h) / 2).at(-1).s;
  const room = k => ({ w: fb.w * sh.inner * top * k, h: fb.h * sh.inner * top * k });

  if (opt.deco === 'text' && opt.text.trim()) {
    const font = await loadFont(opt.fontId);
    const text = opt.text.trim();
    /* ★この書体に無い字は、黙って消える。打った本人には理由が分からないので知らせる。
         はじめの5つの書体は かな＋英数字だけで、漢字が入っていない。 */
    const miss = [...text].filter(c => font.charToGlyphIndex(c) === 0);
    if (miss.length)
      info.warn.push(`この書体に「${KEEP}${[...new Set(miss)].join('')}${KEEP}」がありません。`
                   + '書体を「かんじ」にすると出ます');
    const r = room(opt.textPct / 100);
    const t = textPolys(font, text, r.w, r.h);
    info.text = t.size;
    return { deco: t.polys, info, base };
  }

  if (opt.deco === 'qr' && opt.url.trim()) {
    const r = room(opt.qrPct / 100);
    const side = Math.min(r.w, r.h);
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
    return { deco: qr.polys, info, base };
  }

  return { deco: [], info, base };
}

/* ══ 本体 ═══════════════════════════════════════════════════
   opt … { shape, width, thick, deco:'none'|'text'|'qr', how:'raise'|'carve',
           depth, text, fontId, textPct, url, ec, qrPct }
   返すもの … { positions, size, info }（info は画面に出す数字と注意） */
export async function buildMake(opt) {
  const sh = SHAPES.find(s => s.id === opt.shape) || SHAPES[0];
  const { deco, info, base } = await decoPolys(opt);
  const parts = [base.face, ...base.extras];
  const rings = ringsFor(opt.thick, sh, Math.max(base.size.x, base.size.y) / 2);

  /* 彫る深さは柱の高さを超えられない（超えると底まで抜ける） */
  const depth = Math.max(0.2, Math.min(opt.depth, opt.thick - 0.8));
  if (deco.length && opt.how === 'carve' && opt.depth > depth)
    info.warn.push(`うすいので、彫る深さを ${depth.toFixed(1)}mm にしました`);

  const tris = [];
  /* ★2つ以上のかたちでできている形（ねこ・くも等）は、重なったまま**別々の立体**
       として出す。スライサーが1つにまとめてくれる。ただし体積を足すと
       重なりが二重に数えられるので、検算はそれを見こんで見つもる。 */
  if (!deco.length) {
    for (const p of parts) tris.push(stack(p, rings));
  } else if (opt.how === 'carve') {
    /* 高さ−深さ で2つに割り、上がわの短い柱にだけ穴を通す。
       ★穴の中に残る「島」（「あ」の中の閉じたところ）を忘れないこと。
         忘れると そこまで抜けおちる。 */
    const { low, high } = splitRings(rings, opt.thick - depth);
    for (const p of parts) tris.push(stack(p, low));
    tris.push(stack(base.face, high, deco.map(d => d.outer)));
    for (const p of base.extras) tris.push(stack(p, high));
    for (const d of deco)
      for (const h of d.holes) tris.push(post({ outer: h, holes: [] }, opt.thick - depth, opt.thick));
  } else {
    /* てっぺんの面に置く。少し食いこませて、浮かないようにする */
    for (const p of parts) tris.push(stack(p, rings));
    for (const d of deco) tris.push(post(d, opt.thick - FUSE, opt.thick + depth));
  }

  const n = tris.reduce((a, t) => a + t.length, 0);
  const positions = new Float32Array(n);
  let o = 0;
  for (const t of tris) { positions.set(t, o); o += t.length; }

  info.parts = tris.length;
  return {
    positions,
    size: {
      x: base.size.x, y: base.size.y,
      z: opt.thick + (deco.length && opt.how === 'raise' ? depth : 0),
    },
    info,
  };
}

/* 検算むけ … 彫れるはずの量（字の面積）*/
export const inkArea = deco =>
  deco.reduce((s, p) => s + areaOf(p.outer) - p.holes.reduce((h, q) => h + areaOf(q), 0), 0);
