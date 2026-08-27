/* 読みこんだモデルを、この先ずっと使う形にそろえる。
   ★世界は Z が上（プリンタと同じ）。GLB だけ Y上 なので立て直す。
   ★底が z=0、XYの中心が原点に来るようにそろえる。 */

import * as THREE from 'three';

export const UP = { stl: 'z', '3mf': 'z', glb: 'y' };

export function buildGeometry(model) {
  const geo = new THREE.BufferGeometry();
  /* ★もとの座標配列は写しを取ってから触る。使いまわすと二重に回ってしまう */
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(model.positions), 3));
  if (UP[model.format] === 'y') geo.rotateX(Math.PI / 2);   // Y上 → Z上
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.min.z);
  geo.computeVertexNormals();
  geo.computeBoundingBox();

  const span = new THREE.Vector3();
  geo.boundingBox.getSize(span);
  return { geo, span, positions: geo.attributes.position.array };
}

/* 読みこんだ形に「向き」と「大きさ」をかけて、置きなおしたものを返す。
   ★かける順は X → Y → Z。X と Y は倒す／起こす、Z は立てたまま回す。
   ★置きなおし方（anchor）は2つ。
       'ground' … 底を z=0、XYの中心を原点に。溝の高さを「下から」で測るので、
                  ②から先はこちら。
       'center' … 重心を原点に。向きを決めているあいだはこちら。
                  重心は回しても動かないので、モデルがその場で回って見える。
     どちらにせよ置きなおしは要る。しないと回したとたんに画面の外へ行く。 */
export function transformed(base, { scale = 1, rx = 0, ry = 0, rz = 0, anchor = 'ground' } = {}) {
  const m = new THREE.Matrix4()
    .multiply(new THREE.Matrix4().makeRotationZ(rz))
    .multiply(new THREE.Matrix4().makeRotationY(ry))
    .multiply(new THREE.Matrix4().makeRotationX(rx))
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3));
  geo.applyMatrix4(m);
  if (anchor === 'center') {
    const p = geo.attributes.position;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < p.count; i++) { cx += p.getX(i); cy += p.getY(i); cz += p.getZ(i); }
    geo.translate(-cx / p.count, -cy / p.count, -cz / p.count);
  } else {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.min.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();

  const span = new THREE.Vector3();
  geo.boundingBox.getSize(span);
  return { geo, span, positions: geo.attributes.position.array };
}
