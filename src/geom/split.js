/* 段のついた面でモデルを2つに分ける。

   ① 輪の高さ Zg では、輪から「外」へ水平に切る
   ② 輪にそって垂直に、溝の深さぶん下りる
   ③ 溝の底 Zb では、輪から「内」へ水平に切る

   上下のさかいめは、位置によって高さが変わる1枚の面になる：
     輪の内がわ … Zb
     輪の外がわ … Zg
   この面より上が上パーツ、下が下パーツ。
   ★内か外かの境目は、上下で別の輪を使う。上パーツは「栓の外まわり」、
     下パーツは「受け口の内まわり」。あいだの横のすきまぶんだけ食いちがう。
   ★これで「輪がモデルの表面まで届いていなくても」必ず2つに分かれる。
     ①の水平カットが外まで抜けるため。

   ★溝の底の面には、上下のあいだに底のすきま（floor）を空ける。
     下パーツの床は Zb（カップの一番下）、上パーツの底は Zb ＋ 底のすきま。 */

import { pointInPoly, thin } from './section.js';

/* 「その輪の内がわか」を速くしらべる関数を作る。
   ★頂点1つにつき輪の点の数だけかかる。三角形9万枚＝27万頂点なので、
     輪は 1mm ごとまで間引き、まず四角い枠で弾いてから中身をしらべる。 */
function insideOf(loop) {
  const ring = thin(loop, 1.0);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of ring) {
    if (p[0] < bx0) bx0 = p[0];
    if (p[0] > bx1) bx1 = p[0];
    if (p[1] < by0) by0 = p[1];
    if (p[1] > by1) by1 = p[1];
  }
  return (x, y) =>
    x >= bx0 && x <= bx1 && y >= by0 && y <= by1 && pointInPoly([x, y], ring);
}

/* zTop は数でも「その場所の高さを返す関数」でもよい（プロ編集のうねり）。
   ★底（zBot）は平らのまま。ここは十字のてっぺんに当てる面なので動かせない。 */
export function splitByStep(pos, loopUp, loopLo, zTop, zBot, floor = 1.0, range = null) {
  const inUp = insideOf(loopUp);      // 栓の外まわり
  const inLo = insideOf(loopLo);      // 受け口の内まわり
  /* 切り口のふちに使う線分（分かれめの面の上にある辺）を拾っておく */
  const rimUp = [], rimLo = [];
  /* ★さかいめが届く高さの幅。これより上／下の三角形は、内か外かをしらべるまでもなく
       まるごと片がわに入る。うねっているときは頂点ごとに atan2 がかかるので、
       ここで9割方はじけるかどうかで速さが変わる（実測 600ms → 150ms）。 */
  const zf = typeof zTop === 'function' ? zTop : null;
  const tHi = Math.max(range ? range[1] : (zf ? Infinity : zTop), zBot + floor);
  const tLo = Math.min(range ? range[0] : (zf ? -Infinity : zTop), zBot);

  const up = [], lo = [];
  const P = [[0,0,0],[0,0,0],[0,0,0]];
  const dU = [0, 0, 0];      // 上パーツのさかいめからの高さ（内がわだけ gap ぶん高い）
  const dL = [0, 0, 0];      // 下パーツのさかいめからの高さ

  for (let i = 0; i < pos.length; i += 9) {
    const z0 = pos[i + 2], z1 = pos[i + 5], z2 = pos[i + 8];
    const zmin = z0 < z1 ? (z0 < z2 ? z0 : z2) : (z1 < z2 ? z1 : z2);
    const zmax = z0 > z1 ? (z0 > z2 ? z0 : z2) : (z1 > z2 ? z1 : z2);
    if (zmin >= tHi) { for (let k = 0; k < 9; k++) up.push(pos[i + k]); continue; }
    if (zmax <= tLo) { for (let k = 0; k < 9; k++) lo.push(pos[i + k]); continue; }
    for (let k = 0; k < 3; k++) {
      P[k][0] = pos[i + k*3]; P[k][1] = pos[i + k*3 + 1]; P[k][2] = pos[i + k*3 + 2];
      const zt = zf ? zf(P[k][0], P[k][1]) : zTop;
      dU[k] = P[k][2] - (inUp(P[k][0], P[k][1]) ? zBot + floor : zt);
      dL[k] = P[k][2] - (inLo(P[k][0], P[k][1]) ? zBot : zt);
    }

    if (dU[0] >= 0 && dU[1] >= 0 && dU[2] >= 0) pushTri(up, P);
    else if (dU[0] > 0 || dU[1] > 0 || dU[2] > 0) fan(up, clipSide(P, dU, +1), rimUp);

    if (dL[0] <= 0 && dL[1] <= 0 && dL[2] <= 0) pushTri(lo, P);
    else if (dL[0] < 0 || dL[1] < 0 || dL[2] < 0) fan(lo, clipSide(P, dL, -1), rimLo);
  }
  return {
    upper: new Float32Array(up),
    lower: new Float32Array(lo),
    upperTris: up.length / 9,
    lowerTris: lo.length / 9,
    rimUp, rimLo,
  };
}

