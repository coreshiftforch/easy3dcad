/* 色の出どころが1か所のままか、確かめる検算。
   ── npm run check:colors

   決めごと（README「色は1か所」）
     ① 色の値そのものは public/css/tokens.css の --c-… だけが持つ
     ② ほかのファイルは「自分のところの名前」を var(--c-…) から取るだけで、
        --名前: #色 のように値を直接書かない
     ③ var(--c-…) で引いている名前は、tokens.css に必ずある

   ★②を破ると、以前の「同じ色を2か所に書き写す」状態に戻る。
     ★③を破ると、その色だけ何も効かない（CSSは黙って無視する）ので
       画面を見るまで気づけない。だから機械で見る。 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');

const TOKENS = 'public/css/tokens.css';
/* 色を使う側。ここに増やしたら足す */
const USERS = [
  'public/css/common.css',
  'src/style.css',
  'public/js/resume.js',
  'index.html',
  'clicker.html',
  'public/nameplate.html',
  'public/qr.html',
];

/* tokens.css が持っている名前 */
const tokens = new Set([...read(TOKENS).matchAll(/(--c-[\w-]+)\s*:/g)].map(m => m[1]));

const ng = [];

/* ① tokens.css そのものに、名前だけで値の無いものが無いか（書きかけ） */
for (const [, name, val] of read(TOKENS).matchAll(/(--c-[\w-]+)\s*:\s*([^;]+);/g))
  if (!/^#[0-9a-fA-F]{3,8}$/.test(val.trim()))
    ng.push(`${TOKENS}: ${name} の値が色になっていない（${val.trim()}）`);

for (const f of USERS) {
  const src = read(f);

  /* ② 値を直に書いていないか。**--名前: #色** の形だけを見る。
        resume.js の var(--c-panel,#1e293b) のような「読めなかったときの逃げ道」は
        --名前: の形をしていないので、はじめから当たらない */
  for (const [, name, hex] of src.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*[;'"]/g))
    ng.push(`${f}: ${name} に色を直に書いている（${hex}）→ tokens.css に置いて var(--c-…) で引く`);

  /* ③ 引いている名前が tokens.css にあるか */
  for (const [, name] of src.matchAll(/var\(\s*(--c-[\w-]+)/g))
    if (!tokens.has(name)) ng.push(`${f}: ${name} は tokens.css に無い`);
}

if (ng.length) {
  console.error('✗ 色の決めごとを外れているところ\n');
  for (const m of ng) console.error('  ' + m);
  console.error(`\n${ng.length}件`);
  process.exit(1);
}
console.log(`✓ 色は ${TOKENS} の ${tokens.size}個だけ。${USERS.length}ファイルとも、そこから引いている`);
