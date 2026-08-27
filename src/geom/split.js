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
