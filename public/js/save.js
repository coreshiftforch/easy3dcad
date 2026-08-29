/* ══════════════════════════════════════════════════════════════
   ダウンロードの画面（4ページ共通）

   なまえプレート・QR・クリッカーの「さいごの画面」を1つにまとめたもの。
   出すものは同じ（名前・ファイル・部品・印刷のこつ）で、中身だけ
   それぞれのアプリが渡す。

   ── 使いかた ────────────────────────────────────────────
     SaveScreen.open({
       title:'なまえプレート',
       name:'なまえ',                       // ファイル名の はじめの値
       files:[{ id:'3mf', label:'3MF', note:'色つき', ext:'3mf',
                make: name => Blob }],      // 押されたら その場で作る
       options:[{ id:'lay', label:'向き', pick:'print',
                  items:[{v:'print',t:'印刷向き'},{v:'asis',t:'モデルのまま'}],
                  onPick: v => {} }],
       parts:[{ name:'土台', note:'60×40×3mm' }],
       info:[['できあがり','60 × 40 × 3.4 mm']],
       howto:['① 平置きで印刷（サポート不要）'],
       preview: el,                          // 3Dの窓（あるアプリだけ）
       onBack: () => {},                     // 「戻って直す」
     });

   ── 決めごと ─────────────────────────────────────────
   ★このファイルだけで完結させる。4ページのHTMLには <script> の1行だけ。
     単一HTMLのページからも、Viteが束ねるクリッカーからも同じものを読める。
   ★ファイルは **押されたときに作る**（make）。先に作っておくと、
     つまみを動かすたびに 重い書き出しが走る。
   ★どこにも送信しない。ブラウザに保存させるだけ。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CSS = [
    '.sv-veil{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.5);',
    '  opacity:0;pointer-events:none;transition:opacity .25s;}',
    '.sv-veil.open{opacity:1;pointer-events:auto;}',
    '.sv-sheet{position:fixed;inset:0;z-index:71;display:flex;flex-direction:column;',
    '  background:var(--c-bg,#eef2f7);color:var(--c-text,#16202e);',
    '  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Meiryo",system-ui,sans-serif;',
    '  opacity:0;pointer-events:none;transform:translateY(14px);',
    '  transition:opacity .26s,transform .26s;}',
    '.sv-sheet.open{opacity:1;pointer-events:auto;transform:none;}',

    '.sv-top{flex:none;display:flex;align-items:center;gap:12px;padding:12px 16px;',
    '  border-bottom:1px solid var(--c-line,#cbd5e1);background:var(--c-panel,#fff);}',
    '.sv-top b{font-size:17px;}',
    '.sv-back{min-height:40px;padding:9px 16px;border-radius:10px;',
    '  border:1px solid var(--c-line,#cbd5e1);background:var(--c-panel2,#e8eef7);',
    '  color:var(--c-text,#16202e);font:inherit;font-size:14px;font-weight:600;cursor:pointer;}',
    '.sv-back:hover{border-color:var(--c-accent2,#1d4ed8);}',

    '.sv-body{flex:1;min-height:0;overflow:auto;padding:18px 16px 26px;}',
    /* ★1列。3Dの窓が名前の下に入ったので、横に割らない */
    '.sv-wrap{max-width:680px;margin:0 auto;display:grid;gap:16px;grid-template-columns:1fr;}',

    '.sv-view{background:var(--c-stage,#29384c);border:1px solid var(--c-line,#cbd5e1);',
    '  border-radius:16px;height:300px;position:relative;overflow:hidden;}',
    /* 借りてきた窓（canvas でも div でも）を いっぱいに広げる */
    '.sv-view > *{display:block;width:100%;height:100%;}',
    /* 窓の右下の 拡大ボタン。押すと 3Dだけが画面いっぱいになる */
    '.sv-full{position:absolute;right:10px;bottom:10px;z-index:2;',
    '  width:38px;height:38px;padding:0;border-radius:10px;',
    '  display:grid;place-items:center;',
    '  border:1px solid var(--c-line,#cbd5e1);background:var(--c-panel,#fff);',
    '  color:var(--c-muted,#5b6b80);font:inherit;cursor:pointer;}',
    '.sv-full svg{width:17px;height:17px;}',
    '.sv-full:hover{color:var(--c-accent2,#1d4ed8);border-color:var(--c-accent2,#1d4ed8);}',
    /* ★Fullscreen API は使わない。iPhone の Safari は動画にしか効かないので、
         CSS で広げる（クリッカーの .view-fs と同じ考え）。
       ★.sv-view より1つ強く書くこと。高さ（300px／スマホ 230px）に勝つ必要がある */
    '.sv-view.sv-fs{position:fixed;inset:0;z-index:80;height:auto;',
    '  border-radius:0;border-width:0;}',
    '.sv-col{display:grid;gap:14px;align-content:start;}',
    '.sv-card{background:var(--c-panel,#fff);border:1px solid var(--c-line,#cbd5e1);',
    '  border-radius:16px;padding:14px 16px;}',
    '.sv-h{margin:0 0 9px;font-size:13px;font-weight:bold;color:var(--c-muted,#5b6b80);}',

    '.sv-name{width:100%;min-height:46px;padding:11px 13px;border-radius:11px;',
    '  border:1.5px solid var(--c-line,#cbd5e1);background:var(--c-panel2,#e8eef7);',
    '  color:var(--c-text,#16202e);font:inherit;font-size:16px;}',
    '.sv-name:focus{outline:none;border-color:var(--c-accent2,#1d4ed8);}',
    '.sv-files{display:grid;gap:9px;}',
    '.sv-file{display:flex;flex-direction:column;gap:2px;align-items:flex-start;',
    '  min-height:56px;padding:12px 16px;border-radius:12px;border:1.5px solid var(--c-line,#cbd5e1);',
    '  background:var(--c-panel2,#e8eef7);color:var(--c-text,#16202e);',
    '  font:inherit;font-size:15px;font-weight:bold;cursor:pointer;text-align:left;}',
    '.sv-file:hover{border-color:var(--c-accent2,#1d4ed8);}',
    '.sv-file.main{background:var(--c-accent,#2563eb);border-color:var(--c-accent,#2563eb);color:#fff;}',
    '.sv-file.main:hover{filter:brightness(1.06);}',
    '.sv-file small{font-weight:normal;font-size:12px;opacity:.85;}',
    '.sv-file:disabled{opacity:.5;cursor:default;}',

    '.sv-seg{display:flex;gap:7px;flex-wrap:wrap;}',
    '.sv-seg button{flex:1 1 auto;min-height:44px;padding:10px 14px;border-radius:11px;',
    '  border:1.5px solid var(--c-line,#cbd5e1);background:var(--c-panel2,#e8eef7);',
    '  color:var(--c-text,#16202e);font:inherit;font-size:14px;font-weight:600;cursor:pointer;}',
    '.sv-seg button[aria-pressed="true"]{border-color:var(--c-accent2,#1d4ed8);',
    '  background:var(--c-accent-bg,#dfeaff);color:var(--c-accent2,#1d4ed8);}',

    '.sv-list{display:grid;gap:7px;font-size:13px;line-height:1.7;}',
    '.sv-list div{display:grid;grid-template-columns:auto 1fr;gap:12px;}',
    '.sv-list b{font-weight:bold;}',
    '.sv-list span{color:var(--c-muted,#5b6b80);}',
    '.sv-note{margin:9px 0 0;font-size:12.5px;line-height:1.85;color:var(--c-muted,#5b6b80);}',
    '.sv-msg{margin:10px 0 0;font-size:13.5px;font-weight:bold;min-height:20px;',
    '  color:var(--c-ok2,#15803d);}',
    '.sv-msg.bad{color:var(--c-err2,#b91c1c);}',
    /* ★三角と地の色は foldinfo.js が持っている。ここは並びだけ */
    '.sv-more{margin:0;}',
    '.sv-more .fi-body{gap:12px;}',
    '.sv-more .sv-h{margin:0;}',
    '@media (max-width:899px){',
    '  .sv-view{height:230px;}',
    '  .sv-file{font-size:16px;} .sv-h{font-size:14px;}}',
  ].join('\n');

  var veil = null, sheet = null, opt = null, cur = null;

  /* ファイル名。半角だけにして、日付を足す（同じ名前で上書きしないように） */
  function stamp() {
    var d = new Date(), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
         + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function safe(s) {
    return (String(s || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)) || 'model';
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function say(msg, bad) {
    var el = sheet.querySelector('.sv-msg');
    el.textContent = msg;
    el.classList.toggle('bad', !!bad);
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    veil = document.createElement('div');
    veil.className = 'sv-veil';
    document.body.appendChild(veil);

    sheet = document.createElement('div');
    sheet.className = 'sv-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML =
      '<div class="sv-top">'
      + '  <button class="sv-back" type="button">◀ 戻って直す</button>'
      + '  <b class="sv-title"></b>'
      + '</div>'
      + '<div class="sv-body"><div class="sv-wrap">'
      + '  <div class="sv-col"></div>'
      + '</div></div>';
    document.body.appendChild(sheet);

    sheet.querySelector('.sv-back').onclick = function () {
      var back = opt && opt.onBack;
      close();
      back && back();
    };
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !sheet.classList.contains('open')) return;
      /* ★画面いっぱいのときは、まず それを閉じる。いきなり前の画面へ
           戻ると、広げただけのつもりが 書き出しをやり直しになる */
      var fs = sheet.querySelector('.sv-view.sv-fs');
      if (fs) { fs.querySelector('.sv-full').click(); return; }   /* ボタンが切りかえる */
      sheet.querySelector('.sv-back').click();
    });
  }

  /* 窓の右下に置く「画面いっぱい」ボタン。開いているあいだは しるしが変わる */
  var FULL_ICON = function (on) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"'
      + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + (on ? '<path d="M9 3v6H3M15 3v6h6M15 21v-6h6M9 21v-6H3"/>'
            : '<path d="M9 3H3v6M15 3h6v6M15 21h6v-6M9 21H3v-6"/>')
      + '</svg>';
  };

  function fullButton(view) {
    var b = document.createElement('button');
    b.className = 'sv-full';
    b.type = 'button';
    b.setAttribute('data-no-kana', '');
    function paint() {
      var on = view.classList.contains('sv-fs');
      b.title = on ? 'もとの大きさに戻す' : '画面いっぱいで見る';
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = FULL_ICON(on);
    }
    b.onclick = function (e) {
      e.stopPropagation();
      /* ★広げる前の たて・よこの比を書きのこす。
           貸してくれたアプリは、この比を手がかりに
           「横に入っていた量」を保つ（そうしないと左右が切れる）。
           アプリ側が読まなくても、ただの属性なので害はない。 */
      if (!view.classList.contains('sv-fs')) {
        var r = view.getBoundingClientRect();
        if (r.height) view.dataset.baseAr = (r.width / r.height).toFixed(3);
      }
      view.classList.toggle('sv-fs');
      paint();
    };
    /* ★3Dの窓は つかんでまわせる。ボタンの上では つかませない */
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    paint();
    return b;
  }

  function card(title, inner) {
    return '<div class="sv-card">' + (title ? '<p class="sv-h">' + title + '</p>' : '') + inner + '</div>';
  }

  function render() {
    var col = sheet.querySelector('.sv-col');
    sheet.querySelector('.sv-title').textContent = opt.title || '';

    var html = '';

    (opt.options || []).forEach(function (o, i) {
      html += card(o.label, '<div class="sv-seg" data-opt="' + i + '">'
        + o.items.map(function (it) {
            return '<button type="button" data-v="' + it.v + '"'
              + (it.v === o.pick ? ' aria-pressed="true"' : '') + '>' + it.t + '</button>';
          }).join('')
        + '</div>' + (o.note ? '<p class="sv-note">' + o.note + '</p>' : ''));
    });

    html += card('名前', '<input class="sv-name" type="text" spellcheck="false">'
      + '<p class="sv-note">日付を後ろに足して保存します</p>');

    /* ★3Dの窓は **名前のすぐ下**。以前は いちばん上（ひろい画面では左半分）に
         置いていたが、押すところ（ダウンロード）から遠くて目に入らなかった。
         渡されたときだけ出す。 */
    if (opt.preview) html += '<div class="sv-view"></div>';

    html += card('ダウンロード', '<div class="sv-files">'
      + (opt.files || []).map(function (f, i) {
          return '<button class="sv-file' + (i === 0 ? ' main' : '') + '" type="button" data-file="' + i + '">'
            + f.label + (f.note ? '<small>' + f.note + '</small>' : '') + '</button>';
        }).join('')
      + '</div><p class="sv-msg"></p>');

    /* ★大きさ・部品・印刷のこつは、ここでは たたんでおく。
         押すところ（名前とダウンロード）を先に目に入れたい。
         中身は そのまま。開けば ぜんぶ読める。 */
    var more = '';
    if (opt.info && opt.info.length)
      more += '<p class="sv-h">できあがり</p><div class="sv-list">'
        + opt.info.map(function (x) {
            return '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>';
          }).join('') + '</div>';

    if (opt.parts && opt.parts.length)
      more += '<p class="sv-h">部品</p><div class="sv-list">'
        + opt.parts.map(function (p) {
            return '<div><b>' + p.name + '</b><span>' + (p.note || '') + '</span></div>';
          }).join('') + '</div>';

    if (opt.howto && opt.howto.length)
      more += '<p class="sv-h">印刷のしかた</p><p class="sv-note" style="margin:0">'
        + opt.howto.join('<br>') + '</p>';

    if (more)
      html += '<details class="foldinfo sv-more"><summary>情報</summary>'
        + '<div class="fi-body">' + more + '</div></details>';

    col.innerHTML = html;
    col.querySelector('.sv-name').value = opt.name || '';
    /* ★借りものなので、書きかえのたびに 入れ直す（update でも消えないように） */
    if (opt.preview) {
      var view = col.querySelector('.sv-view');
      view.appendChild(opt.preview);
      view.appendChild(fullButton(view));
    }

    col.querySelectorAll('.sv-seg').forEach(function (seg) {
      var o = opt.options[+seg.dataset.opt];
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        seg.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        o.pick = b.dataset.v;
        o.onPick && o.onPick(b.dataset.v);
      });
    });

    col.querySelectorAll('.sv-file').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = opt.files[+btn.dataset.file];
        var name = safe(col.querySelector('.sv-name').value || opt.name);
        btn.disabled = true;
        say('作っています…');
        /* ★重い書き出しでボタンが固まって見えないよう、1フレーム置いてから作る */
        requestAnimationFrame(function () {
          setTimeout(function () {
            /* ★make は Promise を返してもよい（3MFの ZIP は非同期で作る）。
                 待たずに進むと、できていないものを保存しようとする。 */
            Promise.resolve().then(function () { return f.make(name); }).then(function (out) {
              /* ★Blob を返してくれたら こちらが保存する。返さないときは
                   「アプリが自分で保存した」とみなす（QRの絵やクリッカーのSTLは
                   何枚も出るので、むこうで落としている）。 */
              if (out) download(out instanceof Blob ? out : new Blob([out], { type: f.mime || '' }),
                                name + '_' + stamp() + '.' + (f.ext || f.id));
              say('✓ ' + f.label + ' を保存しました');
            }).catch(function (err) {
              console.error(err);
              say('保存できませんでした（' + (err && err.message || err) + '）', true);
            }).then(function () { btn.disabled = false; });
          }, 0);
        });
      });
    });
  }

  function close() {
    /* ★まだ1度も開いていないときに呼ばれても、何もしない。
         アプリは「戻る」のたびに close() を呼ぶので、ここで落ちると
         そのアプリの画面切りかえごと止まる（実際に止めた）。 */
    if (!sheet) return;
    veil.classList.remove('open');
    sheet.classList.remove('open');
    /* 3Dの窓は、渡してくれたアプリに返す（こちらでは捨てない） */
    var view = sheet.querySelector('.sv-view');
    if (view && opt && opt.preview && view.contains(opt.preview)) view.removeChild(opt.preview);
    cur = null;
  }

  window.SaveScreen = {
    /* 出したあとで中身を入れかえる。★打ちかけの名前は消さない。
         部品の「閉じているか」は数えるのが重くて後から出るので、これで入れ直す。 */
    update: function (patch) {
      if (!sheet || !opt || !patch) return;
      var typed = sheet.querySelector('.sv-name');
      if (typed) opt.name = typed.value;
      Object.keys(patch).forEach(function (k) {
        if (k === 'options' && opt.options) {
          patch.options.forEach(function (o, i) {
            if (opt.options[i]) Object.assign(opt.options[i], o);
          });
        } else opt[k] = patch[k];
      });
      render();
    },
    open: function (o) {
      if (!sheet) build();
      opt = o || {};
      cur = opt;
      render();
      veil.classList.add('open');
      sheet.classList.add('open');
      opt.onShow && opt.onShow(sheet.querySelector('.sv-view'));
    },
    close: close,
    get open$() { return !!cur; },
  };
})();
