/* ══════════════════════════════════════════════════════════════
   つづきから再開（4ページ共通）

   **同じタブで読み直したとき**だけ、「つづきから」か「さいしょから」かを聞く。

   これは「作業のとちゅうで事故があったとき」のための仕組み。
     ○ 聞く … ページの読み直し（F5）／戻る・進む／ブラウザが落ちて開き直したとき
     ✕ 聞かない … タブを閉じてから開き直したとき／別のタブで開いたとき／
                  トップから入り直したとき／しばらく（2時間）あいたとき
   聞かないときは、覚えていたことを捨てて、その画面のはじめから始める。

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
  var VER     = 2;                     /* 形を変えたら上げる（古い保存は捨てられる）
                                          ★2 … QRの操作パネルを作り直して、つまみの
                                            並びが変わった（並び順で覚えているので
                                            そのままだと値がよそへ入る） */
  var HOME    = 'index.html';          // 「さいしょから」の行き先（3つから選ぶ画面）
  var KEEP_MS = 2 * 60 * 60 * 1000;    // 2時間より古い保存は使わない
  var WAIT_MS = 400;                   // これだけ何も起きなければ書く
  var TAB     = 'easy3dcad:open:';     // sessionStorage。このタブでもう開いたか

  /* 聞くときに「どれのつづきか」を出す。check に渡す合いことば → 画面に出す名前。
     ★ここに無い合いことばでも動く（名前を出さないだけ）。 */
  var APPS = { nameplate: 'なまえプレート', qr: 'QRキーホルダー', clicker: 'クリッカーメーカー' };

  /* ── 「同じタブで読み直したか」の見分け ─────────────────
     sessionStorage は **タブごと**で、
       ・読み直し（F5）  … 残る
       ・ブラウザが落ちて開き直し … Chrome が戻してくれるので残る
       ・タブを閉じて開き直し … 消える（＝新しいタブ）
     という、ちょうど欲しい通りのふるまいをする。
     ★localStorage で代わりにはできない。あちらはタブをまたいで残るので、
       「閉じてから開き直した」と「読み直した」の区別がつかない。 */
  function openedHere(page) {
    try { return sessionStorage.getItem(TAB + page) === '1'; }
    catch (e) { return false; }        // 使えない設定のブラウザ
  }
  function markHere(page) {
    try { sessionStorage.setItem(TAB + page, '1'); } catch (e) { /* 何もしない */ }
  }

  /* 「つづきを聞いてよい来かた」かどうか。3つの手がかりを見る。

     ① どうやってこのページに来たか（performance の navigation）
        reload／back_forward なら、読み直しか 戻る・進む。まよわず聞く。
     ② このタブで前に開いたか（上の目じるし）
        初めてなら、タブを閉じて開き直したか、別のタブ。聞かない。
     ③ どこから来たか（referrer）
        ★②を通ったのに ①が「ふつうの行き来（navigate）」だった、という場合が残る。
          ・サイトの中のページから来た → 自分でトップから入り直した。聞かない
          ・どこからも来ていない → ブラウザが開き直した見こみが高い。聞く
        ブラウザが落ちて開き直したときは referrer が付かないので、ここで拾える。 */
  function fromReopen(page) {
    var nav = null;
    try { nav = performance.getEntriesByType('navigation')[0] || null; } catch (e) { /* 古いブラウザ */ }
    var kind = nav ? nav.type : '';
    if (kind === 'reload' || kind === 'back_forward') return true;
    if (!openedHere(page)) return false;
    var ref = document.referrer || '';
    return ref.indexOf(location.origin) !== 0;
  }

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
    /* どのアプリのつづきか。ひと目で分かるように ふだの形にする */
    '.rs-app{display:inline-block;margin:0 0 8px;padding:4px 11px;border-radius:999px;',
    '  background:var(--c-accent-bg,#17325e);color:var(--c-accent2,#3b82f6);',
    '  font-size:12.5px;font-weight:700;}',
    '.rs-app[hidden]{display:none;}',
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

  function ask(app, where, when) {
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
        + '<p class="rs-app" hidden></p>'
        + '<p class="rs-where"></p>'
        + '<p class="rs-when"></p>'
        + '<div class="rs-row">'
        + '<button class="rs-go" type="button">つづきから</button>'
        + '<button class="rs-new" type="button">さいしょから</button>'
        + '</div></div>';
      var appEl = veil.querySelector('.rs-app');
      appEl.textContent = app || '';
      appEl.toggleAttribute('hidden', !app);
      veil.querySelector('.rs-where').textContent = where;
      veil.querySelector('.rs-when').textContent  = when;
      document.body.appendChild(veil);

      function close(yes) {
        veil.remove(); style.remove();
        document.removeEventListener('keydown', onKey);
        done(yes);
      }
      /* ★Esc では何もしない。どちらかを必ず選んでもらう。
           前は Esc を「さいしょから」にしていたが、それは **保存を消して
           トップへ飛ぶ** 道なので、指がすべっただけで作業が消えてしまう
           （実際に消えた）。閉じる手立てを用意しないのが、いちばん安全。 */
      function onKey(e) { if (e.key === 'Escape') e.preventDefault(); }
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
       「さいしょから」なら消して null。聞かないときも null。
       ★呼ぶのは、そのページの **いちばん最初**（画面を組み立てる前）。 */
    check: function (page) {
      var rec = get(page);
      var again = fromReopen(page);
      markHere(page);                  // つぎの読み直しからは「同じタブ」になる

      if (!rec || rec.v !== VER || !rec.at || Date.now() - rec.at > KEEP_MS) {
        if (rec) Resume.forget(page);
        return Promise.resolve(null);
      }
      /* ★読み直しでも開き直しでもないなら聞かない。
           トップから入り直した／タブを閉じて開き直した、ということなので、
           覚えていたことは捨てて、はじめから始める。 */
      if (!again) {
        return Resume.forget(page).then(function () { return null; });
      }
      return ask(APPS[page] || '', rec.label || '', ago(rec.at)).then(function (yes) {
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
