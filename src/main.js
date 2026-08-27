import './style.css';
import { mountScene1 } from './scenes/scene1-import.js';
import { mountScene2 } from './scenes/scene2-view.js';
import { mountScene3Type1 } from './scenes/scene3-type1.js';
import { mountScene3Type2 } from './scenes/scene3-type2.js';
import { mountScene3Lower } from './scenes/scene3-lower.js';
import { mountScene4 } from './scenes/scene4-save.js';

const app = document.querySelector('#app');
let current = null;

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
  swap(() => mountScene1(app, {
    onLoaded: model => showView(model),
    onCreate() {
      // 「モデルを作る」の行き先は、決まったら繋ぐ
      current.say('warn', '<p>「モデルを作る」の行き先は、あとで繋ぎます。</p>');
    },
  }));
}

function showView(model) {
  swap(() => mountScene2(app, {
    model,
    onBack: () => showImport(),
    onConfirm(type) {
      if (type.id === 'flush') return showType1(model);
      if (type.id === 'case')  return showType2(model);
      if (type.id === 'lower') return showLower(model);
    },
  }));
}

function showType1(model) {
  swap(() => mountScene3Type1(app, {
    model,
    onBack: () => showView(model),
    onDone: ({ parts }) => showSave(model, parts),
  }));
}

function showType2(model) {
  swap(() => mountScene3Type2(app, {
    model,
    onBack: () => showView(model),
    onDone: ({ parts }) => showSave(model, parts),
  }));
}

function showLower(model) {
  swap(() => mountScene3Lower(app, {
    model,
    onBack: () => showView(model),
    onDone: ({ parts }) => showSave(model, parts),
  }));
}

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

showImport();
