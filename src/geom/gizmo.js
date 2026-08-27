/* つかんで動かすための3Dの矢印（X＝赤・Y＝緑・Z＝青）。
   ★モデルの肉の中にあっても見えるように depthTest を切って、いちばん手前に描く。 */

import * as THREE from 'three';

export const AXIS_COLOR = { x: 0xe5484d, y: 0x2f9e57, z: 0x2b6fd6 };
export const AXIS_VEC = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

export function makeGizmo(len, axes = ['x', 'y', 'z']) {
  const g = new THREE.Group();
  const mats = [];
  for (const ax of axes) {
    const mat = new THREE.MeshBasicMaterial({
      color: AXIS_COLOR[ax], depthTest: false, transparent: true, opacity: 0.92,
    });
    mats.push(mat);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(len * 0.035, len * 0.035, len * 0.72, 12), mat);
    shaft.position.y = len * 0.36;
    const head = new THREE.Mesh(new THREE.ConeGeometry(len * 0.10, len * 0.26, 16), mat);
    head.position.y = len * 0.85;
    /* ★つかむ当たり判定は太めに。矢印そのものは細いので、細いままだと当たらない */
    const grab = new THREE.Mesh(
      new THREE.CylinderGeometry(len * 0.13, len * 0.13, len, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    grab.position.y = len * 0.5;

    const arm = new THREE.Group();
    arm.add(shaft, head, grab);
    /* 円柱・円すいは +Y 向きに生えるので、そこから回して各軸へ向ける */
    if (ax === 'x') arm.rotation.z = -Math.PI / 2;   // +Y → +X
    if (ax === 'z') arm.rotation.x =  Math.PI / 2;   // +Y → +Z
    for (const o of [shaft, head, grab]) { o.userData.axis = ax; o.renderOrder = 20; }
    g.add(arm);
  }
  g.userData.mats = mats;
  return g;
}
