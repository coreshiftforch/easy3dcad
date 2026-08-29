/* 「モデルを作る」でできる形を、ブラウザを開かずに確かめる。
   ── npm run check:make

   見ているのは6つ。
     ① 寸法    … 頼んだ よこ幅・高さ どおりの箱に収まっているか
     ② 向き    … 面が外を向いているか（体積が正の数か）。全部の形で
     ③ 彫った量 … 「字の面積 × 深さ」ぴったりか。**島の作り忘れがここで出る**
     ④ 書体    … 無い字を黙って消さずに知らせるか／6書体とも読めるか
     ⑤ QR      … マスが重なっていないか（重なると earcut がこわれる）
     ⑥ キーキャップ … 先すぼまりになっているか（上の面が下より小さい）

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

const { buildMake, decoPolys, qrPolys, inkArea, FUSE, SHAPES, FONTS, NGON_MIN, NGON_MAX } =
  await import('../src/geom/make.js');

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
/* z がこの高さのあたりにある点の、広がりを見る（先すぼまりの検査に使う）*/
function widthAtZ(t, z, tol) {
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < t.length; i += 3)
    if (Math.abs(t[i + 2] - z) < tol) { if (t[i] < x0) x0 = t[i]; if (t[i] > x1) x1 = t[i]; }
  return x1 - x0;
}

let ng = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) ng++;
};

const BASE = { shape: 'round', width: 60, thick: 22, deco: 'none', how: 'carve',
               depth: 1.2, text: '', fontId: 'gothic', textPct: 80,
               url: '', ec: 'M', qrPct: 80 };

/* ── ①② 形ぜんぶ：寸法と向き ───────────────────── */
console.log(`① ② 形ぜんぶ（${SHAPES.length}個）で、大きさが合っていて 面が外を向いているか`);
const plainVol = {};
for (const s of SHAPES) {
  const m = await buildMake({ ...BASE, shape: s.id });
  const b = boxOf(m.positions);
  const v = volumeOf(m.positions);
  plainVol[s.id] = v;
  const wOK = Math.abs(b.size[0] - 60) < 0.6;
  const zOK = Math.abs(b.size[2] - 22) < 1e-3;
  /* ★体積は「その形の面積 × 高さ」より小さいはず（先すぼまりは さらに小さい）。
       0以下や、箱いっぱいを超える数字が出たら、面が壊れている。
     ★ただし2つ以上のかたちが重なってできている形（ねこ・くも等）は、重なりを
       二重に数えるので、箱より大きい数が出ることがある。まちがいではないので、
       かたちの数だけ上限をゆるめる。 */
  const vOK = v > 0 && v < 60 * b.size[1] * 22 * m.info.parts;
  ok(wOK && zOK && vOK,
     `${s.name.padEnd(7, '　')} ${b.size[0].toFixed(1)} × ${b.size[1].toFixed(1)} × ${b.size[2].toFixed(1)}mm`
     + `　${(v / 1000).toFixed(1)}cm³`
     + (m.info.parts > 1 ? `（${m.info.parts}つのかたちが重なっている）` : ''));
}

/* ── ③c のせるものを動かしても、彫った量が変わらないか ─────
   ★位置を変えても 字の面積は変わらないので、彫った量も同じはず。
     ちがったら「面の外へ出て、彫りそこねている」ということ。 */
console.log('\n③c のせるものを動かしても 彫った量が同じか');
{
  const opt = { ...BASE, shape: 'round', deco: 'text', how: 'carve', text: 'あお', textPct: 70 };
  const mid = volumeOf((await buildMake(opt)).positions);
  for (const [x, y] of [[100, 0], [-100, 0], [0, 100], [0, -100], [100, 100], [-100, -100]]) {
    const v = volumeOf((await buildMake({ ...opt, decoX: x, decoY: y })).positions);
    ok(Math.abs(v - mid) < 1,
       `よこ${String(x).padStart(4)} たて${String(y).padStart(4)} → ${(v / 1000).toFixed(3)}cm³`
       + `（まん中 ${(mid / 1000).toFixed(3)}cm³）`);
  }
  /* 範囲の外を渡しても、はしで止まること */
  const far = volumeOf((await buildMake({ ...opt, decoX: 999, decoY: 999 })).positions);
  const edge = volumeOf((await buildMake({ ...opt, decoX: 100, decoY: 100 })).positions);
  ok(Math.abs(far - edge) < 1, '999 を渡しても はし（100）で止まる');
}

