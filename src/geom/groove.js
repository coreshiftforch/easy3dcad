/* 溝のかたち。輪に幅を持たせて、下へ押し出した「筒の輪」を作る。 */

import * as THREE from 'three';

/* 溝の深さの既定は「1cm ＋ キーキャップの押し込んだときの高さ」。
   6.6mm の出どころは switch-mock.js（実測.md より）。 */
import { CAP_PRESSED } from './switch-mock.js';
import { heightOf } from './rim.js';
export { CAP_PRESSED };
export const DEPTH_MARGIN = 10.0;                       // 1cm
export const DEFAULT_DEPTH = DEPTH_MARGIN + CAP_PRESSED; // 16.6mm
/* すきまは2つある。1本の値で兼ねると、はめあいがゆるくなるか底が詰まるかになる。
     横 … 栓と受け口のあいだ。実測のちょうどよさは 0.2mm
     底 … 栓の底と器の床のあいだ。ここは指定どおり 1.0mm */
export const DEFAULT_SIDE  = 0.2;
export const DEFAULT_FLOOR = 1.0;

/* 輪を d ミリだけ外（＋）／内（−）へずらす。
   ★角では2辺の法線を足した向きへ伸ばす（マイター）。とがった角で伸びすぎないよう
     4倍で頭打ちにする。溝の幅は1mm程度なので、これで十分きれいに出る。 */
export function offsetLoop(pts, d) {
  const n = pts.length;
  if (!n || !d) return pts.map(p => [p[0], p[1]]);

  /* 反時計まわり（＋面積）にそろえておくと、＋d が必ず外がわになる */
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const src = area < 0 ? pts.slice().reverse() : pts;

  const out = [];
  for (let i = 0; i < n; i++) {
    const p = src[i], q = src[(i + 1) % n], o = src[(i - 1 + n) % n];
    const e1 = norm(p[0] - o[0], p[1] - o[1]);   // 前の辺の向き
    const e2 = norm(q[0] - p[0], q[1] - p[1]);   // 次の辺の向き
    /* 辺の外向き法線（反時計まわりなら右手が外） */
    const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const len = Math.hypot(mx, my);
    if (len < 1e-9) { out.push([p[0] + n2[0] * d, p[1] + n2[1] * d]); continue; }
    mx /= len; my /= len;
    const cos = mx * n2[0] + my * n2[1];
    const scale = Math.min(1 / Math.max(cos, 1e-6), 4);
    out.push([p[0] + mx * d * scale, p[1] + my * d * scale]);
  }
  return out;
}

function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/* 溝そのもの（＝抜きとる形）。
   ★ふたのない「カップ」。側面（輪にそった筒）と底（丸い板）で切る。
     上は開いていて、そこから上パーツが続く。

       ┌──┐          ┌──┐   ← 上は開いている（ふたなし）
       │  │  側面     │  │      壁の厚み＝横のすきま
       │  └──────────┘  │
       └────────────────┘   ← 底（厚み＝底のすきま）

   ★抜きとった殻の厚みが、そのまま上下パーツのすきまになる。
     側面の厚み＝横のすきま（はめあい）、底の厚み＝底のすきま。
   ★底の板には、十字穴の柱が通る穴を空ける（hole）。柱は溝の底より下へ伸びるので、
     空けないと板が柱を突きぬけてしまう。 */
/* zTop は数でも「その場所の高さを返す関数」でもよい（プロ編集のうねり）。
   ★底（zBot）は平らのまま。十字のてっぺんに当てる面なので動かせない。 */
export function grooveGeometry(pts, side, floor, zTop, zBot, hole = null) {
  const outer = offsetLoop(pts,  side / 2);
  const inner = offsetLoop(pts, -side / 2);
  const n = outer.length;
  const zFloor = zBot + floor;          // 底の板の上面＝上パーツの底
  const zt = p => heightOf(zTop, p[0], p[1]);
  const v = [];
  const quad = (a, b, c, d) => { v.push(...a, ...b, ...c, ...a, ...c, ...d); };

  /* 壁（輪っか）。底の板の上から、上のふちまで */
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const o0 = outer[i], o1 = outer[j], i0 = inner[i], i1 = inner[j];
    const to0 = zt(o0), to1 = zt(o1), ti0 = zt(i0), ti1 = zt(i1);
    quad([o0[0], o0[1], zFloor], [o1[0], o1[1], zFloor], [o1[0], o1[1], to1], [o0[0], o0[1], to0]);
    quad([i0[0], i0[1], ti0], [i1[0], i1[1], ti1], [i1[0], i1[1], zFloor], [i0[0], i0[1], zFloor]);
    /* ★上のふたは張らない。そこから上パーツが続くところなので */
    // 底の板の外がわの壁
    quad([o0[0], o0[1], zBot], [o1[0], o1[1], zBot], [o1[0], o1[1], zFloor], [o0[0], o0[1], zFloor]);
  }

  const g = new THREE.BufferGeometry();
  const parts = [new Float32Array(v)];
  /* 底の板のふた（上下）。へこみのある輪でも張れるよう、three のかたち作りに任せる */
  const shape = new THREE.Shape(outer.map(p => new THREE.Vector2(p[0], p[1])));
  if (hole && hole.length >= 3)
    shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(p[0], p[1]))));
  for (const z of [zBot, zFloor]) {
    const f = new THREE.ShapeGeometry(shape).toNonIndexed();
    f.translate(0, 0, z);
    parts.push(f.attributes.position.array);
    f.dispose();
  }
  let len = 0;
  for (const a of parts) len += a.length;
  const all = new Float32Array(len);
  let o = 0;
  for (const a of parts) { all.set(a, o); o += a.length; }
  g.setAttribute('position', new THREE.BufferAttribute(all, 3));
  g.computeVertexNormals();
  return g;
}
