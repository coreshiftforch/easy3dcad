# かんたん3D CAD

3Dプリンターで刷れるキーホルダーのデータを、**ブラウザだけ**でつくれるアプリ。
インストール不要・CADの知識不要・データは端末の外に出ない。

3つのつくるものを1つのアプリにまとめている。

| ページ | つくるもの | 出力 |
|---|---|---|
| `nameplate.html` | なまえプレート（形・フォント・色・穴を選ぶ） | 3MF（2色）・STL |
| `qr.html` | QRキーホルダー（URLを入れるとQRの立体になる） | 3MF（多色）・STL・PNG |
| `clicker.html` | カチカチ クリッカー（3Dモデルを上下2パーツに切る） | 3MF・STL |

## つかいかた

`起動.bat` をダブルクリックすると、サーバーが立ち上がってブラウザが開く。

手で動かす場合:

```powershell
python server.py 8080
```

そのあと <http://localhost:8080/index.html> を開く。

> Three.js を ES Module（importmap）で読み込むため、`file://` で直接開くと動かない。
> かならず `server.py` 経由で開くこと。

## ファイル構成

```
easy3dcad/
├ index.html      … トップ（3つから選ぶ）
├ nameplate.html  … なまえプレート
├ qr.html         … QRキーホルダー
├ clicker.html    … カチカチ クリッカー
├ css/common.css  … 3ページ共通のデザイン（← 見た目を変えるならここ）
├ fonts/*.ttf     … なまえプレートで使う書体
├ server.py       … 動作確認用サーバー（/server-ip つき）
└ 起動.bat        … サーバー起動＋ブラウザを開く
```

## デザインの決まりごと

3ページとも、`css/common.css` の同じ骨組みに乗せている。

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
テーマを変えるときは変数の値を差しかえる。

## つくる → 印刷までの流れ

1. トップでつくるものを選ぶ
2. ステップに沿って進める（3Dプレビューがその場で更新される）
3. STL または 3MF でダウンロード
4. スライサー（Bambu Studio など）で開いて印刷

3MF はパーツごとに色が分かれているので、複数フィラメントの機種ならそのまま色分けして刷れる。
STL は単色だが、どのスライサーでも開ける。

## 元になったアプリ

このアプリは、別々に作っていた3つのアプリを1つにまとめたもの。

- なまえプレート … `公民館イベントアプリ/cad3D_printing_ver2`（BASE決済・注文GAS連携は削除し、無料ダウンロードに変更）
- QRキーホルダー … `QRコード3Dアプリ`
- クリッカー … `フィギュアキーキャップ`

外部サービスへの送信は一切行わない。生成したデータは端末の中だけで完結する。
