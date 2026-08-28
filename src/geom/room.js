/* 下パーツにあける「スイッチの部屋」。

   かたちは黄色の見本（＝スイッチそのもの）どおり。四角い部屋の底のまん中に、
   中心ポール（固定用の円柱）を受けるくぼみがある。★下は突きぬけない。
   スイッチは器の床の四角い穴から、上から落としこむ。

        溝の底 ─┬──────────┬─   ← 部屋の天井。器の床にあく四角い穴（ここから入れる）
                │  16.4角   │
                │   部屋    │      ← まわりの肉は残る
        胴の底 ─┴──┬───┬──┴─   ← 部屋の床。ここに胴がのる
                   │φ4.4│         ← 中心ポールのくぼみ
       ポール先 ───┴───┴───
        ────────────────────  ← モデルの底。肉は残る

   ふつうは部屋がまるごと肉の中に入るので、やることは「内がわを向いた面を足す」だけ
   （切るものが何もない。天井の四角い穴は capLower が器の床に空けてくれている）。

   ★肉が足りなくて部屋がモデルからはみ出すときだけ、昔のやり方（下まで突きぬけて
     抜き、はみ出した口に壁を張る）に落とす。そうしないと、はみ出したところで
     口が開いたままになる。 */

import * as THREE from 'three';
import { buildLoops, nestLoops } from './section.js';

/* 部屋のかたち。
     zTop … 天井（溝の底）
     zMid … 部屋の床（＝胴の底。ポールのぶんだけ底より上）
     zBot … くぼみの底（＝中心ポールの先）
     rp   … くぼみの半径 */
export const roomBox = (cx, cy, side, zTop, bot, pole = 0, poleH = 0) => ({
  x0: cx - side / 2, x1: cx + side / 2,
  y0: cy - side / 2, y1: cy + side / 2,
  zTop, zBot: bot, zMid: Math.min(zTop, bot + poleH),
  cx, cy, rp: pole / 2,
});

/* 天井の四角（器の床に空ける穴）。反時計まわり */
export const roomSquare = b => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];

/* 多角形を1枚の面で切って、[中に残るぶん, 外へ出るぶん] にする */
function split(poly, axis, sign, c) {
  const inP = [], outP = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = sign * (a[axis] - c), db = sign * (b[axis] - c);
    if (da >= 0) inP.push(a); else outP.push(a);
    if ((da > 0) !== (db > 0)) {
      const t = da / (da - db);
      const p = [a[0] + (b[0] - a[0]) * t,
                 a[1] + (b[1] - a[1]) * t,
                 a[2] + (b[2] - a[2]) * t];
      /* ★切った軸はぴったり面に合わせる。丸めのぶんずれると、
           あとで張る壁とのあいだにすきまが出る。 */
      p[axis] = c;
      inP.push(p); outP.push(p);
    }
  }
  return [inP, outP];
}

function fan(out, poly) {
  for (let k = 1; k + 1 < poly.length; k++)
    for (const p of [poly[0], poly[k], poly[k + 1]]) out.push(p[0], p[1], p[2]);
}

/* ① 四角柱の中の肉を抜く */
function subtract(pos, b) {
  const out = [];
  const planes = [
    [0, +1, b.x0], [0, -1, b.x1],
    [1, +1, b.y0], [1, -1, b.y1],
    [2, -1, b.zTop],
  ];
  const P = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < pos.length; i += 9) {
    /* ★まるごと外なら、そのまま通す（ほとんどの三角形はこっち） */
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, zmin = Infinity;
    for (let k = 0; k < 3; k++) {
      const x = pos[i + k*3], y = pos[i + k*3 + 1], z = pos[i + k*3 + 2];
      if (x < xmin) xmin = x; if (x > xmax) xmax = x;
      if (y < ymin) ymin = y; if (y > ymax) ymax = y;
      if (z < zmin) zmin = z;
      P[k][0] = x; P[k][1] = y; P[k][2] = z;
    }
    if (xmax <= b.x0 || xmin >= b.x1 || ymax <= b.y0 || ymin >= b.y1 || zmin >= b.zTop) {
      for (let k = 0; k < 9; k++) out.push(pos[i + k]);
      continue;
    }
    carve([P[0].slice(), P[1].slice(), P[2].slice()], planes, 0, out, false);
  }
  return new Float32Array(out);
}

