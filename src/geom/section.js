/* モデルを水平な平面で切って、切り口の輪郭を取り出す。
   旧アプリ（フィギュアキーキャップ）の clipAt / buildLoops / nestLoops / safeZ を輸入。
   ★輪郭を見せるだけの用途では、切ったあとの面（kept）は要らない。
     90,616枚の三角形ぶん配列を積むと重いので、線分だけ集める形にしてある。 */

/* 符号つき面積（＋＝反時計まわり） */
export const polyArea = p => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};

export function pointInPoly(pt, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) &&
        pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

/* 平面で切ったときの「切り口の線分」を集める。
   cut は切る軸（2＝水平にz、1＝縦にy）、a・b は残る2軸。出てくる点は [a, b, …] の順。
   三角形の巻き方向を保ったまま出すので、あとで順につないで輪にできる。 */
function segsOnPlane(posArr, c0, cut, a, b, eps) {
  const segs = [];
  for (let i = 0; i < posArr.length; i += 9) {
    const R = [[posArr[i], posArr[i+1], posArr[i+2]],
               [posArr[i+3], posArr[i+4], posArr[i+5]],
               [posArr[i+6], posArr[i+7], posArr[i+8]]];
    const P = R.map(p => [p[a], p[b], p[cut]]);
    const d = P.map(p => {
      const v = p[2] - c0;
      return Math.abs(v) < eps ? 0 : v;
    });
    const on = d.map(v => v === 0);
    if (d[0] >= 0 && d[1] >= 0 && d[2] >= 0) {
      if (on[0] && on[1] && on[2]) continue;          // 平面に寝ている面は捨てる
      for (let k = 0; k < 3; k++) {
        const k2 = (k + 1) % 3;
        if (on[k] && on[k2]) segs.push([P[k], P[k2]]);
      }
      continue;
    }
    if (d[0] <= 0 && d[1] <= 0 && d[2] <= 0) continue;
    const poly = [], onPlane = [];
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3, a = P[k], b = P[k2], da = d[k], db = d[k2];
      if (da >= 0) { poly.push(a); onPlane.push(on[k]); }
      /* 交点を作るのは、両はしとも平面から離れていて上下に分かれるときだけ */
      if (!on[k] && !on[k2] && (da > 0) !== (db > 0)) {
        const t = da / (da - db);
        poly.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, c0]);
        onPlane.push(true);
      }
    }
    if (poly.length < 3) continue;
    for (let k = 0; k < poly.length; k++) {
      const k2 = (k + 1) % poly.length;
      if (onPlane[k] && onPlane[k2]) segs.push([poly[k], poly[k2]]);
    }
  }
  return segs;
}

/* 水平（z=z0）で切る。出てくる点は [x, y] */
export function sectionSegs(posArr, z0, eps = 1e-5) {
  return segsOnPlane(posArr, z0, 2, 0, 1, eps);
}

/* 縦（x=x0）で切る。出てくる点は [y, z] */
export function sectionSegsX(posArr, x0, eps = 1e-5) {
  return segsOnPlane(posArr, x0, 0, 1, 2, eps);
}

/* 縦（y=y0）で切る。出てくる点は [x, z] */
export function sectionSegsY(posArr, y0, eps = 1e-5) {
  return segsOnPlane(posArr, y0, 1, 0, 2, eps);
}

/* 切り口の線分を、輪をつくる順につなぐ。
   ★AIが作ったモデルは穴があいている（水密でない）ことがあり、そのままだと輪が閉じない。
     行き止まりになったら、いちばん近い行き止まりへ飛んでつなぐ（すきま 0.5mm まで）。 */
export function buildLoops(segs, tol = 0.5) {
  const q = 1e-4;
  const key = p => `${Math.round(p[0] / q)},${Math.round(p[1] / q)}`;
  const from = new Map();
  for (const s of segs) {
    const k = key(s[0]);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(s);
  }
  const used = new Set();
  const loops = [], open = [];
  for (const s0 of segs) {
    if (used.has(s0)) continue;
    const pts = [];
    let cur = s0;
    while (cur && !used.has(cur)) {
      used.add(cur);
      pts.push([cur[0][0], cur[0][1]]);
      const list = from.get(key(cur[1]));
      cur = list && list.find(t => !used.has(t));
    }
    if (pts.length < 3) continue;
    const head = pts[0], tail = pts[pts.length - 1];
    (Math.hypot(head[0] - tail[0], head[1] - tail[1]) < 5e-3 ? loops : open).push(pts);
  }
  // 閉じなかった鎖どうしを、端が近い順につなぐ
  while (open.length) {
    let cur = open.shift();
    for (let guard = 0; guard < 500; guard++) {
      const tail = cur[cur.length - 1], head = cur[0];
      if (Math.hypot(head[0] - tail[0], head[1] - tail[1]) < tol) break;
      let best = -1, bestD = tol, flip = false;
      open.forEach((o, i) => {
        const d0 = Math.hypot(tail[0] - o[0][0], tail[1] - o[0][1]);
        const d1 = Math.hypot(tail[0] - o[o.length-1][0], tail[1] - o[o.length-1][1]);
        if (d0 < bestD) { bestD = d0; best = i; flip = false; }
        if (d1 < bestD) { bestD = d1; best = i; flip = true; }
      });
      if (best < 0) break;
      const add = open.splice(best, 1)[0];
      cur = cur.concat(flip ? add.slice().reverse() : add);
    }
    if (cur.length >= 3 && Math.abs(polyArea(cur)) > 1e-4) loops.push(cur);
  }
  return loops.filter(p => Math.abs(polyArea(p)) > 1e-4);
}

