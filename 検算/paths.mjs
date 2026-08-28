/* 公開したときに 404 にならないかを確かめる。 ── npm run check:paths

   ★見ているのは3つ。

   1. **ルートから書いた道（/js/… や /fonts/…）が残っていないか**
      GitHub Pages のプロジェクトページは https://〜.github.io/リポジトリ名/ の
      下に置かれる。そこで /js/theme.js と書くと
      https://〜.github.io/js/theme.js を見にいってしまい、必ず404になる。
      index.html と clicker.html は Vite が base:'./' で ./js/… に
      書きかえてくれるが、**public/ の中身は Vite が一切さわらない**ので
      なまえプレートとQRは自分で相対にしておく必要がある。
      src/geom/make.js の書体の道も、ただの文字列なので書きかわらない。

   2. **外のサーバーを読んでいないか**
      three や opentype を CDN から読むと、そこが落ちた日にアプリも死ぬ。
      public/vendor/ に置いて自前で配ること。

   3. **読みにいく先が dist に入っているか** */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

let files;
try { files = walk(DIST); }
catch { console.error('✗ dist がありません。さきに npm run build を走らせてください'); process.exit(1); }

const よむ = f => readFileSync(f, 'utf8');
const 見る = files.filter(f => /\.(html|js|css)$/.test(f));
const みち = f => relative(ROOT, f).split(sep).join('/');

let ng = 0;
const say = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) ng++; };
const 並べる = a => a.map(x => '\n     ' + x).join('');

/* ── ① ルートから書いた道 ───────────────────────────── */
console.log('① ルートから書いた道（/… ）が残っていないか');
{
  const bad = [];
  for (const f of 見る) {
    const s = よむ(f);
    /* src="/…" href="/…"（// で始まる外部URLは別あつかいなので除く） */
    for (const m of s.matchAll(/(?:src|href)="(\/[^/"][^"]*)"/g)) bad.push(`${みち(f)} → ${m[1]}`);
    /* 文字列の中の "/fonts/…" '/js/…' `/css/…` */
    for (const m of s.matchAll(/["'`](\/(?:fonts|js|css|licenses|vendor)\/[^"'`]*)["'`]/g))
      bad.push(`${みち(f)} → ${m[1]}`);
  }
  say(bad.length === 0, bad.length ? `${bad.length}件のこっている:${並べる(bad)}`
                                   : 'ぜんぶ相対（./…）になっている');
}

/* ── ② 外のサーバー ─────────────────────────────────── */
console.log('\n② 外のサーバーから読んでいないか');
{
  const bad = [];
  for (const f of 見る) {
    const s = よむ(f);
    for (const m of s.matchAll(/(?:src|href)="(https?:[^"]+)"/g)) bad.push(`${みち(f)} → ${m[1]}`);
    for (const m of s.matchAll(/["'](https?:[^"']*(?:jsdelivr|unpkg|cdnjs)[^"']*)["']/g))
      bad.push(`${みち(f)} → ${m[1]}`);
  }
  say(bad.length === 0, bad.length ? `${bad.length}件のこっている:${並べる(bad)}`
                                   : '外から読んでいるものは無い');
}

/* ── ③ 読む先が dist にあるか ───────────────────────── */
console.log('\n③ 読む先のファイルが dist に入っているか');
{
  const have = new Set(files.map(f => relative(DIST, f).split(sep).join('/')));
  const want = new Set();
  for (const f of 見る) {
    /* ★「./」がどこから数えられるかは、書いてある場所で違う。
         ・HTML と CSS … そのファイル自身の場所から
           （dist/css/common.css の ./tokens.css は dist/css/tokens.css）
         ・JS … **ページの場所**から。fetch や import の相対は、そのJSが
           どこに置かれていても、読んでいるHTMLを基準に解決される。
           だから dist/assets/clicker-….js の中の ./fonts/….ttf は
           dist/fonts/….ttf を指す（4ページとも dist の直下にある）。 */
    const ここ = /\.js$/.test(f) ? '' : relative(DIST, dirname(f)).split(sep).filter(Boolean).join('/');
    const s = よむ(f);
    /* ./ で始まる読み先（HTMLのsrc/href・importmap・書体の道） */
    for (const m of s.matchAll(/["'`]\.\/([^"'`?#]+)["'`]/g))
      want.add(ここ ? `${ここ}/${m[1]}` : m[1]);
  }
  const miss = [...want].filter(w => !have.has(w) && !w.endsWith('/'));
  say(miss.length === 0, miss.length ? `dist に無い: ${miss.join(', ')}` : `${want.size}件ぜんぶある`);
}

console.log(ng ? `\n✗ ${ng}件だめでした` : '\n✓ ぜんぶ通りました');
process.exit(ng ? 1 : 0);
