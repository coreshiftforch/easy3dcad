/* ══════════════════════════════════════════════════════════════
   つづきから再開（4ページ共通）

   ページを読み直したとき、前の作業が残っていれば
   「つづきから」か「さいしょから」かを聞く。

   ── 使いかた ──────────────────────────────────────────
     // ① 起動のいちばん最初に。保存があれば聞いて、返す。
     const back = await Resume.check('nameplate');
     if (back) { …back.data で画面を組み立てる… }

     // ② 変わるたびに（何度呼んでもよい。0.4秒まとめてから書く）
     Resume.keep('nameplate', { label: '⑤ 動かす', data: state });

     // ③ さいしょに戻したいとき
     Resume.forget('nameplate');

   ── 大きいファイル ────────────────────────────────────
   読みこんだ3Dモデルは数MBあって localStorage に入らないので、
   IndexedDB に別で置く。keep の file に一度だけ渡せば、あとは
   file を省いてよい（前に入れたものがそのまま残る）。

     Resume.keep('clicker', { label:…, data:…,
                              file: { name, type, buf } });   // buf = ArrayBuffer
     const back = await Resume.check('clicker');
     back.file  // → { name, type, buf } ／ 無ければ null

   ── 決めごと ─────────────────────────────────────────
   ★confirm() は使わない。画面の中のダイアログで選んでもらう
     （スマホで confirm が出っぱなしになると何もできなくなるため）。
   ★保存できなくてもアプリは動く。localStorage が使えない設定の
     ブラウザ（プライベートウィンドウなど）では、黙って何もしない。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NS      = 'easy3dcad:resume:';   // localStorage の名前の頭
  var DB      = 'easy3dcad';           // IndexedDB の名前
  var STORE   = 'files';
  var VER     = 1;                     // 形を変えたら上げる（古い保存は捨てられる）
  var HOME    = 'index.html';          // 「さいしょから」の行き先（3つから選ぶ画面）
  var KEEP_MS = 14 * 24 * 60 * 60 * 1000;   // 2週間より古い保存は使わない
  var WAIT_MS = 400;                   // これだけ何も起きなければ書く

  /* ── localStorage（使えないブラウザでも落ちない）─────── */
  function get(page) {
    try { return JSON.parse(localStorage.getItem(NS + page) || 'null'); }
    catch (e) { return null; }
  }
  function put(page, obj) {
    try { localStorage.setItem(NS + page, JSON.stringify(obj)); return true; }
    catch (e) { return false; }        // いっぱい／使えない設定
  }
  function drop(page) {
    try { localStorage.removeItem(NS + page); } catch (e) { /* 何もしない */ }
  }

  /* ── IndexedDB（読みこんだファイルの中身を置く）───────── */
  function openDB() {
    return new Promise(function (ok) {
      var req;
      try { req = indexedDB.open(DB, 1); } catch (e) { return ok(null); }
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () { ok(req.result); };
      req.onerror   = function () { ok(null); };
      req.onblocked = function () { ok(null); };
    });
  }
  function withStore(mode, fn) {
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (ok) {
        var tx, out = null;
        try { tx = db.transaction(STORE, mode); } catch (e) { db.close(); return ok(null); }
        var req = fn(tx.objectStore(STORE));
        if (req) req.onsuccess = function () { out = req.result; };
        tx.oncomplete = function () { db.close(); ok(out); };
        tx.onerror    = function () { db.close(); ok(null); };
        tx.onabort    = function () { db.close(); ok(null); };
      });
    });
  }
  function fileGet(page)       { return withStore('readonly',  function (s) { return s.get(page); }); }
  function filePut(page, rec)  { return withStore('readwrite', function (s) { return s.put(rec, page); }); }
  function fileDrop(page)      { return withStore('readwrite', function (s) { return s.delete(page); }); }

  /* ── 「いつ」を人の言い方で ───────────────────────── */
  function ago(ms) {
    var d = Date.now() - ms;
    if (d < 60e3) return 'さっき';
    var m = Math.floor(d / 60e3);
    if (m < 60) return m + '分まえ';
    var h = Math.floor(m / 60);
    if (h < 24) return h + '時間まえ';
    return Math.floor(h / 24) + '日まえ';
  }

  /* ── 聞くダイアログ ───────────────────────────────
     色は public/css/tokens.css の --c-… を使う。4ページとも読んでいる。 */
  var CSS = [
    '.rs-veil{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;',
    '  justify-content:center;padding:20px;background:rgba(0,0,0,.55);',
    '  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Meiryo",system-ui,sans-serif;}',
    '.rs-box{width:100%;max-width:400px;padding:22px;border-radius:16px;',
    '  background:var(--c-panel,#1e293b);border:1px solid var(--c-line,#334155);',
    '  color:var(--c-text,#f1f5f9);box-shadow:0 18px 50px rgba(0,0,0,.5);}',
    '.rs-box h2{margin:0 0 10px;font-size:18px;}',
    '.rs-where{margin:0 0 4px;font-size:15px;font-weight:700;color:var(--c-accent2,#3b82f6);',
    '  overflow-wrap:anywhere;}',
    '.rs-when{margin:0 0 18px;font-size:12px;color:var(--c-muted,#94a3b8);}',
    '.rs-row{display:flex;flex-direction:column;gap:8px;}',
    '.rs-row button{min-height:48px;padding:12px 18px;border-radius:12px;font:inherit;',
    '  font-weight:700;cursor:pointer;}',
    '.rs-go{border:0;background:var(--c-accent,#2563eb);color:#fff;}',
    '.rs-go:hover{filter:brightness(1.06);}',
    '.rs-new{border:1.5px solid var(--c-line,#334155);background:transparent;',
    '  color:var(--c-text,#f1f5f9);}',
    '.rs-new:hover{border-color:var(--c-accent2,#3b82f6);}',
    '.rs-row button:focus-visible{outline:3px solid var(--c-accent2,#3b82f6);outline-offset:3px;}',
    '@media (min-width:420px){.rs-row{flex-direction:row-reverse;}.rs-row button{flex:1 1 0;}}',
  ].join('\n');

  function ask(where, when) {
    return new Promise(function (done) {
      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      var veil = document.createElement('div');
      veil.className = 'rs-veil';
      veil.setAttribute('role', 'dialog');
      veil.setAttribute('aria-modal', 'true');
      veil.innerHTML = '<div class="rs-box">'
        + '<h2>前のつづきがあります</h2>'
        + '<p class="rs-where"></p>'
        + '<p class="rs-when"></p>'
        + '<div class="rs-row">'
        + '<button class="rs-go" type="button">つづきから</button>'
        + '<button class="rs-new" type="button">さいしょから</button>'
        + '</div></div>';
      veil.querySelector('.rs-where').textContent = where;
      veil.querySelector('.rs-when').textContent  = when;
      document.body.appendChild(veil);

      function close(yes) {
        veil.remove(); style.remove();
        document.removeEventListener('keydown', onKey);
        done(yes);
      }
      /* Esc は「さいしょから」。まちがえて消える心配がないほう…ではなく、
         何も選ばずに閉じたときは、前の作業を消さずに残す（下の forget を呼ばない）。 */
      function onKey(e) { if (e.key === 'Escape') close(false); }
      document.addEventListener('keydown', onKey);
      veil.querySelector('.rs-go').onclick  = function () { close(true); };
      veil.querySelector('.rs-new').onclick = function () { close(false); };
      veil.querySelector('.rs-go').focus();
    });
  }

  /* 「押されている」の見分け。3ページで書き方がちがうので、ぜんぶ見る */
  function pressed(el) {
    return el.getAttribute('aria-pressed') === 'true'
        || el.classList.contains('active')
        || el.classList.contains('on');
  }

  /* ── 外に出すもの ─────────────────────────────────── */
  var timers = {};    // ページごとの「まとめて書く」タイマー
  var queued = {};    // そのあいだに来た いちばん新しいもの

  /* ほんとうに書くところ。
     ★大きいファイルは「前と同じなら書き直さない」。key（名前:バイト数）で見る。
       毎回書くと、つまみを動かすたびに数MBを書くことになる。 */
  function write(page, o) {
    var rec  = get(page);
    var same = o.file && rec && rec.fileKey === o.file.key;
    put(page, {
      v: VER, at: Date.now(), label: o.label || '', data: o.data,
      hasFile: !!o.file || !!(rec && rec.hasFile),
      fileKey: o.file ? o.file.key : (rec && rec.fileKey) || null,
    });
    if (o.file && !same) filePut(page, { name: o.file.name, type: o.file.type, buf: o.file.buf });
  }

  var Resume = {
    /* 保存があれば聞く。「つづきから」なら { data, file, label } を返す。
       「さいしょから」なら消して null。保存が無ければ聞かずに null。 */
    check: function (page) {
      var rec = get(page);
      if (!rec || rec.v !== VER || !rec.at || Date.now() - rec.at > KEEP_MS) {
        if (rec) Resume.forget(page);
        return Promise.resolve(null);
      }
      return ask(rec.label || '', ago(rec.at)).then(function (yes) {
        /* 「さいしょから」は、そのページの①ではなく **トップ（3つから選ぶ画面）** へ。
           作り直すなら、まず何を作るかから選びたいため。
           ★消しおわってから移ること。IndexedDB の削除は非同期なので、
             待たずに移ると消し残ることがある。 */
        if (!yes) {
          return Resume.forget(page).then(function () {
            location.href = HOME;
            return new Promise(function () { });   // もう画面は組み立てない
          });
        }
        if (!rec.hasFile) return { data: rec.data, file: null, label: rec.label };
        return fileGet(page).then(function (f) {
          /* ファイルが消えていたら、つづきにできない（モデルが無い）。
             ★ここで黙って進むと「モデル無しの画面」になるので、消してやり直す。 */
          if (!f) { Resume.forget(page); return null; }
          return { data: rec.data, file: f, label: rec.label };
        });
      });
    },

    /* 保存する。何度呼んでもよい（0.4秒まとめてから書く）。
       file を渡したときだけ IndexedDB に書く（毎回渡さなくてよい）。 */
    keep: function (page, opt) {
      queued[page] = opt;
      if (timers[page]) return;
      timers[page] = setTimeout(function () {
        timers[page] = 0;
        var o = queued[page]; queued[page] = null;
        if (!o) return;
        write(page, o);
      }, WAIT_MS);
    },

    /* いま書く（ページを閉じる直前など、待っていられないとき）。 */
    flush: function (page) {
      if (!timers[page]) return;
      clearTimeout(timers[page]); timers[page] = 0;
      var o = queued[page]; queued[page] = null;
      if (o) write(page, o);
    },

    /* ── 画面のつまみを、まとめて覚える／戻す ────────────
       state を1つずつ書き写すのが大変なページ用。
       ★見分けは「並び順」でしている（id が付いていないつまみが多いため）。
         画面を組み立てたあとの並びは変わらないので、それで足りる。
         つまみを増やしたときに、前の保存とずれるのは覚悟のうえ
         （形が変わったら VER を上げて、古い保存を捨てる）。 */
    readForm: function (root) {
      var out = { val: {}, on: [] };
      root.querySelectorAll('input,select,textarea').forEach(function (el, i) {
        if (el.type === 'file' || el.type === 'button') return;
        out.val[i] = el.type === 'checkbox' ? el.checked : el.value;
      });
      root.querySelectorAll('button').forEach(function (el, i) {
        if (pressed(el)) out.on.push(i);
      });
      return out;
    },

    /* 戻す。値を入れて input／change を投げ、押されていないボタンは押す。
       ★ボタンが先。ボタンでバーの動く範囲が変わることがあるため。 */
    writeForm: function (root, snap) {
      if (!snap) return;
      var btns = root.querySelectorAll('button');
      (snap.on || []).forEach(function (i) {
        var b = btns[i];
        if (b && !pressed(b) && !b.disabled) b.click();
      });
      var els = root.querySelectorAll('input,select,textarea');
      Object.keys(snap.val || {}).forEach(function (k) {
        var el = els[+k];
        if (!el) return;
        if (el.type === 'checkbox') {
          if (el.checked === snap.val[k]) return;
          el.checked = snap.val[k];
        } else {
          if (el.value === String(snap.val[k])) return;
          el.value = snap.val[k];
        }
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    },

    /* 消す。「さいしょから」を選んだときと、最初の画面に戻ったとき。
       IndexedDB のぶんが消えるまで待てるよう、Promise を返す。 */
    forget: function (page) {
      if (timers[page]) { clearTimeout(timers[page]); timers[page] = 0; }
      queued[page] = null;
      drop(page);
      return fileDrop(page);
    },
  };

  window.Resume = Resume;
})();
