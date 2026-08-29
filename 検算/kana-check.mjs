/* ══════════════════════════════════════════════════════════════
   ひらがな切替の取りこぼし検査

   public/js/kana.js の語彙で、画面に出る漢字がぜんぶ ひらがなに
   開けるかを確かめる。開けなかった漢字を一覧で出す。

   ★文言に漢字を足したら、これを走らせること。
     語彙に入れ忘れると、ひらがなモードで漢字が残る。

       npm run check:kana

   ── なぜ2か所を見るのか ──────────────────────────────
   文字の置き場が2通りあるため。片方だけ見ると取りこぼす。
     ① HTMLのタグの中（<p>…</p> など）
     ② JSの文字列リテラル（実行時に組み立てて画面に出すもの）
   ②を忘れて141字の抜けを見のがしたことがある。
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── kana.js から語彙を読む ───────────────────────────── */
const src = fs.readFileSync(path.join(ROOT, 'public/js/kana.js'), 'utf8');
const body = src.slice(src.indexOf('var PAIRS = ['), src.indexOf('/* 長いものから当てる'));
const PAIRS = eval(body.replace('var PAIRS =', '').replace(/;\s*$/, ''));
PAIRS.sort((a, b) => b[0].length - a[0].length);   // kana.js と同じ並べ替え

function toKana(s) {
  let out = '', i = 0;
  outer: while (i < s.length) {
    for (const [from, to] of PAIRS) {
      if (s.startsWith(from, i)) { out += to; i += from.length; continue outer; }
    }
    out += s[i]; i++;
  }
  return out;
}

/* ── 調べるファイル ───────────────────────────────────── */
const files = ['index.html', 'clicker.html', 'public/nameplate.html', 'public/qr.html',
               'public/js/resume.js',   /* 「つづきから」のダイアログの文言 */
               'public/js/pageqr.js',  /* 右上のQRの ふだの文言 */
               'public/js/filaments.js'];  /* 「その他の色」の文言 */
for (const dir of ['src', 'src/scenes', 'src/geom', 'src/io']) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (f.endsWith('.js')) files.push(dir + '/' + f);
  }
}

const KANJI = /[一-龠]/;
const TAGS = /<(button|label|h1|h2|p|span|div|small|option|summary|text|a|b|output)\b[^>]*>([\s\S]*?)<\/\1>/g;
const LIT = /'([^'\n\\]*[一-龠][^'\n\\]*)'|"([^"\n\\]*[一-龠][^"\n\\]*)"|`([^`\\]*[一-龠][^`\\]*)`/g;

const left = new Map();   // 残った漢字 → { 回数, 例, ファイル }

function check(text, file) {
  if (!text || !KANJI.test(text)) return;
  const k = toKana(text);
  for (let i = 0; i < k.length; i++) {
    const ch = k[i];
    if (!KANJI.test(ch)) continue;
    if (!left.has(ch)) {
      left.set(ch, { n: 0, eg: k.slice(Math.max(0, i - 6), i + 7), file });
    }
    left.get(ch).n++;
  }
}

for (const f of files) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) continue;
  const s = fs.readFileSync(abs, 'utf8');

  // ① HTMLのタグの中
  for (const m of s.matchAll(TAGS)) {
    const t = m[2].replace(/<[^>]+>/g, '').replace(/\$\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
    check(t, f);
  }

  // ② JSの文字列リテラル（コメント行はのぞく）
  for (const line of s.split('\n')) {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    for (const m of line.matchAll(LIT)) {
      check((m[1] || m[2] || m[3] || '').replace(/\$\{[^}]*\}/g, ' '), f);
    }
  }
}

/* ── 結果 ─────────────────────────────────────────────── */
if (!left.size) {
  console.log('✓ ひらがなにできない漢字は ありません（語彙 ' + PAIRS.length + '語）');
  process.exit(0);
}

console.log('✗ ひらがなにできなかった漢字が ' + left.size + '字 あります');
console.log('  public/js/kana.js の PAIRS に足してください。\n');
for (const [ch, v] of [...left].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${ch} (${v.n}回)  例: …${v.eg}…  [${v.file}]`);
}
console.log('\n★複合語で読みが変わるものは、長いかたちも一緒に入れること。');
console.log("  例) ['最','さい'] だけだと「最初」が「さい初」。['最初','さいしょ'] を足す。");
process.exit(1);
