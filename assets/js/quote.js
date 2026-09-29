/* Wedgewood — project brief (quote) form
   Progressive enhancement: without JS the page is one long form that posts normally.
   With JS: one question per step, auto-advance on single-choice steps, history-aware
   Back, draft saving, inline validation, live 3D size preview (lazy-loaded). */
(() => {
  'use strict';

  const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
  const form = document.querySelector('[data-quote-form]');
  if (!form) return;
  clearTimeout(window.__quoteFailsafe);
  document.documentElement.classList.add('js');
  form.noValidate = true;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const field = (name) => form.elements.namedItem(name);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }
  };
  const DRAFT_KEY = 'wsb-quote-draft-v1';

  /* ---------- Analytics (dataLayer → GA4 / GTM / Pipedrive) ---------- */
  window.dataLayer = window.dataLayer || [];
  const track = (event, data = {}) => window.dataLayer.push({ event, form: 'quote', ...data });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (el) track(el.dataset.track, { location: el.dataset.trackLocation });
  });

  /* ---------- Attribution: landing URL, UTMs and referrer (kept from the homepage visit) ---------- */
  (() => {
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('wsb-attrib') || '{}'); } catch (e) { /* noop */ }
    const q = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach((k) => {
      const v = q.get(k) || saved[k];
      if (v) field(k).value = v;
    });
    field('landing_page').value = saved.landing_page || location.href;
    field('referrer').value = saved.referrer || document.referrer || '';
  })();

  /* ---------- Elements & state ---------- */
  const steps = $$('.q-step', form);
  const ids = steps.map((s) => s.dataset.step);
  const total = steps.length;
  const ui = {
    bar: $('[data-progress] span'), progress: $('[data-progress]'),
    statusStep: $('[data-status-step]'), statusTitle: $('[data-status-title]'),
    back: $('[data-back]', form), skip: $('[data-skip]', form), next: $('[data-next]', form), nextLabel: $('[data-next-label]', form),
    hint: $('[data-enter-hint]', form), live: $('[data-live]', form),
    list: $$('[data-goto]'), restart: $('[data-restart]'), done: $('[data-done]'),
    review: $('[data-review]', form), reviewList: $('[data-review-list]', form)
  };
  let current = 0;
  let reached = 0;           // furthest step visited
  let started = false;
  let submitted = false;
  let busy = false;

  /* ---------- Helpers: values & summaries ---------- */
  const checked = (name) => { const el = form.querySelector(`input[name="${name}"]:checked`); return el ? el.value : ''; };
  const checkedLabel = (name) => {
    const el = form.querySelector(`input[name="${name}"]:checked`); if (!el) return '';
    const lab = el.closest('label');
    return (lab.querySelector('.q-card__t') || lab.querySelector('span') || el).textContent.trim();
  };
  const val = (name) => (field(name) && field(name).value ? String(field(name).value).trim() : '');
  const num = (name) => { const v = val(name); return v === '' ? NaN : parseFloat(v); };
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 });

  const DIM = { w: { name: 'width', min: 3, max: 100 }, l: { name: 'length', min: 3, max: 300 }, e: { name: 'eaves', min: 2, max: 25 }, h: { name: 'ridge_height', min: 2.5, max: 35 } };
  const EXAMPLE = { w: 15, l: 30, e: 6, pitch: 10 };

  function sizeSummary() {
    const w = num('width'), l = num('length'), e = num('eaves'), h = num('ridge_height');
    const bits = [];
    if (!isNaN(w) && !isNaN(l)) bits.push(`${fmt(w)} × ${fmt(l)} m`); else if (!isNaN(w)) bits.push(`${fmt(w)} m wide`); else if (!isNaN(l)) bits.push(`${fmt(l)} m long`);
    if (!isNaN(e)) bits.push(`${fmt(e)} m eaves`);
    if (!isNaN(h)) bits.push(`${fmt(h)} m overall`);
    return bits.join(' · ');
  }
  function answerFor(id) {
    switch (id) {
      case 'type': return checkedLabel('building_type');
      case 'use': return val('intended_use');
      case 'size': return sizeSummary();
      case 'location': return val('postcode');
      case 'stage': return checkedLabel('stage');
      case 'start': return checkedLabel('start');
      case 'budget': return checkedLabel('budget');
      case 'extras': {
        const f = field('drawings').files.length; const n = val('info');
        return [f ? `${f} file${f > 1 ? 's' : ''}` : '', n ? 'Notes added' : ''].filter(Boolean).join(' · ');
      }
      case 'contact': return val('name');
      default: return '';
    }
  }

  /* ---------- Validation (errors in text, next to the field) ---------- */
  function setError(name, msg, input) {
    const box = form.querySelector(`[data-error="${name}"]`);
    if (box) box.textContent = msg || '';
    const els = input ? [input] : $$(`[name="${name}"]`, form);
    els.forEach((el) => { if (el.type !== 'radio') el.setAttribute('aria-invalid', msg ? 'true' : 'false'); });
  }
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validate(id, { show = true } = {}) {
    const errors = [];   // [name, message, focusEl]
    const req = (name, msg) => { if (!checked(name)) errors.push([name, msg, form.querySelector(`input[name="${name}"]`)]); };
    switch (id) {
      case 'type': req('building_type', 'Choose the closest building type — or “Something else”.'); break;
      case 'size': {
        Object.values(DIM).forEach(({ name, min, max }) => {
          const raw = val(name); if (raw === '') return;
          const n = parseFloat(raw);
          if (isNaN(n)) errors.push([name, 'Enter a number in metres, e.g. 12.5', field(name)]);
          else if (n < min || n > max) errors.push([name, `Enter a value between ${min} and ${max} m.`, field(name)]);
        });
        const e = num('eaves'), h = num('ridge_height');
        if (!isNaN(e) && !isNaN(h) && !errors.some((x) => x[0] === 'ridge_height') && h <= e) {
          errors.push(['ridge_height', 'The overall height must be more than the eaves height — the roof rises to the ridge.', field('ridge_height')]);
        }
        break;
      }
      case 'location': if (val('postcode').length < 2) errors.push(['postcode', 'Tell us where the building will go — a postcode or town is fine.', field('postcode')]); break;
      case 'stage': req('stage', 'Choose the option closest to where you are.'); break;
      case 'start': req('start', 'Choose a rough start date — “Not sure yet” is fine.'); break;
      case 'budget': req('budget', 'Choose a rough budget — “Not sure yet” is fine.'); break;
      case 'extras': {
        const files = [...field('drawings').files];
        const bytes = files.reduce((a, f) => a + f.size, 0);
        const bad = files.find((f) => !/\.(pdf|dwg|dxf|jpe?g|png)$/i.test(f.name));
        if (bad) errors.push(['drawings', `“${bad.name}” isn't a supported file — use PDF, DWG, DXF, JPG or PNG.`, field('drawings')]);
        else if (bytes > 20 * 1024 * 1024) errors.push(['drawings', 'Those files add up to more than 20MB — remove some or email them to us instead.', field('drawings')]);
        break;
      }
      case 'contact':
        if (val('name').length < 2) errors.push(['name', 'Enter your name.', field('name')]);
        if (!EMAIL.test(val('email'))) errors.push(['email', 'Enter an email address like name@company.co.uk.', field('email')]);
        if (val('phone').replace(/\D/g, '').length < 10) errors.push(['phone', 'Enter a phone number with the area code, e.g. 01782 898104.', field('phone')]);
        break;
      default: break;
    }
    if (show) {
      // clear this step's previous errors, then show the new ones
      $$('[data-error]', steps[ids.indexOf(id)]).forEach((b) => setError(b.dataset.error, ''));
      errors.forEach(([name, msg, el]) => setError(name, msg, el && el.type !== 'radio' ? el : undefined));
    }
    return errors;
  }

  /* ---------- Rendering chrome: progress, status, aside, nav ---------- */
  function stepIsEmpty(step) {
    return $$('input, textarea', step).every((el) => (el.type === 'radio' ? !el.checked : el.type === 'file' ? !el.files.length : !el.value.trim()));
  }
  function renderChrome() {
    const step = steps[current];
    const pct = submitted ? 100 : Math.round((current / total) * 100);
    ui.bar.style.width = `${Math.max(pct, 3)}%`;
    ui.progress.setAttribute('aria-valuenow', String(pct));
    ui.statusStep.textContent = submitted ? 'Complete' : `Step ${current + 1} of ${total}`;
    ui.statusTitle.textContent = submitted ? 'Thank you' : step.dataset.title;
    const last = current === total - 1;
    ui.back.hidden = current === 0 || submitted;
    const optional = step.hasAttribute('data-optional');
    ui.skip.hidden = !(optional && stepIsEmpty(step));
    ui.nextLabel.textContent = last ? 'Send project brief' : (optional && stepIsEmpty(step) ? 'Continue' : 'Continue');
    ui.hint.classList.toggle('is-shown', !last);
    ui.list.forEach((btn) => {
      const i = ids.indexOf(btn.dataset.goto);
      btn.classList.toggle('is-current', i === current && !submitted);
      btn.classList.toggle('is-visited', i <= reached && i !== current);
      btn.classList.toggle('is-done', i < current || (i <= reached && !!answerFor(ids[i])));
      btn.disabled = i > reached || submitted;
      if (i === current) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      const a = btn.querySelector('[data-answer]'); const text = answerFor(ids[i]);
      if (a.textContent !== text) a.textContent = text;
    });
    if (ids[current] === 'contact') renderReview();
  }

  function renderReview() {
    const rows = ids.slice(0, -1).map((id, i) => [steps[i].dataset.title, answerFor(id), id]).filter((r) => r[1]);
    ui.review.hidden = !rows.length;
    ui.reviewList.innerHTML = '';
    rows.forEach(([t, a, id]) => {
      const dt = document.createElement('dt'); dt.textContent = t;
      const dd = document.createElement('dd'); dd.textContent = a;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Edit'; b.dataset.goto = id;
      b.setAttribute('aria-label', `Edit ${t.toLowerCase()}`);
      const cell = document.createElement('dd'); cell.appendChild(b);
      ui.reviewList.append(dt, dd, cell);
    });
  }

  /* ---------- Step navigation (animated, history-aware) ---------- */
  function show(index, { push = true, focus = true, dir } = {}) {
    index = Math.max(0, Math.min(total - 1, index));
    if (index === current && steps[index].classList.contains('is-active')) return;
    form.dataset.dir = dir || (index < current ? 'back' : 'forward');
    const from = steps[current];
    const to = steps[index];
    const swap = () => {
      from.classList.remove('is-active', 'is-leaving');
      to.classList.add('is-active');
      current = index; reached = Math.max(reached, index);
      renderChrome();
      if (focus) {
        const title = $('.q-title', to);
        title.focus({ preventScroll: true });
        const top = form.getBoundingClientRect().top + window.scrollY - 120;
        if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
      }
      ui.live.textContent = `Step ${index + 1} of ${total}: ${to.dataset.title}`;
      onStepShown(ids[index]);
      saveDraft();
    };
    if (from !== to && from.classList.contains('is-active') && !reduceMotion) {
      from.classList.add('is-leaving');
      setTimeout(swap, 200);
    } else { from.classList.remove('is-active'); swap(); }
    if (push) history.pushState({ quoteStep: index }, '', `#${ids[index]}`);
    else history.replaceState({ quoteStep: index }, '', `#${ids[index]}`);
  }

  function next() {
    const id = ids[current];
    const errs = validate(id);
    if (errs.length) {
      const el = errs[0][2]; if (el) el.focus({ preventScroll: false });
      track('form_step_error', { step: id, field: errs[0][0] });
      return;
    }
    track('form_step_completed', { step: id, step_number: current + 1 });
    if (current < total - 1) show(current + 1);
    else submit();
  }

  function back() {
    if (history.state && typeof history.state.quoteStep === 'number' && history.state.quoteStep > 0) history.back();
    else show(current - 1, { push: false, dir: 'back' });
  }

  window.addEventListener('popstate', (e) => {
    if (submitted) return;
    const i = e.state && typeof e.state.quoteStep === 'number' ? e.state.quoteStep : ids.indexOf(location.hash.slice(1));
    if (i >= 0 && i <= reached) show(i, { push: false });
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); if (!busy) next(); });
  ui.back.addEventListener('click', back);
  ui.skip.addEventListener('click', () => { track('form_step_skipped', { step: ids[current] }); show(current + 1); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (!b || b.disabled || submitted) return;
    const i = ids.indexOf(b.dataset.goto);
    if (i >= 0 && i <= reached) show(i);
  });

  /* Enter in a single-line field advances; Enter in the notes box adds a new line */
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[type="radio"]')) { e.preventDefault(); next(); }
  });

  /* ---------- Auto-advance on single-choice steps (pointer only; keyboard users confirm with Enter) ---------- */
  let pointerAt = 0;
  form.addEventListener('pointerdown', (e) => { if (e.target.closest('.q-card, .q-opt')) pointerAt = performance.now(); });
  form.addEventListener('click', (e) => {
    const input = e.target.closest('.q-card input, .q-opt input');
    if (!input) return;
    const step = input.closest('.q-step');
    if (!step.hasAttribute('data-auto') || step !== steps[current]) return;
    if (performance.now() - pointerAt > 1200) return;
    setError(input.name, '');
    busy = true;
    setTimeout(() => { busy = false; if (steps[current] === step) next(); }, reduceMotion ? 60 : 320);
  });

  /* ---------- Inputs ---------- */
  form.addEventListener('input', (e) => {
    if (!started) { started = true; track('form_started'); }
    const t = e.target;
    if (t.getAttribute('aria-invalid') === 'true' || t.type === 'radio') setError(t.name, '', t.type === 'radio' ? undefined : t);
    if (t.matches('[data-dim]')) onDimInput(t);
    renderChrome();
    saveDraftSoon();
  });
  form.addEventListener('change', (e) => { if (e.target.type === 'radio') { setError(e.target.name, ''); renderChrome(); saveDraft(); } });

  /* Dimension fields: numbers only (digits + one decimal point), no spinner arrows */
  function sanitiseNumber(raw, maxInt) {
    let s = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    const i = s.indexOf('.');
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    let [a, b] = s.split('.');
    a = (a || '').slice(0, maxInt); if (a.length > 1) a = a.replace(/^0+(?=\d)/, '');
    return b !== undefined ? `${a || '0'}.${b.slice(0, 2)}` : a;
  }
  $$('[data-dim]', form).forEach((inp) => {
    const maxInt = inp.dataset.max && Number(inp.dataset.max) >= 100 ? 3 : 2;
    inp.addEventListener('beforeinput', (e) => {
      if (e.data && /[^0-9.,]/.test(e.data)) e.preventDefault();
    });
    inp.addEventListener('input', () => {
      const clean = sanitiseNumber(inp.value, maxInt);
      if (clean !== inp.value) { const pos = inp.selectionStart - (inp.value.length - clean.length); inp.value = clean; try { inp.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
    });
    inp.addEventListener('blur', () => { if (inp.value.endsWith('.')) inp.value = inp.value.slice(0, -1); if (inp.value) validate('size'); });
  });

  /* Suggestions for intended use (recognition over recall) */
  $$('[data-suggest]').forEach((wrap) => {
    const input = document.getElementById(wrap.dataset.suggest);
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const word = b.textContent.trim();
      const cur = input.value.trim();
      if (!cur.toLowerCase().includes(word.toLowerCase())) input.value = cur ? `${cur}, ${word.toLowerCase()}` : word;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  });

  /* Files: list, drag & drop */
  const fileInput = field('drawings');
  const fileList = $('[data-files]', form);
  const drop = $('[data-drop]', form);
  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  function renderFiles() {
    fileList.innerHTML = '';
    [...fileInput.files].forEach((f) => {
      const li = document.createElement('li'); li.textContent = f.name;
      const s = document.createElement('span'); s.textContent = kb(f.size); li.appendChild(s);
      fileList.appendChild(li);
    });
    if (fileInput.files.length) { track('plans_uploaded', { count: fileInput.files.length }); validate('extras'); }
    renderChrome();
  }
  fileInput.addEventListener('change', renderFiles);
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; renderFiles(); }
  });

  /* ---------- Draft: keep answers if the page is closed or refreshed (files excluded) ---------- */
  let saveTimer;
  const saveDraftSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 400); };
  function saveDraft() {
    if (submitted) return;
    const data = {};
    $$('input, textarea', form).forEach((el) => {
      if (!el.name || el.type === 'file' || el.type === 'hidden' || el.name === 'website') return;
      if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; } else if (el.value) data[el.name] = el.value;
    });
    if (Object.keys(data).length) { store.set(DRAFT_KEY, { data, reached, current, t: Date.now() }); ui.restart.hidden = false; }
  }
  function restoreDraft() {
    const d = store.get(DRAFT_KEY);
    if (!d || !d.data || Date.now() - d.t > 1000 * 60 * 60 * 24 * 30) return false;
    Object.entries(d.data).forEach(([name, v]) => {
      const radio = form.querySelector(`input[type="radio"][name="${name}"][value="${CSS.escape(v)}"]`);
      if (radio) radio.checked = true;
      else if (field(name) && field(name).type !== 'radio') field(name).value = v;
    });
    reached = Math.min(total - 1, d.reached || 0);
    ui.restart.hidden = false;
    return Math.min(d.current || 0, reached);
  }
  ui.restart.addEventListener('click', () => {
    store.del(DRAFT_KEY); form.reset(); fileList.innerHTML = '';
    $$('[data-error]', form).forEach((b) => setError(b.dataset.error, ''));
    reached = 0; ui.restart.hidden = true; updateDims(true);
    show(0); track('form_restarted');
  });

  /* ---------- Live 3D size preview ---------- */
  const previewEl = $('[data-preview]', form);
  const stage = $('[data-preview-stage]', form);
  const labelsEl = $('[data-preview-labels]', form);
  const stateEl = $('[data-preview-state]', form);
  const summaryEl = $('[data-preview-summary]', form);
  const derivedEl = $('[data-derived]', form);
  // Classic scripts (not ES modules) so the preview also works when the page is opened straight from disk (file://)
  const PREVIEW_SCRIPTS = [new URL('../vendor/three/three.min.js', SCRIPT_URL).href, new URL('building-preview.js', SCRIPT_URL).href];
  const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) { existing.dataset.loaded ? resolve() : (existing.addEventListener('load', resolve), existing.addEventListener('error', reject)); return; }
    const sc = document.createElement('script'); sc.src = src; sc.async = false; sc.dataset.src = src;
    sc.onload = () => { sc.dataset.loaded = '1'; resolve(); }; sc.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(sc);
  });
  let preview = null, previewState = 'idle', dimTimer;
  let prefetched = false;
  const labels = {};
  ['w', 'l', 'e', 'h'].forEach((k) => { const s = document.createElement('span'); s.className = 'q-lbl'; labelsEl.appendChild(s); labels[k] = s; });

  /* Preview dimensions: the customer's valid entries, with clearly labelled example values for blanks.
     Example values are only drawn — they are never written into the form. */
  function previewDims() {
    const get = (k) => { const { name, min, max } = DIM[k]; const n = num(name); return !isNaN(n) && n >= min && n <= max ? n : NaN; };
    const u = { w: get('w'), l: get('l'), e: get('e'), h: get('h') };
    const d = { w: isNaN(u.w) ? EXAMPLE.w : u.w, l: isNaN(u.l) ? EXAMPLE.l : u.l, e: isNaN(u.e) ? EXAMPLE.e : u.e };
    const derivedH = Math.round((d.e + (d.w / 2) * Math.tan((EXAMPLE.pitch * Math.PI) / 180)) * 10) / 10;
    const hValid = !isNaN(u.h) && u.h > d.e;
    d.h = hValid ? u.h : derivedH;
    const example = { w: isNaN(u.w), l: isNaN(u.l), e: isNaN(u.e), h: !hValid };
    return { d, u, example, hConflict: !isNaN(u.h) && !isNaN(u.e) && u.h <= u.e };
  }

  function updateDims(immediate) {
    const { d, u, example, hConflict } = previewDims();
    // Plain-language summary (the canvas never holds the only copy of this information)
    const part = (k, text) => (example[k] ? `${text} (example)` : text);
    const allExample = example.w && example.l && example.e && example.h;
    summaryEl.textContent = allExample
      ? `Example size shown: ${fmt(d.w)} m × ${fmt(d.l)} m, ${fmt(d.e)} m to the eaves, about ${fmt(d.h)} m overall.`
      : `Showing ${part('w', `${fmt(d.w)} m wide`)} × ${part('l', `${fmt(d.l)} m long`)}, ${part('e', `${fmt(d.e)} m to the eaves`)}, ${part('h', `${fmt(d.h)} m overall`)}.`;
    // Derived facts & gentle warnings
    const facts = [];
    let warn = false;
    if (!isNaN(u.w) && !isNaN(u.l)) { const m2 = u.w * u.l; facts.push(`Floor area ≈ ${Math.round(m2).toLocaleString('en-GB')} m² (${Math.round(m2 * 10.7639).toLocaleString('en-GB')} sq ft)`); }
    if (!isNaN(u.w) && !isNaN(u.e) && !isNaN(u.h) && u.h > u.e) {
      const pitch = (Math.atan((u.h - u.e) / (u.w / 2)) * 180) / Math.PI;
      facts.push(`Roof pitch ≈ ${pitch.toFixed(pitch < 10 ? 1 : 0)}°`);
      if (pitch > 30) { facts.push('steeper than most steel buildings (typically 5–15°)'); warn = true; }
    }
    if (hConflict) { facts.push('Overall height needs to be above the eaves'); warn = true; }
    derivedEl.textContent = facts.join(' · ');
    derivedEl.classList.toggle('is-warn', warn);
    // Labels
    const text = { w: `W ${fmt(d.w)} m`, l: `L ${fmt(d.l)} m`, e: `Eaves ${fmt(d.e)} m`, h: `Overall ${fmt(d.h)} m` };
    Object.entries(labels).forEach(([k, el]) => {
      el.innerHTML = '';
      el.append(text[k]);
      if (example[k]) { const s = document.createElement('small'); s.textContent = 'example'; el.appendChild(s); }
      el.classList.toggle('is-example', example[k]);
    });
    if (preview) preview.update(d, { animate: !immediate });
  }
  function onDimInput() { clearTimeout(dimTimer); dimTimer = setTimeout(() => updateDims(false), 160); }

  /* Labels sit beside their dimension line (never on top of the building) and stay inside the frame */
  const ALIGN = { w: [-0.5, 0.35], l: [0.12, -0.5], e: [0.08, -0.5], h: [-1.08, -0.5] };
  function placeLabels(pos) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const placed = [];
    const hit = (r) => placed.find((q) => r.x < q.x + q.w + 4 && r.x + r.w + 4 > q.x && r.y < q.y + q.h + 4 && r.y + r.h + 4 > q.y);
    ['w', 'l', 'h', 'e'].forEach((k) => {
      const p = pos[k]; const el = labels[k]; if (!p || !el) return;
      const bw = el.offsetWidth, bh = el.offsetHeight;
      const [ax, ay] = ALIGN[k];
      const r = { x: p.x + ax * bw + (ax > 0 ? 8 : ax < -0.9 ? -8 : 0), y: p.y + ay * bh + (ay > 0 ? 6 : 0), w: bw, h: bh };
      r.x = Math.min(W - bw - 6, Math.max(6, r.x)); r.y = Math.min(H - bh - 6, Math.max(6, r.y));
      for (let i = 0, q; i < 6 && (q = hit(r)); i++) r.y = Math.max(6, q.y - bh - 6);   // nudge up clear of a neighbour
      placed.push(r);
      el.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px)`;
      el.classList.toggle('is-hidden', !p.visible);
    });
  }

  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }
  function fallback(msg) {
    previewState = 'failed';
    previewEl.classList.add('is-fallback');
    stateEl.textContent = msg;
  }
  function ensurePreview() {
    if (previewState !== 'idle') return;
    if (!webglOK()) { fallback('3D preview isn’t available on this device — your sizes are summarised below.'); return; }
    previewState = 'loading';
    stateEl.textContent = 'Loading 3D preview…';
    PREVIEW_SCRIPTS.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve()).then(() => {
      if (!window.WSBBuildingPreview) throw new Error('Preview script did not initialise');
      preview = window.WSBBuildingPreview.createBuildingPreview(stage, { onRender: placeLabels });
      previewState = 'ready';
      updateDims(true);
      requestAnimationFrame(() => previewEl.classList.add('is-ready'));
    }).catch((err) => {
      console.warn('[quote] 3D preview failed to load', err);
      fallback('3D preview couldn’t load — your sizes are summarised below.');
    });
  }
  function prefetchPreview() {
    if (prefetched || !webglOK()) return; prefetched = true;
    PREVIEW_SCRIPTS.forEach((href) => { const l = document.createElement('link'); l.rel = 'preload'; l.as = 'script'; l.href = href; document.head.appendChild(l); });
  }
  // Load when the preview is near the viewport (covers the no-stepper layout too)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { ensurePreview(); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(previewEl);
  }

  function onStepShown(id) {
    if (id === 'use') prefetchPreview();
    if (id === 'size') { ensurePreview(); if (preview) preview.resize(); }
  }

  /* ---------- Submit ---------- */
  function setSending(on) {
    busy = on; ui.next.disabled = on; ui.next.classList.toggle('is-sending', on);
    ui.nextLabel.textContent = on ? 'Sending…' : 'Send project brief';
  }
  async function submit() {
    // Re-check every step (someone may have jumped back and changed an answer)
    for (let i = 0; i < total; i++) {
      const errs = validate(ids[i], { show: false });
      if (errs.length) { show(i); setTimeout(() => validate(ids[i]), 260); return; }
    }
    const fd = new FormData(form);           // only the customer's real entries — preview values are never added
    if (fd.get('website')) { finish(); return; } // spam trap: pretend success
    const endpoint = form.dataset.endpoint;
    setSending(true);
    try {
      if (endpoint) {
        const res = await fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        // Demo mode (no back end configured yet): expose the payload for checking
        const payload = {};
        fd.forEach((v, k) => { payload[k] = v instanceof File ? (v.name ? `${v.name} (${kb(v.size)})` : '') : v; });
        window.__lastQuotePayload = payload;
        console.info('[quote] demo mode — this is what would be sent:', payload);
        await new Promise((r) => setTimeout(r, 600));
      }
      track('form_submitted', { building_type: checked('building_type'), budget: checked('budget'), stage: checked('stage') });
      finish();
    } catch (err) {
      setSending(false);
      setError('phone', '');
      const box = form.querySelector('[data-error="email"]');
      box.textContent = 'Sorry — your brief didn’t send. Please try again, or call us on 01782 898104.';
      track('form_submit_failed', { reason: String(err) });
    }
  }
  function finish() {
    submitted = true; store.del(DRAFT_KEY);
    const first = val('name').split(/\s+/)[0];
    $('[data-done-name]').textContent = first ? `, ${first}` : '';
    form.hidden = true; ui.done.hidden = false;
    renderChrome();
    ui.list.forEach((b) => b.classList.add('is-done'));
    ui.restart.hidden = true;
    ui.done.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    history.replaceState({ quoteStep: 'done' }, '', '#sent');
    if (preview) { preview.dispose(); preview = null; }
  }

  window.addEventListener('pagehide', () => { if (started && !submitted) track('form_abandoned', { step: ids[current] }); });

  /* ---------- Start ---------- */
  const restoredAt = restoreDraft();
  steps.forEach((s) => s.classList.remove('is-active'));
  let startAt = typeof restoredAt === 'number' ? restoredAt : 0;
  const hashAt = ids.indexOf(location.hash.slice(1));
  if (hashAt >= 0 && hashAt <= reached) startAt = hashAt;
  current = startAt;
  steps[startAt].classList.add('is-active');
  history.replaceState({ quoteStep: startAt }, '', `#${ids[startAt]}`);
  if (fileInput.files.length) renderFiles();
  updateDims(true);
  renderChrome();
  onStepShown(ids[startAt]);
  if (typeof restoredAt === 'number') ui.live.textContent = 'Welcome back — we kept your answers.';
  document.documentElement.classList.add('q-ready');
})();
