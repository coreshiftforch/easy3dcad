/* 「モデルを作る」でできる形を、ブラウザを開かずに確かめる。
   ── npm run check:make

   見ているのは4つ。
     ① 寸法      … 頼んだ 幅・厚み どおりの箱に収まっているか
     ② 彫った跡  … 彫ったら体積が減り、のせたら増えるか（向きの取りちがえ検出）
     ③ 島        … 「あ」のように中に閉じたところがある字で、島が残っているか
     ④ QR        … マスが重なっていないか（重なると earcut がこわれる）

   ★体積は「符号つき四面体の足し算」で出す。面が外を向いていれば正の数になる。
     負や 0 に近い数が出たら、三角形の向きが裏返っている。
   ★フォントは fetch で読むようにしてあるので、ここではディスクから
     読ませるように fetch を差しかえる。 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

globalThis.fetch = async (p) => {
  const buf = readFileSync(join(ROOT, 'public', String(p)));
  return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
};

const { buildMake, decoPolys, qrPolys, SHAPES, FONTS } = await import('../src/geom/make.js');

/* ── 道具 ───────────────────────────────────── */
function volumeOf(t) {
  let v = 0;
  for (let i = 0; i < t.length; i += 9)
    v += (t[i] * (t[i + 4] * t[i + 8] - t[i + 5] * t[i + 7])
        - t[i + 1] * (t[i + 3] * t[i + 8] - t[i + 5] * t[i + 6])
        + t[i + 2] * (t[i + 3] * t[i + 7] - t[i + 4] * t[i + 6])) / 6;
  return v;
}
function boxOf(t) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.length; i += 3)
    for (let k = 0; k < 3; k++) {
      if (t[i + k] < lo[k]) lo[k] = t[i + k];
      if (t[i + k] > hi[k]) hi[k] = t[i + k];
    }
  return { lo, hi, size: hi.map((h, k) => h - lo[k]) };
}

let ng = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) ng++;
};

const BASE = { shape: 'round', width: 60, thick: 6, deco: 'none', how: 'carve',
               depth: 1.2, text: '', fontId: 'gothic', textPct: 80,
               url: '', ec: 'M', qrPct: 80 };

/* ── ① 寸法 ─────────────────────────────────── */
console.log('① 頼んだ大きさになるか');
for (const s of SHAPES) {
  const m = await buildMake({ ...BASE, shape: s.id });
  const b = boxOf(m.positions);
  ok(Math.abs(b.size[0] - 60) < 0.6 && Math.abs(b.size[2] - 6) < 1e-4,
     `${s.name}　よこ ${b.size[0].toFixed(1)}mm・厚み ${b.size[2].toFixed(1)}mm`);
}

/* ── ② 彫ると減る・のせると増える ───────────────── */
console.log('\n② 彫ったら減り、のせたら増えるか');
const plain  = await buildMake({ ...BASE });
const carved = await buildMake({ ...BASE, deco: 'text', how: 'carve', text: 'あア8' });
const raised = await buildMake({ ...BASE, deco: 'text', how: 'raise', text: 'あア8' });
const vP = volumeOf(plain.positions), vC = volumeOf(carved.positions), vR = volumeOf(raised.positions);
ok(vP > 0, `板だけ ${vP.toFixed(0)}mm³（正の数＝面が外を向いている）`);
ok(vC > 0 && vC < vP, `彫った ${vC.toFixed(0)}mm³ < 板だけ ${vP.toFixed(0)}mm³`);
ok(vR > vP, `のせた ${vR.toFixed(0)}mm³ > 板だけ ${vP.toFixed(0)}mm³`);
ok(Math.abs(boxOf(carved.positions).size[2] - 6) < 1e-4, '彫っても厚みは変わらない');
ok(Math.abs(boxOf(raised.positions).size[2] - 7.2) < 1e-4,
   `のせたら 6 + 1.2 = ${boxOf(raised.positions).size[2].toFixed(1)}mm になる`);

