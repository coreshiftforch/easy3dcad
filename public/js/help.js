/* ══════════════════════════════════════════════════════════════
   使いかた（4ページ共通）

   右上の「？」を押すと、画面のまん中に 掲示板が降りてくる。
     1ページ目 … アプリ全体
     2〜4ページ目 … なまえプレート／QRキーホルダー／クリッカーメーカー
   左右の三角で ページをめくる。

   ── 決めごと ─────────────────────────────────────────
   ★このファイルだけで完結させる（見た目も中身も）。4ページのHTMLには
     <script src="./js/help.js"> の1行だけ足せばよい。resume.js と同じ流儀。
   ★色は tokens.css の --c-… を引く。読めなかったときのために、
     var(--c-…, #色) の形で逃げ道を書いておく。
   ★絵は絵文字を使わず、その場で描くSVG。ひらがな切替（kana.js）は
     文字だけを開くので、絵はそのまま残る。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ヘッダーが無いページ用の、右上の帯（theme.js と同じもの）。
     先に作られていれば それを使う。並ぶ順は order で決めている。 */
  function floatBar() {
    var bar = document.getElementById('e3c-floatbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'e3c-floatbar';
      document.body.appendChild(bar);
    }
    return bar;
  }

  /* ── 見た目 ─────────────────────────────────────── */
  var CSS = [
    '.hp-veil{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);',
    '  opacity:0;pointer-events:none;transition:opacity .25s;}',
    '.hp-veil.open{opacity:1;pointer-events:auto;}',

    /* ── 掲示板 ────────────────────────────────
       画面のまん中に、上から降りてくる。板のわく → 板の面（つぶつぶ）→
       画びょうでとめた名ふだ と 紙、の重ねで できている。
       ★大きさは 画面の8わり。ころがるのは紙の中だけで、
         名ふだと下の列は いつも見えている。 */
    '.hp-sheet{position:fixed;left:50%;top:50%;z-index:61;box-sizing:border-box;',
    '  width:min(80vw,1120px);height:80dvh;padding:16px;',
    '  display:flex;flex-direction:column;gap:12px;',
    '  background:var(--c-panel2,#0f172a);',
    '  background-image:radial-gradient(rgba(0,0,0,.10) 1px,transparent 1px);',
    '  background-size:13px 13px;',
    /* ★わくは --c-muted。--c-line だと あかるい方で 板の面と見わけがつかない */
    '  border:9px solid var(--c-muted,#94a3b8);border-radius:20px;',
    '  box-shadow:0 30px 70px rgba(0,0,0,.45),inset 0 0 22px rgba(0,0,0,.18);',
    '  color:var(--c-text,#f1f5f9);',
    '  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Meiryo",system-ui,sans-serif;',
    '  transform:translate(-50%,-50%) translateY(-150vh);',
    '  transition:transform .42s cubic-bezier(.22,.9,.3,1);}',
    '.hp-sheet.open{transform:translate(-50%,-50%);}',
    '@media (max-width:700px){.hp-sheet{width:92vw;height:88dvh;padding:10px;',
    '  border-width:7px;border-radius:16px;gap:9px;}}',

    /* 板にとめた名ふだ */
    '.hp-top{position:relative;flex:none;display:flex;align-items:center;gap:10px;',
    '  background:var(--c-panel,#1e293b);border:1px solid var(--c-line,#334155);',
    '  border-radius:12px;padding:9px 10px 9px 18px;',
    '  box-shadow:0 3px 8px rgba(0,0,0,.22);}',
    '.hp-top b{font-size:18px;}',
    '.hp-x{margin-left:auto;width:38px;height:38px;border-radius:50%;',
    '  border:1px solid var(--c-line,#334155);background:var(--c-panel2,#0f172a);',
    '  color:var(--c-muted,#94a3b8);font:inherit;font-size:17px;cursor:pointer;}',
    '.hp-x:hover{color:var(--c-text,#f1f5f9);border-color:var(--c-accent2,#3b82f6);}',

    /* 板にはった紙。ころがるのは ここだけ */
    /* safe center … 中身が短いときは まん中、はみ出すときは上ぞろえ。
       ただの center だと はみ出した上のほうへ ころがせなくなる */
    '.hp-wrap{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;',
    '  display:grid;align-content:safe center;',
    '  background:var(--c-panel,#1e293b);border:1px solid var(--c-line,#334155);',
    '  border-radius:12px;padding:24px 28px;',
    '  box-shadow:0 6px 18px rgba(0,0,0,.22);}',

    '.hp-body{display:grid;gap:18px;grid-template-columns:1fr;align-items:center;}',
    '@media (min-width:720px){.hp-body{grid-template-columns:320px 1fr;gap:28px;}}',
    '.hp-art{background:var(--c-panel2,#0f172a);border:1px solid var(--c-line,#334155);',
    '  border-radius:16px;padding:14px;display:grid;place-items:center;}',
    '.hp-art svg{width:100%;height:auto;max-height:220px;}',
    /* ★絵は index.html のカードと **同じもの** を持ってきている。
         あちらは il-… の名前で色を決めているので、ここでも同じ名前を
         用意する。色の値は tokens.css から引く（生の色は書かない）。 */
    '.hp-art .il-fill{fill:var(--c-panel,#1e293b);}',
    '.hp-art .il-line{fill:none;stroke:var(--c-text,#f1f5f9);stroke-width:2.2;',
    '  stroke-linejoin:round;stroke-linecap:round;opacity:.85;}',
    '.hp-art .il-accent{fill:var(--c-accent2,#3b82f6);}',
    '.hp-art .il-soft{fill:var(--c-line,#334155);}',
    '.hp-art .il-ink{fill:var(--c-text,#f1f5f9);opacity:.88;}',
    '.hp-h{font-size:20px;font-weight:bold;margin:0 0 6px;}',
    '.hp-lead{color:var(--c-muted,#94a3b8);font-size:14px;line-height:1.9;margin:0 0 12px;}',
    '.hp-list{margin:0;padding:0;list-style:none;display:grid;gap:10px;}',
    '.hp-list li{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;',
    '  font-size:14px;line-height:1.8;}',
    '.hp-list i{font-style:normal;display:grid;place-items:center;width:26px;height:26px;',
    '  border-radius:50%;background:var(--c-accent-bg,#17325e);color:var(--c-accent2,#3b82f6);',
    '  font-size:12px;font-weight:bold;}',
    '.hp-list b{display:block;}',
    '.hp-list span{color:var(--c-muted,#94a3b8);}',

    /* 板の下の列。三角も点も ここにならべる（画面のひろさで動かさない） */
    '.hp-foot{flex:none;display:flex;align-items:center;justify-content:center;gap:10px;}',
    '.hp-dot{width:9px;height:9px;border-radius:50%;border:0;padding:0;cursor:pointer;',
    '  background:var(--c-line,#334155);}',
    '.hp-dot.on{background:var(--c-accent2,#3b82f6);width:22px;border-radius:5px;}',
    '.hp-arrow{width:42px;height:42px;border-radius:50%;flex:none;',
    '  border:1px solid var(--c-line,#334155);background:var(--c-panel,#1e293b);',
    '  color:var(--c-text,#f1f5f9);',
    '  font:inherit;font-size:15px;cursor:pointer;display:grid;place-items:center;}',
    '.hp-arrow:hover:not(:disabled){border-color:var(--c-accent2,#3b82f6);color:var(--c-accent2,#3b82f6);}',
    '.hp-arrow:disabled{opacity:.3;cursor:default;}',
    '.hp-prev{margin-right:6px;} .hp-next{margin-left:6px;}',

    /* 右上の「？」 */
    '.help-btn{flex:none;width:37px;height:37px;border-radius:50%;',
    '  border:1px solid var(--c-line,#334155);background:var(--c-panel2,#0f172a);',
    '  color:var(--c-muted,#94a3b8);font:inherit;font-size:16px;font-weight:bold;cursor:pointer;}',
    /* スタート画面（浮かせるとき）は ひとまわり大きく */
    '#e3c-floatbar .help-btn{order:2;width:46px;height:46px;font-size:20px;}',
    /* ★スマホでは ひとまわり小さく（帯が題と重なるため） */
    '@media (max-width:720px){#e3c-floatbar .help-btn{width:40px;height:40px;',
    '  font-size:17px;}}',
    '.help-btn:hover{color:var(--c-accent2,#3b82f6);border-color:var(--c-accent2,#3b82f6);}',
    '#e3c-floatbar{position:fixed;top:14px;right:14px;z-index:20;',
    '  display:flex;align-items:center;gap:10px;}',

    /* == スマホ：紙の中を たてに ころがさない ==================
       ★このかたまりは **いちばん後ろ** に置くこと。上に置くと、
         あとから来る素の .hp-body（display:grid）や .hp-art に
         同じ強さで上書きされて効かない（実際に効かなかった）。 */
    '@media (max-width:700px){',
    /* ★スマホでは 紙の中を たてに ころがさない。
         スタート画面と同じ考えで、**絵のところが縮んで** 収まるようにする。
         文字は縮めない（読めなくなるため）。 */
    '  .hp-wrap{padding:12px;display:flex;touch-action:pan-y;}',
    '  .hp-body{display:flex;flex-direction:column;gap:11px;flex:1 1 auto;min-height:0;}',
    '  .hp-art{flex:1 1 auto;min-height:64px;place-items:stretch;padding:10px;}',
    /* place-items:stretch と組で、viewBox が わくの中で ちょうど縮む */
    '  .hp-art svg{width:100%;height:100%;max-height:none;min-width:0;min-height:0;}',
    '  .hp-body > div:last-child{flex:none;}',
    '  .hp-h{font-size:16px;}',
    '  .hp-lead{font-size:12.5px;line-height:1.7;margin-bottom:9px;}',
    '  .hp-list{gap:7px;}',
    '  .hp-list li{font-size:12.5px;line-height:1.6;grid-template-columns:22px 1fr;gap:8px;}',
    '  .hp-list i{width:22px;height:22px;font-size:11px;}',
    '}',
  ].join('\n');

  /* ── 絵 ─────────────────────────────────────────
     ★4ページとも index.html のカードの絵をそのまま使う。色は
       .hp-art .il-… （上のCSS）が tokens.css から引いている。
       ここで描き起こすのは やめた（カードと見た目がずれるため）。 */
  /* ぜんたい：**作れるものの見本を3つ並べる**。
     ★中身は下の ART_PLATE / ART_QR / ART_CLICK と同じもの（index.html の
       カードから持ってきた絵）。ここで描き直すと、カードと見た目がずれる。
     ★どれも viewBox は 168x122。横に3つ、少しずつ ずらして置く。 */
  var innerOf = function (svg) {
    return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  };

  /* なまえプレート（index.html のカードと同じ絵） */
  var ART_PLATE = [
    '<svg viewBox="0 0 168 122" aria-hidden="true">',
    '          <path class="il-soft" d="M41 34H76.45A11 11 0 1 1 91.55 34H127A15 15 0 0 1 142 49V83A15 15 0 0 1 127 98H41A15 15 0 0 1 26 83V49A15 15 0 0 1 41 34Z" transform="translate(0 7)"/>',
    '          <path class="il-fill" d="M41 34H76.45A11 11 0 1 1 91.55 34H127A15 15 0 0 1 142 49V83A15 15 0 0 1 127 98H41A15 15 0 0 1 26 83V49A15 15 0 0 1 41 34Z"/>',
    '          <path class="il-line" d="M41 34H76.45A11 11 0 1 1 91.55 34H127A15 15 0 0 1 142 49V83A15 15 0 0 1 127 98H41A15 15 0 0 1 26 83V49A15 15 0 0 1 41 34Z"/>',
    '          <circle class="il-soft" cx="84" cy="22" r="4.4"/>',
    '          <path class="il-accent" transform="translate(46.63 77.65) scale(0.2520)" d="M61.0-49.2L61.0-49.2L68.3-49.2Q68.5-35.6 69.4-19.9L69.4-19.9Q81.9-15.7 91.2-9.9L91.2-9.9L86.8-3.5Q77.4-9.4 69.7-12.7L69.7-12.7Q70.0-4.1 66.2-0.3L66.2-0.3Q62.3 3.5 53.4 3.5L53.4 3.5Q45.3 3.5 40.0 0L40.0 0Q34.6-3.6 34.6-10.1L34.6-10.1Q34.6-16.9 41.5-20.6L41.5-20.6Q46.2-23.2 51.5-23.2L51.5-23.2Q56.8-23.2 62.0-22.1L62.0-22.1Q61.2-34.7 61.0-49.2ZM62.1-15.4L62.1-15.4Q56.7-16.9 51.5-16.9L51.5-16.9Q47.4-16.9 44.6-15.3L44.6-15.3Q41.6-13.5 41.6-10.2L41.6-10.2Q41.6-3.1 53.1-3.1L53.1-3.1Q58.6-3.1 60.5-5.9L60.5-5.9Q62.5-8.7 62.1-15.4ZM11.9-54.3L11.5-61.4Q22.7-60.7 31.2-61.5L31.2-61.5Q33.5-68.5 35.8-80.1L35.8-80.1L43.5-78.9Q41.9-71.2 39.3-62.3L39.3-62.3Q46.4-63.0 55.6-65.2L55.6-65.2L55.9-58.0Q45.6-55.9 37.1-55.2L37.1-55.2Q29.0-31.7 16.3-13.0L16.3-13.0L9.4-17.4Q20.7-32.2 29.0-54.5L29.0-54.5Q16.6-54.1 11.9-54.3L11.9-54.3ZM92.1-48.9L86.5-43.1Q78.1-52.4 66.6-60.2L66.6-60.2L71.7-65.5Q83.4-58.3 92.1-48.9L92.1-48.9ZM147.5-79.3L155.3-79.3L155.4-64.7Q170.5-65.7 182.6-67.8L182.6-67.8L183.2-60.9Q174.1-59.5 155.5-58.1L155.5-58.1L155.7-45.7Q171.5-47.2 178.6-48.5L178.6-48.5L179.1-41.6Q170.6-40.2 155.9-39.1L155.9-39.1L156.7-21.9Q170.8-17.6 185.3-8.0L185.3-8.0L180.5-1.3Q172.8-7.1 156.9-14.2L156.9-14.2Q157.3-5.2 153.0-1.3L153.0-1.3Q148.7 2.4 140.0 2.4L140.0 2.4Q129.7 2.4 123.8-1.1L123.8-1.1Q117.8-4.6 117.8-11.2L117.8-11.2Q117.8-18.2 125.5-22.1L125.5-22.1Q131.2-24.9 137.7-24.9L137.7-24.9Q143.7-24.9 149.3-24.0L149.3-24.0L148.6-38.6Q141.3-38.3 137.7-38.3L137.7-38.3Q130.2-38.3 122.2-38.8L122.2-38.8L122.2-45.6Q130.3-44.9 139.3-44.9L139.3-44.9Q142.3-44.9 148.4-45.2L148.4-45.2L148.0-57.6Q137.2-57.4 136.6-57.4L136.6-57.4Q128.0-57.4 116.8-57.9L116.8-57.9L116.8-64.7Q127.2-64.0 138.0-64.0L138.0-64.0Q138.4-64.0 147.8-64.2L147.8-64.2L147.5-79.3ZM149.4-12.4L149.4-17.0Q142.4-18.5 137.4-18.5L137.4-18.5Q132.7-18.5 129.3-17.0L129.3-17.0Q125.1-15.2 125.1-11.7L125.1-11.7Q125.1-7.6 130.1-5.7L130.1-5.7Q133.7-4.3 139.1-4.3L139.1-4.3Q149.4-4.3 149.4-12.4L149.4-12.4ZM263.7-69.8L259.3-63.1Q249.1-69.2 231.4-73.6L231.4-73.6L235.4-79.8Q252.9-75.6 263.7-69.8L263.7-69.8ZM221.7-44.4L219.7-52.3Q240.1-53.6 261.8-56.9L261.8-56.9L267.0-51.0Q258.7-42.8 244.9-27.8L244.9-27.8Q249.3-29.4 252.4-29.4L252.4-29.4Q261.1-29.4 261.2-19.6L261.2-19.6L261.4-11.1Q261.6-7.1 264.3-6.4L264.3-6.4Q266.3-5.8 270.6-5.8L270.6-5.8Q277.2-5.8 286.5-7.5L286.5-7.5L287.2 0.5Q279.6 1.6 273.0 1.6L273.0 1.6Q263.2 1.6 259.2-0.4L259.2-0.4Q254.4-2.8 254.1-9.3L254.1-9.3L253.8-17.1Q253.7-23.3 249.2-23.3L249.2-23.3Q243.8-23.3 236.3-16.7L236.3-16.7Q230.5-11.7 217.3 2.9L217.3 2.9L211.5-2.6Q232.1-22.4 256.2-49.7L256.2-49.7Q240.6-46.7 221.7-44.4L221.7-44.4Z"/>',
    '        </svg>',
  ].join('\n');

  /* QRキーホルダー（index.html のカードと同じ絵） */
  var ART_QR = [
    '<svg viewBox="0 0 168 122" aria-hidden="true">',
    '          <path class="il-soft" d="M50 22H78A10 10 0 1 1 90 22H118A16 16 0 0 1 134 38V98A16 16 0 0 1 118 114H50A16 16 0 0 1 34 98V38A16 16 0 0 1 50 22Z" transform="translate(0 7)"/>',
    '          <path class="il-fill" d="M50 22H78A10 10 0 1 1 90 22H118A16 16 0 0 1 134 38V98A16 16 0 0 1 118 114H50A16 16 0 0 1 34 98V38A16 16 0 0 1 50 22Z"/>',
    '          <path class="il-line" d="M50 22H78A10 10 0 1 1 90 22H118A16 16 0 0 1 134 38V98A16 16 0 0 1 118 114H50A16 16 0 0 1 34 98V38A16 16 0 0 1 50 22Z"/>',
    '          <circle class="il-soft" cx="84" cy="11" r="3.8"/>',
    '          <path class="il-ink" d="M48.00 32.00h3.43v3.43h-3.43zM51.43 32.00h3.43v3.43h-3.43zM54.86 32.00h3.43v3.43h-3.43zM58.29 32.00h3.43v3.43h-3.43zM61.71 32.00h3.43v3.43h-3.43zM65.14 32.00h3.43v3.43h-3.43zM68.57 32.00h3.43v3.43h-3.43zM85.71 32.00h3.43v3.43h-3.43zM89.14 32.00h3.43v3.43h-3.43zM96.00 32.00h3.43v3.43h-3.43zM99.43 32.00h3.43v3.43h-3.43zM102.86 32.00h3.43v3.43h-3.43zM106.29 32.00h3.43v3.43h-3.43zM109.71 32.00h3.43v3.43h-3.43zM113.14 32.00h3.43v3.43h-3.43zM116.57 32.00h3.43v3.43h-3.43zM48.00 35.43h3.43v3.43h-3.43zM68.57 35.43h3.43v3.43h-3.43zM96.00 35.43h3.43v3.43h-3.43zM116.57 35.43h3.43v3.43h-3.43zM48.00 38.86h3.43v3.43h-3.43zM54.86 38.86h3.43v3.43h-3.43zM58.29 38.86h3.43v3.43h-3.43zM61.71 38.86h3.43v3.43h-3.43zM68.57 38.86h3.43v3.43h-3.43zM75.43 38.86h3.43v3.43h-3.43zM78.86 38.86h3.43v3.43h-3.43zM85.71 38.86h3.43v3.43h-3.43zM89.14 38.86h3.43v3.43h-3.43zM96.00 38.86h3.43v3.43h-3.43zM102.86 38.86h3.43v3.43h-3.43zM106.29 38.86h3.43v3.43h-3.43zM109.71 38.86h3.43v3.43h-3.43zM116.57 38.86h3.43v3.43h-3.43zM48.00 42.29h3.43v3.43h-3.43zM54.86 42.29h3.43v3.43h-3.43zM58.29 42.29h3.43v3.43h-3.43zM61.71 42.29h3.43v3.43h-3.43zM68.57 42.29h3.43v3.43h-3.43zM75.43 42.29h3.43v3.43h-3.43zM78.86 42.29h3.43v3.43h-3.43zM82.29 42.29h3.43v3.43h-3.43zM89.14 42.29h3.43v3.43h-3.43zM96.00 42.29h3.43v3.43h-3.43zM102.86 42.29h3.43v3.43h-3.43zM106.29 42.29h3.43v3.43h-3.43zM109.71 42.29h3.43v3.43h-3.43zM116.57 42.29h3.43v3.43h-3.43zM48.00 45.71h3.43v3.43h-3.43zM54.86 45.71h3.43v3.43h-3.43zM58.29 45.71h3.43v3.43h-3.43zM61.71 45.71h3.43v3.43h-3.43zM68.57 45.71h3.43v3.43h-3.43zM75.43 45.71h3.43v3.43h-3.43zM85.71 45.71h3.43v3.43h-3.43zM89.14 45.71h3.43v3.43h-3.43zM96.00 45.71h3.43v3.43h-3.43zM102.86 45.71h3.43v3.43h-3.43zM106.29 45.71h3.43v3.43h-3.43zM109.71 45.71h3.43v3.43h-3.43zM116.57 45.71h3.43v3.43h-3.43zM48.00 49.14h3.43v3.43h-3.43zM68.57 49.14h3.43v3.43h-3.43zM75.43 49.14h3.43v3.43h-3.43zM78.86 49.14h3.43v3.43h-3.43zM82.29 49.14h3.43v3.43h-3.43zM89.14 49.14h3.43v3.43h-3.43zM96.00 49.14h3.43v3.43h-3.43zM116.57 49.14h3.43v3.43h-3.43zM48.00 52.57h3.43v3.43h-3.43zM51.43 52.57h3.43v3.43h-3.43zM54.86 52.57h3.43v3.43h-3.43zM58.29 52.57h3.43v3.43h-3.43zM61.71 52.57h3.43v3.43h-3.43zM65.14 52.57h3.43v3.43h-3.43zM68.57 52.57h3.43v3.43h-3.43zM75.43 52.57h3.43v3.43h-3.43zM82.29 52.57h3.43v3.43h-3.43zM89.14 52.57h3.43v3.43h-3.43zM96.00 52.57h3.43v3.43h-3.43zM99.43 52.57h3.43v3.43h-3.43zM102.86 52.57h3.43v3.43h-3.43zM106.29 52.57h3.43v3.43h-3.43zM109.71 52.57h3.43v3.43h-3.43zM113.14 52.57h3.43v3.43h-3.43zM116.57 52.57h3.43v3.43h-3.43zM75.43 56.00h3.43v3.43h-3.43zM82.29 56.00h3.43v3.43h-3.43zM85.71 56.00h3.43v3.43h-3.43zM89.14 56.00h3.43v3.43h-3.43zM48.00 59.43h3.43v3.43h-3.43zM54.86 59.43h3.43v3.43h-3.43zM58.29 59.43h3.43v3.43h-3.43zM61.71 59.43h3.43v3.43h-3.43zM65.14 59.43h3.43v3.43h-3.43zM68.57 59.43h3.43v3.43h-3.43zM78.86 59.43h3.43v3.43h-3.43zM82.29 59.43h3.43v3.43h-3.43zM89.14 59.43h3.43v3.43h-3.43zM96.00 59.43h3.43v3.43h-3.43zM99.43 59.43h3.43v3.43h-3.43zM102.86 59.43h3.43v3.43h-3.43zM106.29 59.43h3.43v3.43h-3.43zM109.71 59.43h3.43v3.43h-3.43zM58.29 62.86h3.43v3.43h-3.43zM72.00 62.86h3.43v3.43h-3.43zM75.43 62.86h3.43v3.43h-3.43zM78.86 62.86h3.43v3.43h-3.43zM82.29 62.86h3.43v3.43h-3.43zM89.14 62.86h3.43v3.43h-3.43zM99.43 62.86h3.43v3.43h-3.43zM106.29 62.86h3.43v3.43h-3.43zM109.71 62.86h3.43v3.43h-3.43zM48.00 66.29h3.43v3.43h-3.43zM51.43 66.29h3.43v3.43h-3.43zM58.29 66.29h3.43v3.43h-3.43zM61.71 66.29h3.43v3.43h-3.43zM68.57 66.29h3.43v3.43h-3.43zM72.00 66.29h3.43v3.43h-3.43zM75.43 66.29h3.43v3.43h-3.43zM85.71 66.29h3.43v3.43h-3.43zM92.57 66.29h3.43v3.43h-3.43zM102.86 66.29h3.43v3.43h-3.43zM106.29 66.29h3.43v3.43h-3.43zM109.71 66.29h3.43v3.43h-3.43zM113.14 66.29h3.43v3.43h-3.43zM48.00 69.71h3.43v3.43h-3.43zM51.43 69.71h3.43v3.43h-3.43zM54.86 69.71h3.43v3.43h-3.43zM72.00 69.71h3.43v3.43h-3.43zM75.43 69.71h3.43v3.43h-3.43zM78.86 69.71h3.43v3.43h-3.43zM99.43 69.71h3.43v3.43h-3.43zM102.86 69.71h3.43v3.43h-3.43zM106.29 69.71h3.43v3.43h-3.43zM109.71 69.71h3.43v3.43h-3.43zM116.57 69.71h3.43v3.43h-3.43zM48.00 73.14h3.43v3.43h-3.43zM51.43 73.14h3.43v3.43h-3.43zM54.86 73.14h3.43v3.43h-3.43zM61.71 73.14h3.43v3.43h-3.43zM68.57 73.14h3.43v3.43h-3.43zM82.29 73.14h3.43v3.43h-3.43zM85.71 73.14h3.43v3.43h-3.43zM92.57 73.14h3.43v3.43h-3.43zM102.86 73.14h3.43v3.43h-3.43zM106.29 73.14h3.43v3.43h-3.43zM109.71 73.14h3.43v3.43h-3.43zM116.57 73.14h3.43v3.43h-3.43zM75.43 76.57h3.43v3.43h-3.43zM78.86 76.57h3.43v3.43h-3.43zM85.71 76.57h3.43v3.43h-3.43zM89.14 76.57h3.43v3.43h-3.43zM92.57 76.57h3.43v3.43h-3.43zM96.00 76.57h3.43v3.43h-3.43zM109.71 76.57h3.43v3.43h-3.43zM113.14 76.57h3.43v3.43h-3.43zM48.00 80.00h3.43v3.43h-3.43zM51.43 80.00h3.43v3.43h-3.43zM54.86 80.00h3.43v3.43h-3.43zM58.29 80.00h3.43v3.43h-3.43zM61.71 80.00h3.43v3.43h-3.43zM65.14 80.00h3.43v3.43h-3.43zM68.57 80.00h3.43v3.43h-3.43zM78.86 80.00h3.43v3.43h-3.43zM82.29 80.00h3.43v3.43h-3.43zM89.14 80.00h3.43v3.43h-3.43zM96.00 80.00h3.43v3.43h-3.43zM99.43 80.00h3.43v3.43h-3.43zM113.14 80.00h3.43v3.43h-3.43zM48.00 83.43h3.43v3.43h-3.43zM68.57 83.43h3.43v3.43h-3.43zM75.43 83.43h3.43v3.43h-3.43zM82.29 83.43h3.43v3.43h-3.43zM85.71 83.43h3.43v3.43h-3.43zM89.14 83.43h3.43v3.43h-3.43zM92.57 83.43h3.43v3.43h-3.43zM96.00 83.43h3.43v3.43h-3.43zM106.29 83.43h3.43v3.43h-3.43zM109.71 83.43h3.43v3.43h-3.43zM48.00 86.86h3.43v3.43h-3.43zM54.86 86.86h3.43v3.43h-3.43zM58.29 86.86h3.43v3.43h-3.43zM61.71 86.86h3.43v3.43h-3.43zM68.57 86.86h3.43v3.43h-3.43zM75.43 86.86h3.43v3.43h-3.43zM78.86 86.86h3.43v3.43h-3.43zM82.29 86.86h3.43v3.43h-3.43zM89.14 86.86h3.43v3.43h-3.43zM99.43 86.86h3.43v3.43h-3.43zM109.71 86.86h3.43v3.43h-3.43zM113.14 86.86h3.43v3.43h-3.43zM48.00 90.29h3.43v3.43h-3.43zM54.86 90.29h3.43v3.43h-3.43zM58.29 90.29h3.43v3.43h-3.43zM61.71 90.29h3.43v3.43h-3.43zM68.57 90.29h3.43v3.43h-3.43zM75.43 90.29h3.43v3.43h-3.43zM82.29 90.29h3.43v3.43h-3.43zM89.14 90.29h3.43v3.43h-3.43zM99.43 90.29h3.43v3.43h-3.43zM106.29 90.29h3.43v3.43h-3.43zM48.00 93.71h3.43v3.43h-3.43zM54.86 93.71h3.43v3.43h-3.43zM58.29 93.71h3.43v3.43h-3.43zM61.71 93.71h3.43v3.43h-3.43zM68.57 93.71h3.43v3.43h-3.43zM75.43 93.71h3.43v3.43h-3.43zM82.29 93.71h3.43v3.43h-3.43zM85.71 93.71h3.43v3.43h-3.43zM92.57 93.71h3.43v3.43h-3.43zM102.86 93.71h3.43v3.43h-3.43zM106.29 93.71h3.43v3.43h-3.43zM48.00 97.14h3.43v3.43h-3.43zM68.57 97.14h3.43v3.43h-3.43zM78.86 97.14h3.43v3.43h-3.43zM99.43 97.14h3.43v3.43h-3.43zM102.86 97.14h3.43v3.43h-3.43zM109.71 97.14h3.43v3.43h-3.43zM48.00 100.57h3.43v3.43h-3.43zM51.43 100.57h3.43v3.43h-3.43zM54.86 100.57h3.43v3.43h-3.43zM58.29 100.57h3.43v3.43h-3.43zM61.71 100.57h3.43v3.43h-3.43zM65.14 100.57h3.43v3.43h-3.43zM68.57 100.57h3.43v3.43h-3.43zM75.43 100.57h3.43v3.43h-3.43zM85.71 100.57h3.43v3.43h-3.43zM92.57 100.57h3.43v3.43h-3.43zM102.86 100.57h3.43v3.43h-3.43zM109.71 100.57h3.43v3.43h-3.43zM113.14 100.57h3.43v3.43h-3.43z"/>',
    '        </svg>',
  ].join('\n');

  /* クリッカーメーカー（index.html のカードと同じ絵） */
  var ART_CLICK = [
    '<svg viewBox="0 0 168 122" aria-hidden="true">',
    '          <g transform="translate(0 -5)">',
    '            <g transform="translate(0 9)">',
    '              <path class="il-soft" d="M50 60L55 24Q55.5 21 58.5 21Q84 27 109.5 21Q112.5 21 113 24L118 60Q118.4 63 115.4 63H52.6Q49.6 63 50 60Z" transform="translate(0 6)"/>',
    '              <path class="il-fill" d="M50 60L55 24Q55.5 21 58.5 21Q84 27 109.5 21Q112.5 21 113 24L118 60Q118.4 63 115.4 63H52.6Q49.6 63 50 60Z"/>',
    '              <path class="il-line" d="M50 60L55 24Q55.5 21 58.5 21Q84 27 109.5 21Q112.5 21 113 24L118 60Q118.4 63 115.4 63H52.6Q49.6 63 50 60Z"/>',
    '            </g>',
    '            <rect class="il-fill" x="54" y="86" width="60" height="24" rx="6"/>',
    '            <rect class="il-line" x="54" y="86" width="60" height="24" rx="6"/>',
    '            <rect class="il-accent" x="77" y="73" width="14" height="15" rx="1"/>',
    '            <rect class="il-fill" x="46" y="84" width="76" height="9" rx="4"/>',
    '            <rect class="il-line" x="46" y="84" width="76" height="9" rx="4"/>',
    '          </g>',
    '        </svg>',
  ].join('\n');

  /* 作れるものの見本。カードの絵を 3つ横に並べたもの */
  var ART_ALL = [
    '<svg viewBox="0 0 516 132" aria-hidden="true">',
    '  <g transform="translate(4 5)">'   + innerOf(ART_PLATE) + '</g>',
    '  <g transform="translate(174 5)">' + innerOf(ART_QR)    + '</g>',
    '  <g transform="translate(344 5)">' + innerOf(ART_CLICK) + '</g>',
    '</svg>',
  ].join(String.fromCharCode(10));

  /* ── 中身 ───────────────────────────────────────
     ★もとの文は **漢字で書く**。ひらがなに開くのは kana.js の仕事なので、
       ここで先にひらがなで書くと、漢字ビューでも ひらがなのままになる。
     ★漢字を足したら npm run check:kana を通すこと。 */
  var PAGES = [
    { t: 'ZEROモデリング', art: ART_ALL,
      h: 'ブラウザだけで、3Dプリンターのデータが作れます',
      lead: 'アプリのインストールも、CADの知識もいりません。'
          + '作ったデータは この端末の中だけで作られ、どこにも送信されません。',
      li: [['選ぶ', '作りたいものを、トップの3つから選ぶ'],
           ['作る', 'ステップに沿って進めるだけ。3Dですぐ見える'],
           ['保存', 'STL または 3MF でダウンロード'],
           ['印刷', 'スライサー（Bambu Studio など）に入れて3Dプリント']] },

    { t: 'なまえプレート', art: ART_PLATE,
      h: '好きな形の土台に、名前をのせます',
      lead: '土台は 四角・丸・ハート・猫 など たくさん。2色プリントにもできます。',
      li: [['土台を選ぶ', '形と大きさを決める'],
           ['名前を入れる', 'ひらがな・カタカナ・英数字・記号が使える'],
           ['見た目を整える', 'フォント／文字の大きさ／線の太さ／色'],
           ['穴をつける', 'キーリングを通す穴の場所を選ぶ'],
           ['保存', '3MF（2色）か STL でダウンロード']] },

    { t: 'QRキーホルダー', art: ART_QR,
      h: 'URLを入れると、QRコードのキーホルダーになります',
      lead: '作ったQRは、その場でスマホで読み取って試せます。'
          + '誤り訂正は いちばん強い H で固定してあります。',
      li: [['形', 'キーホルダー（磁石でQRが外せる）か スタンド'],
           ['中身', '面ごとに QR／ロゴ／なし。QRの面にだけURLを入れる'],
           ['大きさ', '一辺のほか、厚み・磁石・QRの深さも選べる'],
           ['色', '面ごとに色を決める（2色で刷ると いちばん読みやすい）'],
           ['保存', '3MF（多色）・STL・PNG']] },

    { t: 'クリッカーメーカー', art: ART_CLICK,
      h: '3Dモデルを、カチカチ押せる上下2つのパーツにします',
      lead: 'キースイッチ（Cherry MX 規格対応）が中に入ります。'
          + 'モデルが手もとに無ければ、その場で作ることもできます。',
      li: [['モデルを入れる', 'STL / 3MF / GLB を読みこむ。無ければ「モデルを作る」'],
           ['作りを選ぶ', 'タイプ1（溝で落としこむ）／タイプ2（平面で切る）／下パーツ生成'],
           ['形を作る', '大きさ・溝・クリッカーの位置・十字の穴を決める'],
           ['確かめる', 'プレビューで押して、カチッと沈むのを見る'],
           ['書き出し', '部品ごとに STL、または1つの 3MF']] },
  ];

  var at = 0, veil = null, sheet = null;

  /* ★いま開いているページに合う説明を、はじめに出す。
       どのアプリでも1ページ目（ぜんたいの話）から始まると、
       自分の使っているものを 毎回さがすことになる。
     ★ファイル名で見分ける。スタート画面（index）は 0ページ目のまま。 */
  function appPage() {
    var f = (location.pathname.split('/').pop() || '').toLowerCase();
    if (f.indexOf('nameplate') === 0) return 1;
    if (f.indexOf('qr') === 0) return 2;
    if (f.indexOf('clicker') === 0) return 3;
    return 0;
  }

  function render() {
    var p = PAGES[at];
    sheet.querySelector('.hp-title').textContent = p.t;
    sheet.querySelector('.hp-art').innerHTML = p.art;
    sheet.querySelector('.hp-h').textContent = p.h;
    sheet.querySelector('.hp-lead').textContent = p.lead;
    sheet.querySelector('.hp-list').innerHTML = p.li.map(function (x, i) {
      return '<li><i>' + (i + 1) + '</i><span><b>' + x[0] + '</b>' + x[1] + '</span></li>';
    }).join('');
    var dots = sheet.querySelectorAll('.hp-dot');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === at);
    sheet.querySelector('.hp-prev').disabled = at === 0;
    sheet.querySelector('.hp-next').disabled = at === PAGES.length - 1;
    sheet.querySelector('.hp-wrap').scrollTop = 0;
  }

  function go(n) {
    at = Math.max(0, Math.min(PAGES.length - 1, n));
    render();
  }
  function open() {
    at = appPage();
    veil.classList.add('open'); sheet.classList.add('open'); render();
  }
  function close() { veil.classList.remove('open'); sheet.classList.remove('open'); }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    veil = document.createElement('div');
    veil.className = 'hp-veil';
    veil.onclick = close;
    document.body.appendChild(veil);

    sheet = document.createElement('div');
    sheet.className = 'hp-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML =
      '<div class="hp-top"><b class="hp-title"></b>'
      + '  <button class="hp-x" type="button" aria-label="とじる">✕</button></div>'
      + '<div class="hp-wrap">'
      + '  <div class="hp-body">'
      + '    <div class="hp-art"></div>'
      + '    <div><p class="hp-h"></p><p class="hp-lead"></p><ul class="hp-list"></ul></div>'
      + '  </div>'
      + '</div>'
      + '<div class="hp-foot">'
      + '  <button class="hp-arrow hp-prev" type="button" aria-label="前のページ">◀</button>'
      + '  <button class="hp-arrow hp-next" type="button" aria-label="次のページ">▶</button>'
      + '</div>';
    document.body.appendChild(sheet);

    /* 三角と点は いつも板の下の列。ひろい画面でも動かさない */
    var foot = sheet.querySelector('.hp-foot');
    foot.appendChild(sheet.querySelector('.hp-prev'));
    for (var i = 0; i < PAGES.length; i++) {
      var d = document.createElement('button');
      d.className = 'hp-dot';
      d.type = 'button';
      d.setAttribute('aria-label', (i + 1) + 'ページ目');
      d.onclick = (function (n) { return function () { go(n); }; })(i);
      foot.appendChild(d);
    }
    foot.appendChild(sheet.querySelector('.hp-next'));
    /* 読む順も この並び（前 → 点 → 次）。 */

    /* ★指で横になぞってめくる（スマホ）。**指について紙が動く**。
         ・たてになぞったときは 何もしない（|よこ| > |たて| で見分ける）
         ・マウスは対象外。押しながら動かすのは「文字を選ぶ」動きなので、
           そちらを取りあげると PCで説明を読み写せなくなる
         ・ボタンの上から始まったときは、そのボタンの仕事にする
         ・はしのページで さらに はらったときは、少しだけ動いて戻る
           （「これ以上ない」ことが 手で分かる） */
    var swipe = null;
    var paper = sheet.querySelector('.hp-wrap');
    var body = function () { return sheet.querySelector('.hp-body'); };

    /* dx だけ横へずらす。smooth=true で すべって戻る */
    function slide(dx, smooth) {
      var b = body();
      b.style.transition = smooth ? 'transform .22s ease, opacity .22s ease' : 'none';
      b.style.transform = 'translateX(' + dx + 'px)';
      b.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 420));
    }
    function clear() {
      var b = body();
      b.style.transition = '';
      b.style.transform = '';
      b.style.opacity = '';
    }

    paper.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' || e.target.closest('button')) { swipe = null; return; }
      swipe = { x: e.clientX, y: e.clientY, on: false };
    });
    paper.addEventListener('pointermove', function (e) {
      if (!swipe) return;
      var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      /* 横に動かす気だと分かってから 追いかける。それまでは何もしない */
      if (!swipe.on) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        swipe.on = true;
        paper.setPointerCapture && paper.setPointerCapture(e.pointerId);
      }
      /* はしのページは 手ごたえを重くして、それ以上いかないことを見せる */
      var edge = (dx > 0 && at === 0) || (dx < 0 && at === PAGES.length - 1);
      slide(edge ? dx * 0.25 : dx, false);
    });
    function release(e) {
      if (!swipe) return;
      var on = swipe.on, dx = e.clientX - swipe.x;
      swipe = null;
      if (!on) return;
      var w = paper.clientWidth || 1;
      var far = Math.abs(dx) >= Math.min(70, w * 0.18);
      var next = dx < 0 ? at + 1 : at - 1;
      if (far && next >= 0 && next < PAGES.length) {
        go(next);                                   /* 中身だけ入れかわる */
        /* 入ってきたページを 反対がわから すべりこませる */
        slide(dx < 0 ? w * 0.3 : -w * 0.3, false);
        requestAnimationFrame(function () { slide(0, true); });
      } else {
        slide(0, true);                             /* もとの場所へ戻す */
      }
    }
    paper.addEventListener('pointerup', release);
    paper.addEventListener('pointercancel', function () { swipe = null; clear(); });

    sheet.querySelector('.hp-x').onclick = close;
    sheet.querySelector('.hp-prev').onclick = function () { go(at - 1); };
    sheet.querySelector('.hp-next').onclick = function () { go(at + 1); };

    var btn = document.createElement('button');
    btn.className = 'help-btn';
    btn.type = 'button';
    btn.textContent = '？';
    btn.title = '使いかた';
    btn.setAttribute('aria-label', '使いかた');
    btn.setAttribute('data-no-kana', '');
    btn.onclick = open;

    /* ★ヘッダーがあれば その右はしへ。スタート画面には無いので、
         右上の帯（#e3c-floatbar）に入れる。並ぶ順は order まかせ。 */
    var head = document.querySelector('header');
    if (head) head.appendChild(btn);
    else floatBar().appendChild(btn);

    document.addEventListener('keydown', function (e) {
      if (!sheet.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(at - 1);
      else if (e.key === 'ArrowRight') go(at + 1);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
