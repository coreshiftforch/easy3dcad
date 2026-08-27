/* 「その向き・その高さで、外まわりはどこにあるか」の一覧表。

   プロ編集（分かれめを高さ方向にうねらせる）で使う。欲しいのは

     r(θ, z) ＝ まん中から θ の向きへ伸ばした線が、高さ z の切り口とぶつかる距離

   これが手元にあれば、
     ・分かれめの線をオブジェクトの表面へぴったり描ける
     ・向きごとに「いちばん細い高さ（くびれ）」をさがせる
     ・つまんで動かしても、その場で返る（切りなおしが要らない）

   ★作り方は「1回なめて、全部の高さぶんまとめて切る」。
     高さごとに切りなおすと 1枚 40ms かかるので、48枚で 2秒近くかかってしまう。
     三角形の z の幅から「またぐ面」だけを出せば、ぜんぶで1回ぶんの走査ですむ。
   ★輪をつなぐ（buildLoops）必要はない。線分のまま、角度ごとに
     いちばん遠いぶつかりを拾えばよい。輪が閉じていなくても効く。 */

const TAU = Math.PI * 2;

export function buildProfile(pos, cx, cy, nz = 56, na = 128) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 2; i < pos.length; i += 3) {
    const v = pos[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const H = hi - lo || 1;
  /* ★上端・下端ちょうどで切ると、そこの面がまるごと平面に寝て切り口が抜ける。
       ほんの少し内へ寄せる。 */
  const z0 = lo + H * 0.004, z1 = hi - H * 0.004;
  const dz = (z1 - z0) / (nz - 1);
  const r = new Float32Array(nz * na);

  const P = [0, 0], Q = [0, 0];
  for (let i = 0; i < pos.length; i += 9) {
    const az = pos[i + 2], bz = pos[i + 5], cz = pos[i + 8];
    const zmin = Math.min(az, bz, cz), zmax = Math.max(az, bz, cz);
    let k0 = Math.ceil((zmin - z0) / dz), k1 = Math.floor((zmax - z0) / dz);
    if (k1 < 0 || k0 > nz - 1) continue;
    if (k0 < 0) k0 = 0;
    if (k1 > nz - 1) k1 = nz - 1;
    for (let k = k0; k <= k1; k++) {
      if (!cutTri(pos, i, z0 + k * dz, P, Q)) continue;
      sweep(r, k * na, na, cx, cy, P, Q);
    }
  }
  return { z0, dz, nz, na, r, cx, cy, lo, hi };
}

/* 三角形を高さ z で切った線分。取れたら true */
function cutTri(pos, i, z, P, Q) {
  let n = 0;
  for (let e = 0; e < 3; e++) {
    const a = i + e * 3, b = i + ((e + 1) % 3) * 3;
    const za = pos[a + 2], zb = pos[b + 2];
    if ((za > z) === (zb > z)) continue;
    const t = (z - za) / (zb - za);
    const x = pos[a] + (pos[b] - pos[a]) * t;
    const y = pos[a + 1] + (pos[b + 1] - pos[a + 1]) * t;
    if (n === 0) { P[0] = x; P[1] = y; }
    else if (n === 1) { Q[0] = x; Q[1] = y; }
    n++;
    if (n === 2) break;
  }
  return n === 2;
}

/* 線分がまたいでいる角度のところだけ、いちばん遠いぶつかりを書きこむ */
function sweep(r, base, na, cx, cy, P, Q) {
  const ax = P[0] - cx, ay = P[1] - cy;
  const bx = Q[0] - cx, by = Q[1] - cy;
  let a0 = Math.atan2(ay, ax), a1 = Math.atan2(by, bx);
  let d = a1 - a0;
  /* ★近いほうへ回る。そうしないと、まん中をまたぐ線分で全周を回ってしまう */
  if (d >  Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  if (d < 0) { a0 = a0 + d; d = -d; }          // a0 が小さいほうになるようそろえる
  const ex = bx - ax, ey = by - ay;
  const i0 = Math.ceil(a0 / TAU * na), i1 = Math.floor((a0 + d) / TAU * na);
  for (let i = i0; i <= i1; i++) {
    const th = i * TAU / na;
    const dx = Math.cos(th), dy = Math.sin(th);
    /* まん中から出る光線と線分の交わり。t＝距離、s＝線分のどこか */
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ey - ay * ex) / den;
    if (t <= 0) continue;
    const s = (ax * dy - ay * dx) / den;
    if (s < 0 || s > 1) continue;
    let k = i % na;
    if (k < 0) k += na;
    if (t > r[base + k]) r[base + k] = t;
  }
}

/* その向き・その高さの外まわりの距離（表のあいだは伸ばして読む） */
export function radiusAt(pf, theta, z) {
  const { z0, dz, nz, na, r } = pf;
  const fz = Math.min(nz - 1, Math.max(0, (z - z0) / dz));
  const k0 = Math.floor(fz), k1 = Math.min(nz - 1, k0 + 1), tz = fz - k0;
  const fa = ((theta / TAU * na) % na + na) % na;
  const a0 = Math.floor(fa), a1 = (a0 + 1) % na, ta = fa - a0;
  const at = (k, a) => r[k * na + a];
  const v0 = at(k0, a0) * (1 - ta) + at(k0, a1) * ta;
  const v1 = at(k1, a0) * (1 - ta) + at(k1, a1) * ta;
  return v0 * (1 - tz) + v1 * tz;
}

/* その向きで、いちばん細い高さ（＝くびれ）をさがす。
   zMid のまわり ±band の中だけを見る。見つからなければ zMid。 */
export function neckAt(pf, theta, zMid, band) {
  const { z0, dz, nz, na } = pf;
  const fa = ((theta / TAU * na) % na + na) % na;
  const a = Math.round(fa) % na;
  const k0 = Math.max(0, Math.ceil((zMid - band - z0) / dz));
  const k1 = Math.min(nz - 1, Math.floor((zMid + band - z0) / dz));
  let best = null, bv = Infinity;
  for (let k = k0; k <= k1; k++) {
    const v = pf.r[k * na + a];
    if (v <= 0) continue;                       // そこに面がない
    if (v < bv) { bv = v; best = k; }
  }
  return best === null ? zMid : z0 + best * dz;
}