/* 三角形を5面ぜんぶで切り分ける。
   ★「外に出たぶん」も残りの面で切っておくこと。片がわだけ切ると、
     となりあう面のふちの点の数が食いちがって（T字）、あとで口が開く（実測82本）。
   done＝すでに箱の外だと分かっているぶん。 */
function carve(poly, planes, i, out, done) {
  if (i === planes.length) {
    if (done) fan(out, poly);       // 箱の外 → 残す
    return;                         // 箱の中 → 捨てる
  }
  const [axis, sign, c] = planes[i];
  const [inP, outP] = split(poly, axis, sign, c);
  if (inP.length >= 3) carve(inP, planes, i + 1, out, done);
  if (outP.length >= 3) carve(outP, planes, i + 1, out, true);
}

/* ── 抜いたあとの穴に、ふたを張る ──────────────────
   ★張る形は「切り口をもう一度計算する」のではなく、**出てきた形のひらいた辺**
     （1回しか使われていない辺）から作る。計算しなおすと、丸めと輪のつなぎ方の
     ちがいでほんの少しずれて、すきまが残る（実測で68本ぶん空いた）。 */

const QK = (x, y, z) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;

/* 1回しか使われていない辺を集める（向きは出てきたときのまま） */
function openEdges(tris) {
  const m = new Map();
  for (let i = 0; i < tris.length; i += 9) {
    for (let e = 0; e < 3; e++) {
      const i0 = i + e * 3, i1 = i + ((e + 1) % 3) * 3;
      const A = [tris[i0], tris[i0 + 1], tris[i0 + 2]];
      const B = [tris[i1], tris[i1 + 1], tris[i1 + 2]];
      const ka = QK(...A), kb = QK(...B);
      if (ka === kb) continue;
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const rec = m.get(id);
      if (rec) rec.n++;
      else m.set(id, { A, B, n: 1 });
    }
  }
  const out = [];
  for (const r of m.values()) if (r.n === 1) out.push(r);
  return out;
}

/* ひらいた辺を、向きを気にせずつないで1本の線にする */
function chainUp(segs) {
  const q = 1e-4;
  const key = p => `${Math.round(p[0] / q)},${Math.round(p[1] / q)}`;
  const at = new Map();
  for (const s of segs) for (const p of s) {
    const k = key(p);
    if (!at.has(k)) at.set(k, []);
    at.get(k).push(s);
  }
  const used = new Set(), out = [];
  /* はしから伸ばす（1本しかつながっていない点＝はし） */
  const starts = [...at.entries()].filter(([, v]) => v.length === 1).map(([k]) => k);
  const walk = k0 => {
    const pts = [];
    let k = k0, prev = null;
    for (let guard = 0; guard < 1e5; guard++) {
      const list = (at.get(k) || []).filter(s => !used.has(s));
      if (!list.length) break;
      const s = list[0];
      used.add(s);
      const a = key(s[0]) === k ? s[0] : s[1];
      const b = key(s[0]) === k ? s[1] : s[0];
      if (!pts.length) pts.push(a);
      pts.push(b);
      k = key(b);
      prev = s;
    }
    return pts;
  };
  for (const k of starts) {
    const pts = walk(k);
    if (pts.length >= 2) out.push(pts);
  }
  /* 輪になっているぶん（はしがない）も拾う */
  for (const s of segs) {
    if (used.has(s)) continue;
    const pts = walk(key(s[0]));
    if (pts.length >= 3) out.push(pts);
  }
  return out;
}

/* 面ごとにふたを張る。axis 0＝x の面（u＝y, v＝z）、1＝y の面（u＝x, v＝z）。
   ★天井（v＝vTop）とすみ（u＝u0／u1）の辺は、こちらで足して輪を閉じる。
     切り口の線だけでは閉じない（すみに沿う辺は、切ったときに出てこない）。 */