/* 輪の入れ子をしらべる。深さが偶数＝外がわ、奇数＝穴 */
export function nestLoops(loops) {
  const items = loops.map(p => ({ pts: p, a: Math.abs(polyArea(p)), depth: 0, holes: [] }));
  items.sort((x, y) => y.a - x.a);
  for (let i = 0; i < items.length; i++)
    for (let j = 0; j < i; j++)
      if (pointInPoly(items[i].pts[0], items[j].pts)) items[i].depth++;
  const outers = items.filter(o => o.depth % 2 === 0);
  for (const h of items.filter(o => o.depth % 2 === 1)) {
    let host = null;
    for (const o of outers)
      if (o.depth === h.depth - 1 && pointInPoly(h.pts[0], o.pts) && (!host || o.a < host.a)) host = o;
    if (host) host.holes.push(h.pts);
  }
  return outers;
}

/* 切る高さを、頂点のかたまりから少し離れたところへ寄せる。
   ★スライダの位置がたまたま「平らな面」に当たると、その面の頂点がまるごと平面に吸われて
     面が消え、切り口の輪が抜ける。動かす幅はモデルの高さの1%まで。 */
export function safeZ(posArr, z) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 2; i < posArr.length; i += 3) {
    const v = posArr[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const H = (hi - lo) || 1;
  const win  = H * 0.01;
  const need = H * 0.002;
  if (z <= lo + need || z >= hi - need) return z;

  const near = [];
  for (let i = 2; i < posArr.length; i += 3) {
    const v = posArr[i];
    if (Math.abs(v - z) <= win * 1.5) near.push(v);
  }
  if (!near.length) return z;
  near.sort((a, b) => a - b);
  const cl = [near[0]];
  for (const v of near) if (v - cl[cl.length - 1] > need * 0.5) cl.push(v);

  const far = t => {
    let d = Infinity;
    for (const c of cl) d = Math.min(d, Math.abs(t - c));
    return d;
  };
  if (far(z) >= need) return z;

  const cand = [z - win, z + win];
  for (let i = 0; i + 1 < cl.length; i++) cand.push((cl[i] + cl[i + 1]) / 2);
  let best = null, bd = Infinity;
  for (const t of cand) {
    if (t <= lo + need || t >= hi - need || far(t) < need) continue;
    const d = Math.abs(t - z);
    if (d < bd) { bd = d; best = t; }
  }
  return best === null ? z : best;
}

/* その高さの切り口のうち、いちばん大きい輪（＝外まわり）を返す。
   見つからなければ null。 */
export function outlineAt(posArr, z) {
  const outers = nestLoops(buildLoops(sectionSegs(posArr, safeZ(posArr, z))));
  if (!outers.length) return null;
  let best = outers[0];
  for (const o of outers) if (o.a > best.a) best = o;
  return best.pts;
}

/* 線分どうしが本当に交わるか（端点を共有するだけは交わりとみなさない） */
function crosses(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/* 輪が自分自身と交わっているか。
   ★輪郭を内がわへ寄せると、へこみのところで反対がわの辺を追いこして交わる。
     面積だけ見ていると「まだ正の面積がある」と通ってしまうので、交わりで見る。 */
export function selfIntersects(pts) {
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i], a2 = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;          // となりあう辺どうし
      if (crosses(a1, a2, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/* 点を間引く。切り口はそのままだと数百点あり、あとの計算が重くなる */
export function thin(pts, minGap = 0.35) {
  if (pts.length < 4) return pts;
  const out = [pts[0]];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= minGap) out.push(p);
  }
  const a = out[0], b = out[out.length - 1];
  if (out.length > 3 && Math.hypot(a[0] - b[0], a[1] - b[1]) < minGap) out.pop();
  return out.length >= 3 ? out : pts;
}
