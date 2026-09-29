/* Wedgewood Steel Buildings — Home
   Vanilla JS, no dependencies. Progressive enhancement: page is fully usable without it. */
(() => {
  'use strict';

  const doc = document.documentElement;
  doc.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- Analytics (dataLayer — wire to GA4 / GTM / Pipedrive) ---------- */
  window.dataLayer = window.dataLayer || [];
  const track = (event, data = {}) => window.dataLayer.push({ event, ...data });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (!el) return;
    track(el.dataset.track, {
      category: el.dataset.category,
      case_study: el.dataset.case,
      location: el.dataset.trackLocation,
      href: el.getAttribute('href') || undefined
    });
  });

  /* ---------- Split headings into word spans ---------- */
  const splitWords = (el) => {
    let wi = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = p;
            inner.style.setProperty('--wi', wi++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    $$('.w', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  };
  $$('[data-split]').forEach(splitWords);

  /* ---------- Line drawings: normalise path length for draw-on ---------- */
  $$('.drawing').forEach((svg) => {
    $$('.draw', svg).forEach((p, i) => {
      if (p.hasAttribute('stroke-dasharray')) return;
      p.setAttribute('pathLength', '1');
      p.style.setProperty('--di', Math.min(i, 12));
    });
  });

  /* ---------- Hero intro ---------- */
  const heroTitle = $('.hero h1');
  if (heroTitle) heroTitle.style.setProperty('--d', '.25s');
  const start = () => requestAnimationFrame(() => {
    document.body.classList.add('is-loaded');
    heroTitle && heroTitle.classList.add('is-in');
  });
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
  // Fallback so content never stays hidden if an image is slow
  setTimeout(start, 1600);

  /* ---------- Upgrade images to full resolution where available ---------- */
  const upgrade = (img) => {
    const full = img.dataset.full;
    if (!full) return;
    const probe = new Image();
    probe.decoding = 'async';
    probe.onload = () => { if (probe.naturalWidth > (img.naturalWidth || 0)) img.src = full; };
    probe.src = full;
  };
  const heroImg = $('.hero__img');
  if (heroImg) upgrade(heroImg);

  /* ---------- Reveal on scroll ---------- */
  const counters = new WeakSet();
  const runCounter = (el) => {
    if (counters.has(el)) return;
    counters.add(el);
    const end = parseFloat(el.dataset.count);
    const pad = parseInt(el.dataset.pad || '0', 10);
    const fmt = (v) => String(Math.round(v)).padStart(pad, '0');
    if (reduceMotion) { el.textContent = fmt(end); return; }
    const dur = 1600;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(end * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      if (el.classList.contains('drawing')) setTimeout(() => el.classList.add('is-drawn'), reduceMotion ? 0 : 3200);
      $$('[data-count]', el).forEach(runCounter);
      $$('img[data-full]', el).forEach(upgrade);
      // Once an image reveal has played, strip its animation so it can never replay (until a refresh)
      const revealImgs = $$('.img-reveal img', el);
      if (revealImgs.length) {
        const finish = () => el.classList.add('reveal-done');
        revealImgs[revealImgs.length - 1].addEventListener('animationend', finish, { once: true });
        setTimeout(finish, 4000);
      }
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  $$('[data-reveal], [data-split], .drawing, .flagship').filter((el) => el !== heroTitle && !el.closest('dialog')).forEach((el) => io.observe(el));

  /* ---------- Header: glass on scroll, hide on scroll-down, reveal on scroll-up ---------- */
  const header = $('[data-header]');
  const hero = $('.hero');
  const mobileBar = $('[data-mobile-bar]');
  let lastY = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > 480) header.classList.add('is-hidden');
    else if (goingUp || y < 480) header.classList.remove('is-hidden');
    if (goingDown || goingUp) lastY = y;

    // Mobile persistent CTA — appears after the hero
    if (mobileBar && hero) {
      const show = y > hero.offsetHeight * 0.8;
      mobileBar.classList.toggle('is-visible', show);
      mobileBar.setAttribute('aria-hidden', String(!show));
      $$('a', mobileBar).forEach((a) => (a.tabIndex = show ? 0 : -1));
      document.body.classList.toggle('has-bar', show);
    }

    if (!reduceMotion) parallax();
    processProgress();
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  /* ---------- Parallax (hero + flagship) ---------- */
  const flagMedia = $('.flagship [data-parallax]');
  const parallax = () => {
    const vh = window.innerHeight;
    // (hero image is static — no parallax)
    if (flagMedia) {
      const r = flagMedia.parentElement.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const p = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
        flagMedia.style.setProperty('--py', `${(p * -8).toFixed(2)}%`);
      }
    }
  };

  /* ---------- Process rail progress (eased, deliberately unhurried) ---------- */
  const steps = $('[data-steps]');
  const stepItems = steps ? $$('.step', steps) : [];
  let railTarget = 0;
  let railCurrent = 0;
  let railRaf = null;
  const railRender = () => {
    // ease toward the scroll target so the line trails the scroll smoothly
    railCurrent += (railTarget - railCurrent) * 0.06;
    if (Math.abs(railTarget - railCurrent) < 0.0005) railCurrent = railTarget;
    steps.style.setProperty('--progress', railCurrent.toFixed(4));
    const vertical = window.matchMedia('(max-width: 1099px)').matches;
    const h = steps.offsetHeight;
    stepItems.forEach((s, i) => {
      const at = vertical ? s.offsetTop / h : i / (stepItems.length - 1) * 0.985;
      s.classList.toggle('is-active', railCurrent >= at);
    });
    railRaf = railCurrent === railTarget ? null : requestAnimationFrame(railRender);
  };
  const processProgress = () => {
    if (!steps) return;
    const r = steps.getBoundingClientRect();
    const vh = window.innerHeight;
    const vertical = window.matchMedia('(max-width: 1099px)').matches;
    let p;
    // Desktop: rail fills while the steps travel from 92% to 18% of the viewport (was 85%→35%)
    if (vertical) p = (vh * 0.6 - r.top) / (r.height + vh * 0.1);
    else p = (vh * 0.92 - r.top) / (vh * 0.74);
    // One-way: the rail only ever advances, so it doesn't replay when scrolling back up
    railTarget = Math.max(railTarget, Math.min(1, p));
    if (reduceMotion) railCurrent = railTarget;
    if (!railRaf) railRaf = requestAnimationFrame(railRender);
  };

  onScroll();

  /* ---------- Mega menus ---------- */
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  document.body.appendChild(scrim);

  const megaButtons = $$('.nav-link[aria-controls]');
  let openMega = null;
  let closeTimer;

  const setGlass = (panel) => {
    if (!panel) { header.style.removeProperty('--glass-h'); return; }
    const h = header.querySelector('.header-bar').offsetHeight + panel.offsetHeight;
    header.style.setProperty('--glass-h', `${h}px`);
  };
  const closeMega = () => {
    if (!openMega) return;
    const { btn, panel } = openMega;
    btn.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    setGlass(null);
    header.classList.remove('is-mega');
    scrim.classList.remove('is-on');
    const p = panel;
    setTimeout(() => { if (!p.classList.contains('is-open')) p.hidden = true; }, 350);
    openMega = null;
  };
  const openMegaPanel = (btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (openMega && openMega.panel === panel) return;
    if (openMega) {
      openMega.btn.setAttribute('aria-expanded', 'false');
      openMega.panel.classList.remove('is-open');
      openMega.panel.hidden = true;
    }
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    header.classList.add('is-mega');
    scrim.classList.add('is-on');
    requestAnimationFrame(() => { panel.classList.add('is-open'); setGlass(panel); });
    openMega = { btn, panel };
  };

  megaButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (openMega && openMega.btn === btn) closeMega(); else openMegaPanel(btn);
    });
    if (finePointer) {
      const li = btn.closest('.nav-item');
      li.addEventListener('mouseenter', () => { clearTimeout(closeTimer); openMegaPanel(btn); });
    }
  });
  if (finePointer) {
    header.addEventListener('mouseleave', () => { closeTimer = setTimeout(closeMega, 220); });
    header.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    $$('.nav-item:not(.has-mega)').forEach((li) => li.addEventListener('mouseenter', closeMega));
  }
  scrim.addEventListener('click', closeMega);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openMega) { const b = openMega.btn; closeMega(); b.focus(); }
  });
  document.addEventListener('focusin', (e) => {
    if (openMega && !header.contains(e.target)) closeMega();
  });
  window.addEventListener('resize', () => { if (openMega) setGlass(openMega.panel); });

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('.menu-toggle');
  const menu = $('#mobile-menu');
  $$('.mobile-menu__inner > *', menu).forEach((el, i) => el.style.setProperty('--mi', i));
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    header.classList.toggle('is-menu', open);
    document.body.classList.toggle('dialog-open', open);
    if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); }
    else { menu.classList.remove('is-open'); setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 400); }
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); } });

  /* ---------- Subtle magnetic pull on primary CTAs ---------- */
  if (finePointer && !reduceMotion) {
    $$('.btn--lg:not(.btn--primary):not(.btn--ghost)').forEach((btn) => { // primary + ghost buttons stay still on hover
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) / r.width;
        const y = (e.clientY - r.top - r.height / 2) / r.height;
        btn.style.transform = `translate(${x * 6}px, ${y * 6}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- Attribution: remember how the visitor arrived, for the quote form ---------- */
  try {
    if (!sessionStorage.getItem('wsb-attrib')) {
      const q = new URLSearchParams(location.search); const a = { landing_page: location.href, referrer: document.referrer || '' };
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach((k) => { if (q.get(k)) a[k] = q.get(k); });
      sessionStorage.setItem('wsb-attrib', JSON.stringify(a));
    }
  } catch (e) { /* storage unavailable */ }

  /* ---------- Footer year ---------- */
  const yr = $('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();
})();
