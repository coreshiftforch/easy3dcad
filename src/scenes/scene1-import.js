/* シーン1：モデルインポート
   ── 中央に大きなインポート枠。ドラッグ＆ドロップとファイル選択の両方。
   ── 「モデルを作る」ボタンは PCなら右、スマホなら下（シーン2への分かれ道）。
   ── 読めたら、そのままシーン2へ進む。 */

import { readModelFile, BIG_FILE } from '../io/loadModel.js';

const MB = n => (n / 1024 / 1024).toFixed(1);

export function mountScene1(root, { onLoaded, onCreate } = {}) {
  root.innerHTML = `
    <div class="scene scene1">
      <div class="stage">
        <button class="dropzone" type="button">
          <svg class="dz-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 34V12M24 12l-9 9M24 12l9 9" fill="none" stroke="currentColor"
                  stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 32v4a3 3 0 003 3h24a3 3 0 003-3v-4" fill="none" stroke="currentColor"
                  stroke-width="3.2" stroke-linecap="round"/>
          </svg>
          <span class="dz-title">モデルインポート</span>
          <span class="dz-sub only-pc">ここにドラッグ＆ドロップ<br>／ クリックして選ぶ</span>
          <span class="dz-sub only-touch">タップしてモデルを選ぶ</span>
          <span class="dz-formats">（STL / 3MF / GLB）</span>
        </button>
        <div class="side">
          <button class="make-btn" type="button">モデルを作る</button>
        </div>
      </div>
      <div class="notice" hidden></div>
      <input class="picker" type="file" accept=".stl,.3mf,.glb,.obj,application/octet-stream" hidden>
    </div>`;
  /* ★accept は **拡張子と application/octet-stream の両方**を書く。
     ・拡張子だけ … PCでは正しく絞れるが、iPhone の「ファイル」アプリは
       拡張子ではなく UTI で見るので、ぜんぶグレーアウトして選べなくなる
     ・octet-stream だけ … iPhone は public.data として ぜんぶ選べるが、
       **PCの選択窓が「octet-stream」で絞ってしまい、STLが選べなくなった**
     ・付けない … iPhone が「写真またはビデオを撮る／フォトライブラリ」を出す。
       3Dモデルに写真は関係ないので まぎらわしい
     両方書けば、PCは拡張子で絞り、iPhone は public.data で ぜんぶ選べる。
     どちらにしても、選ばれたあと 先頭の数バイトで中身を見て判断する。 */

  const scene   = root.querySelector('.scene1');
  const zone    = root.querySelector('.dropzone');
  const picker  = root.querySelector('.picker');
  const notice  = root.querySelector('.notice');
  const makeBtn = root.querySelector('.make-btn');

  const clearNotice = () => { notice.hidden = true; notice.innerHTML = ''; };
  const say = (kind, html) => {
    notice.className = `notice ${kind}`;
    notice.innerHTML = html;
    notice.hidden = false;
  };

  /* ── ファイルを受けとる ───────────────────────────── */
  function take(file) {
    if (!file) return;
    clearNotice();
    if (file.size > BIG_FILE) {
      /* ★大きいファイルはスマホのブラウザが黙って落ちる。読む前に知らせる。
           確認ダイアログ（confirm）は使わない。画面の中で選んでもらう。 */
      say('warn', `<p><b>大きいファイルです（${MB(file.size)}MB）。</b>
        スマホでは読みこみ中にブラウザが落ちることがあります。</p>
        <div class="row"><button class="go" type="button">このまま読む</button>
        <button class="cancel" type="button">やめる</button></div>`);
      notice.querySelector('.go').onclick     = () => { clearNotice(); read(file); };
      notice.querySelector('.cancel').onclick = () => { clearNotice(); picker.value = ''; };
      return;
    }
    read(file);
  }

  async function read(file) {
    say('busy', `<p>読みこみ中… <span class="dim">${file.name}</span></p>`);
    try {
      const info = await readModelFile(file);
      clearNotice();
      /* ★中身そのものも渡す。「つづきから」で読みこみ直すのに要る
           （ファイルの場所は覚えられないので、中身を持っておくしかない）。 */
      const buf = await file.arrayBuffer();
      onLoaded?.(info, { name: file.name, type: file.type,
                         buf, key: file.name + ':' + buf.byteLength });
    } catch (e) {
      say('error', `<p><b>読めませんでした。</b><br>${String(e.message || e)}</p>`);
      picker.value = '';
    }
  }

  /* ── クリック／タップで選ぶ ───────────────────────── */
  zone.onclick = () => picker.click();
  picker.onchange = () => take(picker.files[0]);

  /* ── ドラッグ＆ドロップ（パソコンだけ） ─────────────── */
  let depth = 0;
  /* ★window でも止めないと、枠の外に落としたときにブラウザがファイルを開いてしまう */
  const stop = e => e.preventDefault();
  window.addEventListener('dragover', stop);
  window.addEventListener('drop', stop);
  zone.addEventListener('dragenter', e => { e.preventDefault(); if (++depth === 1) scene.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; scene.classList.remove('dragging'); } });
  zone.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    depth = 0; scene.classList.remove('dragging');
    take(e.dataTransfer.files[0]);
  });

  makeBtn.onclick = () => onCreate?.();

  return {
    say, clearNotice,
    destroy() {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    },
  };
}
