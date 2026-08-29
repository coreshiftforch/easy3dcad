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

    /* 板にとめた名ふだ。上のまん中の丸が 画びょう */
    '.hp-top{position:relative;flex:none;display:flex;align-items:center;gap:10px;',
    '  background:var(--c-panel,#1e293b);border:1px solid var(--c-line,#334155);',
    '  border-radius:12px;padding:9px 10px 9px 18px;',
    '  box-shadow:0 3px 8px rgba(0,0,0,.22);}',
    '.hp-top::before{content:"";position:absolute;left:50%;top:-7px;',
    '  width:13px;height:13px;margin-left:-6.5px;border-radius:50%;',
    '  background:var(--c-accent2,#3b82f6);box-shadow:0 2px 4px rgba(0,0,0,.4);}',
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
    '@media (max-width:700px){.hp-wrap{padding:14px;}}',

    '.hp-body{display:grid;gap:18px;grid-template-columns:1fr;align-items:center;}',
    '@media (min-width:720px){.hp-body{grid-template-columns:320px 1fr;gap:28px;}}',
    '.hp-art{background:var(--c-panel2,#0f172a);border:1px solid var(--c-line,#334155);',
    '  border-radius:16px;padding:14px;display:grid;place-items:center;}',
    '.hp-art svg{width:100%;height:auto;max-height:220px;}',
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
  ].join('\n');

  /* ── 絵 ─────────────────────────────────────────
     色は3つだけ。地＝--c-panel、線＝--c-text（うすめ）、目だつところ＝--c-accent2 */
  var A = 'var(--c-accent2,#3b82f6)', L = 'var(--c-text,#f1f5f9)', F = 'var(--c-panel,#1e293b)';
  function svg(inner) {
    return '<svg viewBox="0 0 260 170" role="img" aria-hidden="true">'
      + '<g fill="none" stroke="' + L + '" stroke-width="2.4" stroke-linejoin="round" '
      + 'stroke-linecap="round" opacity=".85">' + inner + '</g></svg>';
  }

  /* ぜんたい：3つからえらぶ → 立体 → ファイル → プリンター */
  var ART_ALL = svg(
    '<rect x="10" y="46" width="34" height="44" rx="7"/>'
    + '<rect x="48" y="46" width="34" height="44" rx="7"/>'
    + '<rect x="86" y="46" width="34" height="44" rx="7"/>'
    + '<g fill="' + A + '" stroke="none"><rect x="18" y="56" width="18" height="4" rx="2"/>'
    + '<rect x="56" y="56" width="18" height="4" rx="2"/><rect x="94" y="56" width="18" height="4" rx="2"/></g>'
    + '<path d="M128 68h18m-6-6 6 6-6 6"/>'
    + '<path d="M172 40l24 13v27l-24 13-24-13V53z"/><path d="M148 53l24 13 24-13M172 66v27"/>'
    + '<path d="M206 68h18m-6-6 6 6-6 6"/>'
    + '<rect x="228" y="52" width="26" height="34" rx="4"/>'
    + '<path d="M234 62h14M234 70h14M234 78h9"/>'
    + '<rect x="88" y="112" width="84" height="30" rx="6"/>'
    + '<path d="M104 112v-10h52v10"/><g fill="' + A + '" stroke="none">'
    + '<rect x="104" y="122" width="52" height="10" rx="3"/></g>');

  /* なまえプレート */
  var ART_PLATE = svg(
    '<rect x="42" y="46" width="176" height="86" rx="20" fill="' + F + '"/>'
    + '<circle cx="130" cy="34" r="11"/>'
    + '<g fill="' + A + '" stroke="none">'
    + '<rect x="72" y="76" width="14" height="30" rx="4"/>'
    + '<rect x="96" y="66" width="14" height="40" rx="4"/>'
    + '<rect x="120" y="80" width="14" height="26" rx="4"/>'
    + '<rect x="144" y="70" width="14" height="36" rx="4"/>'
    + '<rect x="168" y="78" width="14" height="28" rx="4"/></g>'
    + '<path d="M60 118h140" opacity=".4"/>');

  /* QRキーホルダー：ふだと、よみとるスマホ */
  var ART_QR = svg(
    '<rect x="26" y="40" width="104" height="100" rx="18" fill="' + F + '"/>'
    + '<circle cx="78" cy="30" r="9"/>'
    + '<g fill="' + A + '" stroke="none">'
    + '<rect x="42" y="56" width="20" height="20" rx="4"/><rect x="94" y="56" width="20" height="20" rx="4"/>'
    + '<rect x="42" y="104" width="20" height="20" rx="4"/>'
    + '<rect x="70" y="58" width="8" height="8"/><rect x="80" y="70" width="8" height="8"/>'
    + '<rect x="70" y="82" width="8" height="8"/><rect x="94" y="86" width="8" height="8"/>'
    + '<rect x="70" y="106" width="8" height="8"/><rect x="94" y="110" width="8" height="8"/>'
    + '<rect x="108" y="98" width="8" height="8"/></g>'
    + '<g fill="' + F + '" stroke="none">'
    + '<rect x="47" y="61" width="10" height="10" rx="2"/><rect x="99" y="61" width="10" height="10" rx="2"/>'
    + '<rect x="47" y="109" width="10" height="10" rx="2"/></g>'
    + '<rect x="168" y="34" width="68" height="112" rx="12"/>'
    + '<path d="M190 44h24"/>'
    + '<g stroke="' + A + '"><path d="M186 82h34M186 96h34M203 74v34"/></g>'
    + '<path d="M140 90h18m-6-6 6 6-6 6"/>');

  /* クリッカー：上下2つに分かれて、スイッチが入る */
  /* クリッカー：キャップをはめた形。スタート画面の絵と同じ形にそろえてある
     （まん中の青い棒が スイッチの軸。ここで上下がつながっている）
     ★十字は上から見たときの形。横から見た絵なので、軸は角柱で描く */
  var ART_CLICK = svg(
    '<path d="M82.4 83.6L89.4 33.2Q90.1 29 94.3 29Q130 37.4 165.7 29Q169.9 29 170.6 33.2'
    + 'L177.6 83.6Q178.2 87.8 174 87.8H86Q81.8 87.8 82.4 83.6Z" fill="' + F + '"/>'
    + '<rect x="88" y="107.4" width="84" height="33.6" rx="8.4" fill="' + F + '"/>'
    + '<g fill="' + A + '" stroke="none">'
    + '<rect x="120.2" y="89.2" width="19.6" height="21" rx="1.4"/></g>'
    + '<rect x="76.8" y="104.6" width="106.4" height="12.6" rx="5.6" fill="' + F + '"/>'
    + '<path d="M130 8v13m-15-9 5 9m25-9-5 9" opacity=".55"/>');

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
      lead: 'キースイッチ（Cherry MX 互換）が中に入ります。'
          + 'モデルが手もとに無ければ、その場で作ることもできます。',
      li: [['モデルを入れる', 'STL / 3MF / GLB を読みこむ。無ければ「モデルを作る」'],
           ['作りを選ぶ', 'タイプ1（溝で落としこむ）／タイプ2（平面で切る）／下パーツ生成'],
           ['形を作る', '大きさ・溝・クリッカーの位置・十字の穴を決める'],
           ['確かめる', 'プレビューで押して、カチッと沈むのを見る'],
           ['書き出し', '部品ごとに STL、または1つの 3MF']] },
  ];

  var at = 0, veil = null, sheet = null;

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
  function open() { veil.classList.add('open'); sheet.classList.add('open'); render(); }
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
