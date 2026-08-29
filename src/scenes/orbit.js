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
/* ほぼ真上（=LIMIT）。真上ちょうどにはできない。上がどっちか決まらなくなる */
export const TOP_EL = LIMIT;
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
    /* 決めた向きへ向ける（真上から見せたいとき等）。
       ★見おろしは 上限までで止める。reset() と違い、
         これは「もう自分で動かした」あつかいにする（ひとりでに回らない）。 */
    aim(az, el) {
      ang.az = az;
      ang.el = Math.max(-LIMIT, Math.min(LIMIT, el));
      touched = true;
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

/* 2本指で つまんで 大きく／小さく。

   ── 使いかた ──────────────────────────────────────
     attachPinch(host, { onScale: f => zoomBy(f) });

   ★指が1本のときは 何もしない。まわす・つかむ操作と ぶつからない。
   ★touchmove で preventDefault する（passive: false）。これをしないと
     ブラウザが「ページごと拡大」してしまい、3Dは大きくならない。
     CSS 側でも .view に touch-action: pan-y を入れてある。
   ★倍率は「前の指の間かく」との比で返す。はじめとの比にすると、
     指を置きなおしたとき とぶ。 */
export function attachPinch(host, { onScale, onStart } = {}) {
  let last = 0;
  const gap = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const start = e => { if (e.touches.length === 2) { last = gap(e.touches); onStart?.(); } };
  const move = e => {
    if (e.touches.length !== 2 || !last) return;
    e.preventDefault();
    const now = gap(e.touches);
    if (!now) return;
    onScale?.(now / last);
    last = now;
  };
  const end = e => { if (e.touches.length < 2) last = 0; };
  host.addEventListener('touchstart', start, { passive: true });
  host.addEventListener('touchmove', move, { passive: false });
  host.addEventListener('touchend', end);
  host.addEventListener('touchcancel', end);
  return {
    dispose() {
      host.removeEventListener('touchstart', start);
      host.removeEventListener('touchmove', move);
      host.removeEventListener('touchend', end);
      host.removeEventListener('touchcancel', end);
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

/* 窓のすみに置く「全画面」ボタン。押すと 3Dの窓だけが 画面いっぱいになる。
   ★ブラウザの Fullscreen API は **使わない**。iPhone の Safari は
     動画にしか効かず、押しても何も起きないため。代わりに CSS で
     position:fixed / inset:0 に広げる（style.css の .view-fs）。
     どの機械でも同じに動き、窓の中のボタン（視点・虫めがね）も
     そのまま使える。
   ★広げると大きさが変わる。どの窓も ResizeObserver で描き直すので、
     こちらから知らせなくてよい。
   ★Esc でも戻れるようにしてある（PCの全画面と同じ気持ちで押せるように）。 */
const FULL_ICON = on => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + (on ? '<path d="M9 3v6H3M15 3v6h6M15 21v-6h6M9 21v-6H3"/>'
        : '<path d="M9 3H3v6M15 3h6v6M15 21h6v-6M9 21H3v-6"/>')
  + '</svg>';

export function fullButton(host) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'view-full';

  const on = () => host.classList.contains('view-fs');
  const paint = () => {
    b.title = on() ? 'もとの大きさに戻す' : '画面いっぱいで見る';
    b.setAttribute('aria-pressed', String(on()));
    /* ★戻すほうは ひらがなで書く。ひらがなモードでも同じ字数で収まる */
    b.innerHTML = FULL_ICON(on()) + '<span>' + (on() ? 'もどす' : '全画面') + '</span>';
  };

  function set(next) {
    host.classList.toggle('view-fs', next);
    paint();
  }
  function onKey(e) { if (e.key === 'Escape' && on()) { e.preventDefault(); set(false); } }

  b.onclick = e => { e.stopPropagation(); set(!on()); };
  /* ★押しはじめが まわす操作にならないよう、ボタンの上では つかませない */
  b.addEventListener('pointerdown', e => e.stopPropagation());
  document.addEventListener('keydown', onKey);

  paint();
  host.appendChild(b);
  return b;
}
