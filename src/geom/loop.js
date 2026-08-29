/* 溝を回す「輪」の形。上から見た閉じたループを、点の並びで返す。
   大きさは「半径」＝中心から輪までの長さ（四角なら中心から辺までの長さ）。
   ★「オブジェクトに沿った形」と「自分で描く」はここでは作らない。
     前者は切り口の輪郭（section.js）、後者は人がなぞった線。 */

export const SHAPES = [
  { id: 'circle', label: '円' },
  { id: 'square', label: '四角' },
  { id: 'round',  label: '角丸の四角' },
  { id: 'along',  label: 'オブジェクトに沿った形' },
  { id: 'free',   label: '自分で描く' },
];

/* 半径のスライダを使う形かどうか。
   ★poly（多角形）は SHAPES に入れていない。タイプ1の②の選べる形を変えたくないので、
     使う側（下パーツ生成の②）が自分の一覧に足して、ここへ id を渡す。 */
export const USES_SIZE = id =>
  id === 'circle' || id === 'square' || id === 'round' || id === 'poly';

/* corner は「半径のうち何割を丸めるか」。0＝四角、1＝円。
   sides は多角形の角の数（poly のときだけ見る）。 */
export function makeLoop(id, r, seg = 96, corner = 0.3, sides = 6) {
  if (id === 'square') return squarePts(r);
  if (id === 'round')  return corner < 0.01 ? squarePts(r) : roundPts(r, r * Math.min(corner, 1));
  if (id === 'poly')   return polyPts(r, sides);
  return circlePts(r, seg);
}

/* 正多角形。r は中心から**角**までの長さ。
   ★平らな面を下（−Y）に向ける。三角形が「▽」ではなく「△」に見えるほうが、
     上から見たときに向きが読みやすい。 */
function polyPts(r, sides) {
  const n = Math.max(3, Math.min(16, Math.round(sides)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = -Math.PI / 2 + Math.PI / n + 2 * Math.PI * i / n;
    out.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  return out;
}

function circlePts(r, seg) {
  const out = [];
  for (let i = 0; i < seg; i++) {
    const t = 2 * Math.PI * i / seg;
    out.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  return out;
}

function squarePts(r) {
  return [[-r, -r], [r, -r], [r, r], [-r, r]];
}

/* 角丸の四角。c は角の丸みの半径（mm）。
   ★丸みが大きいほど角の分割を細かくする。粗いままだと、円に近づけたときに
     多角形の折れ線が見えてしまう。 */
function roundPts(r, c) {
  const per = Math.max(4, Math.min(24, Math.round(c / Math.max(r, 0.01) * 20) + 4));
  const k = Math.min(c, r * 0.99);
  const s = r - k;
  const out = [];
  const corner = (cx, cy, from) => {
    for (let i = 0; i <= per; i++) {
      const t = from + (Math.PI / 2) * (i / per);
      out.push([cx + Math.cos(t) * k, cy + Math.sin(t) * k]);
    }
  };
  corner( s,  s, 0);              // 右上
  corner(-s,  s, Math.PI / 2);    // 左上
  corner(-s, -s, Math.PI);        // 左下
  corner( s, -s, -Math.PI / 2);   // 右下
  return out;
}

/* 輪を重心から k 倍する。
   ★「距離を一定に保つオフセット」は、細い切れこみのある輪郭だと内外どちらへずらしても
     自分と交わってしまう（猫のしっぽと胴のあいだで、外へ5mmでも起きた）。
     重心からの拡大縮小なら、もとが交わっていなければ絶対に交わらない。
     そのかわり、細いところも同じ割合で縮む（消えはしない）。 */
export function scaleLoop(pts, k) {
  if (k === 1) return pts;
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  return pts.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
}

/* なぞった輪を なめらかにする（手ブレのぎざぎざを取る）。

   ── やりかた ────────────────────────────────────────
   ① 等間かくに 打ちなおす（リサンプル）
      指の速さで点の間かくがバラバラだと、次のならしが かたよる。
      ゆっくり描いたところだけ 強くならされて、形がゆがむ。
   ② となりと平均をとる（移動平均）を n 回くり返す
      1回ごとに [0.25, 0.5, 0.25] で混ぜる。輪なので 端は反対がわへ回す。

   ★点の数は増やさない。あとで earcut にかけるので、増やすと重くなる。
   ★角のある形（四角く描いたつもり）も まるくなる。それは承知のうえで、
     手ブレのぎざぎざのほうが目につく、という判断。 */
export function smoothLoop(pts, passes = 4) {
  const n = pts.length;
  if (n < 6) return pts;

  /* ① 等間かく。まわりの長さを 点の数で割った間かくで 打ちなおす */
  let total = 0;
  const seg = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(d);
    total += d;
  }
  if (!(total > 0)) return pts;
  const step = total / n;
  const even = [];
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const want = k * step;
    while (i < n - 1 && acc + seg[i] < want) { acc += seg[i]; i++; }
    const t = seg[i] > 0 ? (want - acc) / seg[i] : 0;
    const a = pts[i], b = pts[(i + 1) % n];
    even.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }

  /* ② となりと平均をとる */
  let cur = even;
  for (let pass = 0; pass < passes; pass++) {
    const out = new Array(n);
    for (let k = 0; k < n; k++) {
      const a = cur[(k - 1 + n) % n], b = cur[k], c = cur[(k + 1) % n];
      out[k] = [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4];
    }
    cur = out;
  }
  return cur;
}