function wallPoly(edges, w, vTop) {
  const eps = 1e-6;
  const segs = [];
  for (const { A, B } of edges) {
    if (Math.abs(A[w.axis] - w.c) > eps || Math.abs(B[w.axis] - w.c) > eps) continue;
    const u = w.axis === 0 ? 1 : 0;
    /* 天井の辺（器の床の穴のふち）は、あとで足すので外す */
    if (Math.abs(A[2] - vTop) < 1e-4 && Math.abs(B[2] - vTop) < 1e-4) continue;
    segs.push([[A[u], A[2]], [B[u], B[2]]]);
  }
  /* ★1本でよい。まっすぐな面（板の底など）に四角い穴があくと、その辺は
       **1本の線分**になる。2本以上を求めていたので、4つの壁のうち
       たまたま三角形が割れなかった側だけ作られず、そこが口を開けていた
       （切り口が低くて部屋が底を突きぬけるときに出る。実測6本）。 */
  if (!segs.length) return null;
  const chains = chainUp(segs).sort((a, b) => b.length - a.length);
  let ch = chains[0];
  if (!ch || ch.length < 2) return null;
  /* 左（u0）から右（u1）へ向くようにそろえる */
  if (Math.abs(ch[0][0] - w.u0) > Math.abs(ch[ch.length - 1][0] - w.u0)) ch = ch.slice().reverse();
  const a = ch[0], b = ch[ch.length - 1];
  if (Math.abs(a[0] - w.u0) > 0.05 || Math.abs(b[0] - w.u1) > 0.05) return null;
  return { ch, a, b };
}

