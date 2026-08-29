/* ══════════════════════════════════════════════════════════════
   フィラメントの色（なまえプレート・QRキーホルダー 共通）

   前は 2つのページが **べつべつの一覧** を持っていて、同じ「水色」でも
   ちがう色が出ていた（#00b1b7 と #2ea7e0）。刷るのは同じフィラメントなので、
   ここ1か所にまとめてある。tokens.css が画面の色を1か所にまとめているのと
   同じ考えかた。

   ── 使いかた ────────────────────────────────────────────
     <script src="./js/filaments.js"></script>   ← 本文より先に読む
     const FILAMENTS = window.FILAMENTS;

   ── 決めごと ─────────────────────────────────────────
   ★色は **Bambu Lab 純正 PLA Basic の公式hex**。
     使用プリンター: Bambu Lab P1S / 純正フィラメント。
     ★黄だけは公式hexが手もとに無いので、QRキーホルダーで使っていた値を
       そのまま置いている（見た目を合わせるためのもの）。
   ★色は hex そのもので覚える（何番目か では覚えない）。
     並びを変えても、保存したものの色がずれない。
   ★short は 1文字。なまえプレートが ファイル名に使う（例 たろう_名白_土灰）。
   ══════════════════════════════════════════════════════════════ */
window.FILAMENTS = [
  { name: '黒',       short: '黒', hex: 0x000000 },  // Black
  { name: '白',       short: '白', hex: 0xffffff },  // Jade White
  { name: '灰色',     short: '灰', hex: 0x8e9089 },  // Gray
  { name: '水色',     short: '水', hex: 0x00b1b7 },  // Turquoise
  { name: 'ピンク',   short: '桃', hex: 0xf5547c },  // Hot Pink
  { name: 'オレンジ', short: '橙', hex: 0xff6a13 },  // Orange
  { name: '緑',       short: '緑', hex: 0x00ae42 },  // Bambu Green
  { name: '黄色',     short: '黄', hex: 0xf5cf3d },  // ★公式hexではない（上の決めごと）
];

/* ══════════════════════════════════════════════════════════════
   「その他の色」… OSのカラーパネルから 好きな色を選ぶ

     const b = FilamentPicker.other(cls, () => state.col, hex => { … });
     box.appendChild(b);
     b.paint();     // 外から色を変えたときは これを呼ぶ

   ★見た目は 色見本と同じ丸／四角。中身に input[type=color] を
     透明で重ねてあるので、**どこを押しても** カラーパネルが開く。
     JS から click() を呼ぶやり方は、ブラウザによっては はじかれる。
   ★えらんでいる途中（つまみを動かすたび）にも知らせる。
     立体の色がその場で変わるので、選びやすい。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var hexStr = function (h) { return '#' + h.toString(16).padStart(6, '0'); };
  /* 一覧の色でないとき（＝自分で選んだ色）は、その色そのものを見本に出す。
     まだのときは 虹色にして「ここから好きな色が選べる」と分かるようにする */
  var RAINBOW = 'conic-gradient(#f5547c,#ff6a13,#f5cf3d,#00ae42,#00b1b7,#4b6bff,#a855f7,#f5547c)';

  var style = document.createElement('style');
  style.textContent = [
    '.fp-other{position:relative;overflow:hidden;}',
    /* 透明の input を ボタンいっぱいに重ねる。押した場所が そのまま
       カラーパネルを開く操作になる */
    '.fp-other input[type=color]{position:absolute;inset:0;width:100%;height:100%;',
    '  margin:0;padding:0;border:0;background:none;opacity:0;cursor:pointer;}',
  ].join(String.fromCharCode(10));
  (document.head || document.documentElement).appendChild(style);

  window.FilamentPicker = {
    /* 一覧に無い色か（＝自分で選んだ色か） */
    isOther: function (hex) {
      return !window.FILAMENTS.some(function (f) { return f.hex === hex; });
    },
    hexStr: hexStr,
    other: function (cls, get, onPick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = (cls ? cls + ' ' : '') + 'fp-other';
      b.title = 'その他の色（カラーパネルから選ぶ）';
      b.setAttribute('aria-label', b.title);

      var inp = document.createElement('input');
      inp.type = 'color';
      inp.tabIndex = -1;
      b.appendChild(inp);

      b.paint = function () {
        var v = get();
        var mine = window.FilamentPicker.isOther(v);
        b.style.background = mine ? hexStr(v) : RAINBOW;
        inp.value = hexStr(mine ? v : 0x888888);
      };
      inp.addEventListener('input', function () {
        onPick(parseInt(inp.value.slice(1), 16));
      });
      b.paint();
      return b;
    },
  };
})();
