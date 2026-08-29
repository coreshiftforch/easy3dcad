════════════════════════════════════════════════════════════════
かんたん3D CAD ― 使っている他の人の作りもの（クレジット）
════════════════════════════════════════════════════════════════

このアプリは、下に挙げたソフトウェアと書体をお借りしています。
それぞれのライセンス全文は、このフォルダの中に入れてあります。

────────────────────────────────────────────────────────────────
■ ソフトウェア
────────────────────────────────────────────────────────────────

three.js  v0.185.1 / v0.160.0
  3Dの表示に使用。MITライセンス。
  Copyright (c) 2010-2025 three.js authors
  https://github.com/mrdoob/three.js
  → three-LICENSE.txt
  ※クリッカーメーカーは npm の 0.185.1（ビルドで assets/ に埋めこまれる）、
    なまえプレートとQRキーホルダーは vendor/three-0.160.0/ を読む（2系統ある）。
    ライブラリは外のサーバー（CDN）からは読まず、すべて同梱している。

opentype.js  v1.3.4
  書体ファイル(.ttf)から文字の輪郭を取り出すのに使用。MITライセンス。
  vendor/opentype-1.3.4.min.js
  Copyright (c) 2020 Frederik De Bleser
  https://github.com/opentypejs/opentype.js
  → opentypejs-LICENSE.txt

qrcode-generator  v1.4.4
  QRコードの黒白の並びを計算するのに使用。MITライセンス。
  vendor/qrcode-generator-1.4.4.js
  Copyright (c) 2009 Kazuhiko Arase
  http://www.d-project.com/
  ※「QRコード」は株式会社デンソーウェーブの登録商標です。

Vite  v8.2.2
  組み立て（ビルド）に使う道具。MITライセンス。作ったものの中には入らない。
  https://github.com/vitejs/vite
  → vite-LICENSE.txt

────────────────────────────────────────────────────────────────
■ 書体
────────────────────────────────────────────────────────────────

★「間引き」＝アプリで使う字だけを残して小さくしたもの（サブセット）。
  もとの書体を作りかえたものなので、そのことをここに明記しています。

fonts/IPAexGothic.ttf  ―― アプリでの名前「かんじ」
  IPAexゴシック Ver.004.01（12,239字・**手を加えていないそのまま**）
  Copyright(c) Information-technology Promotion Agency, Japan (IPA), 2003-2019
  IPAフォントライセンス v1.0
  https://moji.or.jp/ipafont/
  → IPA_Font_License_Agreement_v1.0.txt

fonts/gothic.ttf  ―― アプリでの名前「ゴシック」
  ★IPAexゴシック Ver.004.01 を 328字に**間引いた派生プログラム**。
  IPAフォントライセンス v1.0 第3条1項(4) に従い、フォント名から
  「IPAex」を外し「E3C Gothic」に変えてあります。
  同項(2) の「オリジナルに置きかえられること」は、手を加えていない
  IPAexGothic.ttf を同じフォルダに置くことで満たしています。
  → IPA_Font_License_Agreement_v1.0.txt

fonts/maru.ttf  ―― アプリでの名前「まる」
  Zen Maru Gothic Bold を 309字に間引いたもの
  Copyright 2021 The Zen Maru Gothic Project Authors
  https://github.com/googlefonts/zen-marugothic
  SIL Open Font License 1.1（Reserved Font Name の指定なし）
  → OFL-1.1.txt

fonts/mincho.ttf  ―― アプリでの名前「みんちょう」
  Shippori Mincho Bold を 751字に間引いたもの
  Copyright 2021 The Shippori Mincho Project Authors
  https://github.com/fontdasu/ShipporiMincho
  SIL Open Font License 1.1（Reserved Font Name の指定なし）
  → OFL-1.1.txt

fonts/pop.ttf  ―― アプリでの名前「ふとポップ」
  Dela Gothic One を 323字に間引いたもの
  Copyright 2020 The Dela Gothic Project Authors
  https://github.com/syakuzen/DelaGothic
  SIL Open Font License 1.1（Reserved Font Name の指定なし）
  → OFL-1.1.txt

fonts/robo.ttf  ―― アプリでの名前「ドット」
  DotGothic16 を 406字に間引いたもの
  Copyright 2020 The DotGothic16 Project Authors
  https://github.com/fontworks-fonts/DotGothic16
  SIL Open Font License 1.1（Reserved Font Name の指定なし）
  → OFL-1.1.txt

────────────────────────────────────────────────────────────────
■ そのほか
────────────────────────────────────────────────────────────────

・作ったデータ（STL / 3MF）は、すべてブラウザの中だけで組み立てています。
  どこかのサーバーへ送ることはありません。
・上に挙げたもの以外の、かたち作り・切り分け・書き出しの処理は
  すべてこのアプリのために書いたものです。
