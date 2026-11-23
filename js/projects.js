/* 個人專案：全螢幕卡片牌組（showcase）與專案介紹頁（detail）。
   app.js 透過 window.PROJECTS.open() / openDetail(id) 呼叫。 */
(() => {
  'use strict';

  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const shot = (c, n) => `${c.dir}/${n}.webp`;
  const CLOSE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

  // The rest of the page is made inert while an overlay is open.
  const backdrop = () => $$('.menubar, #desktop, .dock-wrap');
  let openCount = 0;
  const setInert = (on) => {
    openCount = Math.max(0, openCount + (on ? 1 : -1));
    backdrop().forEach((el) => { el.inert = openCount > 0; });
    ring.toggle(openCount > 0);
  };

  // Inside the project pages the pointer becomes a soft ring that trails it slightly,
  // grows over anything clickable and presses in on click. Mouse/trackpad only.
  const ring = (() => {
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let el = null;
    let on = false;
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    const frame = () => {
      const k = reduceMotion.matches ? 1 : 0.32;
      rx += (x - rx) * k;
      ry += (y - ry) * k;
      el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(frame) : 0;
    };
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      x = e.clientX; y = e.clientY;
      if (!el.classList.contains('is-shown')) { rx = x; ry = y; el.classList.add('is-shown'); }
      el.classList.toggle('is-hot', Boolean(e.target.closest && e.target.closest('a, button, [role="button"], .sc-card')));
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const down = () => el.classList.add('is-down');
    const up = () => el.classList.remove('is-down');
    const out = (e) => { if (!e.relatedTarget) el.classList.remove('is-shown'); };
    return {
      toggle(want) {
        want = want && fine.matches;
        if (want === on) return;
        on = want;
        if (!el) { el = document.createElement('div'); el.className = 'pj-ring'; el.setAttribute('aria-hidden', 'true'); }
        document.documentElement.classList.toggle('pj-cursor', on);
        if (on) {
          document.body.appendChild(el);
          addEventListener('pointermove', move, { passive: true });
          addEventListener('pointerdown', down);
          addEventListener('pointerup', up);
          document.addEventListener('pointerout', out);
        } else {
          removeEventListener('pointermove', move);
          removeEventListener('pointerdown', down);
          removeEventListener('pointerup', up);
          document.removeEventListener('pointerout', out);
          cancelAnimationFrame(raf); raf = 0;
          el.classList.remove('is-shown', 'is-hot', 'is-down');
          el.remove();
        }
      },
    };
  })();

  function mock(c, eager) {
    const [a, b, d] = c.theme;
    const load = eager ? '' : 'loading="lazy"';
    const phones = c.mock.phones || [];
    const badges = c.mock.badges || []; // round stickers floating around a laptop-only cover
    return `
      <div class="mock ${phones.length ? '' : 'solo'}" style="--m1:${esc(a)};--m2:${esc(b)};--m3:${esc(d)}" aria-hidden="true">
        <div class="mk-laptop">
          <div class="mk-screen"><img src="${shot(c, c.mock.laptop)}" alt="" ${load}></div>
          <div class="mk-base"></div>
        </div>
        ${phones.map((n, i) => `<div class="mk-phone p${i + 1}"><img src="${shot(c, n)}" alt="" ${load}></div>`).join('')}
        ${badges.map((n, i) => `<img class="mk-badge k${i + 1}" src="${shot(c, n)}" alt="" ${load}>`).join('')}
      </div>`;
  }

  function overlay(cls, label) {
    const el = document.createElement('div');
    el.className = cls;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', label);
    el.tabIndex = -1;
    return el;
  }

  function leave(el, then) {
    el.classList.add('is-leaving');
    const done = () => { el.remove(); if (then) then(); };
    if (reduceMotion.matches) done();
    else setTimeout(done, 320);
  }

  /* ---------- showcase: the card deck ---------- */
  let deck = null;

  function open(from) {
    if (deck) return;
    const list = S.cases;
    const el = overlay('sc', '個人專案');
    el.innerHTML = `
      <button class="ov-close" type="button" aria-label="關閉個人專案">${CLOSE_ICON}</button>
      <div class="sc-info" aria-live="polite">
        <span class="sc-year" data-year></span>
        <h2 data-title></h2>
        <p data-meta></p>
        <div class="sc-foot">
          <span data-count></span>
          <span class="sc-hint">${list.length > 1 ? '滾動、滑動或用 ← → 切換專案' : '更多專案整理中'}</span>
        </div>
      </div>
      <div class="sc-stage">
        <div class="sc-orbit" aria-hidden="true"></div>
        <div class="sc-sun" aria-hidden="true"></div>
        ${list.map((c, i) => `
          <button class="sc-card" type="button" data-i="${i}" aria-label="查看專案：${esc(c.title)}">
            ${mock(c, i === 0)}
            <span class="sc-view">VIEW PROJECT</span>
          </button>`).join('')}
      </div>
`;
    document.body.appendChild(el);
    setInert(true);

    const cards = $$('.sc-card', el);
    const N = list.length;
    const stage = $('.sc-stage', el);
    const orbit = $('.sc-orbit', el);
    const sun = $('.sc-sun', el);
    const info = $('.sc-info', el);
    // The projects sit on an elliptical orbit around a glowing "sun": the current one is at the front,
    // the rest recede along the ring, smaller and dimmer the further back they are.
    // rot is a continuous position (in cards), so turning past the last project wraps round to the first.
    let cur = 0;
    let rot = 0;
    let geo = null;
    const measure = () => {
      const W = innerWidth, H = innerHeight;
      const narrow = W < 760;
      const cardW = Math.min(860, W * (narrow ? 0.92 : 0.6), H * 0.58 * 1.6);
      geo = {
        cardW,
        cx: W / 2,
        cy: H * (narrow ? 0.54 : 0.45),
        rx: Math.min(W * (narrow ? 0.38 : 0.42), 660),
        ry: H * (narrow ? 0.16 : 0.2),
        tilt: -0.14, // the orbit plane leans: left side lower, right side higher (≈8°), clear of the title at top left
      };
      stage.style.setProperty('--card-w', `${cardW}px`);
      Object.assign(orbit.style, {
        left: `${geo.cx - geo.rx}px`, top: `${geo.cy - geo.ry}px`, width: `${geo.rx * 2}px`, height: `${geo.ry * 2}px`,
        transform: `skewY(${Math.atan(geo.tilt)}rad)`,
      });
      Object.assign(sun.style, { left: `${geo.cx}px`, top: `${geo.cy}px`, width: `${cardW * 1.15}px` });
    };
    const wrap = (d) => ((d % N) + N + N / 2) % N - N / 2; // -N/2 … N/2, nearest way round
    const place = () => {
      cards.forEach((card, i) => {
        const t = (wrap(i - rot) / N) * Math.PI * 2;
        const depth = (Math.cos(t) + 1) / 2; // 1 at the front, 0 at the very back
        const x = geo.cx + Math.sin(t) * geo.rx;
        // The lean is a shear, so the front slot (sin t = 0) stays exactly level and upright;
        // the further a planet is from the front, the more it tilts with the orbit.
        const y = geo.cy + Math.cos(t) * geo.ry + Math.sin(t) * geo.rx * geo.tilt;
        const tiltDeg = (1 - depth) * Math.atan(geo.tilt) * (180 / Math.PI);
        const s = 0.22 + Math.pow(depth, 3) * 0.78; // planets shrink quickly as they head round the back, so the front one stands out
        card.style.transform = `translate3d(${(x - geo.cardW / 2).toFixed(1)}px, ${(y - geo.cardW / 3.2).toFixed(1)}px, 0) rotate(${tiltDeg.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        card.style.zIndex = String(Math.round(depth * 100) + (depth > 0.5 ? 100 : 0)); // the front half passes in front of the sun
        card.style.setProperty('--dim', ((1 - depth) * 0.7).toFixed(3));
      });
    };
    let shown = -1;
    const label = () => {
      cards.forEach((card, i) => {
        card.classList.toggle('is-front', i === cur);
        card.tabIndex = i === cur ? 0 : -1;
      });
      if (cur === shown) return;
      const first = shown === -1;
      shown = cur;
      const c = list[cur];
      $('[data-year]', info).textContent = c.year;
      $('[data-title]', info).textContent = c.title;
      $('[data-meta]', info).textContent = `${c.client} · ${c.product}`;
      $('[data-count]', info).textContent = `${String(cur + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
      if (!first && !reduceMotion.matches) {
        info.animate([{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
          { duration: 380, easing: 'cubic-bezier(.2, .9, .25, 1)' });
      }
    };
    // Turning the orbit: rot eases towards its target along the ring (a CSS transition would cut straight across).
    let raf = 0, rFrom = 0, rTo = 0, t0 = 0, dur = 0;
    const ease = (k) => 1 - Math.pow(1 - k, 3.2);
    const tick = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      rot = rFrom + (rTo - rFrom) * ease(k);
      place();
      raf = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    const turnTo = (target, ms) => {
      cancelAnimationFrame(raf);
      if (reduceMotion.matches) { rot = rTo = target; place(); return; }
      rFrom = rot; rTo = target; t0 = performance.now(); dur = ms;
      raf = requestAnimationFrame(tick);
    };
    const go = (step) => {
      if (N < 2) return;
      cur = (cur + step + N) % N;
      label();
      turnTo(rTo + step, 820);
      $('.sc-card.is-front', el).focus({ preventScroll: true });
    };
    const goTo = (i) => {
      const step = wrap(i - cur);
      if (step) go(Math.round(step));
    };
    const onResize = () => { measure(); place(); };
    addEventListener('resize', onResize);

    let lock = 0;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 12 || Date.now() < lock) return;
      lock = Date.now() + 620;
      go(d > 0 ? 1 : -1);
    }, { passive: false });
    let touch = null;
    el.addEventListener('touchstart', (e) => { touch = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!touch) return;
      const dx = touch[0] - e.changedTouches[0].clientX;
      const dy = touch[1] - e.changedTouches[0].clientY;
      touch = null;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(d) > 45) go(d > 0 ? 1 : -1);
    });
    el.addEventListener('keydown', (e) => {
      if (deckDetailOpen()) return;
      const step = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (step) { e.preventDefault(); go(step); }
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    stage.addEventListener('click', (e) => {
      const card = e.target.closest('.sc-card');
      if (!card) return;
      const i = Number(card.dataset.i);
      if (i === cur) openDetail(list[i].id, card); // the front planet opens; any other one turns to the front
      else goTo(i);
    });
    $('.ov-close', el).addEventListener('click', () => close());

    function close() {
      if (!deck) return;
      const back = deck.from;
      deck = null;
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      setInert(false);
      leave(el, () => { if (back && back.isConnected) back.focus({ preventScroll: true }); });
    }
    deck = { el, from, close };
    measure();
    label();
    rot = reduceMotion.matches ? 0 : -1.6; // swing in from a little way round the orbit
    place();
    turnTo(0, 1300);
    requestAnimationFrame(() => el.classList.add('is-in'));
    $('.sc-card.is-front', el).focus({ preventScroll: true });
  }
  const deckDetailOpen = () => Boolean($('.pd'));

  /* ---------- detail: the project page ---------- */
  const isPhone = (c, n) => (c.phones || []).includes(n);

  // A framed screenshot: phone bezel or browser window, picked from the project's phone list.
  const frame = (c, n, alt) => `
    <div class="pd-frame ${isPhone(c, n) ? 'is-phone' : 'is-desk'}"><img src="${shot(c, n)}" alt="${esc(alt)}" loading="lazy"></div>`;

  // A section with its heading on top (for screenshots, video, diagrams).
  const sec = (title, body, extra = '') => `
    <section class="pd-sec rv ${extra}">
      <h3>${esc(title)}</h3>
      ${body}
    </section>`;

  // A text section: heading in the left column, prose in the right, like a written case study.
  const split = (title, body) => `
    <section class="pd-sec pd-split rv">
      <h3>${esc(title)}</h3>
      <div class="sp-body">${body}</div>
    </section>`;

  // A run of topics, each its own row: the topic as the heading on the left, its points merged into
  // flowing paragraphs on the right (two paragraphs when there is a lot to say). A small label names the group.
  const topics = (label, list) => `
    <section class="pd-sec pd-topics rv">
      <p class="pd-label">${esc(label)}</p>
      ${list.map((h) => {
        const half = h.items.length >= 4 ? Math.ceil(h.items.length / 2) : h.items.length;
        const paras = [h.items.slice(0, half), h.items.slice(half)].filter((x) => x.length);
        return `
      <div class="pd-topic">
        <h3>${esc(h.title)}</h3>
        <div class="tp-body">${paras.map((x) => `<p>${esc(x.join(''))}</p>`).join('')}</div>
      </div>`;
      }).join('')}
    </section>`;

  // Short titled passages for the right column of a split section.
  const passages = (list) => list.map(([title, paras]) => `
    <div class="pd-pt">
      <h4>${esc(title)}</h4>
      ${paras.map((t) => `<p>${esc(t)}</p>`).join('')}
    </div>`).join('');

  // A light "spec sheet" canvas: dashed groups holding white component cards, like a design file.
  const archSheet = (a) => `
    <div class="pd-arch">
      <div class="ax-group ax-flow">
        <span class="ax-tag">FLOW</span>
        <ol style="--n:${a.flow.length}">${a.flow.map(([k, v, sub], i) => `
          <li><span class="ax-step">${String(i + 1).padStart(2, '0')} · ${esc(k)}</span><b>${esc(v)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</li>`).join('')}
        </ol>
      </div>
      <div class="ax-stores">${a.stores.map(([name, rows]) => `
        <div class="ax-group">
          <span class="ax-tag">${esc(name)}</span>
          <ul class="ax-menu">${rows.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>`).join('')}
      </div>
    </div>
    ${a.notes?.length ? `<ul class="arch-notes">${a.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`;

  // Floating, overlapping screenshots with soft edges — an interlude between text sections.
  function collage(c) {
    if (!c.collage) return '';
    return `
      <figure class="pd-collage rv" aria-label="${esc(c.title)} 畫面拼貼">
        <div class="cl-stage">${c.collage.items.map((it) => `
          <div class="cl-item ${isPhone(c, it.n) ? 'is-phone' : 'is-desk'}" data-depth="${it.z}"
               style="left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${it.z};--rot:${it.rot || 0}deg">
            <img src="${shot(c, it.n)}" alt="" loading="lazy">
          </div>`).join('')}
        </div>
        <figcaption>${esc(c.collage.caption)}</figcaption>
      </figure>`;
  }

  // Split panel: a dark headline card overlapped by a lighter card that holds the screen.
  function feature(c) {
    const f = c.feature;
    if (!f) return '';
    const phone = isPhone(c, f.n);
    return `
      <section class="pd-feature rv ${phone ? 'with-phone' : 'with-desk'}">
        <div class="ft-intro" style="--bg:url('${esc(new URL(shot(c, f.n), location.href).href)}')">
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.text)}</p>
        </div>
        <div class="ft-card">
          ${frame(c, f.n, `${f.title} 畫面`)}
          <ul>${f.points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
      </section>`;
  }

  function shotGroups(c) {
    const meta = c.groups || [...new Set(c.shots.map((s) => s.group))].map((name) => ({ name, kicker: 'SCREENS' }));
    return meta.map((g) => {
      const list = c.shots.filter((s) => s.group === g.name);
      const phones = list.filter((s) => isPhone(c, s.n));
      const desks = list.filter((s) => !isPhone(c, s.n));
      const cap = (s) => `<figcaption><b>${esc(s.title)}</b>${esc(s.text)}</figcaption>`;
      const strip = phones.length >= 3 ? `
        <div class="pd-phones">${phones.map((s) => `<figure class="pd-phone">${frame(c, s.n, `${s.title} 畫面`)}${cap(s)}</figure>`).join('')}</div>` : '';
      // One or two phone screens sit beside their caption instead of in a near-empty strip.
      const solos = phones.length && phones.length < 3 ? phones.map((s) => `
        <figure class="pd-solo">${frame(c, s.n, `${s.title} 畫面`)}${cap(s)}</figure>`).join('') : '';
      const grid = desks.length ? `
        <div class="pd-desks">${desks.map((s) => `<figure class="pd-desk">${frame(c, s.n, `${s.title} 畫面`)}${cap(s)}</figure>`).join('')}</div>` : '';
      const desksFirst = list.length && !isPhone(c, list[0].n);
      const nav = strip && phones.length > 3 ? `<div class="pd-strip-nav">
          <button type="button" data-strip="-1" aria-label="上一組截圖">‹</button>
          <button type="button" data-strip="1" aria-label="下一組截圖">›</button>
        </div>` : '';
      return `
        <section class="pd-sec rv">
          <div class="pd-h"><h3>${esc(g.name)}</h3>${desksFirst ? '' : nav}</div>
          ${desksFirst ? grid + strip + solos : strip + solos + grid}
        </section>`;
    }).join('');
  }

  function openDetail(id, from) {
    const c = S.cases.find((x) => x.id === id);
    if (!c || $('.pd')) return;
    const el = overlay('pd', `${c.title} 專案介紹`);
    el.innerHTML = `
      <button class="ov-close" type="button" aria-label="關閉專案介紹">${CLOSE_ICON}</button>
      <div class="pd-scroll">
        <article class="pd-inner">
          <div class="pd-hero">${mock(c, true)}</div>

          <header class="pd-head rv">
            <h2>${esc(c.title)}</h2>
            <p>${esc(c.subtitle)}</p>
          </header>

          <div class="pd-cards rv">
            <section class="pd-card">
              <h3>ABOUT THE PROJECT</h3>
              <p>${esc(c.about)}</p>
              <h3>MY ROLE</h3>
              <p>${esc(c.role)}</p>
            </section>
            <section class="pd-card raised">
              <dl>
                <dt>YEAR</dt><dd>${esc(c.year)}</dd>
                <dt>CLIENT</dt><dd>${esc(c.client)}</dd>
                <dt>PRODUCT</dt><dd>${esc(c.product)}</dd>
                <dt>TEAM</dt><dd>${esc(c.team)}</dd>
                <dt>STACK</dt><dd>${c.facts.map(([k, v]) => `${esc(k)}：${esc(v)}`).join('<br>')}</dd>
                <dt>DELIVERABLES</dt><dd>${esc(c.deliverables)}</dd>
              </dl>
            </section>
          </div>

          <ul class="pd-stats rv">${c.stats.map(([v, k]) => `<li><b>${esc(v)}</b><span>${esc(k)}</span></li>`).join('')}</ul>

          ${collage(c)}

          ${split('要解決的問題', `
            <div class="pd-problems">${c.problems.map(([q, a]) => `
              <div class="pr"><p class="q">${esc(q)}</p><p class="a">${esc(a)}</p></div>`).join('')}
            </div>`)}

          ${shotGroups(c)}

          ${feature(c)}

          ${c.logic ? topics('業務邏輯', c.logic) : ''}

          ${c.video ? sec('操作示範', `
            <figure class="pd-video">
              <video src="${esc(`${c.dir}/${c.video.src}`)}" poster="${esc(`${c.dir}/${c.video.poster}`)}" controls muted playsinline loop preload="none"></video>
              ${c.video.caption ? `<figcaption>${esc(c.video.caption)}</figcaption>` : ''}
            </figure>`) : ''}

          ${topics('技術亮點', c.highlights)}

          ${c.stories ? split('開發心得', passages(c.stories.map(([t, body]) => [t, [body]]))) : ''}

          ${c.architecture ? sec('系統架構', archSheet(c.architecture)) : ''}

          <footer class="pd-foot rv">
            ${c.note ? `<p>${esc(c.note)}</p>` : ''}
            <div class="pd-actions">
              <button class="pd-btn" type="button" data-back>${deck ? '回到專案列表' : '關閉'}</button>
            </div>
          </footer>
        </article>
      </div>
      <div class="pd-blur is-top" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="pd-blur" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
    document.body.appendChild(el);
    setInert(true);
    if (deck) deck.el.inert = true;

    const scroller = $('.pd-scroll', el);
    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      }), { root: scroller, rootMargin: '0px 0px -8% 0px' });
      $$('.rv', el).forEach((n) => io.observe(n));
    } else {
      $$('.rv', el).forEach((n) => n.classList.add('in'));
    }

    // The demo video plays (muted) while it is on screen and pauses once it scrolls away.
    const video = $('.pd-video video', el);
    if (video && 'IntersectionObserver' in window && !reduceMotion.matches) {
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }, { root: scroller, threshold: 0.55 }).observe(video);
    }

    // The soft edge blurs fade away at either end of the page, so the hero and the footer stay sharp.
    const [blurTop, blurBottom] = $$('.pd-blur', el);
    const atEnd = () => {
      blurTop.classList.toggle('is-end', scroller.scrollTop < 20);
      blurBottom.classList.toggle('is-end', scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 80);
    };
    scroller.addEventListener('scroll', atEnd, { passive: true });
    atEnd();

    // Collage parallax: nearer layers drift a little faster than the ones behind.
    const layers = $$('.cl-item', el);
    if (layers.length && !reduceMotion.matches) {
      let ticking = false;
      const drift = () => {
        ticking = false;
        const view = scroller.clientHeight;
        layers.forEach((it) => {
          const r = it.parentElement.getBoundingClientRect();
          const off = (r.top + r.height / 2 - view / 2) / view; // -1 … 1 around the viewport centre
          it.style.setProperty('--py', `${(off * Number(it.dataset.depth) * r.width * -0.018).toFixed(1)}px`); // drift scales with collage width
        });
      };
      scroller.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
      drift();
    }

    $$('[data-strip]', el).forEach((btn) => btn.addEventListener('click', () => {
      const strip = $('.pd-phones', btn.closest('.pd-sec'));
      strip.scrollBy({ left: Number(btn.dataset.strip) * strip.clientWidth * 0.8, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }));

    const close = () => {
      if (!el.isConnected || el.classList.contains('is-leaving')) return;
      setInert(false);
      if (deck) deck.el.inert = false;
      leave(el, () => { if (from && from.isConnected) from.focus({ preventScroll: true }); });
    };
    $('.ov-close', el).addEventListener('click', close);
    $('[data-back]', el).addEventListener('click', close);
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    requestAnimationFrame(() => el.classList.add('is-in'));
    el.focus({ preventScroll: true });
  }

  window.PROJECTS = { open, openDetail };
})();
