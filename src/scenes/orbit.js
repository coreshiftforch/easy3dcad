/* つかんで まわす（視点の向きを変える）＋ 視点リセット。

   ── 使いかた ────────────────────────────────────────────
     const orb = attachOrbit(host, { dir: [0.34, -0.78, 0.52], onChange: draw });
     … カメラを置くとき orb.dir() を使う …
     orb.reset();      // はじめの向きに戻す
     orb.dispose();    // 画面を捨てるとき

   ★向きは「方位（az）と 見おろし（el）」で持つ。ベクトルのまま回すと、
     まわすほど ゆがみが たまって 水平が くずれる。
   ★見おろしは ±80°まで。真上まで行くと「上はどっち」が決まらなくなって
     画がひっくり返る。
   ★つかんで動かす向きは「モデルを引きずる」感じにそろえる。右へ引いたら
     モデルも右へ回る＝カメラは左へまわるので、方位は引いた向きと逆に足す。 */

const LIMIT = 1.4;          // 見おろしの上限（ラジアン。約80°）
const SPEED = 0.011;        // 1画素あたり何ラジアンまわすか

export function attachOrbit(host, { dir = [0.34, -0.78, 0.52], onChange } = {}) {
  const n = Math.hypot(...dir) || 1;
  const d0 = dir.map(v => v / n);
  const home = { az: Math.atan2(d0[0], -d0[1]), el: Math.asin(Math.max(-1, Math.min(1, d0[2]))) };
  const ang = { ...home };
  let drag = null, touched = false;

  const dirOf = () => [
    Math.sin(ang.az) * Math.cos(ang.el),
    -Math.cos(ang.az) * Math.cos(ang.el),
    Math.sin(ang.el),
  ];

  const down = ev => {
    if (ev.button !== undefined && ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY };
    host.classList.add('grabbing');
    try { host.setPointerCapture(ev.pointerId); } catch { /* 古いブラウザ */ }
  };
  const move = ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.x = ev.clientX; drag.y = ev.clientY;
    ang.az -= dx * SPEED;
    ang.el = Math.max(-LIMIT, Math.min(LIMIT, ang.el + dy * SPEED));
    touched = true;
    onChange?.();
  };
  const up = ev => {
    if (!drag) return;
    drag = null;
    host.classList.remove('grabbing');
    try { host.releasePointerCapture(ev.pointerId); } catch { /* 何もしない */ }
  };

  host.classList.add('grabbable');
  host.addEventListener('pointerdown', down);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);

  return {
    dir: dirOf,
    get moved() { return touched; },
    reset() {
      ang.az = home.az; ang.el = home.el;
      touched = false;
      onChange?.();
    },
    dispose() {
      host.classList.remove('grabbable', 'grabbing');
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
    },
  };
}

/* 窓のすみに置く「視点リセット」ボタン。押すと はじめの向きに戻る。
   ★見た目は style.css の .view-reset。3Dの窓の中に浮かせる。 */
export function resetButton(host, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'view-reset';
  b.title = '視点を戻す';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>'
    + '<span>視点</span>';
  b.onclick = e => { e.stopPropagation(); onClick(); };
  /* ★押しはじめが まわす操作にならないよう、ボタンの上では つかませない */
  b.addEventListener('pointerdown', e => e.stopPropagation());
  host.appendChild(b);
  return b;
}