/* すみの高さは、となりあう2面で同じにする（ずれると そこだけ口が開く） */
function shareCorners(polys, W) {
  const key = (x, y) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)}`;
  const at = new Map();
  const ends = [];
  polys.forEach((pl, i) => {
    if (!pl) return;
    const w = W[i];
    for (const [pt, u] of [[pl.a, w.u0], [pl.b, w.u1]]) {
      const x = w.axis === 0 ? w.c : u, y = w.axis === 0 ? u : w.c;
      const k = key(x, y);
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(pt);
      ends.push(pt);
    }
  });
  for (const list of at.values()) {
    if (list.length < 2) continue;
    let v = 0;
    for (const p of list) v += p[1];
    v /= list.length;
    for (const p of list) p[1] = v;
  }
}

/* 多角形を三角形にして、3Dへ立てる */
function wallTris(pl, w, vTop) {
  const pts = [[w.u0, vTop], ...pl.ch, [w.u1, vTop]];
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ShapeGeometry(sh).toNonIndexed();
  const p = g.attributes.position.array;
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 9) {
    /* u×v の向きは x の面なら ＋x、y の面なら −y。内がわへ向ける */
    const ar = (p[i+3] - p[i]) * (p[i+7] - p[i+1]) - (p[i+4] - p[i+1]) * (p[i+6] - p[i]);
    const base = w.axis === 0 ? +1 : -1;
    const want = w.inward ? +1 : -1;
    const ord = ((ar < 0) !== (base * want < 0)) ? [2, 1, 0] : [0, 1, 2];
    for (let k = 0; k < 3; k++) {
      const s = i + ord[k] * 3;
      const u = p[s], v = p[s + 1];
      out[i + k*3]     = w.axis === 0 ? w.c : u;
      out[i + k*3 + 1] = w.axis === 0 ? u : w.c;
      out[i + k*3 + 2] = v;
    }
  }
  g.dispose();
  return out;
}

/* ── T字の後始末 ────────────────────────────────
   となりの三角形が切られていて、こちらは切られていないと、長い辺の途中に
   点がのった「T字」になる。辺が食いちがうので、そこだけ口が開いて見える。
   ★ひらいた辺を集めて、その上にのっている点で三角形を分けなおす。 */
export function healT(tris) {
  const q = 1e4;
  const key = (x, y, z) => `${Math.round(x*q)},${Math.round(y*q)},${Math.round(z*q)}`;
  const seen = new Map();
  for (let t = 0; t < tris.length; t += 9) {
    for (let e = 0; e < 3; e++) {
      const i0 = t + e*3, i1 = t + ((e+1)%3)*3;
      const ka = key(tris[i0], tris[i0+1], tris[i0+2]);
      const kb = key(tris[i1], tris[i1+1], tris[i1+2]);
      if (ka === kb) continue;
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const r = seen.get(id);
      if (r) r.n++; else seen.set(id, { n: 1, t, e });
    }
  }
  const open = [...seen.values()].filter(r => r.n === 1);
  if (!open.length) return tris;

  /* 点をおおまかな升目に入れておく（近くの点だけ見ればよい）。
     ★入れるのは「ひらいた辺のまわり」だけ。ぜんぶ入れると 14万点ぶんかかる（300ms）。 */
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const { t, e } of open) {
    for (const j of [e, (e + 1) % 3]) {
      const i = t + j * 3;
      for (let k = 0; k < 3; k++) {
        if (tris[i + k] < lo[k]) lo[k] = tris[i + k];
        if (tris[i + k] > hi[k]) hi[k] = tris[i + k];
      }
    }
  }
  for (let k = 0; k < 3; k++) { lo[k] -= 0.01; hi[k] += 0.01; }
  const cell = 1.0;
  const grid = new Map();
  for (let i = 0; i < tris.length; i += 3) {
    if (tris[i] < lo[0] || tris[i] > hi[0] || tris[i+1] < lo[1] || tris[i+1] > hi[1]
      || tris[i+2] < lo[2] || tris[i+2] > hi[2]) continue;
    const k = `${Math.floor(tris[i]/cell)},${Math.floor(tris[i+1]/cell)},${Math.floor(tris[i+2]/cell)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const EPS = 1e-4;
  const cut = new Map();               // 三角形の頭 → 辺ごとに足す点
  for (const { t, e } of open) {
    const i0 = t + e*3, i1 = t + ((e+1)%3)*3;
    const A = [tris[i0], tris[i0+1], tris[i0+2]];
    const B = [tris[i1], tris[i1+1], tris[i1+2]];
    const dx = B[0]-A[0], dy = B[1]-A[1], dz = B[2]-A[2];
    const len2 = dx*dx + dy*dy + dz*dz;
    if (len2 < 1e-12) continue;
    const found = [];
    const lo = [Math.min(A[0],B[0]), Math.min(A[1],B[1]), Math.min(A[2],B[2])];
    const hi = [Math.max(A[0],B[0]), Math.max(A[1],B[1]), Math.max(A[2],B[2])];
    for (let cx = Math.floor(lo[0]/cell); cx <= Math.floor(hi[0]/cell); cx++)
    for (let cy = Math.floor(lo[1]/cell); cy <= Math.floor(hi[1]/cell); cy++)
    for (let cz = Math.floor(lo[2]/cell); cz <= Math.floor(hi[2]/cell); cz++) {
      for (const i of grid.get(`${cx},${cy},${cz}`) || []) {
        const P = [tris[i], tris[i+1], tris[i+2]];
        const s = ((P[0]-A[0])*dx + (P[1]-A[1])*dy + (P[2]-A[2])*dz) / len2;
        if (s <= 1e-6 || s >= 1 - 1e-6) continue;
        const d = Math.hypot(P[0]-(A[0]+dx*s), P[1]-(A[1]+dy*s), P[2]-(A[2]+dz*s));
        if (d > EPS) continue;
        if (!found.some(f => Math.abs(f.s - s) < 1e-9)) found.push({ s, P });
      }
    }
    if (!found.length) continue;
    found.sort((a, b) => a.s - b.s);
    if (!cut.has(t)) cut.set(t, {});
    cut.get(t)[e] = found.map(f => f.P);
  }
  if (!cut.size) return tris;

  const out = [];
  for (let t = 0; t < tris.length; t += 9) {
    const c = cut.get(t);
    if (!c) { for (let k = 0; k < 9; k++) out.push(tris[t+k]); continue; }
    /* 辺の途中の点を入れた多角形にして、扇形に張りなおす */
    const poly = [];
    for (let e = 0; e < 3; e++) {
      const i0 = t + e*3;
      poly.push([tris[i0], tris[i0+1], tris[i0+2]]);
      for (const p of (c[e] || [])) poly.push(p);
    }
    for (let k = 1; k + 1 < poly.length; k++)
      for (const p of [poly[0], poly[k], poly[k+1]]) out.push(p[0], p[1], p[2]);
  }
  return new Float32Array(out);
}

