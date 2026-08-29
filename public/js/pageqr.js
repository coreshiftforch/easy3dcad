/* ══════════════════════════════════════════════════════════════
   このページのQR（スタート画面）

   右上の「？」のとなりに QRのボタンを置く。押すと、いま見ている
   ページの住所をQRにして出す。スマホのカメラで読みとれば、
   同じページが スマホで開く。

   ── 決めごと ─────────────────────────────────────────
   ★このファイルだけで完結させる（見た目も中身も）。help.js と同じ流儀。
     ページ側は このファイルを読む1行だけ。
     ★書きかたは index.html を見ること。ここに道を書きうつさない
       （public/ の中の文字は Vite が書きかえないので、check:paths が
        ルートから始まる道として拾ってしまう）。
     ただし先に vendor/qrcode-generator-1.4.4.js を読んでおくこと。
   ★QRは **白地に黒** で焼きこまれる（vendor の createSvgTag が
     そう作る）。あかるい／くらい どちらの画面でも読みとれる。
   ★もとの文は漢字で書く。ひらがなに開くのは kana.js の仕事。
   ★並ぶ順は order。あかるさ=1／？=2／QR=3／ひらがな=4。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ヘッダーが無いページ用の、右上の帯（theme.js・help.js と同じもの）。
     先に作られていれば それを使う。 */
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
    '.pq-veil{position:fixed;inset:0;z-index:62;background:rgba(0,0,0,.45);',
    '  opacity:0;pointer-events:none;transition:opacity .2s;}',
    '.pq-veil.open{opacity:1;pointer-events:auto;}',

    /* ボタンの下から、ふわっと出てくる小さな ふだ */
    '.pq-panel{position:fixed;top:74px;right:14px;z-index:63;width:252px;',
    '  box-sizing:border-box;padding:14px;',
    '  background:var(--c-panel,#1e293b);border:1px solid var(--c-line,#334155);',
    '  border-radius:16px;color:var(--c-text,#f1f5f9);',
    '  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Meiryo",system-ui,sans-serif;',
    '  box-shadow:0 18px 40px rgba(0,0,0,.40);',
    '  opacity:0;transform:translateY(-10px) scale(.96);transform-origin:100% 0;',
    '  pointer-events:none;transition:opacity .18s,transform .18s;}',
    '.pq-panel.open{opacity:1;transform:none;pointer-events:auto;}',
    '@media (max-width:700px){.pq-panel{right:10px;left:10px;width:auto;max-width:300px;',
    '  margin-left:auto;}}',

    '.pq-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;}',
    '.pq-head b{font-size:14.5px;}',
    '.pq-x{margin-left:auto;width:28px;height:28px;border-radius:50%;',
    '  border:1px solid var(--c-line,#334155);background:var(--c-panel2,#0f172a);',
    '  color:var(--c-muted,#94a3b8);font:inherit;font-size:13px;cursor:pointer;}',
    '.pq-x:hover{color:var(--c-text,#f1f5f9);border-color:var(--c-accent2,#3b82f6);}',

    /* ★ここだけ白を直に書く。QRは白地に黒でないと読みとれないので、
         あかるさの切りかえに つられてはいけない */
    '.pq-code{background:#fff;border-radius:10px;padding:8px;line-height:0;}',
    '.pq-code svg{width:100%;height:auto;display:block;}',

    '.pq-lead{margin:10px 0 0;font-size:12px;line-height:1.75;',
    '  color:var(--c-muted,#94a3b8);}',
    '.pq-url{margin-top:6px;font-size:10.5px;line-height:1.5;',
    '  color:var(--c-muted,#94a3b8);word-break:break-all;user-select:text;}',
    '.pq-warn{display:none;margin-top:9px;font-size:11.5px;line-height:1.7;',
    '  background:var(--c-warn-bg,#251c0a);color:var(--c-warn3,#fde68a);',
    '  border-radius:9px;padding:7px 9px;}',

    /* 「？」のとなりのボタン */
    '.pq-btn{flex:none;width:37px;height:37px;border-radius:50%;padding:0;',
    '  border:1px solid var(--c-line,#334155);background:var(--c-panel2,#0f172a);',
    '  color:var(--c-muted,#94a3b8);font:inherit;cursor:pointer;',
    '  display:grid;place-items:center;}',
    '.pq-btn svg{width:19px;height:19px;}',
    '.pq-btn:hover{color:var(--c-accent2,#3b82f6);border-color:var(--c-accent2,#3b82f6);}',
    /* スタート画面（浮かせるとき）は ひとまわり大きく */
    '#e3c-floatbar .pq-btn{order:3;width:46px;height:46px;}',
    '#e3c-floatbar .pq-btn svg{width:24px;height:24px;}',
    /* ★スマホでは ひとまわり小さく（帯が題と重なるため） */
    '@media (max-width:720px){#e3c-floatbar .pq-btn{width:40px;height:40px;}',
    '  #e3c-floatbar .pq-btn svg{width:21px;height:21px;}}',
  ].join('\n');

  /* QRのボタンの絵。3つの角の四角と、こまかい点 */
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="3" y="3" width="7" height="7" rx="1.6"/>'
    + '<rect x="14" y="3" width="7" height="7" rx="1.6"/>'
    + '<rect x="3" y="14" width="7" height="7" rx="1.6"/>'
    + '<path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 21h1M21 14h0"/></svg>';

  var veil = null, panel = null, drawn = false;

  /* いまのページの住所をQRにする。開いたときに1度だけ作る */
  function draw() {
    if (drawn) return;
    var url = location.href;
    var box = panel.querySelector('.pq-code');
    try {
      var qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      drawn = true;
    } catch (e) {
      box.innerHTML = '';
      panel.querySelector('.pq-lead').textContent = 'QRを作れませんでした。下の住所を打ちこんでください。';
    }
    panel.querySelector('.pq-url').textContent = url;

    /* ★localhost や file: は この端末の中だけの住所。
         スマホで読みとっても そのスマホの中を見にいくので、開けない */
    var host = location.hostname;
    var local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
      || location.protocol === 'file:';
    panel.querySelector('.pq-warn').style.display = local ? 'block' : 'none';
  }

  function open() { draw(); veil.classList.add('open'); panel.classList.add('open'); }
  function close() { veil.classList.remove('open'); panel.classList.remove('open'); }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    veil = document.createElement('div');
    veil.className = 'pq-veil';
    veil.onclick = close;
    document.body.appendChild(veil);

    panel = document.createElement('div');
    panel.className = 'pq-panel';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML =
      '<div class="pq-head"><b>スマホで開く</b>'
      + '  <button class="pq-x" type="button" aria-label="とじる">✕</button></div>'
      + '<div class="pq-code"></div>'
      + '<p class="pq-lead">スマホのカメラで これを読みとると、同じページが スマホで開きます。</p>'
      + '<div class="pq-url" data-no-kana></div>'
      /* ★「開けません」と書くと ひらがなで「あけません」になる（戸を開ける の読み）。
           言いかえて にげている */
      + '<div class="pq-warn">この住所は パソコンの中だけのものなので、'
      + 'スマホからは 開くことができません。</div>';
    document.body.appendChild(panel);
    panel.querySelector('.pq-x').onclick = close;

    var btn = document.createElement('button');
    btn.className = 'pq-btn';
    btn.type = 'button';
    btn.innerHTML = ICON;
    btn.title = 'スマホで開く';
    btn.setAttribute('aria-label', 'スマホで開く');
    btn.setAttribute('data-no-kana', '');
    btn.onclick = function () {
      if (panel.classList.contains('open')) close(); else open();
    };

    /* ★ヘッダーがあれば その右はしへ。スタート画面には無いので、
         右上の帯（#e3c-floatbar）に入れる。並ぶ順は order まかせ。 */
    var head = document.querySelector('header');
    if (head) head.appendChild(btn);
    else floatBar().appendChild(btn);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