/* ── ②b 多角形：角の数を 3〜16 まで動かしても壊れないか ─────
   ★角が少ないと てっぺんがせまい。文字を置ける広さ（inner）を
     角の数から出しているので、両はしと まん中を通しておく。
   ★正n角形の面積は (1/2)n R² sin(2π/n)。横幅60mmにそろえたあとの
     体積が、その式と合うかを見る（角が増えるほど まるに近づく）。 */
console.log(`
②b 多角形（${NGON_MIN}〜${NGON_MAX}角）が、角の数どおりに作れているか`);
for (let n = NGON_MIN; n <= NGON_MAX; n++) {
  const m = await buildMake({ ...BASE, shape: 'ngon', sides: n });
  const b = boxOf(m.positions);
  const v = volumeOf(m.positions);
  const wOK = Math.abs(b.size[0] - 60) < 0.6;
  const zOK = Math.abs(b.size[2] - 22) < 1e-3;
  /* ★体積が箱の半分より大きく、箱より小さいこと。面が裏返っていたり
       ふたが抜けていたりすると、0以下や 箱ごえの数字が出る。
     ★「角がふえるほど体積もふえる」は **成り立たない**。横幅60mmに
       そろえているので、四角（箱いっぱい）が いちばん大きくなる。 */
  const box = 60 * b.size[1] * 22;
  const vOK = v > box * 0.45 && v < box;
  ok(wOK && zOK && vOK,
     `${String(n).padStart(2)}角　${b.size[0].toFixed(1)} × ${b.size[1].toFixed(1)} × ${b.size[2].toFixed(1)}mm`
     + `　${(v / 1000).toFixed(1)}cm³　箱の${(v / box * 100).toFixed(0)}%`);
}
/* 角の数を外れた数を渡しても、止まらずに近い値へ寄せるか */
for (const [bad, want] of [[0, NGON_MIN], [99, NGON_MAX], [undefined, 8]]) {
  const m = await buildMake({ ...BASE, shape: 'ngon', sides: bad });
  const same = await buildMake({ ...BASE, shape: 'ngon', sides: want });
  ok(Math.abs(volumeOf(m.positions) - volumeOf(same.positions)) < 1,
     `角の数に ${bad} を渡しても ${want}角として作る`);
}

/* ── ③ 彫った量が、字の面積ぴったりか ─────────────
   彫った跡は「字のかたち × 深さ」ぶんだけ減るはず。
   ★「あ」や「お」のように中が閉じている字は、その中に **島** が残る。
     島を作り忘れると、そこまで抜けおちて **減りすぎる**。
   ★穴はまっすぐ下ろしている（縮めない）ので、先すぼまりの形でも同じ式で合う。 */
console.log('\n③ 彫った量が、字の面積のぶんぴったりか');
for (const shape of ['round', 'circle', 'star', 'cat', 'keycap']) {
  for (const [label, text] of [['島あり', 'あおぬ'], ['島なし', 'くしつ']]) {
    const opt = { ...BASE, shape, deco: 'text', how: 'carve', text, textPct: 80 };
    const { deco } = await decoPolys(opt);
    const ink = inkArea(deco);
    const got = volumeOf((await buildMake(opt)).positions);
    const want = plainVol[shape] - ink * BASE.depth;
    ok(Math.abs(got - want) < 0.5,
       `${SHAPES.find(s => s.id === shape).name}／${label}「${text}」　`
       + `${got.toFixed(1)} ≒ ${plainVol[shape].toFixed(1)} − ${ink.toFixed(1)}mm² × ${BASE.depth}mm`);
  }
}
{
  const { deco } = await decoPolys({ ...BASE, deco: 'text', text: 'あおぬ', textPct: 80 });
  ok(deco.some(p => p.holes.length > 0), '「あおぬ」には島がある（穴の中に閉じたところ）');
}

