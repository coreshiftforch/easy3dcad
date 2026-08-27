/* 分かれめ（Zg）の高さのうねり ＝ 「ふち」。

   ふだんは真っ平ら。プロ編集で、向きごとに高さをずらせるようにする。
   たとえば猫なら、首のくびれに沿わせて分けられる。

   ★持つのは「基準の高さからのずれ」だけ。基準（②で決めた高さ）を動かしても、
     うねりはそのままついてくる。
   ★制御点は角度を等分した n 個。あいだは周期のなめらかな曲線でつなぐ。
     まん中（輪の重心）から見た角度で引くので、輪の形が円でも四角でも同じように効く。 */

const TAU = Math.PI * 2;

export function makeRim(n = 12) {
  return { n, dz: new Float32Array(n) };
}

export const rimFlat = rim => {
  for (const v of rim.dz) if (Math.abs(v) > 1e-6) return false;
  return true;
};

export function rimClear(rim) { rim.dz.fill(0); }

/* 制御点の角度（ラジアン） */
export const rimAngle = (rim, i) => i * TAU / rim.n;

/* その向きのずれ。周期のCatmull-Romでなめらかにつなぐ */
export function rimAt(rim, theta) {
  const { n, dz } = rim;
  if (n < 2) return dz[0] || 0;
  const f = ((theta / TAU * n) % n + n) % n;
  const i = Math.floor(f), t = f - i;
  const g = k => dz[((k % n) + n) % n];
  const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
  return 0.5 * (2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

/* まん中を (cx, cy) として、その場所での分かれめの高さを返す関数を作る。
   ★平らなときは、ただの数を返す（頂点27万ぶんの atan2 を省く）。 */
export function rimHeightFn(rim, base, cx, cy) {
  if (rimFlat(rim)) return base;
  return (x, y) => base + rimAt(rim, Math.atan2(y - cy, x - cx));
}

/* 高さを返すもの（数でも関数でも）から、その場所の高さを取り出す */
export const heightOf = (h, x, y) => (typeof h === 'function' ? h(x, y) : h);

/* となりどうしをならして、とがりを取る（自動で合わせたあとに使う） */
export function rimSmooth(rim, k = 0.25) {
  const { n, dz } = rim;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = dz[(i - 1 + n) % n], b = dz[i], c = dz[(i + 1) % n];
    out[i] = b * (1 - 2 * k) + (a + c) * k;
  }
  rim.dz.set(out);
}
