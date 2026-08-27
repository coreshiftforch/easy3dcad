/* ══════════════════════════════════════════════════════════════
   かたまり分け（shells / pickShellAt）の検算

   U字のように、切ると上が2つ以上に分かれるかたちのための処理。
   ブラウザを使わずに、三角形の並びを直に食わせて確かめる。

       npm run check:split
   ══════════════════════════════════════════════════════════════ */
import { shells, pickShellAt } from '../src/geom/split.js';

let ng = 0;
const ok = (cond, name, extra = '') => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (extra ? '  ' + extra : ''));
  if (!cond) ng++;
};

/* 直方体を三角形の並びにする */
function box(x0, x1, y0, y1, z0, z1) {
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const f = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],
             [1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  const out = [];
  for (const [a, b, c] of f) for (const p of [v[a], v[b], v[c]]) out.push(...p);
  return new Float32Array(out);
}

const cat = (...a) => {
  const n = a.reduce((s, x) => s + x.length, 0);
  const out = new Float32Array(n);
  let w = 0;
  for (const x of a) { out.set(x, w); w += x.length; }
  return out;
};

console.log('■ かたまりを数える');
{
  const one = box(0, 10, 0, 10, 0, 10);
  ok(shells(one).length === 1, 'つながった立体は1つ', `→ ${shells(one).length}`);

  /* 離れた2つ（U字の腕2本にあたる） */
  const two = cat(box(0, 10, 0, 10, 0, 10), box(30, 40, 0, 10, 0, 10));
  ok(shells(two).length === 2, '離れた2つは2つに分かれる', `→ ${shells(two).length}`);

  const three = cat(box(0, 10, 0, 10, 0, 10), box(30, 40, 0, 10, 0, 10),
                    box(60, 70, 0, 10, 0, 10));
  ok(shells(three).length === 3, '離れた3つは3つに分かれる', `→ ${shells(three).length}`);

  /* 面をぴったり共有してつながっているもの（切り口とふた） */
  const glued = cat(box(0, 10, 0, 10, 0, 10), box(0, 10, 0, 10, 10, 20));
  ok(shells(glued).length === 1, '面を共有していれば1つ', `→ ${shells(glued).length}`);
}

console.log('\n■ クリッカーのあるかたまりを選ぶ');
{
  const left = box(0, 10, 0, 10, 0, 10);      // クリッカーはこちら
  const right = box(30, 40, 0, 10, 0, 10);    // 腕だけ（宙に浮く）
  const both = cat(left, right);

  const a = pickShellAt(both, 5, 5);          // 左の真上
  ok(a.strays.length === 1, '残りが1つ出る', `→ ${a.strays.length}`);
  ok(a.keep.length === left.length, '選ばれたのは左', `→ ${a.keep.length / 9}枚`);
  ok(a.strays[0].length === right.length, '右が残りになる');

  const b = pickShellAt(both, 35, 5);         // 右の真上
  ok(b.keep.length === right.length, 'クリッカーが右なら右が残る');
  ok(b.strays[0].length === left.length, 'そのとき左が残りになる');

  /* どちらにも当たらない位置 → いちばん大きいほうを残す（安全側） */
  const big = box(50, 90, 0, 40, 0, 10);
  const c = pickShellAt(cat(left, big), 200, 200);
  ok(c.keep.length === big.length, '当たらなければ大きいほうを残す');
  ok(c.strays.length === 1, 'そのとき残りは1つ');

  /* かたまりが1つなら、そのまま返す（ふつうのかたち） */
  const d = pickShellAt(left, 5, 5);
  ok(d.strays.length === 0, '1つだけなら残りは無し');
  ok(d.keep === left, '中身をつくり直さずそのまま返す');
}

console.log('\n■ 上パーツに乗っているだけのもの（文字・かざり）は上に残す');
{
  /* なまえプレートの STL は、土台と文字が **別の立体** として書き出される。
     面で接しているだけなので かたまりとしては分かれる。
     これを下パーツへ落とすと、文字だけ台に取り残されてしまう。 */
  const plate = box(0, 100, 0, 40, 0, 5);          // 土台（クリッカーはここ）
  const ch1 = box(20, 30, 15, 25, 5, 8);           // 文字（土台の上に乗るだけ）
  const ch2 = box(45, 55, 15, 25, 5, 8);
  const arm = box(200, 212, 0, 40, 0, 30);         // 遠くの腕（U字のもう1本）

  const r = pickShellAt(cat(plate, ch1, ch2, arm), 50, 20);
  ok(r.strays.length === 1, '下へ回るのは遠くの腕だけ', `→ ${r.strays.length}`);
  ok(r.strays[0].length === arm.length, '回されたのは腕');
  ok(r.keep.length === plate.length + ch1.length + ch2.length,
     '土台＋文字2つが上に残る', `→ ${r.keep.length / 9}枚`);
}

console.log('\n■ 三角形の枚数が減らない（付けかえても失わない）');
{
  const both = cat(box(0, 10, 0, 10, 0, 10), box(30, 40, 0, 10, 0, 10));
  const r = pickShellAt(both, 5, 5);
  const total = r.keep.length + r.strays.reduce((s, x) => s + x.length, 0);
  ok(total === both.length, '上＋下で もとの枚数と同じ',
     `→ ${total / 9} / ${both.length / 9}枚`);
}

console.log(ng ? `\n✗ ${ng}件 だめでした` : '\n✓ ぜんぶ通りました');
process.exit(ng ? 1 : 0);
