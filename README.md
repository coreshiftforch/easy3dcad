# かんたん3D CAD

3Dプリンターで刷れるキーホルダーのデータを、**ブラウザだけ**でつくれるアプリ。
インストール不要・CADの知識不要・データは端末の外に出ない。

3つのつくるものを1つのアプリにまとめている。

| ページ | つくるもの | 出力 |
|---|---|---|
| `nameplate.html` | なまえプレート（形・フォント・色・穴を選ぶ） | 3MF（2色）・STL |
| `qr.html` | QRキーホルダー（URLを入れるとQRの立体になる） | 3MF（多色）・STL・PNG |
| `clicker.html` | クリッカーメーカー（3Dモデルをキースイッチで押せる上下2パーツにする） | 3MF・STL |

## 動かす

```
npm install
npm run dev       # http://localhost:5173/
npm run build     # dist/ に出る（これが提出物）
npm run preview   # dist/ を確かめる
```

`起動.bat` をダブルクリックすれば、初回セットアップ（`npm install`）から
開発サーバー起動・ブラウザ表示までまとめてやる。

## ファイル構成

```
easy3dcad/
├ index.html        … トップ（3つから選ぶ）      ← Viteのエントリ
├ clicker.html      … クリッカーメーカー          ← Viteのエントリ
├ src/              … クリッカーメーカーのソース（約8,400行）
│  ├ main.js        … シーンの入れかえ
│  ├ scenes/        … 1インポート → 2作りを選ぶ → 3形をつくる → 4書き出し
│  ├ geom/          … 立体をつくる部品
│  ├ io/            … モデルの読み書き
│  └ style.css      … クリッカーだけのスタイル
├ public/           … ★Viteが一切いじらず、そのまま配られる
│  ├ nameplate.html … なまえプレート（単一HTML）
│  ├ qr.html        … QRキーホルダー（単一HTML）
│  ├ css/common.css … なまえプレート／QR／トップの共通デザイン
│  └ fonts/*.ttf    … なまえプレートで使う書体
├ vite.config.js
└ 起動.bat
```

### なぜ public/ に分けているか

なまえプレートとQRキーホルダーは、**three.js を CDN の importmap で読む単一HTML**。
これを Vite にビルドさせると、npm 側の three（0.185）で解決しようとして
食いちがう。`public/` に置いたものは Vite が一切さわらないので、
書いたままの形で配られる。

いっぽう クリッカーメーカーは npm の three を `import` するモジュール構成なので、
Vite のエントリ（`clicker.html` → `/src/main.js`）として束ねている。

つまり **three.js が2系統ある**が、ページが別なので競合しない。

## デザイン

トップ・なまえプレート・QRキーホルダーは `public/css/common.css` の同じ骨組みに乗せている。

```html
<header>…タイトル＋メニューへ戻るリンク…</header>
<div class="main">
  <div class="stage"><canvas>…3Dプレビュー…</canvas></div>
  <div class="side">
    <div class="steps">…丸いステップ表示…</div>
    <div class="panel">…操作パネル（.step-page / .sec を1つずつ出す）…</div>
    <div class="nav">…もどる／つぎへ…</div>
  </div>
</div>
```

- **スマホ幅**: たて1列（3Dが上、操作が下）
- **900px以上**: 左に操作パネル、右に3Dビューの横ならび
  （`.main` を `row-reverse` にしているので、DOMは `stage → side` の順で書く）

色は `:root` の CSS変数（`--bg` `--panel` `--accent` など）だけで決めている。

> **クリッカーメーカーだけ、まだこの共通デザインに乗っていない**（ライトテーマの独自UI）。
> 見た目を揃えるかどうかは、3つ並べて見てから決める。

## つくる → 印刷までの流れ

1. トップでつくるものを選ぶ
2. ステップに沿って進める（3Dプレビューがその場で更新される）
3. STL または 3MF でダウンロード
4. スライサー（Bambu Studio など）で開いて印刷

3MF はパーツごとに色が分かれているので、複数フィラメントの機種ならそのまま色分けして刷れる。
STL は単色だが、どのスライサーでも開ける。

## 元になったアプリ

別々に作っていた3つのアプリを1つにまとめたもの。

- なまえプレート … `公民館イベントアプリ/cad3D_printing_ver2`
  （BASE決済・注文GAS連携は削除し、無料ダウンロードに変更）
- QRキーホルダー … `QRコード3Dアプリ`
- クリッカーメーカー … `projects/clicker-maker`
  （`フィギュアキーキャップ` の単一HTML版を作り直したもの。旧版はもう使わない）

外部サービスへの送信は一切行わない。生成したデータは端末の中だけで完結する。