/* ── ③ 彫った量が、字の面積ぴったりか ─────────────
   彫った跡は「字のかたち × 深さ」ぶんだけ減るはず。
   ★「あ」や「お」のように中が閉じている字は、その中に **島** が残る。
     島を作り忘れると、そこまで抜けおちて **減りすぎる**。
     だから紙の上で出した面積とくらべれば、島の作り忘れがそのまま出る。 */
console.log('\n③ 彫った量が、字の面積のぶんぴったりか');
const area = pts => {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};
for (const [label, text] of [['島のある字', 'あおぬ'], ['島のない字', 'くしつ']]) {
  const opt = { ...BASE, deco: 'text', how: 'carve', text, textPct: 80 };
  const { deco } = await decoPolys(opt);
  const ink = deco.reduce((s, p) => s + area(p.outer) - p.holes.reduce((h, q) => h + area(q), 0), 0);
  const got = volumeOf((await buildMake(opt)).positions);
  const want = vP - ink * BASE.depth;
  ok(Math.abs(got - want) < 0.5,
     `${label}「${text}」　彫った ${got.toFixed(1)} ≒ 板 ${vP.toFixed(1)} − 面積 ${ink.toFixed(1)}mm² × ${BASE.depth}mm`);
  if (text === 'あおぬ')
    ok(deco.some(p => p.holes.length > 0), '　　　　「あおぬ」には島がある（穴の中に閉じたところ）');
}

/* ── ③b この書体に無い字は、黙って消さずに知らせるか ────
   はじめの5つの書体には漢字が入っていない。打った本人には分からないので、
   ★出ない字を名指しで知らせること。 */
console.log('\n③b 書体に無い字を知らせるか');
const kanji = await decoPolys({ ...BASE, deco: 'text', text: '漢字', fontId: 'gothic' });
ok(kanji.info.warn.some(w => w.includes('漢字')), 'ゴシックに「漢字」が無いと知らせる');
const kanjiOK = await decoPolys({ ...BASE, deco: 'text', text: '漢字', fontId: 'kanji' });
ok(kanjiOK.info.warn.length === 0 && kanjiOK.deco.length > 0, '「かんじ」の書体なら出る');

/* ── ④ QRのマスが重なっていないか ─────────────────
   重なったまま穴にすると earcut がこわれて、面がぐちゃぐちゃになる。 */
console.log('\n④ QRのマスが重なっていないか');
const { polys, count, module } = qrPolys('https://example.com/abc', 'M', 30);
const rects = polys.map(p => ({
  x0: Math.min(...p.outer.map(q => q.x)), x1: Math.max(...p.outer.map(q => q.x)),
  y0: Math.min(...p.outer.map(q => q.y)), y1: Math.max(...p.outer.map(q => q.y)),
}));
let overlap = 0;
for (let i = 0; i < rects.length; i++)
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.y0 < b.y1 - 1e-9 && b.y0 < a.y1 - 1e-9) overlap++;
  }
ok(overlap === 0, `${count}×${count}マス → ${rects.length}個の長方形。重なり ${overlap}件`);
ok(module > 0 && Math.abs(module - 30 / count) < 1e-9, `1マス ${module.toFixed(2)}mm`);

const qrCarve = await buildMake({ ...BASE, deco: 'qr', how: 'carve', url: 'https://example.com/abc' });
const qrRaise = await buildMake({ ...BASE, deco: 'qr', how: 'raise', url: 'https://example.com/abc' });
ok(volumeOf(qrCarve.positions) > 0 && volumeOf(qrCarve.positions) < vP, 'QRを彫ると減る');
ok(volumeOf(qrRaise.positions) > vP, 'QRをのせると増える');
ok(qrCarve.info.qr.count === count, `情報に出るマス数 ${qrCarve.info.qr.count} が合っている`);

/* ── おまけ：書体をぜんぶ読めるか ─────────────────── */
console.log('\n⑤ 書体をぜんぶ読めるか');
for (const f of FONTS) {
  const m = await buildMake({ ...BASE, deco: 'text', how: 'raise', text: 'あA1', fontId: f.id });
  ok(volumeOf(m.positions) > vP, `${f.name}`);
}

console.log(ng ? `\n✗ ${ng}件だめでした` : '\n✓ ぜんぶ通りました');
process.exit(ng ? 1 : 0);