/* ── のせたら増える ────────────────────────────── */
console.log('\n③b のせたら、その ぶんだけ増えるか');
{
  const opt = { ...BASE, deco: 'text', how: 'raise', text: 'あおぬ', textPct: 80 };
  const { deco } = await decoPolys(opt);
  const m = await buildMake(opt);
  const got = volumeOf(m.positions);
  /* ★のせたものは**別の立体**として土台に食いこませてある。体積を足すと
       食いこんだぶん（FUSE）も数えるので、増えるのは (深さ + FUSE) ぶん。
       外から見える高さは 深さ ぶんだけ（下の行で見ている）。 */
  const want = plainVol.round + inkArea(deco) * (BASE.depth + FUSE);
  ok(Math.abs(got - want) < 0.5, `のせた ${got.toFixed(1)} ≒ ${want.toFixed(1)}`);
  ok(Math.abs(boxOf(m.positions).size[2] - (22 + 1.2)) < 1e-3, '高さは 22 + 1.2 = 23.2mm');
}

/* ── ④ 書体 ────────────────────────────────── */
console.log('\n④ 書体に無い字を知らせるか／ぜんぶ読めるか');
const kanjiNG = await decoPolys({ ...BASE, deco: 'text', text: '漢字', fontId: 'gothic' });
ok(kanjiNG.info.warn.some(w => w.includes('漢字')), 'ゴシックに「漢字」が無いと知らせる');
const kanjiOK = await decoPolys({ ...BASE, deco: 'text', text: '漢字', fontId: 'kanji' });
ok(kanjiOK.info.warn.length === 0 && kanjiOK.deco.length > 0, '「かんじ」の書体なら出る');
for (const f of FONTS) {
  const m = await buildMake({ ...BASE, deco: 'text', how: 'raise', text: 'あA1', fontId: f.id });
  ok(volumeOf(m.positions) > plainVol.round, `${f.name}`);
}

/* ── ⑤ QRのマスが重なっていないか ─────────────────
   重なったまま穴にすると earcut がこわれて、面がぐちゃぐちゃになる。 */
console.log('\n⑤ QRのマスが重なっていないか');
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
{
  const opt = { ...BASE, deco: 'qr', how: 'carve', url: 'https://example.com/abc' };
  const { deco, info } = await decoPolys(opt);
  const got = volumeOf((await buildMake(opt)).positions);
  const want = plainVol.round - inkArea(deco) * BASE.depth;
  ok(Math.abs(got - want) < 0.5, `QRを彫った量も面積ぴったり（1マス ${info.qr.module.toFixed(2)}mm）`);
}

/* ── ⑥ キーキャップは先すぼまりか ─────────────────
   キーボードのキーらしく見えるかは、**上の面が下より小さいこと**で決まる。
   まっすぐな柱と見くらべる。 */
console.log('\n⑥ キーキャップが先すぼまりか');
{
  const cap = await buildMake({ ...BASE, shape: 'keycap' });
  const box = await buildMake({ ...BASE, shape: 'square' });
  const capLo = widthAtZ(cap.positions, 0, 0.01), capHi = widthAtZ(cap.positions, 22, 0.01);
  const boxLo = widthAtZ(box.positions, 0, 0.01), boxHi = widthAtZ(box.positions, 22, 0.01);
  ok(capHi < capLo * 0.9,
     `キーキャップ　下 ${capLo.toFixed(1)}mm → 上 ${capHi.toFixed(1)}mm（${(capHi / capLo * 100).toFixed(0)}%）`);
  ok(Math.abs(boxHi - boxLo) < 0.01,
     `正方形はまっすぐ　下 ${boxLo.toFixed(1)}mm → 上 ${boxHi.toFixed(1)}mm`);
  ok(plainVol.keycap < plainVol.square, 'すぼまっているぶん、正方形より体積が小さい');
}

console.log(ng ? `\n✗ ${ng}件だめでした` : '\n✓ ぜんぶ通りました');
process.exit(ng ? 1 : 0);
