/* 上パーツの底に足す「十字穴のついた柱」。

   上パーツの底（＝溝の底 ＋ 底のすきま）から下へ len だけ伸ばす。
   十字穴は下端から掘り、**天井が十字の先に当たる**深さにする：

     穴の深さ ＝ 柱の長さ − 底のすきま     （既定なら 7.5 − 1.0 ＝ 6.5mm）

   ★2.5mm しか掘らないと、押しきる前に十字の先が天井に当たって沈みきらない。
     実物のキーキャップも穴は 6.5mm あって、沈む量 4.0mm を引いた 2.5mm が
     かみ合っているぶん（実測.md の out6.5 − travel4.0）。

     ①post  … 穴のあいた円柱
     ②square… 四角柱（実測のステム座 5.8 × 5.0）
   まわりの囲い（スカート）はやめた。

   ★材料を足す作りなので、柱を長くしたぶんだけ十字の先は下がる。
     溝の深さの自動計算（scene3）で、その ぶんを見ている。 */

import * as THREE from 'three';
import { HOLE_DEPTH } from './switch-mock.js';

export const BOSS_TYPES = [
  { id: 'post',   label: '円柱' },
  { id: 'square', label: '四角柱' },
];

/* 押しきったとき、柱がスイッチの開口へどれだけ入りこむか。
   ★沈む量（4.0mm）を入れておくと、指を離しているときから押しきりまで
     ずっと開口にかかったままになる（横ぶれの案内にもなる）。
     実物パーツ（ステム座 5.8 × 5.0）が開口に入ることは実機で確認ずみ。 */
export const ENTRY = 4.0;

/* 実測（フィギュアキーキャップ\実物パーツ\実測.md）から。
   ★太さは実物のステム座そのもの、長さはスイッチの位置から決まる。
     どちらも人が決めるところではないので、バーは置かない。
     もし長く要るときは**上へ**伸ばす（上パーツをえぐる）。下へ出すと
     スイッチの箱に当たる。 */
export const BOSS = {
  len   : 7.5,    // 柱の長さ＝底のすきま1.0 ＋ 十字穴2.5 ＋ 入りこみ4.0
  dia   : 5.8,    // 円柱の太さ。四角柱は 5.8 × 5.0
  sqX   : 5.8,
  sqY   : 5.0,
  arm   : 3.90,   // 十字の長さ
  th    : 1.45,   // 十字の腕のはば
};

/* 十字（プラス）の12点 */
export function crossPts(arm, th) {
  const a = arm / 2, t = th / 2;
  return [[t,t],[a,t],[a,-t],[t,-t],[t,-a],[-t,-a],[-t,-t],[-a,-t],[-a,t],[-t,t],[-t,a],[t,a]];
}

/* 柱の輪郭。中心は原点 */
export function bossPts(type, dim, seg = 40) {
  if (type === 'square') {
    const a = dim.sqX / 2, b = dim.sqY / 2;
    return [[-a,-b],[a,-b],[a,b],[-a,b]];
  }
  const r = dim.dia / 2, out = [];
  for (let i = 0; i < seg; i++) {
    const t = 2 * Math.PI * i / seg;
    out.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  return out;
}

/* 十字（プラス）の輪郭 */
function crossShape(arm, th) {
  const p = crossPts(arm, th);
  const sh = new THREE.Shape();
  sh.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) sh.lineTo(p[i][0], p[i][1]);
  sh.closePath();
  return sh;
}

function extrude(shape, depth) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
}

