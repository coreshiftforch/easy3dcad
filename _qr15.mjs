import fs from 'node:fs';
const p = 'public/qr.html';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const put = (a, b) => { if (!s.includes(a)) throw new Error('見つからない: ' + a.slice(0, 46)); s = s.replace(a, b); };

put(`slider('qrh', 'qrh', v => v.toFixed(1) + ' mm', 'qrhV');`,
`/* ══ QRごとの「深さ」と「まわりの余白」════════════════════
   面が2つ3つあるので、1本のつまみでは足りない。面の数だけ並べる。

   ★つまみは **5面ぶんぜんぶ作っておいて、要らない面を隠す**。
     そのつど作り直すと、画面のつまみの数が増えたり減ったりして、
     「つづきから」（並び順で覚えている）がずれる。 */
const QR_SLOTS = ['tileFront', 'tileBack', 'bodyBack', 'plateFront', 'plateBack'];
const KIND_SLOTS = { key:['tileFront', 'tileBack', 'bodyBack'], stand:['plateFront', 'plateBack'] };
document.getElementById('qrEach').innerHTML = QR_SLOTS.map(slot => \`
  <div class="qr-each" data-for="\${slot}" style="display:none">
    <label class="row"><span>\${qrName(slot)} の深さ（うら面は高さ）</span>
      <b data-out="qrh" data-slot="\${slot}"></b></label>
    <input type="range" data-key="qrh" data-slot="\${slot}" min="0.4" max="3" step="0.1" value="0.6">
    <label class="row"><span>\${qrName(slot)} のまわりの余白</span>
      <b data-out="mar" data-slot="\${slot}"></b></label>
    <input type="range" data-key="mar" data-slot="\${slot}" min="1.5" max="6" step="0.5" value="2.5">
  </div>\`).join('');

const KEY_OF = { qrh:'qrh', mar:'margin' };
function paintQrEach() {
  for (const inp of document.querySelectorAll('#qrEach input[data-key]')) {
    const { key, slot } = inp.dataset;
    const v = state[KEY_OF[key]][slot];
    inp.value = v;
    document.querySelector(\`#qrEach b[data-out="\${key}"][data-slot="\${slot}"]\`).textContent =
      v.toFixed(1) + ' mm';
  }
}
document.getElementById('qrEach').addEventListener('input', e => {
  const inp = e.target.closest('input[data-key]'); if (!inp) return;
  const { key, slot } = inp.dataset;
  state[KEY_OF[key]][slot] = parseFloat(inp.value);
  paintQrEach();
  requestRebuild(false);
});
/* いま出す面だけ見せる（そのかたちに有る面で、QRをえらんでいるもの） */
function syncQrEach() {
  const use = KIND_SLOTS[state.kind] || [];
  for (const row of document.querySelectorAll('#qrEach .qr-each'))
    row.style.display = (use.includes(row.dataset.for) && state.slots[row.dataset.for] === 'qr')
      ? '' : 'none';
}
paintQrEach();`);

put(`slider('mar', 'margin', v => v.toFixed(1) + ' mm', 'marV');\n`, '');

put(`    syncBoxPanel();
    syncSlotUrls();`,
`    syncBoxPanel();
    syncSlotUrls();
    syncQrEach();`);
put(`  document.getElementById('thickKey').style.display = key ? '' : 'none';`,
`  document.getElementById('thickKey').style.display = key ? '' : 'none';
  syncQrEach();`);
put(`syncSlotUrls();\nsyncMagnet();`, `syncSlotUrls();\nsyncMagnet();\nsyncQrEach();`);

put(`  q.innerHTML = info.qrhCut
    ? \`<span class="bad">⚠ おもて面は <b>\${info.inlayMax.toFixed(1)} mm</b> までしか掘れません。\` +
      \`厚みを増やすと、もっと深くできます</span>\`
    : \`おもて面は <b>\${info.inlayMax.toFixed(1)} mm</b> まで掘れます（うら面は上に足すので制限なし）\`;`,
`  q.innerHTML = info.qrhCut
    ? \`<span class="bad">⚠ 掘れるのは <b>\${info.inlayMax.toFixed(1)} mm</b> まで。\` +
      \`厚みを増やすと、もっと深くできます</span>\`
    : \`掘れるのは <b>\${info.inlayMax.toFixed(1)} mm</b> まで（QRタイルのうら面は上に足すので制限なし）\`;`);

fs.writeFileSync(p, s.replace(/\n/g, '\r\n'));
console.log('QRごとのつまみを作った');
