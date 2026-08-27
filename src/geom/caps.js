/* 切り口に張る「ふた」。

   段のついた面で振り分けただけだと、上下とも切り口が開いた殻のまま。
   ★上パーツは「あたま」しか形になっておらず、栓（カップケーキの差しこみ）が
     どこにもないので、柱が宙に浮く。ここでその面を張る。

   張るのは6枚。

        ┌───────────────┐              上パーツ
        │               │
  ──────┴────┐     ┌────┴──────        ⓐ Zg の輪っか（下向き）
             │     │                   ⓑ 栓の側面（外向き）
             └─────┘                   ⓒ 栓の底（下向き）
             ▲ 底のすきま
             ▼
  ──────┐  ┌───────┐  ┌──────          ⓓ Zg の輪っか（上向き）
        │  │       │  │                ⓔ 受け口の内壁（内向き）
        │  └───────┘  │                ⓕ 器の床（上向き）
        │             │
        └─────────────┘                下パーツ

   ・輪っかの外まわりは、その高さで切ったモデルの切り口そのもの（穴があればそれも）
   ・栓の外まわり ＝ 輪から内へ 横のすきま/2、受け口の内まわり ＝ 輪から外へ 同じだけ。
     だから栓と受け口のあいだは、ぐるりと「横のすきま」ぶん空く。

   ★プロ編集で分かれめがうねっているときは、輪っかは平らな板ではなくなる。
     そのときは「殻を切ったときに出たふちの線」と「輪」を、角度の順につないで張る
     （殻の実物のふちを使うので、すきまなく合う）。 */

import * as THREE from 'three';
import { pointInPoly, polyArea, buildLoops } from './section.js';
import { heightOf } from './rim.js';

const TAU = Math.PI * 2;

/* Shape を三角形の並びにして、高さ z へ寝かせる。
   ★ShapeGeometry は XY 平面に上向き（＋Z）で作る。下向きの面がほしいときは
     巻き方向を逆にする。逆にしないと裏返った面になり、表からは見えなくなる。 */
function flatTris(shapes, z, up) {
  if (!shapes.length) return new Float32Array(0);
  const g = new THREE.ShapeGeometry(shapes).toNonIndexed();
  const p = g.attributes.position.array;
  const out = new Float32Array(p.length);
  const ord = up ? [0, 1, 2] : [2, 1, 0];
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const s = i + ord[k] * 3;
      out[i + k * 3]     = p[s];
      out[i + k * 3 + 1] = p[s + 1];
      out[i + k * 3 + 2] = z;
    }
  }
  g.dispose();
  return out;
}

const shapeOf = pts => new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));

/* モデルの切り口（穴つき）から、さらに inner を抜いた「輪っか」の形 */
function ringShapes(outers, inner) {
  const shapes = [];
  for (const o of outers) {
    const sh = shapeOf(o.pts);
    for (const h of o.holes) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
    /* ★栓（受け口）は、それを含む切り口の輪にだけ穴として空ける。
         輪がモデルからはみ出しているときは、どの輪にも入らないので抜かない。 */
    if (inner && inner.length >= 3 && pointInPoly(inner[0], o.pts))
      sh.holes.push(new THREE.Path(inner.map(p => new THREE.Vector2(p[0], p[1]))));
    shapes.push(sh);
  }
  return shapes;
}

/* 垂直の壁。loop は反時計まわりが前提（offsetLoop がそろえてくれる）。
   outward＝true で外向きの面、false で内向き。
   zHi は数でも「その場所の高さを返す関数」でもよい。 */
function wallTris(loop, zHi, zLo, outward) {
  const n = loop.length;
  if (n < 3) return new Float32Array(0);
  const v = new Float32Array(n * 18);
  let o = 0;
  const put = (p, z) => { v[o++] = p[0]; v[o++] = p[1]; v[o++] = z; };
  for (let i = 0; i < n; i++) {
    const a = loop[i], b = loop[(i + 1) % n];
    /* この順で張ると外向きになる。内向きにしたいときは a と b を入れかえる */
    const [p, q] = outward ? [a, b] : [b, a];
    const zp = heightOf(zHi, p[0], p[1]), zq = heightOf(zHi, q[0], q[1]);
    put(p, zLo); put(q, zLo); put(q, zq);
    put(p, zLo); put(q, zq); put(p, zp);
  }
  return v;
}

function join(parts) {
  let len = 0;
  for (const a of parts) len += a.length;
  const all = new Float32Array(len);
  let o = 0;
  for (const a of parts) { all.set(a, o); o += a.length; }
  return all;
}

/* ── うねった分かれめの輪っか ───────────────────────
   殻を切ったときに出たふち（rim）を輪につなぎ、内がわの輪と
   「まん中から見た角度の順」でつないで張る。 */

/* 反時計まわりにそろえる */
function ccw(pts) { return polyArea(pts) < 0 ? pts.slice().reverse() : pts; }

/* ふちの線分から、いちばん大きい輪を取り出す（穴はここでは見ない）。
   ★高さは「殻が実際に切れた高さ」をそのまま持ちかえること。
     場所から計算しなおすと、うねりの面は曲がっているので ほんの少しずれて、
     ふたと殻のあいだにすきまが空く（実測で 368本ぶん空いた）。 */
