/* 下パーツ生成（カップケーキの包み紙）の立体を作る。

   ふたつある。

   ① おわん（bowlSolid）… まっすぐな柱の入れもの。
      外がわの筒 ＋ 底板 ＋ 内がわの筒 ＋ 縁の輪っか ＋ 床 ＋ スイッチの部屋。
      ★どこも「まっすぐ」なので、切り分けもオフセットも要らない。筒と平らな面だけで組める。

   ② オブジェクトの底の止まり穴（digPocket）… **オブジェクトは切らない**。
      底の平らな面だけを張りなおして穴を空け、そこへ内がわを向いた面を足す。
      ★これができるのは「底が平ら」なとき。底が丸いモデルは穴の口が閉じないので、
        そのときは掘らずに知らせる（呼びもとで ok を見ること）。

        ┌──────────┐  ← 十字の穴の天井（下向き）
        │  十字    │
        ├──┬───┬──┤  ← クリッカーを載せる穴の天井（下向き。十字のぶんだけ抜けている）
        │  │   │  │
        └──┴───┴──┘  ← オブジェクトの底（ここに四角い口が空く）
*/

import * as THREE from 'three';
import { buildLoops, nestLoops, pointInPoly } from './section.js';
import { crossPts } from './boss.js';

const v2 = pts => pts.map(p => new THREE.Vector2(p[0], p[1]));

/* 上下に立つ筒。loop は反時計まわりが前提。
   outward＝true で外向きの面、false で内向き。 */
function tube(out, loop, zLo, zHi, outward) {
  const n = loop.length;
  if (n < 3 || zHi - zLo < 1e-6) return;
  for (let i = 0; i < n; i++) {
    const a = loop[i], b = loop[(i + 1) % n];
    /* この順で張ると外向きになる。内向きにしたいときは a と b を入れかえる */
    const [p, q] = outward ? [a, b] : [b, a];
    out.push(p[0], p[1], zLo, q[0], q[1], zLo, q[0], q[1], zHi);
    out.push(p[0], p[1], zLo, q[0], q[1], zHi, p[0], p[1], zHi);
  }
}

/* 平らな面。up＝true で上向き。
   ★ShapeGeometry は XY 平面に上向き（＋Z）で作る。下向きがほしいときは巻き方向を逆にする。 */
function flat(out, shape, z, up) {
  const g = new THREE.ShapeGeometry(shape).toNonIndexed();
  const p = g.attributes.position.array;
  const ord = up ? [0, 1, 2] : [2, 1, 0];
  for (let i = 0; i < p.length; i += 9)
    for (const k of ord) out.push(p[i + k * 3], p[i + k * 3 + 1], z);
  g.dispose();
}

/* 反時計まわりにそろえる */
function ccw(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a < 0 ? pts.slice().reverse() : pts;
}

const rectPts = (cx, cy, s) =>
  [[cx - s/2, cy - s/2], [cx + s/2, cy - s/2], [cx + s/2, cy + s/2], [cx - s/2, cy + s/2]];

