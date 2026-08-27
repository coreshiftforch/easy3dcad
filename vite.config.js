import { defineConfig } from 'vite';

/*
  かんたん3D CAD のビルド設定。

  ・エントリは index.html（トップ）と clicker.html（クリッカーメーカー）の2つ。
    クリッカーだけが src/ のモジュールを読むので、Viteが束ねるのはこの2つ。

  ・なまえプレート／QRキーホルダーは public/ に置いてある。
    public/ の中身はViteが一切いじらず、そのままの形で配られる。
    この2つは three.js を CDN の importmap で読む単一HTMLなので、
    Viteに解決させると npm 側の three（0.185）と食いちがってしまう。
    さわらせないために public/ に置いている。

  ・base:'./' … dist/ をどの階層に置いても動くよう、相対パスで出す
    （GitHub Pages のプロジェクトページのように /リポジトリ名/ の下に置く場合に効く）
*/
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        index:   'index.html',
        clicker: 'clicker.html',
      },
    },
  },
});
