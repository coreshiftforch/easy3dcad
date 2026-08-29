/* ══════════════════════════════════════════════════════════════
   説明を「情報」にたたむ（4ページ共通）

   つまみの下に書いてある説明を、フローごとに1つの「▶ 情報」へ
   まとめる。はじめは閉じていて、押すと開く。

   ── 使いかた ────────────────────────────────────────────
     FoldInfo.apply(box);       // box の中の説明を1つにまとめる
     // 何度呼んでもよい。あとから足された説明も拾って入れ直す。

   ── 決めごと ─────────────────────────────────────────
   ★このファイルだけで完結させる（見た目も中身も）。help.js と同じ流儀。
   ★たたむのは **そういうものです という説明** だけ。
     「うすいので彫る深さを変えました」「⚠ 読み取れないおそれ」のような
     **その場で直してほしい知らせ**は、たたんではいけない。
     残したいものには data-keep を付けること。
   ★中身は動かすだけで、作り直さない。アプリが
     document.querySelector('.parts').textContent = … のように
     名前で書きかえているので、**同じ節点のまま**でないと止まる。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* 説明として扱う名前。3ページで書き方がちがうので ぜんぶ見る */
  var PICK = '.note, .hint-line, .info';

  var CSS = [
    '.foldinfo{margin-top:10px;border:1px solid var(--c-line,#334155);',
    '  border-radius:10px;background:var(--c-panel2,#0f172a);}',
    '.foldinfo > summary{list-style:none;cursor:pointer;user-select:none;',
    '  display:flex;align-items:center;gap:7px;padding:9px 12px;',
    '  font-size:13px;font-weight:bold;color:var(--c-muted,#94a3b8);}',
    '.foldinfo > summary::-webkit-details-marker{display:none;}',
    /* 閉じているときは右向き、開くと下向きになる三角 */
    '.foldinfo > summary::before{content:"\\25B6";font-size:10px;transition:transform .15s;}',
    '.foldinfo[open] > summary::before{transform:rotate(90deg);}',
    '.foldinfo > summary:hover{color:var(--c-text,#f1f5f9);}',
    '.fi-body{padding:0 12px 11px;display:grid;gap:8px;}',
    '.fi-body > *{margin:0;}',
    /* 中で「無いときは出さない」ものが空のままだと、すき間だけ残る */
    '.fi-body > :empty{display:none;}',
  ].join('\n');

  /* ★読みこんだ時点で入れておく。apply() のときに入れると、
       save.js（さいごの画面）のように **自分で details を建てる側** が
       まだ apply を呼んでいないとき、三角も地の色も付かない。 */
  (function style() {
    var el = document.createElement('style');
    el.textContent = CSS;
    (document.head || document.documentElement).appendChild(el);
  })();

  function foldOf(box) {
    var d = box.querySelector(':scope > details.foldinfo');
    if (d) return d;
    d = document.createElement('details');
    d.className = 'foldinfo';
    d.innerHTML = '<summary>情報</summary><div class="fi-body"></div>';
    return d;
  }

  window.FoldInfo = {
    apply: function (box) {
      if (!box) return null;

      /* まだ入れていない説明を、書いてある順のまま集める */
      var found = [];
      var all = box.querySelectorAll(PICK);
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        if (n.hasAttribute('data-keep')) continue;   /* 知らせは たたまない */
        if (n.closest('.fi-body')) continue;         /* もう入っている */
        found.push(n);
      }

      var d = foldOf(box);
      var body = d.querySelector('.fi-body');
      for (var k = 0; k < found.length; k++) body.appendChild(found[k]);

      /* 1つも無ければ、たたみ自体を出さない */
      if (!body.children.length) { if (d.parentNode) d.remove(); return null; }
      /* ★いつも いちばん下へ。あとから中身が増えても 位置がぶれない */
      box.appendChild(d);
      return d;
    },
  };
})();