const circPts = (cx, cy, r, seg = 24) => {
  const out = [];
  for (let i = 0; i < seg; i++) {
    const t = i / seg * Math.PI * 2;
    out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return out;
};

/* ── ① おわん ───────────────────────────────────
     inner    … 内がわの輪（「のせる」のときは使わない）
     outer    … 外がわの輪
     bottom   … いちばん下
     floorTop … 内がわの床（スイッチのプレートがのる面）
     rim      … 縁の高さ（＝floorTop なら「のせる」＝平らな台）
     roomTop/roomMid/roomBot … 部屋の天井・床・くぼみの底
     side/poleR … 部屋の一辺、中心ポールのくぼみの半径

   ★部屋が床からはみ出していたら **作らずに null を返す**。
     はみ出したまま「穴」として床に空けると、口が閉じずに面が壊れる
     （三角柱の内接円 11 に対して 16.4角の角は 11.6。実際に辺が3本ひらいた）。 */
export function bowlSolid(o) {
  const out = [];
  const inner = ccw(o.inner), outer = ccw(o.outer);
  const wrap = o.rim > o.floorTop + 1e-6;
  const room = ccw(rectPts(o.cx, o.cy, o.side));
  const pole = ccw(circPts(o.cx, o.cy, o.poleR));
  if (!roomInside(room, wrap ? inner : outer)) return null;

  /* 外がわ ── 筒と底板 */
  tube(out, outer, o.bottom, o.rim, true);
  flat(out, new THREE.Shape(v2(outer)), o.bottom, false);

  if (wrap) {
    /* 縁の輪っか（上向き）と、内がわの筒 */
    const ring = new THREE.Shape(v2(outer));
    ring.holes.push(new THREE.Path(v2(inner).reverse()));
    flat(out, ring, o.rim, true);
    tube(out, inner, o.floorTop, o.rim, false);
    /* 床。まん中は部屋のぶんを抜く */
    const fl = new THREE.Shape(v2(inner));
    fl.holes.push(new THREE.Path(v2(room).reverse()));
    flat(out, fl, o.floorTop, true);
  } else {
    /* 「のせる」… 上面がそのまま台の天井。部屋のぶんだけ抜く */
    const fl = new THREE.Shape(v2(outer));
    fl.holes.push(new THREE.Path(v2(room).reverse()));
    flat(out, fl, o.floorTop, true);
  }

  /* スイッチの部屋（内向き）。★下は突きぬけない。上から落としこむ */
  tube(out, room, o.roomMid, o.floorTop, false);
  const rf = new THREE.Shape(v2(room));
  rf.holes.push(new THREE.Path(v2(pole).reverse()));
  flat(out, rf, o.roomMid, true);
  /* 中心ポールのくぼみ */
  tube(out, pole, o.roomBot, o.roomMid, false);
  flat(out, new THREE.Shape(v2(pole)), o.roomBot, true);

  return new Float32Array(out);
}

/* ── ② オブジェクトの底に止まり穴を掘る ─────────────
     recess … クリッカーを載せる穴の深さ（0＝十字だけ掘る）
     deep   … 十字の穴の深さ
   底の平らな面を張りなおして口を空け、内がわを向いた面を足す。
   ★戻り値の ok が false のときは掘っていない（呼びもとで知らせること）。 */
export function digPocket(pos, o) {
  const eps = 1e-3;
  let zBot = Infinity;
  for (let i = 2; i < pos.length; i += 3) if (pos[i] < zBot) zBot = pos[i];
  const flatZ = zBot + eps;

  /* 底の平らな面を集めて、その外まわりを取る。
     ★「1回しか出てこない辺」がそのまま外まわりになる。 */
  const q = 1e-4;
  const key = (x, y) => `${Math.round(x / q)},${Math.round(y / q)}`;
  const edge = new Map();
  const keep = [];
  let bottomTris = 0;
  for (let i = 0; i < pos.length; i += 9) {
    if (pos[i + 2] > flatZ || pos[i + 5] > flatZ || pos[i + 8] > flatZ) {
      for (let k = 0; k < 9; k++) keep.push(pos[i + k]);
      continue;
    }
    bottomTris++;
    for (let k = 0; k < 3; k++) {
      const a = [pos[i + k * 3], pos[i + k * 3 + 1]];
      const b = [pos[i + ((k + 1) % 3) * 3], pos[i + ((k + 1) % 3) * 3 + 1]];
      const ka = key(a[0], a[1]), kb = key(b[0], b[1]);
      if (ka === kb) continue;
      const e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (edge.has(e)) edge.delete(e); else edge.set(e, [a, b]);
    }
  }
  if (!bottomTris) return { ok: false, why: 'flat', tris: pos };
  const outers = nestLoops(buildLoops([...edge.values()]));
  if (!outers.length) return { ok: false, why: 'flat', tris: pos };

  /* 掘る口のかたち。recess があれば四角、なければ十字そのもの */
  const mouth = recessMouth(o);
  const inside = p => {
    for (const oo of outers) {
      if (!pointInPoly(p, oo.pts)) continue;
      for (const h of oo.holes) if (pointInPoly(p, h)) return false;
      return true;
    }
    return false;
  };
  if (!mouth.every(inside)) return { ok: false, why: 'narrow', tris: pos };

  const out = keep;
  const cross = ccw(crossPts(o.arm, o.th).map(p => [p[0] + o.cx, p[1] + o.cy]));
  const mouthCcw = ccw(mouth);

  /* 底の面を張りなおす（口を抜いて、下向き） */
  const face = [];
  for (const oo of outers) {
    const sh = new THREE.Shape(v2(oo.pts));
    for (const h of oo.holes) sh.holes.push(new THREE.Path(v2(h).reverse()));
    if (pointInPoly(mouthCcw[0], oo.pts))
      sh.holes.push(new THREE.Path(v2(mouthCcw).reverse()));
    face.push(sh);
  }
  for (const sh of face) flat(out, sh, zBot, false);

  if (o.recess > 1e-6) {
    /* 四角い穴 → その天井（十字のぶんだけ抜く）→ 十字の穴 → 十字の天井 */
    const zc = zBot + o.recess;
    tube(out, mouthCcw, zBot, zc, false);
    const ceil = new THREE.Shape(v2(mouthCcw));
    ceil.holes.push(new THREE.Path(v2(cross).reverse()));
    flat(out, ceil, zc, false);
    tube(out, cross, zc, zc + o.deep, false);
    flat(out, new THREE.Shape(v2(cross)), zc + o.deep, false);
  } else {
    /* 十字だけ掘る */
    tube(out, mouthCcw, zBot, zBot + o.deep, false);
    flat(out, new THREE.Shape(v2(mouthCcw)), zBot + o.deep, false);
  }
  return { ok: true, tris: new Float32Array(out), zBot };
}

/* 掘る口のかたち。recess があれば四角（部屋の一辺）、なければ十字 */
function recessMouth(o) {
  return o.recess > 1e-6
    ? rectPts(o.cx, o.cy, o.side)
    : crossPts(o.arm, o.th).map(p => [p[0] + o.cx, p[1] + o.cy]);
}

/* 部屋の四角が、床のかたちにおさまっているか。
   ★辺のまん中も見る。角だけだと、細くくびれた形をすりぬけてしまう。 */
function roomInside(room, floor) {
  const N = 8;
  for (let i = 0; i < room.length; i++) {
    const a = room[i], b = room[(i + 1) % room.length];
    for (let k = 0; k < N; k++) {
      const t = k / N;
      if (!pointInPoly([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], floor)) return false;
    }
  }
  return true;
}