/* 下パーツ（閉じた立体）から部屋を抜いて、壁を張ったものを返す。
   ★肉が足りずに部屋がはみ出したときだけ通る道。下まで突きぬける。 */
function cutThrough(pos, b) {
  const body = subtract(pos, b);
  /* ★ふたは、抜いたあとの形のひらいた辺から張る。切り口をもう一度計算すると、
       丸めと輪のつなぎ方のちがいでずれて、すきまが残る（実測68本）。 */
  const edges = openEdges(body);
  const W = [
    { axis: 0, c: b.x0, u0: b.y0, u1: b.y1, inward: true  },
    { axis: 0, c: b.x1, u0: b.y0, u1: b.y1, inward: false },
    { axis: 1, c: b.y0, u0: b.x0, u1: b.x1, inward: true  },
    { axis: 1, c: b.y1, u0: b.x0, u1: b.x1, inward: false },
  ];
  const polys = W.map(w => wallPoly(edges, w, b.zTop));
  shareCorners(polys, W);
  const walls = polys.map((pl, i) => pl ? wallTris(pl, W[i], b.zTop) : new Float32Array(0));
  let len = body.length;
  for (const w of walls) len += w.length;
  const all = new Float32Array(len);
  all.set(body, 0);
  let o = body.length;
  for (const w of walls) { all.set(w, o); o += w.length; }
  return healT(all);
}


/* ── ふつうの道：肉の中にくぼみを足す ───────────────
   部屋がまるごと肉の中にあるなら、切るものは何もない。
   内がわを向いた面（壁・床・くぼみ）を足すだけで、閉じた立体のままになる。
   ★天井は張らない。そこは器の床にあいた四角い穴（capLower がやっている）で、
     部屋はそこから上のカップにつながっている（スイッチはそこから入れる）。 */

const NC = 24;                                   // くぼみの丸さ

function circlePts(b) {
  const out = [];
  for (let i = 0; i < NC; i++) {
    const t = i * Math.PI * 2 / NC;
    out.push([b.cx + Math.cos(t) * b.rp, b.cy + Math.sin(t) * b.rp]);
  }
  return out;
}

/* 反時計まわりの輪を、zLo〜zHi の壁にする。
   ★内がわ（輪のまん中）を向かせたいので、外向きの並びの逆で張る。 */
function tube(out, loop, zLo, zHi) {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], c = loop[(i + 1) % loop.length];
    out.push(c[0], c[1], zLo, a[0], a[1], zLo, a[0], a[1], zHi);
    out.push(c[0], c[1], zLo, a[0], a[1], zHi, c[0], c[1], zHi);
  }
}

/* 平らな面。up＝true で上向き（＋Z） */
function flat(out, shape, z, up) {
  const g = new THREE.ShapeGeometry(shape).toNonIndexed();
  const p = g.attributes.position.array;
  const ord = up ? [0, 1, 2] : [2, 1, 0];
  for (let i = 0; i < p.length; i += 9)
    for (const k of ord) out.push(p[i + k * 3], p[i + k * 3 + 1], z);
  g.dispose();
}

const v2 = pts => pts.map(p => new THREE.Vector2(p[0], p[1]));

export function pocketShell(b) {
  const out = [];
  const sq = roomSquare(b);
  const dent = b.rp > 0.05 && b.zMid - b.zBot > 0.05;
  /* 四角い部屋の壁（天井から部屋の床まで）。
     ★天井の辺は、器の床にあけた穴の辺とぴったり同じ4本。
       途中で割らないこと（割ると相手と食いちがってT字になる）。 */
  tube(out, sq, b.zMid, b.zTop);
  /* 部屋の床。まん中はくぼみのぶんだけ抜く */
  const floor = new THREE.Shape(v2(sq));
  if (dent) floor.holes.push(new THREE.Path(v2(circlePts(b)).reverse()));
  flat(out, floor, b.zMid, true);
  if (dent) {
    tube(out, circlePts(b), b.zBot, b.zMid);
    flat(out, new THREE.Shape(v2(circlePts(b))), b.zBot, true);
  }
  return new Float32Array(out);
}