function pushTri(out, P) {
  for (const p of P) out.push(p[0], p[1], p[2]);
}

/* ══════════════════════════════════════════════════════════════
   切ったあとの「かたまり」を分ける

   ふつうは切ると上下2つになる。けれど U字（コの字）のように腕が
   2本あるかたちだと、切り口より上が **2つ以上に分かれる**。
   クリッカーが入るのはそのうち1つだけで、のこりは宙に浮いた
   バラバラの部品になってしまう。

   そこで「クリッカーのあるかたまり」だけを上パーツに残し、
   のこりは下パーツにくっつける（下から生えたままにする）。
   ══════════════════════════════════════════════════════════════ */

/* つながっている面ごとに分ける。
   ★頂点は座標を 0.001mm に丸めて突きあわせる。切ってできる点は同じ式で
     出しているので ふつうは ぴったり一致するが、丸めておけば わずかな
     ゆれで かたまりが余計に割れるのを防げる。 */
export function shells(pos, eps = 1e-3) {
  const nTri = pos.length / 9;
  if (nTri < 2) return nTri ? [pos] : [];

  const parent = new Int32Array(nTri);
  for (let i = 0; i < nTri; i++) parent[i] = i;
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };

  /* 同じ頂点を使う三角形どうしをつなぐ */
  const seen = new Map();
  const q = v => Math.round(v / eps);
  for (let t = 0; t < nTri; t++) {
    for (let k = 0; k < 3; k++) {
      const i = t * 9 + k * 3;
      const key = q(pos[i]) + ',' + q(pos[i + 1]) + ',' + q(pos[i + 2]);
      const prev = seen.get(key);
      if (prev === undefined) seen.set(key, t);
      else join(prev, t);
    }
  }

  /* かたまりごとに三角形を集める */
  const bucket = new Map();
  for (let t = 0; t < nTri; t++) {
    const r = find(t);
    let arr = bucket.get(r);
    if (!arr) { arr = []; bucket.set(r, arr); }
    arr.push(t);
  }
  if (bucket.size === 1) return [pos];

  const out = [];
  for (const tris of bucket.values()) {
    const a = new Float32Array(tris.length * 9);
    let w = 0;
    for (const t of tris) for (let k = 0; k < 9; k++) a[w++] = pos[t * 9 + k];
    out.push(a);
  }
  return out;
}

/* 三角形を真上から見て、その中に点 (x,y) が入っているか。

   ★立った面（横から見える壁）は真上から見ると線になり、面積が0になる。
     面積0のまま符号だけで判定すると「どの点も内側」と答えてしまい、
     どのかたまりにも当たってしまう。先に面積を見て、潰れていれば外す。 */
function triHasXY(pos, t, x, y) {
  const i = t * 9;
  const ax = pos[i],     ay = pos[i + 1];
  const bx = pos[i + 3], by = pos[i + 4];
  const cx = pos[i + 6], cy = pos[i + 7];
  const area2 = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(area2) < 1e-9) return false;      // 真上から見て潰れている
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/* かたまりが (x,y) を真上から覆っているか */
function coversXY(part, x, y) {
  for (let t = 0, n = part.length / 9; t < n; t++) if (triHasXY(part, t, x, y)) return true;
  return false;
}