/* zTop（溝の底）にくっつけて、下へ伸ばした柱を返す */
export function makeBoss(type, dim, zTop, mats) {
  const g = new THREE.Group();
  const len = dim.len;
  const add = (geo, mat, z0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z0;
    m.renderOrder = 8;
    g.add(m);
    return m;
  };

  if (type === 'square') {
    const sh = new THREE.Shape();
    sh.moveTo(-dim.sqX / 2, -dim.sqY / 2);
    sh.lineTo( dim.sqX / 2, -dim.sqY / 2);
    sh.lineTo( dim.sqX / 2,  dim.sqY / 2);
    sh.lineTo(-dim.sqX / 2,  dim.sqY / 2);
    sh.closePath();
    add(extrude(sh, len), mats.body, zTop - len);
  } else {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, dim.dia / 2, 0, Math.PI * 2, false);
    add(extrude(sh, len), mats.body, zTop - len);
  }

  /* 十字穴。天井が十字の先に当たる深さまで掘る（見せるため少しはみ出させる） */
  add(extrude(crossShape(dim.arm, dim.th), holeDepth(dim)), mats.hole, zTop - len - 0.01);

  return g;
}

/* 十字穴の深さ。天井が十字の先に当たるところまで */
export function holeDepth(dim) {
  return Math.max(HOLE_DEPTH, dim.len - dim.floor);
}


/* ── 書き出し用：十字穴を本当にあけた柱 ────────────
   ★画面に出しているほう（makeBoss）は、穴のかたちを**色ちがいで見せているだけ**で
     掘ってはいない。書き出すときは本当に掘らないと、ただの棒が出てしまう。

        zTop  ─┬───────┬─   上パーツの底にくっつく（cap=false なら ふたを張らない）
               │       │
               │  柱   │
   穴の天井 ───┤ ┌─┐  ├──   ここで十字の先が当たる
               │ │ │  │
        zBot  ─┴─┘ └──┴──   下端。十字の穴があいている
*/

const area2 = p => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return a / 2;
};
const ccw = p => (area2(p) < 0 ? p.slice().reverse() : p);
const v2 = pts => pts.map(p => new THREE.Vector2(p[0], p[1]));

/* 輪を壁にする。outward＝外を向く、false＝輪のまん中を向く */
function tube(out, loop, zLo, zHi, outward) {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], c = loop[(i + 1) % loop.length];
    const [p, q] = outward ? [a, c] : [c, a];
    out.push(p[0], p[1], zLo, q[0], q[1], zLo, q[0], q[1], zHi);
    out.push(p[0], p[1], zLo, q[0], q[1], zHi, p[0], p[1], zHi);
  }
}

/* 平らな面。up＝true で上向き */
function flat(out, shape, z, up) {
  const g = new THREE.ShapeGeometry(shape).toNonIndexed();
  const a = g.attributes.position.array;
  const ord = up ? [0, 1, 2] : [2, 1, 0];
  for (let i = 0; i < a.length; i += 9)
    for (const k of ord) out.push(a[i + k * 3], a[i + k * 3 + 1], z);
  g.dispose();
}

/* cap＝true なら上にもふたを張って、それだけで閉じた立体にする。
   false のときは、上パーツの底に同じかたちの穴を空けてつなぐこと（＝1つの立体になる）。 */
export function bossSolid(type, dim, zTop, cx, cy, cap = true, seg = 40) {
  const zBot = zTop - dim.len;
  const zHole = zBot + holeDepth(dim);
  const move = pts => pts.map(p => [p[0] + cx, p[1] + cy]);
  const post  = move(ccw(bossPts(type, dim, seg)));
  const cross = move(ccw(crossPts(dim.arm, dim.th)));
  const out = [];
  tube(out, post,  zBot, zTop,  true);     // 柱の外がわ
  tube(out, cross, zBot, zHole, false);    // 十字穴の内がわ
  const bottom = new THREE.Shape(v2(post));
  bottom.holes.push(new THREE.Path(v2(cross).reverse()));
  flat(out, bottom, zBot, false);          // 下端（十字を抜いたところ）
  flat(out, new THREE.Shape(v2(cross)), zHole, false);   // 穴の天井
  if (cap) flat(out, new THREE.Shape(v2(post)), zTop, true);
  return new Float32Array(out);
}
