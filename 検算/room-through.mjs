/* スイッチの部屋を抜いたあと、下パーツが閉じているかを確かめる。
   ── npm run check:room

   ★見ているのは「ひらいた辺（1回しか使われていない辺）が0本か」。
     0本でなければ、そのまま印刷すると失敗する。

   ★とくに **部屋が底を突きぬけるとき**（切り口が低くて、下に 15.5mm ぶんの
     肉が残らないとき）。ここが長いあいだ開いていた：
       壁は「抜いたあとのひらいた辺」から作るのだが、まっすぐな板の底に
       四角い穴があくと その辺は **1本の線分**になる。wallPoly が
       2本以上を求めていたので、三角形がたまたま割れなかった側の壁だけ
       作られず、そこが口を開けていた（6本／8本）。 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join as pjoin } from 'node:path';

const ROOT = pjoin(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.fetch = async (p) => {
  const b = readFileSync(pjoin(ROOT, 'public', String(p)));
  return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
};

const { buildMake } = await import('../src/geom/make.js');
const { transformed } = await import('../src/geom/model.js');
const { sectionSegs, buildLoops, nestLoops } = await import('../src/geom/section.js');
const { splitByStep } = await import('../src/geom/split.js');
const { capFlat } = await import('../src/geom/caps.js');
const { roomBox, cutRoom, roomSquare, roomFits } = await import('../src/geom/room.js');

/* 1回しか使われていない辺を数える。0なら閉じた立体 */
function openEdges(t) {
  const q = i => `${Math.round(t[i] * 1e4)},${Math.round(t[i+1] * 1e4)},${Math.round(t[i+2] * 1e4)}`;
  const m = new Map();
  for (let i = 0; i < t.length; i += 9)
    for (let e = 0; e < 3; e++) {
      const ka = q(i + e * 3), kb = q(i + ((e + 1) % 3) * 3);
      if (ka === kb) continue;
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      m.set(id, (m.get(id) || 0) + 1);
    }
  let n = 0;
  for (const v of m.values()) if (v === 1) n++;
  return n;
}
const join = (...a) => {
  const n = a.reduce((s, x) => s + x.length, 0);
  const out = new Float32Array(n);
  let o = 0; for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};

/* タイプ2（平面ひとつで切る）と同じ手順で 下パーツを作る */
const ROOM_SIDE = 16.4, NEED_BELOW = 15.5, POLE_D = 4.4, POLE_H = 3.3;
function lowerPart(pos, zg) {
  const outers = nestLoops(buildLoops(sectionSegs(pos, zg)));
  const r = splitByStep(pos, outers[0].pts, outers[0].pts, zg, zg, 0, [zg, zg]);
  const box = roomBox(0, 0, ROOM_SIDE, zg, zg - NEED_BELOW, POLE_D, POLE_H);
  const lo0 = join(r.lower, capFlat(outers, roomSquare(box), zg, true));
  return { lower: cutRoom(lo0, box), through: !roomFits(lo0, box) };
}

const BASE = { width: 60, thick: 22, deco: 'none', how: 'carve', depth: 1.2,
               text: '', fontId: 'gothic', textPct: 80, url: '', ec: 'M', qrPct: 85 };

let ng = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) ng++; };

console.log('① 切り口の高さを変えて、下パーツが閉じているか');
for (const shape of ['keycap', 'square', 'circle', 'round', 'hexagon']) {
  const m = await buildMake({ ...BASE, shape });
  let hi = -Infinity, lo = Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    if (m.positions[i] > hi) hi = m.positions[i];
    if (m.positions[i] < lo) lo = m.positions[i];
  }
  /* シーン3の①と同じように、いちばん長いところを 72.3mm にそろえる */
  const pos = transformed(m.positions, { scale: 72.3 / (hi - lo), anchor: 'ground' }).positions;
  let zmax = -Infinity;
  for (let i = 2; i < pos.length; i += 3) if (pos[i] > zmax) zmax = pos[i];

  const out = [];
  let bad = 0;
  for (const frac of [0.35, 0.45, 0.55, 0.7, 0.85]) {
    const { lower, through } = lowerPart(pos, zmax * frac);
    const n = openEdges(lower);
    if (n) bad++;
    out.push(`${(frac * 100) | 0}%${through ? '（突きぬけ）' : ''}:${n}`);
  }
  ok(bad === 0, `${shape.padEnd(7)} ${out.join('  ')}`);
}

/* ★境目そのものを見る。部屋の底が モデルの底より ほんの少し下に出た瞬間に
     こわれていた（-0.02 は通るのに -0.2 で6本）。 */
console.log('\n② 部屋の底が モデルの底を またぐところ');
{
  const m = await buildMake({ ...BASE, shape: 'square' });
  let hi = -Infinity, lo = Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    if (m.positions[i] > hi) hi = m.positions[i];
    if (m.positions[i] < lo) lo = m.positions[i];
  }
  const pos = transformed(m.positions, { scale: 72.3 / (hi - lo), anchor: 'ground' }).positions;
  let zmax = -Infinity;
  for (let i = 2; i < pos.length; i += 3) if (pos[i] > zmax) zmax = pos[i];
  const zg = zmax * 0.45;
  const outers = nestLoops(buildLoops(sectionSegs(pos, zg)));
  const r = splitByStep(pos, outers[0].pts, outers[0].pts, zg, zg, 0, [zg, zg]);
  for (const zBot of [2, 0, -0.2, -1, -3.5]) {
    const box = roomBox(0, 0, ROOM_SIDE, zg, zBot, POLE_D, POLE_H);
    const lo0 = join(r.lower, capFlat(outers, roomSquare(box), zg, true));
    const n = openEdges(cutRoom(lo0, box));
    ok(n === 0, `部屋の底 z=${String(zBot).padStart(5)}（モデルの底は 0）→ ひらいた辺 ${n}本`);
  }
}

console.log(ng ? `\n✗ ${ng}件だめでした` : '\n✓ ぜんぶ通りました');
process.exit(ng ? 1 : 0);
