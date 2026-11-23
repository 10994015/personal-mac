/*
 * 進站 loading：Mac 開機風格，進度條跟著實際載入進度走，完成後淡出到桌面。
 * window.siteReady 會在開始淡出時完成，其他動畫都等它。
 */
window.siteReady = new Promise((resolve) => {
  'use strict';

  const cover = document.getElementById('boot');
  if (!cover) { resolve(); return; }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_MS = calm ? 300 : 1300; // 快取很快時也讓動畫看得完
  const MAX_MS = 4500;             // 網路再慢也不會把人擋在外面
  const started = performance.now();

  const images = ['me-sprite.webp', 'award.webp', 'paper.jpg', 'stamp.webp', 'favicon.png'].map((f) => `assets/${f}`);
  if (window.SITE) window.SITE.works.forEach((w) => images.push(`assets/works/${w.image}`));

  let done = 0;
  const total = images.length + 2;
  const tick = () => { done += 1; };

  images.forEach((src) => {
    const img = new Image();
    img.onload = tick;
    img.onerror = tick; // 一張圖壞掉不該卡住整個網站
    img.src = src;
  });

  const fontSheet = document.getElementById('fontCss');
  const sheetLoaded = new Promise((ok) => {
    if (!fontSheet || fontSheet.sheet) { ok(); return; }
    fontSheet.addEventListener('load', ok, { once: true });
    fontSheet.addEventListener('error', ok, { once: true });
  });
  sheetLoaded
    .then(() => (document.fonts ? Promise.all([
      document.fonts.load('800 100px Outfit', 'LICHENGYAN'),
      document.fonts.load('500 14px Outfit', 'about_me.txt'),
      document.fonts.load('400 13px "JetBrains Mono"', '2022'),
    ]) : null))
    .catch(() => {})
    .then(tick);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, { once: true });
  else tick();

  function leave() {
    cover.classList.add('is-leaving');
    cover.removeAttribute('role');
    setTimeout(resolve, 120);
    setTimeout(() => cover.remove(), calm ? 0 : 700);
  }

  let shown = 0;
  function frame(now) {
    const elapsed = Math.max(0, now - started);
    const real = elapsed >= MAX_MS ? 1 : done / total;
    const target = Math.min(real, elapsed / MIN_MS);
    shown += (target - shown) * 0.18;
    if (target - shown < 0.002) shown = target;

    const value = Math.round(shown * 100);
    cover.style.setProperty('--p', shown.toFixed(4));
    cover.setAttribute('aria-valuenow', value);

    if (shown >= 1) setTimeout(leave, calm ? 0 : 220);
    else requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