const qkey = (x, y) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
function rimLoop(segs, zMin) {
  const zOf = new Map();
  const use = [];
  for (const [a, b] of segs) {
    if (a[2] < zMin || b[2] < zMin) continue;       // 栓の底がわのふちは別もの
    zOf.set(qkey(a[0], a[1]), a[2]);
    zOf.set(qkey(b[0], b[1]), b[2]);
    use.push([[a[0], a[1]], [b[0], b[1]]]);
  }
  if (!use.length) return null;
  let best = null, ba = 0;
  for (const l of buildLoops(use)) {
    const a = Math.abs(polyArea(l));
    if (a > ba) { ba = a; best = l; }
  }
  return best && best.length >= 3 ? { pts: ccw(best), zOf } : null;
}

/* 2つの輪を、角度の順にたどってつなぐ（帯を張る）。
   ★点の数がちがっても、角度でそろえれば素直に張れる。
     どちらの輪も、まん中から見て一周ぶん角度が増えていることが前提
     （＝まん中から見て星形。首まわりならこれで足りる）。 */
function stitch(outer, inner, cx, cy, up) {
  const ang = p => {
    let a = Math.atan2(p[1] - cy, p[0] - cx);
    return a < 0 ? a + TAU : a;
  };
  const roll = loop => {
    let bi = 0, bv = Infinity;
    loop.forEach((p, i) => { const a = ang(p); if (a < bv) { bv = a; bi = i; } });
    const out = [];
    for (let i = 0; i <= loop.length; i++) {
      const p = loop[(bi + i) % loop.length];
      let a = ang(p);
      if (out.length && a < out[out.length - 1].a) a += TAU;
      out.push({ p, a });
    }
    return out;
  };
  const A = roll(outer), B = roll(inner);
  const v = [];
  const tri = (p, q, r) => {
    const t = up ? [p, q, r] : [r, q, p];
    for (const s of t) v.push(s[0], s[1], s[2]);
  };
  let i = 0, j = 0;
  while (i < A.length - 1 || j < B.length - 1) {
    const takeA = j >= B.length - 1
      || (i < A.length - 1 && A[i + 1].a <= B[j + 1].a);
    if (takeA) { tri(A[i].p, A[i + 1].p, B[j].p); i++; }
    else { tri(A[i].p, B[j + 1].p, B[j].p); j++; }
  }
  return new Float32Array(v);
}

/* 輪っか1枚（うねっているとき）。取れなければ null */
function rimRing(segs, zMin, inner, zTop, cx, cy, up) {
  const outer = rimLoop(segs, zMin);
  if (!outer) return null;
  const lifted = outer.pts.map(p =>
    [p[0], p[1], outer.zOf.get(qkey(p[0], p[1])) ?? heightOf(zTop, p[0], p[1])]);
  const ring = ccw(inner).map(p => [p[0], p[1], heightOf(zTop, p[0], p[1])]);
  return stitch(lifted, ring, cx, cy, up);
}

/* ── 平らなふた1枚 ────────────────────────────────
   タイプ2（平面ひとつで切るだけ）は、切り口が平らな板1枚なのでこれで足りる。
   outers＝その高さのモデルの切り口（穴つき）、inner＝さらに抜くかたち
   （上パーツなら柱の足あと、下パーツならスイッチの部屋の四角）。
   up＝true で上向き（下パーツ）、false で下向き（上パーツ）。 */
export function capFlat(outers, inner, z, up) {
  return flatTris(ringShapes(outers, inner), z, up);
}

/* 上パーツのふた ⓐⓑⓒ。plug＝栓の外まわり、zFloor＝栓の底。
   floorHole＝栓の底に空ける穴（柱の足あと）。★穴の辺は柱の壁の上の辺と
   同じ点でできていること。ずれると そこだけ口が開く。 */
export function capUpper(outers, plug, zTop, zFloor, rim = null, floorHole = null) {
  const ring = rim
    ? rimRing(rim.segs, zFloor + 0.5, plug, zTop, rim.cx, rim.cy, false)
    : null;
  const floor = shapeOf(plug);
  if (floorHole && floorHole.length >= 3)
    floor.holes.push(new THREE.Path(floorHole.map(p => new THREE.Vector2(p[0], p[1]))));
  return join([
    ring || flatTris(ringShapes(outers, plug), zTop, false),
    wallTris(plug, zTop, zFloor, true),
    flatTris([floor], zFloor, false),
  ]);
}

/* 下パーツのふた ⓓⓔⓕ。socket＝受け口の内まわり、zBot＝器の床。
   floorHole＝器の床に空ける四角（スイッチの部屋の天井） */
export function capLower(outers, socket, zTop, zBot, rim = null, floorHole = null) {
  const ring = rim
    ? rimRing(rim.segs, zBot + 0.5, socket, zTop, rim.cx, rim.cy, true)
    : null;
  const floor = shapeOf(socket);
  if (floorHole && floorHole.length >= 3)
    floor.holes.push(new THREE.Path(floorHole.map(p => new THREE.Vector2(p[0], p[1]))));
  return join([
    ring || flatTris(ringShapes(outers, socket), zTop, true),
    wallTris(socket, zTop, zBot, false),
    flatTris([floor], zBot, true),
  ]);
}
