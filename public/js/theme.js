/* ══════════════════════════════════════════════════════════════
   あかるい／くらい の切りかえ（4ページ共通）

   ★ふだんは **あかるい（ライト）**。押すと くらく（ダーク）なる。
     えらんだ状態は localStorage に残るので、ページをまたいでも保たれる。

   しくみは <html> に data-theme="dark" を付けるだけ。
   色の値は public/css/tokens.css が持っていて、
   :root と :root[data-theme="dark"] で まるごと入れかわる。

   ★このファイルは <head> のいちばん上で読むこと。
     body より後ろで読むと、いちど あかるい姿が出てから暗くなって
     画面がチカッとする（フラッシュ）。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'easy3dcad-theme';

  function get() {
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
    catch (e) { return 'light'; }        // 使えない設定のブラウザ
  }
  function apply(v) {
    if (v === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }

  /* ★まず色を当てる。ボタンを作るのは body ができてから */
  apply(get());

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    + ' stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/>'
    + '<path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8'
    + 'M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    + ' stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';

  function build() {
    var style = document.createElement('style');
    style.textContent = [
      '.theme-btn{flex:none;width:34px;height:34px;border-radius:50%;display:grid;',
      '  place-items:center;border:1px solid var(--c-line,#cbd5e1);',
      '  background:var(--c-panel2,#f4f7fb);color:var(--c-muted,#5b6b80);',
      '  font:inherit;cursor:pointer;}',
      '.theme-btn svg{width:17px;height:17px;}',
      '.theme-btn:hover{color:var(--c-accent2,#1d4ed8);border-color:var(--c-accent2,#1d4ed8);}',
      '.theme-btn-float{position:fixed;top:14px;right:174px;z-index:20;}',
    ].join('\n');
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    btn.setAttribute('data-no-kana', '');

    function paint() {
      var dark = get() === 'dark';
      btn.innerHTML = dark ? SUN : MOON;
      btn.title = dark ? 'あかるくする' : 'くらくする';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    }
    btn.onclick = function () {
      var next = get() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* 使えなくても動く */ }
      apply(next);
      paint();
    };
    paint();

    /* ★ヘッダーがあれば その右はしへ。トップページには無いので浮かせる。
         ならぶ順は 左から「？」「あかるさ」「ひらがな」。 */
    var head = document.querySelector('header');
    if (head) head.appendChild(btn);
    else { btn.classList.add('theme-btn-float'); document.body.appendChild(btn); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
