import './style.css';
import { readModelFile } from './io/loadModel.js';
import { mountScene1 } from './scenes/scene1-import.js';
import { mountScene2 } from './scenes/scene2-view.js';
import { mountScene3Type1 } from './scenes/scene3-type1.js';
import { mountScene3Type2 } from './scenes/scene3-type2.js';
import { mountScene3Lower } from './scenes/scene3-lower.js';
import { mountScene4 } from './scenes/scene4-save.js';

const app = document.querySelector('#app');
let current = null;

/* ══════════════════════════════════════════════════════════════
   つづきから再開

   読み直したとき、前の作業が残っていれば「つづきから」か
   「さいしょから」かを聞く（しくみは public/js/resume.js）。

   覚えるもの
     - 読みこんだモデルの中身そのもの（数MB。IndexedDB へ）
     - どの作りに入っていたか（タイプ1／タイプ2／下パーツ生成）
     - そのフローの何番まで進んだか＋操作パネルのつまみ

   覚えないもの
     - ②の「自分で描く」でなぞった線（つまみに出ないので戻せない）
     - 書き出し画面（シーン4）。戻すのは、その手前のフローまで
   ══════════════════════════════════════════════════════════════ */
const RESUME = 'clicker';
const FLOW_NAME = { view: '作りを選ぶ', type1: 'タイプ1', type2: 'タイプ2', lower: '下パーツ生成' };
let here = null;      // { where, model, file }  … いま何をしているか

function keepResume() {
  if (!here) { Resume.forget(RESUME); return; }
  const snap = current?.snapshot?.();
  const n = snap ? '　' + '①②③④⑤⑥'[Math.max(0, (snap.step || 1) - 1)] : '';
  Resume.keep(RESUME, {
    label: FLOW_NAME[here.where] + n + '　' + here.model.name,
    data: { where: here.where, scene: snap },
    file: here.file,           // 同じファイルなら resume.js が書き直さない
  });
}
/* ★つまみ1つずつに足すのではなく、画面ぜんぶでまとめて受ける。
     泡立ち（バブリング）で受けるので、ボタン自身の処理が終わってから呼ばれる。 */
for (const ev of ['input', 'change', 'click']) app.addEventListener(ev, keepResume);
addEventListener('pagehide', () => Resume.flush(RESUME));

/* 画面を入れかえる。前の画面の後始末（3Dの破棄など）を必ず呼ぶ。
   ★組み立てに失敗したら、そのわけを画面に出す。前の画面はもう壊しているので、
     黙って落ちると「押しても進まない」だけになって、何が起きたか分からない。 */
function swap(make) {
  current?.destroy?.();
  try {
    current = make();
  } catch (e) {
    current = null;
    app.innerHTML = '<div class="scene"><div class="notice error">'
      + '<p>画面を作れませんでした。</p>'
      + `<p class="dim">${String(e && e.message || e)}</p></div></div>`;
    throw e;
  }
}

function showImport() {
  here = null;
  Resume.forget(RESUME);       // 最初の画面まで戻ったら、覚えていることは要らない
  swap(() => mountScene1(app, {
    onLoaded: (model, file) => showView(model, file),
    onCreate() {
      // 「モデルを作る」の行き先は、決まったら繋ぐ
      current.say('warn', '<p>「モデルを作る」の行き先は、あとで繋ぎます。</p>');
    },
  }));
}

function showView(model, file) {
  here = { where: 'view', model, file };
  swap(() => mountScene2(app, {
    model,
    onBack: () => showImport(),
    onConfirm(type) {
      if (type.id === 'flush') return showType1(model);
      if (type.id === 'case')  return showType2(model);
      if (type.id === 'lower') return showLower(model);
    },
  }));
  keepResume();
}

/* 3つの作りは、渡すものも戻り先も同じ。1つにまとめてある。
   back … つづきから のときだけ渡す（そのフローのつまみと何番目か） */
const FLOWS = { type1: mountScene3Type1, type2: mountScene3Type2, lower: mountScene3Lower };
function showFlow(where, model, back) {
  if (here) here.where = where;
  swap(() => FLOWS[where](app, {
    model,
    onBack: () => showView(model),
    onDone: ({ parts }) => showSave(model, parts),
  }));
  if (back) current.restore?.(back);
  keepResume();
}
const showType1 = (model, back) => showFlow('type1', model, back);
const showType2 = (model, back) => showFlow('type2', model, back);
const showLower = (model, back) => showFlow('lower', model, back);

/* 書き出し。タイプ2・下パーツ生成からも、部品の一覧を渡せばここへ来られる。

   ★呼びもとのシーンは**壊さずに、画面から外すだけ**にする。作り直すと
     バーの値も溝の形もぜんぶ既定に戻ってしまう（そこまでの手間が消える）。
     戻るときは、外しておいたものをそのまま戻す。 */
function showSave(model, parts) {
  const kept = app.firstElementChild;
  const keptScene = current;
  kept?.remove();
  current = mountScene4(app, {
    model, parts,
    onBack() {
      current?.destroy?.();
      app.replaceChildren(kept);
      current = keptScene;
    },
  });
}

/* ── 起動 ─────────────────────────────────────────────────
   保存があれば聞く。「つづきから」なら、覚えておいたファイルの中身を
   読みこみ直してから、そのときの画面へ飛ぶ。
   ★モデルを読めなかったら、黙って最初の画面にする（つづきにできない）。 */
const back = await Resume.check(RESUME);
let started = false;
if (back && back.file) {
  try {
    const file = new File([back.file.buf], back.file.name, { type: back.file.type || '' });
    const model = await readModelFile(file);
    here = { where: back.data.where || 'view', model, file: undefined };
    if (back.data.where && back.data.where !== 'view') {
      showFlow(back.data.where, model, back.data.scene);
    } else {
      showView(model);
    }
    started = true;
  } catch (e) {
    Resume.forget(RESUME);
  }
}
if (!started) showImport();
