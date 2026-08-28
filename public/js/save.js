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
    '.sv-wrap{max-width:1000px;margin:0 auto;display:grid;gap:16px;grid-template-columns:1fr;}',
    '@media (min-width:900px){.sv-wrap.has-view{grid-template-columns:1fr 380px;align-items:start;}}',

    '.sv-view{background:var(--c-stage,#29384c);border:1px solid var(--c-line,#cbd5e1);',
    '  border-radius:16px;min-height:320px;position:relative;overflow:hidden;}',
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
    '@media (max-width:899px){',
    '  .sv-view{min-height:210px;}',
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
      + '  <div class="sv-view" hidden></div>'
      + '  <div class="sv-col"></div>'
      + '</div></div>';
    document.body.appendChild(sheet);

    sheet.querySelector('.sv-back').onclick = function () {
      var back = opt && opt.onBack;
      close();
      back && back();
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open'))
        sheet.querySelector('.sv-back').click();
    });
  }

  function card(title, inner) {
    return '<div class="sv-card">' + (title ? '<p class="sv-h">' + title + '</p>' : '') + inner + '</div>';
  }

  function render() {
    var col = sheet.querySelector('.sv-col');
    var view = sheet.querySelector('.sv-view');
    sheet.querySelector('.sv-title').textContent = opt.title || '';

    /* 3Dの窓は、渡されたときだけ出す */
    view.innerHTML = '';
    view.toggleAttribute('hidden', !opt.preview);
    sheet.querySelector('.sv-wrap').classList.toggle('has-view', !!opt.preview);
    if (opt.preview) view.appendChild(opt.preview);

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

    html += card('ダウンロード', '<div class="sv-files">'
      + (opt.files || []).map(function (f, i) {
          return '<button class="sv-file' + (i === 0 ? ' main' : '') + '" type="button" data-file="' + i + '">'
            + f.label + (f.note ? '<small>' + f.note + '</small>' : '') + '</button>';
        }).join('')
      + '</div><p class="sv-msg"></p>');

    if (opt.info && opt.info.length)
      html += card('できあがり', '<div class="sv-list">'
        + opt.info.map(function (x) {
            return '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>';
          }).join('') + '</div>');

    if (opt.parts && opt.parts.length)
      html += card('部品', '<div class="sv-list">'
        + opt.parts.map(function (p) {
            return '<div><b>' + p.name + '</b><span>' + (p.note || '') + '</span></div>';
          }).join('') + '</div>');

    if (opt.howto && opt.howto.length)
      html += card('印刷のしかた', '<p class="sv-note" style="margin:0">'
        + opt.howto.join('<br>') + '</p>');

    col.innerHTML = html;
    col.querySelector('.sv-name').value = opt.name || '';

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
    if (opt && opt.preview && view.contains(opt.preview)) view.removeChild(opt.preview);
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
