/* クリッカーの中身（Cherry MX 互換のキースイッチ）の見本。
   「ここにスイッチが入る」を見せるためだけのもの。書き出しには使わない。

   寸法は実測から（フィギュアキーキャップ\実物パーツ\実測.md）。
   プレートの上面を z=0 として組み、使うがわで上下に動かす。

   ★基準は「押し込んだとき」。ステムは沈みきった位置で描く。
     指を離しているときは、上パーツだけがここから 4mm 高くなる（＝見える溝が広がる）。

        z= +9.1  ステムの先（押し込んだとき。上パーツの十字穴の天井に当たる）
        z= +6.6  箱の上面 ＝ 押し込んだときの上パーツの底
        z=  0    プレートの上面
        z= −5.6  胴の底
        z= −8.9  中心ポールの先
*/

import * as THREE from 'three';

export const HOLE_DEPTH   = 2.5;    // 上パーツの十字穴の深さ（実測）
export const TRAVEL       = 4.0;    // 沈む量
export const CAP_PRESSED  = 6.6;    // 押し込んだときの「プレート → 上パーツの底」
export const BELOW_PLATE  = 8.9;    // プレートより下（胴 5.6 ＋ 中心ポール 3.3）
export const PLATE_TO_STEM = CAP_PRESSED + HOLE_DEPTH;   // 9.1（押し込んだときのステムの先）
export const SWITCH_H     = PLATE_TO_STEM + BELOW_PLATE; // 18.0（押し込んだときの背）
export const SWITCH_W     = 15.6;   // 上ハウジングの一辺
/* 溝の底は「十字のてっぺん」に合わせる。そこから下にスイッチが SWITCH_H(18.0) ぶん出るので、
   それだけ肉がないと、スイッチがモデルの底から突き出る。 */

export function makeSwitchMock() {
  const g = new THREE.Group();
  /* ★白い半透明。面が重なるぶんだけ濃くなるので、1枚はかなり薄くしておく。
       depthTest を切って、モデルの肉の中にあっても見えるようにする。 */
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.35, transparent: true, opacity: 0.30,
    depthTest: false, depthWrite: false,
  });
  /* ★白い面だけだと、うすいグレーのモデルの上で埋もれて形が読めない。
       輪郭線を重ねると、半透明のまま「何がどこにあるか」が分かる。 */
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x51606f, transparent: true, opacity: 0.55, depthTest: false,
  });
  /* ★ステムだけは押すと沈むので、別のまとまりに入れて動かせるようにする */
  let into = g;
  const add = (geo, z0, h) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z0 + h / 2;
    m.renderOrder = 9;
    into.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
    e.position.z = m.position.z;
    e.renderOrder = 9;
    into.add(e);
    return m;
  };
  const box = (w, d, h, z0) => add(new THREE.BoxGeometry(w, d, h), z0, h);

  box(15.6, 15.6, 6.6, 0);        // 上ハウジング（箱）
  box(14.0, 14.0, 1.8, -1.8);     // 首（プレートにくわえられるところ）
  box(13.9, 13.9, 3.8, -5.6);     // 胴
  // ステム（十字）。板2枚を組んで十字にする。★押し込んだ位置（先が z=+9.1）
  const stem = new THREE.Group();
  g.add(stem);
  into = stem;
  box(4.10, 1.17, 7.7, 1.4);
  box(1.17, 4.10, 7.7, 1.4);
  into = g;
  // 中心ポール
  const poleGeo = new THREE.CylinderGeometry(3.85 / 2, 3.85 / 2, 3.3, 16).rotateX(Math.PI / 2);
  add(poleGeo, -8.9, 3.3);

  g.userData.mats = [mat, edgeMat];
  /* 使うがわで stem.position.z を動かすと、押していないときの位置になる */
  g.userData.stem = stem;
  return g;
}

/* 上パーツの底（＝溝の底）が zPlug のとき、プレートの上面が来る高さ。
   ★押し込んだ状態が基準。そのとき「プレート → 上パーツの底」は 6.6mm。 */
export function plateZFor(zPlug) {
  return zPlug - CAP_PRESSED;
}
