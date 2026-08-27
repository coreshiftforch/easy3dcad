/* 「ここで溝を回すとよさそう」という高さをさがす。
   旧アプリ（フィギュアキーキャップ index.html:2161 findNecks）から輸入。
   実績のある2つの手がかりを同時に見る：
     ① くびれ … その高さの切り口の「ぐるりの長さ」がまわりより短い所（猫の首、人形の腰）
     ② 段    … 水平に近い面が輪になって集まっている所（頭と胴の境目、台座の上面）
   ★②が「角度で見つける」ほう。段のあるモデルでは、境目に上向き・下向きの面が集まる。 */

export function findNecks(posArr, minZ, maxZ, N = 96) {
  const H = maxZ - minZ || 1;
  const per  = new Float64Array(N);     // 高さごとの「切り口のぐるりの長さ」
  const flat = new Float64Array(N);     // 高さごとの「水平に近い面の広さ」
  const zAt = k => minZ + H * k / (N - 1);

  for (let i = 0; i < posArr.length; i += 9) {
    const P = [[posArr[i], posArr[i+1], posArr[i+2]],
               [posArr[i+3], posArr[i+4], posArr[i+5]],
               [posArr[i+6], posArr[i+7], posArr[i+8]]];
    const lo = Math.min(P[0][2], P[1][2], P[2][2]);
    const hi = Math.max(P[0][2], P[1][2], P[2][2]);
    const k0 = Math.max(0, Math.ceil((lo - minZ) / H * (N - 1)));
    const k1 = Math.min(N - 1, Math.floor((hi - minZ) / H * (N - 1)));
    for (let k = k0; k <= k1; k++) {
      const z = zAt(k), pt = [];
      for (let e = 0; e < 3; e++) {
        const a = P[e], b = P[(e + 1) % 3];
        if ((a[2] - z) * (b[2] - z) > 0) continue;
        if (Math.abs(b[2] - a[2]) < 1e-12) continue;
        const t = (z - a[2]) / (b[2] - a[2]);
        if (t < 0 || t > 1) continue;
        pt.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      if (pt.length >= 2) per[k] += Math.hypot(pt[0][0] - pt[1][0], pt[0][1] - pt[1][1]);
    }
    const ux = P[1][0]-P[0][0], uy = P[1][1]-P[0][1], uz = P[1][2]-P[0][2];
    const vx = P[2][0]-P[0][0], vy = P[2][1]-P[0][1], vz = P[2][2]-P[0][2];
    const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12 && Math.abs(nz) / len > 0.86) {         // 水平から30°以内
      const cz = (P[0][2] + P[1][2] + P[2][2]) / 3;
      const k = Math.round((cz - minZ) / H * (N - 1));
      if (k >= 0 && k < N) flat[k] += len / 2;              // 三角形の面積
    }
  }

  const smooth = arr => {
    const o = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      let a = 0, c = 0;
      for (let d = -1; d <= 1; d++) { const j = k + d; if (j >= 0 && j < N) { a += arr[j]; c++; } }
      o[k] = a / c;
    }
    return o;
  };
  const sm = smooth(per), sf = smooth(flat);
  let flatMax = 0;
  for (const v of sf) flatMax = Math.max(flatMax, v);

  const lo = Math.floor(N * 0.08), hi = Math.ceil(N * 0.88);
  const cand = [];
  for (let k = lo + 1; k < hi - 1; k++) {
    /* ★くらべる範囲は広めに（高さの±12%）。せまいと、なだらかな首の谷を
         「まわりと同じくらい」と見なして取りこぼす（猫の首で実際に取りこぼした）。 */
    let around = 0;
    for (let d = -12; d <= 12; d++) { const j = k + d; if (j >= lo && j < hi) around = Math.max(around, sm[j]); }
    const isNeck = sm[k] < sm[k - 1] && sm[k] <= sm[k + 1] && sm[k] < around * 0.93;
    const drop   = isNeck ? 1 - sm[k] / (around || 1) : 0;
    const shelf  = flatMax > 0 && sf[k] >= sf[k - 1] && sf[k] >= sf[k + 1] ? sf[k] / flatMax : 0;
    const score  = drop * 1.2 + shelf;
    if (score > 0.15) cand.push({ pct: (k / (N - 1)) * 100, score, drop, shelf });
  }
  cand.sort((a, b) => b.score - a.score);
  const out = [];
  for (const c of cand) {
    if (out.some(o => Math.abs(o.pct - c.pct) < 4)) continue;
    out.push(c);
    if (out.length >= 4) break;
  }
  return out.sort((a, b) => a.pct - b.pct);
}
