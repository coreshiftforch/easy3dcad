/* ══════════════════════════════════════════════════════════════
   右上のボタンを しまう（なまえプレート／QR／クリッカーの3ページ）

   スマホでは ヘッダーが せまく、右上のボタン（あかるさ・？・ひらがな）が
   題や中身と ぶつかる。そこで **画面の外に出しておいて**、右はしの
   ◀ を押したときだけ 滑り出てくるようにする。

   ── 決めごと ─────────────────────────────────────────
   ★このファイルだけで完結させる。help.js と同じ流儀。
     ページ側は このファイルを読む1行だけ。**いちばん後ろ**に読むこと
     （theme.js・help.js・kana.js が ボタンを足しおわってから動くため）。
   ★ヘッダーが無いページ（スタート画面）では なにもしない。
     あちらは #e3c-floatbar で もともと右上に浮いている。
   ★ひろい画面では **今までと まったく同じ**。入れものを
     display:contents にして、ボタンがヘッダーの直下の子のまま
     並ぶようにしている（margin-left:auto の効き方も変わらない）。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CSS = [
    /* ★ひろい画面では 入れものが「無いのと同じ」になる。
         こうしないと、ひらがなボタンの margin-left:auto が
         入れものの中で効いてしまい、右はしに寄らなくなる */
    '.tb-rail{display:contents;}',
    '.tb-tab{display:none;}',

    '@media (max-width:720px){',
    '  .tb-rail{display:flex;align-items:center;gap:8px;',
    '    position:fixed;top:9px;right:0;z-index:25;',
    '    padding:5px 10px 5px 4px;',
    '    background:var(--c-panel,#1e293b);',
    '    border:1px solid var(--c-line,#334155);border-right:0;',
    '    border-radius:999px 0 0 999px;',
    '    box-shadow:0 8px 22px rgba(0,0,0,.28);',
    /* しまっているとき … ◀ のぶん（40px）だけ 見せて、あとは画面の外 */
    '    transform:translateX(calc(100% - 40px));',
    '    transition:transform .28s cubic-bezier(.22,.9,.3,1);}',
    '  .tb-rail.open{transform:none;}',
    '  .tb-rail .kana-toggle{margin-left:0;font-size:12.5px;padding:8px 11px;}',
    '  .tb-rail .theme-btn,.tb-rail .help-btn{width:34px;height:34px;}',
    '  .tb-rail .theme-btn svg{width:18px;height:18px;}',
    '  .tb-rail .help-btn{font-size:15px;}',
    '  .tb-tab{display:grid;place-items:center;flex:none;',
    '    width:34px;height:34px;border-radius:50%;padding:0;',
    '    border:1px solid var(--c-line,#334155);background:var(--c-panel2,#0f172a);',
    '    color:var(--c-muted,#94a3b8);font:inherit;font-size:12px;cursor:pointer;}',
    '  .tb-tab:hover{color:var(--c-accent2,#3b82f6);border-color:var(--c-accent2,#3b82f6);}',
    '}',
  ].join('\n');

  function build() {
    var head = document.querySelector('header');
    if (!head) return;                       /* スタート画面は なにもしない */

    var btns = head.querySelectorAll('.theme-btn, .help-btn, .kana-toggle');
    if (!btns.length) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var rail = document.createElement('div');
    rail.className = 'tb-rail';

    var tab = document.createElement('button');
    tab.className = 'tb-tab';
    tab.type = 'button';
    tab.textContent = '◀';
    tab.title = 'ボタンを出す';
    tab.setAttribute('aria-label', 'ボタンを出す');
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('data-no-kana', '');
    rail.appendChild(tab);

    /* ★ヘッダーに並んでいた順のまま 入れものへ移す */
    for (var i = 0; i < btns.length; i++) rail.appendChild(btns[i]);
    head.appendChild(rail);

    function set(open) {
      rail.classList.toggle('open', open);
      tab.textContent = open ? '▶' : '◀';
      tab.title = open ? 'ボタンをしまう' : 'ボタンを出す';
      tab.setAttribute('aria-label', tab.title);
      tab.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    tab.onclick = function (e) {
      e.stopPropagation();
      set(!rail.classList.contains('open'));
    };

    /* よそを押したら しまう。中のボタンを押したときは そのまま */
    document.addEventListener('click', function (e) {
      if (rail.classList.contains('open') && !rail.contains(e.target)) set(false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
