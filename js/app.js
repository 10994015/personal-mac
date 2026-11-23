(() => {
  'use strict';

  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const PALETTE = ['#01d9d3', '#ffcb46', '#ff81cc', '#57ef97', '#d661ff'];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const siteReady = window.siteReady || Promise.resolve();
  const phone = matchMedia('(max-width: 760px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  const desktop = $('#desktop');
  const dock = $('#dock');
  const windows = {};
  let zTop = 10;
  let booted = false;

  /* ---------- dock icons ---------- */
  const glyphs = {
    about: '<text x="32" y="46" text-anchor="middle" font-family="Outfit,Arial,sans-serif" font-size="39" font-weight="800" fill="#fff">A</text>',
    experience: '<path d="M16 22l11 10-11 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 44h16" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
    thesis: '<path d="M19 15h23a4 4 0 014 4v26a4 4 0 01-4 4H19z" fill="#fff" opacity=".96"/><path d="M19 15a5 5 0 00-5 5v25a5 5 0 015-5h27" fill="none" stroke="#0d7f6b" stroke-opacity=".4" stroke-width="2"/><path d="M25 23h15M25 29h15" stroke="#18a98f" stroke-width="3" stroke-linecap="round"/>',
    awards: '<path d="M23 11h9l5 13h-9zM41 11h-9l-5 13h9z" fill="#fff" opacity=".7"/><circle cx="32" cy="36" r="15" fill="#fff"/><path d="M32 27l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1-5.4-3-5.4 3 1.1-6.1-4.5-4.2 6.1-.8z" fill="#f5941d"/>',
    works: '<path d="M11 21a4 4 0 014-4h11l5 5h18a4 4 0 014 4v2H11z" fill="#fff" opacity=".7"/><rect x="11" y="26" width="42" height="24" rx="4" fill="#fff"/>',
    mail: '<rect x="11" y="18" width="42" height="29" rx="5" fill="#fff"/><path d="M13 21l19 15 19-15" fill="none" stroke="#20b95a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const iconColors = {
    about: ['#ff8a7a', '#e93d3a'], experience: ['#7fb2ff', '#2d68ee'], thesis: ['#6cecc9', '#14a68c'],
    awards: ['#ffd25f', '#f58f18'], works: ['#7ce3f8', '#1baede'], mail: ['#7cec98', '#1eb455'],
  };
  const dockIcon = (id) => {
    const [a, b] = iconColors[id];
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="ic-${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#ic-${id})"/><rect x="1" y="1" width="62" height="62" rx="14" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>${glyphs[id]}</svg>`;
  };

  /* ---------- window contents ---------- */
  function renderExperience(body) {
    const row = (j, i) => {
      const item = (it) => (typeof it === 'string'
        ? `<li>${esc(it)}</li>`
        : `<li>${esc(it.text)}<ul>${it.sub.map(item).join('')}</ul></li>`);
      const status = j.tag ? `[${j.tag}]` : (j.active ? '[ACTIVE]' : '[CLOSED]');
      const meta = [j.period, j.duration, j.location, j.org].filter(Boolean).join(' · ');
      const num = String(i + 1).padStart(2, '0');
      return `<li class="log-item">
        <button class="log-row" type="button" aria-expanded="false">
          <span class="log-num">${num} &gt;</span>
          <span class="log-date">[${esc(j.date)}]</span>
          <span class="log-what"><b>${esc(j.company)}</b> <span class="log-dot">·</span> <span class="log-role">${esc(j.role)}</span></span>
          <span class="log-loc">${esc(j.location || '')}</span>
          <span class="log-status ${j.active ? 'active' : ''}">${esc(status)}</span>
          <span class="log-chev" aria-hidden="true">›</span>
        </button>
        <div class="log-detail" hidden>
          <p class="role">${esc(j.role)}</p>
          <p class="meta">${esc(meta)}</p>
          ${j.note ? `<p class="note">${esc(j.note)}</p>` : ''}
          <ol>${j.items.map(item).join('')}</ol>
          ${j.tags ? `<p class="tags">${j.tags.map((t) => `#${esc(t)}`).join(' ')}</p>` : ''}
        </div>
      </li>`;
    };
    const skillCount = S.skills.reduce((n, g) => n + g.list.length, 0);
    body.innerHTML = `
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" type="button" aria-selected="true" data-tab="jobs">EXPERIENCE</button>
        <button class="tab" role="tab" type="button" aria-selected="false" data-tab="skills">SKILLS</button>
        <button class="tab" role="tab" type="button" aria-selected="false" data-tab="education">EDUCATION</button>
      </div>
      <div class="scroll log" data-pane="jobs"><ul style="list-style:none;padding:0">${S.jobs.map(row).join('')}</ul></div>
      <div class="scroll log" data-pane="education" hidden><ul style="list-style:none;padding:0">${S.education.map(row).join('')}</ul></div>
      <div class="scroll" data-pane="skills" hidden>
        ${S.skills.map((g) => `<section class="skill-group"><h3>${esc(g.group)}</h3><ul class="skill-list">${g.list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>`).join('')}
      </div>
      <div class="statusbar" style="font-family:var(--mono)"><span data-count>${S.jobs.length} entries</span><span>點一列看詳情</span></div>`;

    $$('.log-row', body).forEach((btn) => btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      btn.nextElementSibling.hidden = open;
    }));
    $$('.tab', body).forEach((tab) => tab.addEventListener('click', () => {
      $$('.tab', body).forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      $$('[data-pane]', body).forEach((p) => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
      const name = tab.dataset.tab;
      const counter = $('[data-count]', body);
      counter.textContent = { jobs: `${S.jobs.length} entries`, skills: `${skillCount} skills`, education: `${S.education.length} entries` }[name];
      counter.nextElementSibling.textContent = name === 'skills' ? '' : '點一列看詳情';
    }));
  }

  function renderAbout(body) {
    const line = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`;
    body.innerHTML = `
      <div class="editor-tools" role="toolbar" aria-label="文字格式">
        <button class="tool" type="button" data-size="-1" aria-label="縮小文字" style="font-size:11px">A</button>
        <button class="tool" type="button" data-size="1" aria-label="放大文字" style="font-size:15px;font-weight:600">A</button>
        <span class="tool-sep"></span>
        <button class="tool" type="button" data-cmd="bold" aria-label="粗體"><b>B</b></button>
        <button class="tool" type="button" data-cmd="italic" aria-label="斜體"><i>I</i></button>
        <button class="tool" type="button" data-cmd="underline" aria-label="底線"><u>U</u></button>
        <span class="tool-sep"></span>
        <button class="tool on" type="button" data-align="left" aria-label="靠左">${line('M2 4h12M2 8h8M2 12h11')}</button>
        <button class="tool" type="button" data-align="center" aria-label="置中">${line('M2 4h12M4 8h8M3 12h10')}</button>
        <button class="tool" type="button" data-align="right" aria-label="靠右">${line('M2 4h12M6 8h8M3 12h11')}</button>
      </div>
      <div class="scroll">
        <div class="about-head">
          <div class="avatar" role="img" aria-label="李承諺的卡通頭像"></div>
          <div class="about-id">
            <h3>${esc(S.name)} <small>${esc(S.nameEn)}</small></h3>
            <p class="about-role">${esc(S.headline)}</p>
            <i>"${esc(S.quote)}"</i>
            <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>
            <a href="tel:${esc(S.phone.replace(/-/g, ''))}">${esc(S.phone)}</a>
          </div>
        </div>
        <div class="doc" contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" aria-label="自我介紹，可以編輯">
          ${S.bio.map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>
      </div>
      <div class="statusbar"><span data-words></span><span>INS · UTF-8</span></div>`;

    const doc = $('.doc', body);
    const words = $('[data-words]', body);
    const count = () => { words.textContent = `${doc.innerText.replace(/\s/g, '').length} 字`; };
    doc.addEventListener('input', count);
    count();

    let size = 16.5;
    const tools = $('.editor-tools', body);
    // Keep the text selection when a toolbar button is pressed.
    tools.addEventListener('mousedown', (e) => e.preventDefault());
    tools.addEventListener('click', (e) => {
      const t = e.target.closest('.tool');
      if (!t) return;
      if (t.dataset.size) {
        size = clamp(size + Number(t.dataset.size), 14, 24);
        doc.style.setProperty('--doc-size', `${size}px`);
      } else if (t.dataset.cmd) {
        doc.focus();
        document.execCommand(t.dataset.cmd);
      } else if (t.dataset.align) {
        doc.style.textAlign = t.dataset.align;
        $$('[data-align]', tools).forEach((b) => b.classList.toggle('on', b === t));
      }
    });

    const avatar = $('.avatar', body);
    let timer = null;
    const talk = () => {
      if (timer || reduceMotion.matches) return;
      let i = 0;
      timer = setInterval(() => {
        i += 1;
        if (i > 16) { clearInterval(timer); timer = null; i = 0; }
        avatar.style.backgroundPositionX = `${(i / 16) * 100}%`;
      }, 130);
    };
    avatar.addEventListener('pointerenter', talk);
    siteReady.then(() => setTimeout(talk, 900));
  }

  function renderThesis(body) {
    const t = S.thesis;
    body.innerHTML = `
      <div class="pdf-tools"><span>摘要預覽</span></div>
      <div class="scroll"><div class="pdf-pages">
        <section class="pdf-card">
          <p class="pdf-kicker">${esc(t.kicker)}</p>
          <h3>${esc(t.title)}</h3>
          <ul>${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </section>
        <img class="pdf-cover" src="assets/paper.jpg" alt="碩士論文實體封面" loading="lazy">
        <section class="pdf-card pdf-abstract">
          <h4>摘要</h4>
          ${t.abstract.map((p) => `<p>${esc(p)}</p>`).join('')}
        </section>
      </div></div>
      <div class="statusbar"><span>僅提供摘要預覽</span><span>碩士學位論文</span></div>`;
  }

  function renderAwards(body) {
    const rows = [['獎項', '類別', '學年'], ...S.awards.map((a) => [a.title, a.type, a.year])];
    const blank = 4;
    const cell = (v, r, c) => `<td tabindex="${r === 0 && c === 0 ? 0 : -1}" data-r="${r}" data-c="${c}" class="${r === 0 ? 'is-head' : ''}">${esc(v)}</td>`;
    body.innerHTML = `
      <div class="fx"><span class="fx-ref" data-ref>A1</span><span class="fx-sym">fx</span><span class="fx-val" data-val></span></div>
      <div class="scroll sheet"><div class="sheet-inner">
        <table>
          <colgroup><col class="rownum"><col><col class="col-b"><col class="col-c"></colgroup>
          <thead><tr><th class="rownum"></th><th>A</th><th>B</th><th>C</th></tr></thead>
          <tbody>
            ${rows.map((row, r) => `<tr><th class="rownum" scope="row">${r + 1}</th>${row.map((v, c) => cell(v, r, c)).join('')}</tr>`).join('')}
            ${Array.from({ length: blank }, (_, i) => `<tr><th class="rownum" scope="row">${rows.length + i + 1}</th><td></td><td></td><td></td></tr>`).join('')}
          </tbody>
        </table>
        <img class="medal" src="assets/award.webp" alt="" width="74">
      </div></div>
      <div class="statusbar"><span>Sheet1</span><span>${S.awards.length} 筆紀錄</span></div>`;

    const ref = $('[data-ref]', body);
    const val = $('[data-val]', body);
    const select = (td, focus) => {
      $$('td.sel', body).forEach((c) => { c.classList.remove('sel'); c.tabIndex = -1; });
      td.classList.add('sel');
      td.tabIndex = 0;
      const col = 'ABC'[td.cellIndex - 1];
      ref.textContent = `${col}${td.parentElement.rowIndex}`;
      val.textContent = td.textContent;
      if (focus) td.focus();
    };
    const table = $('table', body);
    table.addEventListener('click', (e) => { const td = e.target.closest('td'); if (td) select(td); });
    table.addEventListener('keydown', (e) => {
      const td = e.target.closest('td');
      const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!td || !move) return;
      e.preventDefault();
      const nextRow = table.rows[td.parentElement.rowIndex + move[0]];
      const next = nextRow && nextRow.rowIndex > 0 && nextRow.cells[td.cellIndex + move[1]];
      if (next && next.tagName === 'TD') select(next, true);
    });
    select($('td', table));
  }

  function renderWorks(body) {
    // Only the personal projects are listed; each tile opens that project's case page.
    const tileImg = (c) => {
      const w = S.works.find((x) => x.case === c.id);
      return w ? `assets/works/${w.image}` : `${c.dir}/${c.mock.laptop}.webp`;
    };
    const tile = (c, i) => `
      <button class="tile" type="button" data-case="${esc(c.id)}">
        <span class="thumb"><img src="${esc(tileImg(c))}" alt="" loading="lazy"></span>
        <span class="tile-name"><i style="background:${PALETTE[i % PALETTE.length]}"></i><span>${esc(c.title)}</span></span>
      </button>`;
    const arrow = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5h5.5V8M9.5 2.5L3 9"/></svg>';
    body.innerHTML = `
      <div class="finder">
        <div class="finder-side">
          <h3>精選</h3>
          <button class="side-item side-launch" type="button" data-projects aria-haspopup="dialog">個人專案 <span>${arrow}</span></button>
        </div>
        <div class="finder-main">
          <div class="scroll"><div class="grid" data-grid>${S.cases.map(tile).join('')}</div></div>
        </div>
      </div>
      <div class="statusbar"><span>${S.cases.length} 個專案</span><span>點一下看專案介紹</span></div>`;

    const projectsBtn = $('[data-projects]', body);
    projectsBtn.addEventListener('click', () => window.PROJECTS.open(projectsBtn));
    $('[data-grid]', body).addEventListener('click', (e) => {
      const t = e.target.closest('.tile');
      if (t) window.PROJECTS.openDetail(t.dataset.case, t);
    });
  }

  function renderMail(body) {
    body.innerHTML = `
      <form class="mail" novalidate>
        <div class="mail-to"><span>收件人</span><b>${esc(S.name)} &lt;${esc(S.email)}&gt;</b></div>
        <img class="mail-stamp" src="assets/stamp.webp" alt="" width="62">
        <label><span>你的名字</span><input name="name" required autocomplete="name"></label>
        <label><span>Email</span><input name="email" type="email" required autocomplete="email"></label>
        <textarea name="content" required placeholder="想跟我聊什麼？" aria-label="訊息內容"></textarea>
        <p class="mail-msg" data-msg role="status" hidden></p>
        <div class="mail-foot">
          <div class="mail-links">
            <button type="button" data-copy>複製 Email</button>
            ${S.social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}
          </div>
          <button class="mail-send" type="submit">用郵件 App 寄出</button>
        </div>
      </form>`;
    const form = $('form', body);
    const msg = $('[data-msg]', body);
    const say = (text) => { msg.textContent = text; msg.hidden = false; };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const f = new FormData(form);
      const subject = `來自個人網站：${f.get('name')}`;
      const text = `${f.get('content')}\n\n${f.get('name')}\n${f.get('email')}`;
      location.href = `mailto:${S.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      form.classList.add('sent');
      say(`已幫你帶入信件內容，請到郵件 App 按下傳送。沒有跳出來的話，可以直接寄到 ${S.email}。`);
    });
    $('[data-copy]', body).addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(S.email);
        say(`已複製 ${S.email}`);
      } catch {
        say(`請手動複製：${S.email}`);
      }
    });
  }

  /* ---------- window definitions ---------- */
  const DEFS = [
    { id: 'about', title: 'about_me.txt', tip: '關於我', render: renderAbout, min: [280, 260] },
    { id: 'experience', title: 'experience.log', tip: '經歷、技能與學歷', render: renderExperience, min: [320, 220] },
    { id: 'thesis', title: 'thesis.pdf', tip: '碩士論文', render: renderThesis, min: [300, 280] },
    { id: 'awards', title: 'awards.xls', tip: '獎項', render: renderAwards, min: [340, 200] },
    { id: 'works', title: 'portfolio', tip: '作品集', render: renderWorks, min: [340, 280] },
    { id: 'mail', title: 'new_message.eml', tip: '與我聯繫', render: renderMail, min: [320, 300] },
  ];
  const STACK = ['awards', 'works', 'experience', 'thesis', 'about']; // back → front on first load

  function desktopBounds() {
    const menubar = 30;
    const dockTop = $('.dock-wrap').getBoundingClientRect().top || innerHeight - 90;
    return { w: innerWidth, h: Math.max(240, dockTop - menubar - 10), top: menubar + 2 };
  }

  function layoutFor(id) {
    const d = desktopBounds();
    const H = (f) => Math.round(d.h * f);
    if (d.w >= 1180) {
      // experience, about and thesis sit side by side so the text people read first isn't covered;
      // awards and works peek out behind them.
      const exp = { x: d.w * 0.03, y: d.top + H(0.06), w: Math.min(650, d.w * 0.37), h: Math.min(460, H(0.66)) };
      const aboutW = Math.min(600, d.w - 48);
      const L = {
        experience: exp,
        about: { x: Math.max(24, Math.min(exp.x + exp.w + 12, d.w - aboutW - 24)), y: d.top + H(0.04), w: aboutW, h: null }, // h: null → fit to content
        works: { x: d.w * 0.47, y: d.top + H(0.17), w: Math.min(840, d.w * 0.5), h: H(0.8) },
        awards: { x: d.w * 0.61, y: d.top + H(0.015), w: Math.min(560, d.w * 0.37), h: Math.min(380, H(0.5)) },
        thesis: { x: d.w - 420 - d.w * 0.025, y: d.top + H(0.05), w: 420, h: H(0.92) },
        mail: { x: d.w * 0.3, y: d.top + H(0.14), w: 560, h: Math.min(490, H(0.76)) },
      };
      return L[id];
    }
    // Narrower screens: a simple cascade.
    const order = ['experience', 'about', 'awards', 'works', 'thesis', 'mail'];
    const i = order.indexOf(id);
    if (id === 'about') {
      const w = Math.min(600, d.w - 48);
      return { x: Math.max(12, (d.w - w) / 2), y: d.top + 8, w, h: null };
    }
    const w = Math.min(680, d.w - 150);
    return { x: 24 + i * 22, y: d.top + 8 + i * 26, w, h: Math.min(540, d.h - 160) };
  }

  // Height of a window at its current width when nothing limits it, capped to the desktop.
  function fitHeight(win, w) {
    const el = win.el, wasHidden = el.hidden;
    Object.assign(el.style, { width: `${Math.round(w)}px`, height: 'auto', visibility: 'hidden' });
    el.hidden = false;
    const h = el.offsetHeight;
    el.hidden = wasHidden; el.style.visibility = '';
    return Math.min(h, desktopBounds().h - 4);
  }

  function place(win, rect) {
    if (rect.h == null) rect = { ...rect, h: fitHeight(win, rect.w) };
    win.rect = rect;
    Object.assign(win.el.style, {
      left: `${Math.round(rect.x)}px`, top: `${Math.round(rect.y)}px`,
      width: `${Math.round(rect.w)}px`, height: `${Math.round(rect.h)}px`,
    });
  }

  function keepOnScreen(win) {
    const d = desktopBounds();
    if (win.saved) { place(win, maxRect()); return; }
    const r = win.rect;
    const w = Math.min(r.w, d.w - 16);
    const h = Math.min(r.h, d.h - 4);
    place(win, {
      w, h,
      x: clamp(r.x, 120 - w, d.w - 120),
      y: clamp(r.y, d.top, innerHeight - 46),
    });
  }

  function maxRect() {
    const d = desktopBounds();
    return { x: 8, y: d.top + 2, w: d.w - 16, h: d.h - 2 };
  }

  /* ---------- drag / resize ---------- */
  function pointerDrag(handle, { start, move, end }) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      if (start(e) === false) return;
      e.preventDefault();
      const sx = e.clientX;
      const sy = e.clientY;
      handle.setPointerCapture(e.pointerId);
      const onMove = (ev) => move(ev.clientX - sx, ev.clientY - sy);
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        if (end) end();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }

  function buildWindow(def) {
    const el = document.createElement('section');
    el.className = 'win';
    el.dataset.id = def.id;
    el.tabIndex = -1;
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `${def.title}：${def.tip}`);
    const glyph = { min: 'M1.500 4h5', max: 'M4 1.200v5.600M1.200 4h5.600', close: 'M1.500 1.500l5 5M6.500 1.500l-5 5' };
    const ctl = (k, label) => `<button class="ctl-${k}" type="button" aria-label="${label}"><svg viewBox="0 0 8 8" aria-hidden="true"><path d="${glyph[k]}"/></svg></button>`;
    el.innerHTML = `
      <header class="win-bar">
        <h2 class="win-title">${esc(def.title)}</h2>
        <div class="win-ctl">${ctl('min', '最小化')}${ctl('max', '放大')}${ctl('close', '關閉')}</div>
      </header>
      <div class="win-body"></div>
      <div class="grip grip-e"></div><div class="grip grip-s"></div><div class="grip grip-se"></div>`;
    desktop.appendChild(el);
    def.render($('.win-body', el));

    const win = { def, el, state: 'closed', rect: layoutFor(def.id), saved: null };
    windows[def.id] = win;
    place(win, win.rect);

    el.addEventListener('pointerdown', () => raise(def.id), true);
    el.addEventListener('focusin', () => raise(def.id));
    $('.ctl-min', el).addEventListener('click', () => minimize(def.id));
    $('.ctl-max', el).addEventListener('click', () => toggleMax(def.id));
    $('.ctl-close', el).addEventListener('click', () => closeWindow(def.id));

    const bar = $('.win-bar', el);
    bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button') && !phone.matches) toggleMax(def.id); });
    let o;
    pointerDrag(bar, {
      start: () => { if (phone.matches || win.saved) return false; o = { ...win.rect }; return true; },
      move: (dx, dy) => {
        const d = desktopBounds();
        place(win, {
          ...o,
          x: clamp(o.x + dx, 120 - o.w, d.w - 120),
          y: clamp(o.y + dy, d.top, innerHeight - 46),
        });
      },
    });
    const [minW, minH] = def.min;
    [['.grip-e', 1, 0], ['.grip-s', 0, 1], ['.grip-se', 1, 1]].forEach(([sel, gw, gh]) => {
      let r;
      pointerDrag($(sel, el), {
        start: () => { r = { ...win.rect }; return true; },
        move: (dx, dy) => place(win, {
          ...r,
          w: gw ? Math.max(minW, r.w + dx) : r.w,
          h: gh ? Math.max(minH, r.h + dy) : r.h,
        }),
      });
    });
    return win;
  }

  /* ---------- window state ---------- */
  function syncChrome() {
    const front = $('.win.is-front');
    $('#activeTitle').textContent = front ? windows[front.dataset.id].def.title : '';
    $$('.dock-item', dock).forEach((b) => {
      const st = windows[b.dataset.id].state;
      b.classList.toggle('running', st !== 'closed');
      if (front && b.dataset.id === front.dataset.id) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    if (booted) {
      const hash = front ? `#${front.dataset.id}` : location.pathname + location.search;
      history.replaceState(null, '', hash);
    }
  }

  function raise(id) {
    const win = windows[id];
    if (win.state !== 'open') return;
    if (win.el.classList.contains('is-front')) return;
    $$('.win.is-front').forEach((w) => w.classList.remove('is-front'));
    zTop += 1;
    win.el.style.zIndex = zTop;
    win.el.classList.add('is-front');
    syncChrome();
  }

  function raiseNext() {
    let best = null;
    Object.values(windows).forEach((w) => {
      if (w.state === 'open' && (!best || Number(w.el.style.zIndex) > Number(best.el.style.zIndex))) best = w;
    });
    if (best) raise(best.def.id);
    else syncChrome();
  }

  function dockTransform(win) {
    const a = win.el.getBoundingClientRect();
    const b = $(`.dock-item[data-id="${win.def.id}"]`, dock).getBoundingClientRect();
    const scale = Math.max(0.06, b.width / a.width);
    const tx = b.left + b.width / 2 - (a.left + a.width / 2);
    const ty = b.top + b.height / 2 - (a.top + a.height / 2);
    return `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function fly(win, toDock) {
    if (reduceMotion.matches) return Promise.resolve();
    const hidden = { transform: dockTransform(win), opacity: 0.2 };
    const shown = { transform: 'none', opacity: 1 };
    return win.el.animate(toDock ? [shown, hidden] : [hidden, shown], {
      duration: toDock ? 240 : 280,
      easing: 'cubic-bezier(.3,.8,.3,1)',
    }).finished.catch(() => {});
  }

  function bounce(id) {
    if (reduceMotion.matches) return;
    const b = $(`.dock-item[data-id="${id}"]`, dock);
    b.classList.remove('bounce');
    void b.offsetWidth;
    b.classList.add('bounce');
  }

  function openWindow(id, opts = {}) {
    const win = windows[id];
    const wasClosed = win.state !== 'open';
    if (wasClosed) {
      win.state = 'open';
      win.el.hidden = false;
      if (!opts.silent) bounce(id);
    }
    win.el.classList.remove('is-front');
    raise(id);
    if (wasClosed && !opts.silent && !phone.matches) fly(win, false);
    if (!opts.silent) win.el.focus({ preventScroll: true });
  }

  async function hideWindow(id, nextState) {
    const win = windows[id];
    win.state = nextState;
    win.el.classList.remove('is-front');
    raiseNext();
    if (nextState === 'min' && !phone.matches) await fly(win, true);
    // The window may have been reopened while the animation was running.
    if (win.state === nextState) win.el.hidden = true;
    syncChrome();
  }
  const minimize = (id) => hideWindow(id, 'min');
  const closeWindow = (id) => hideWindow(id, 'closed');

  function animateSize(win) {
    if (reduceMotion.matches) return;
    win.el.classList.add('is-animating-size');
    setTimeout(() => win.el.classList.remove('is-animating-size'), 260);
  }

  function toggleMax(id) {
    const win = windows[id];
    animateSize(win);
    if (win.saved) {
      place(win, win.saved);
      win.saved = null;
      win.el.classList.remove('is-max');
    } else {
      win.saved = { ...win.rect };
      place(win, maxRect());
      win.el.classList.add('is-max');
    }
  }

  function arrange() {
    Object.values(windows).forEach((w) => {
      w.saved = null;
      w.el.classList.remove('is-max');
      w.el.classList.remove('is-front');
      animateSize(w);
      place(w, layoutFor(w.def.id));
      w.state = 'closed';
      w.el.hidden = true;
    });
    const initial = phone.matches ? ['about'] : STACK;
    initial.forEach((id) => openWindow(id, { silent: true }));
    // web fonts can change the text height after the first measurement
    if (document.fonts) document.fonts.ready.then(() => { const w = windows.about; if (w && !w.saved && w.rect) place(w, { ...w.rect, h: null }); });
  }

  /* ---------- dock ---------- */
  function buildDock() {
    dock.innerHTML = DEFS.map((d) => `
      <button class="dock-item" type="button" data-id="${d.id}" aria-label="${esc(d.tip)}（${esc(d.title)}）">
        ${dockIcon(d.id)}<span class="dock-tip">${esc(d.title)}</span>
      </button>`).join('');
    dock.addEventListener('click', (e) => {
      const b = e.target.closest('.dock-item');
      if (b) openWindow(b.dataset.id);
    });

    const items = $$('.dock-item', dock);
    const BASE = 54;
    const REACH = 130;
    const GROW = 0.42;
    dock.addEventListener('pointermove', (e) => {
      if (!finePointer.matches || reduceMotion.matches) return;
      items.forEach((it) => {
        const r = it.getBoundingClientRect();
        const dist = Math.abs(e.clientX - (r.left + r.width / 2));
        const t = Math.max(0, 1 - dist / REACH);
        const k = 1 + GROW * (Math.cos(Math.PI * (1 - t)) + 1) / 2;
        it.style.setProperty('--size', `${(BASE * k).toFixed(1)}px`);
      });
    });
    dock.addEventListener('pointerleave', () => items.forEach((it) => it.style.removeProperty('--size')));
  }

  /* ---------- orb menu ---------- */
  function setTheme(mode) {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem('theme', mode); } catch { /* storage may be blocked */ }
    $('meta[name="theme-color"]').content = mode === 'dark' ? '#141416' : '#fafaf9';
  }

  function buildOrb() {
    const orb = $('#orb');
    const menu = $('#orbMenu');
    const dark = () => document.documentElement.dataset.theme === 'dark';
    const paint = () => {
      menu.innerHTML = `
        <button type="button" data-act="arrange">整理視窗</button>
        <button type="button" data-act="hide">收起所有視窗</button>
        <button type="button" data-act="theme">${dark() ? '淺色模式' : '深色模式'}</button>
        <hr>
        ${S.social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}<span aria-hidden="true">↗</span></a>`).join('')}`;
    };
    const toggle = (open) => {
      menu.hidden = !open;
      orb.setAttribute('aria-expanded', String(open));
    };
    paint();
    orb.addEventListener('click', () => toggle(menu.hidden));
    menu.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) { if (e.target.closest('a')) toggle(false); return; }
      if (act.dataset.act === 'arrange') arrange();
      if (act.dataset.act === 'hide') Object.values(windows).forEach((w) => { if (w.state === 'open') minimize(w.def.id); });
      if (act.dataset.act === 'theme') { setTheme(dark() ? 'light' : 'dark'); paint(); }
      toggle(false);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!menu.hidden && !e.target.closest('.orb-wrap')) toggle(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { toggle(false); orb.focus(); }
    });
  }

  /* ---------- clock ---------- */
  function tick() {
    const now = new Date();
    const clock = $('#clock');
    clock.dateTime = now.toISOString();
    clock.textContent = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(now);
  }

  /* ---------- boot ---------- */
  function boot() {
    try {
      const saved = localStorage.getItem('theme');
      const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = saved || (prefersDark ? 'dark' : 'light');
    } catch {
      document.documentElement.dataset.theme = 'light';
    }
    buildDock();
    DEFS.forEach(buildWindow);
    buildOrb();
    arrange();

    const fromHash = location.hash.slice(1);
    if (windows[fromHash]) openWindow(fromHash, { silent: true });
    booted = true;
    syncChrome();

    if (!reduceMotion.matches) {
      // Windows wait behind the loading cover, then rise as it lifts.
      siteReady.then(() => {
        $$('.win:not([hidden])').forEach((el, i) => {
          el.animate([{ opacity: 0, transform: 'translateY(26px) scale(.97)' }, { opacity: 1, transform: 'none' }], {
            duration: 560, delay: 180 + i * 80, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards',
          });
        });
      });
    }

    tick();
    setInterval(tick, 20000);

    addEventListener('resize', () => {
      Object.values(windows).forEach(keepOnScreen);
    });
    phone.addEventListener('change', arrange);
    addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (windows[id]) openWindow(id);
    });
    desktop.addEventListener('pointerdown', (e) => {
      if (e.target.id === 'desktopHit') {
        $$('.win.is-front').forEach((w) => w.classList.remove('is-front'));
        syncChrome();
      }
    });
  }

  boot();
})();
