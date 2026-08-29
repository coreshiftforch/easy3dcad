/* ══════════════════════════════════════════════
   溝の輪の「自己交差ほどき」を たしかめる

   クリッカーの「オブジェクトに沿った形」は、モデルの切り口を
   内へ寄せて（offsetLoop）作る。細いところでは 向かいがわの線と
   ぶつかって 8の字になり、赤い線が交差して見えていた。

   ここで見るのは 3つ。
     ① ほどいたあと、自分と交わる辺が 1つも残っていないか
     ② 残ったのは「広いほう」か（小さい輪を残していないか）
     ③ 交わっていない輪は そのまま返るか（よけいなことをしない）

   走らせかた: npm run check:loop
   ══════════════════════════════════════════════ */
import { unkink, offsetLoop } from '../src/geom/groove.js';

let ng = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  OK  ' : '  NG  ') + msg);
  if (!cond) ng++;
};

/* 自分と交わっている辺があるか（となり合う辺はのぞく） */
function kinks(pts) {
  const n = pts.length;
  let hit = 0;
  const cross = (a, b, c, d) => {
    const rx = b[0] - a[0], ry = b[1] - a[1];
    const sx = d[0] - c[0], sy = d[1] - c[1];
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) return false;
    const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
    const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
    const E = 1e-9;
    return t > E && t < 1 - E && u > E && u < 1 - E;
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (cross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) hit++;
    }
  return hit;
}

const area = pts => {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

console.log('① はっきりした 8の字 を ほどく');
{
  /* 上下2つの輪が まん中で交わる形（数字の8） */
  const fig8 = [[-10, 0], [-10, 10], [10, 10], [10, 0], [-10, -10], [10, -10]];
  const out = unkink(fig8);
  ok(kinks(fig8) > 0, `もとの形は 交わっている（${kinks(fig8)}か所）`);
  ok(kinks(out) === 0, 'ほどいたあとは 交わりが無い');
  ok(out.length >= 3, `点が ${out.length} 個 残っている`);
}

console.log('\n② 残るのは 広いほう');
{
  /* 大きい四角と 小さい三角が 1点で交わる形 */
  const loop = [[-30, -20], [30, -20], [30, 20], [-30, 20],
                [-30, 0], [-2, -2], [-34, -2]];
  const out = unkink(loop);
  ok(kinks(out) === 0, '交わりが無い');
  ok(area(out) > 1000, `残った輪の広さ ${area(out).toFixed(0)} mm2（大きい四角のほう）`);
}

console.log('\n③ 交わっていない輪は そのまま');
{
  const circle = Array.from({ length: 64 }, (_, i) => {
    const a = i * Math.PI * 2 / 64;
    return [Math.cos(a) * 20, Math.sin(a) * 20];
  });
  const out = unkink(circle);
  ok(out.length === circle.length, `点の数が 変わらない（${out.length}）`);
  ok(Math.abs(area(out) - area(circle)) < 1e-9, '広さも 変わらない');
}

console.log('\n④ 細い形を 内へ寄せても こわれない');
{
  /* ダンベル形（まん中がくびれている）。深く内へ寄せると 8の字になる */
  const bell = [];
  for (let i = 0; i < 120; i++) {
    const t = i / 120 * Math.PI * 2;
    const r = 20 * (0.45 + 0.55 * Math.abs(Math.cos(t)));
    bell.push([Math.cos(t) * r * 1.8, Math.sin(t) * r]);
  }
  for (const d of [2, 4, 6, 8]) {
    const raw = offsetLoop(bell, -d);
    const out = unkink(raw);
    ok(kinks(out) === 0,
      `${d}mm 内へ寄せる … もと ${kinks(raw)}か所 → 0か所（点 ${out.length}）`);
  }
}

console.log(ng ? `\n✖ ${ng} 件 だめでした` : '\n✔ ぜんぶ とおりました');
process.exit(ng ? 1 : 0);