/* かたまり same が本体 base の真上（または真下）に乗っているか。

   ★これが要る理由：上パーツには「別のかたまりだが、上パーツに乗っている
     もの」がある。たとえば なまえプレートの文字は、土台とは別の立体として
     書き出されていて、面で接しているだけ。これを下パーツへ落とすと、
     文字だけ台に取り残されてしまう（実際にそうなった）。
     真上から見て本体に重なっていれば、乗りものとみなして上に残す。 */
function sitsOn(part, base) {
  const n = part.length / 9;
  const step = Math.max(1, Math.floor(n / 24));   // 何枚か拾えば十分
  for (let t = 0; t < n; t += step) {
    const i = t * 9;
    const cx = (part[i] + part[i + 3] + part[i + 6]) / 3;
    const cy = (part[i + 1] + part[i + 4] + part[i + 7]) / 3;
    if (coversXY(base, cx, cy)) return true;
  }
  return false;
}

/* クリッカーのあるかたまりを残す。のこり（strays）は
   呼びもとで下パーツにくっつける。

   ・かたまりが1つなら そのまま返す（ふつうのかたち）
   ・(x,y) を真上から見て覆っているかたまりが「クリッカーのあるほう」
   ・そのかたまりに乗っているだけのもの（文字・かざり）も上に残す
   ・どちらでもないもの（U字の もう1本の腕）だけを下パーツへ回す
   ・クリッカーがどれにも当たらなければ いちばん大きいものを残す（安全側） */
export function pickShellAt(pos, x, y) {
  const parts = shells(pos);
  if (parts.length <= 1) return { keep: pos, strays: [] };

  let hit = -1;
  for (let i = 0; i < parts.length && hit < 0; i++) if (coversXY(parts[i], x, y)) hit = i;
  if (hit < 0) {
    hit = 0;
    for (let i = 1; i < parts.length; i++) if (parts[i].length > parts[hit].length) hit = i;
  }

  const base = parts[hit];
  const keep = [base], strays = [];
  for (let i = 0; i < parts.length; i++) {
    if (i === hit) continue;
    (sitsOn(parts[i], base) ? keep : strays).push(parts[i]);
  }

  if (keep.length === 1) return { keep: base, strays };
  let n = 0;
  for (const p of keep) n += p.length;
  const merged = new Float32Array(n);
  let w = 0;
  for (const p of keep) { merged.set(p, w); w += p.length; }
  return { keep: merged, strays };
}

/* d の符号が s のがわだけを残した多角形 */
function clipSide(P, d, s) {
  const poly = [];
  for (let k = 0; k < 3; k++) {
    const k2 = (k + 1) % 3;
    const da = d[k] * s, db = d[k2] * s;
    /* 4つめは「切ってできた点かどうか」のしるし */
    if (da >= 0) poly.push([P[k][0], P[k][1], P[k][2], da === 0]);
    if ((da > 0) !== (db > 0)) {
      const t = da / (da - db);
      poly.push([P[k][0] + (P[k2][0] - P[k][0]) * t,
                 P[k][1] + (P[k2][1] - P[k][1]) * t,
                 P[k][2] + (P[k2][2] - P[k][2]) * t, true]);
    }
  }
  return poly;
}

/* 切り取った多角形を三角形に。
   ★切り口のふちに乗った辺（＝もとの三角形になかった辺）を拾っておく。
     これがそのまま「ふたを張る相手」になるので、ふたと殻がぴったり合う。
     切り口の平面が場所によって高さの変わる面でも、これなら必ず一致する。 */
function fan(out, poly, rim) {
  for (let k = 1; k + 1 < poly.length; k++)
    for (const p of [poly[0], poly[k], poly[k + 1]]) out.push(p[0], p[1], p[2]);
  if (!rim) return;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    if (a[3] && b[3]) rim.push([a, b]);          // どちらも切ってできた点
  }
}