/* ── 部屋がまるごと肉の中にあるか ──────────────────
   ★面と面がふれているだけ（天井は器の床と同じ高さ）は「あたり」にしない。
     箱をほんの少し縮めてから調べる。 */
const SHRINK = 0.02;

function boxHit(pos, lo, hi) {
  const c = [(lo[0]+hi[0])/2, (lo[1]+hi[1])/2, (lo[2]+hi[2])/2];
  const h = [(hi[0]-lo[0])/2, (hi[1]-lo[1])/2, (hi[2]-lo[2])/2];
  if (h[0] <= 0 || h[1] <= 0 || h[2] <= 0) return false;
  const V = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < pos.length; i += 9) {
    /* まず そまつな箱どうしで見て、ほとんどをはじく */
    let out = false;
    for (let k = 0; k < 3 && !out; k++) {
      let mn = Infinity, mx = -Infinity;
      for (let t = 0; t < 3; t++) {
        const v = pos[i + t*3 + k];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      if (mn >= hi[k] || mx <= lo[k]) out = true;
    }
    if (out) continue;
    for (let t = 0; t < 3; t++)
      for (let k = 0; k < 3; k++) V[t][k] = pos[i + t*3 + k] - c[k];
    if (triBox(V, h)) return true;
  }
  return false;
}

/* 三角形と直方体がぶつかるか（分離できる向きが1つでもあれば ぶつかっていない） */
function triBox(V, h) {
  const E = [
    [V[1][0]-V[0][0], V[1][1]-V[0][1], V[1][2]-V[0][2]],
    [V[2][0]-V[1][0], V[2][1]-V[1][1], V[2][2]-V[1][2]],
    [V[0][0]-V[2][0], V[0][1]-V[2][1], V[0][2]-V[2][2]],
  ];
  /* 9とおりの向き（箱の辺 × 三角形の辺） */
  for (let a = 0; a < 3; a++) {
    for (const e of E) {
      const u = (a + 1) % 3, w = (a + 2) % 3;
      let mn = Infinity, mx = -Infinity;
      for (const v of V) {
        const p = e[u] * v[w] - e[w] * v[u];
        if (p < mn) mn = p;
        if (p > mx) mx = p;
      }
      const r = h[u] * Math.abs(e[w]) + h[w] * Math.abs(e[u]);
      if (mn > r || mx < -r) return false;
    }
  }
  /* 箱の3つの向き */
  for (let k = 0; k < 3; k++) {
    const mn = Math.min(V[0][k], V[1][k], V[2][k]);
    const mx = Math.max(V[0][k], V[1][k], V[2][k]);
    if (mn > h[k] || mx < -h[k]) return false;
  }
  /* 三角形の面 */
  const n = [
    E[0][1]*E[1][2] - E[0][2]*E[1][1],
    E[0][2]*E[1][0] - E[0][0]*E[1][2],
    E[0][0]*E[1][1] - E[0][1]*E[1][0],
  ];
  const d = n[0]*V[0][0] + n[1]*V[0][1] + n[2]*V[0][2];
  const r = h[0]*Math.abs(n[0]) + h[1]*Math.abs(n[1]) + h[2]*Math.abs(n[2]);
  return Math.abs(d) <= r;
}

export function roomFits(pos, b) {
  const s = SHRINK;
  if (boxHit(pos, [b.x0+s, b.y0+s, b.zMid+s], [b.x1-s, b.y1-s, b.zTop-s])) return false;
  if (b.rp > 0.05 && b.zMid - b.zBot > 0.05
    && boxHit(pos, [b.cx-b.rp+s, b.cy-b.rp+s, b.zBot+s],
                   [b.cx+b.rp-s, b.cy+b.rp-s, b.zMid-s])) return false;
  return true;
}

/* 下パーツ（閉じた立体）に部屋を作る */
export function cutRoom(pos, b) {
  if (!roomFits(pos, b)) return cutThrough(pos, b);
  const shell = pocketShell(b);
  const all = new Float32Array(pos.length + shell.length);
  all.set(pos, 0);
  all.set(shell, pos.length);
  return all;
}
