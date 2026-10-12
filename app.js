'use strict';

const $ = (id) => document.getElementById(id);
const N = STEPS.length;
const LAST_KEY = 'pedsdose.lastIndex';

// ---------- number formatting ----------

function num(x) {
  if (x >= 100) return String(Math.round(x));
  if (x >= 10) return String(Math.round(x * 10) / 10);
  if (x >= 1) return String(Math.round(x * 100) / 100);
  return String(Number(x.toPrecision(2)));
}

function range(lo, hi, unit) {
  if (unit === 'mcg' && hi >= 1000) { lo /= 1000; hi /= 1000; unit = 'mg'; }
  else if (unit === 'mg' && hi >= 1000) { lo /= 1000; hi /= 1000; unit = 'g'; }
  const a = num(lo), b = num(hi);
  return (a === b ? a : a + '–' + b) + ' ' + unit;
}

// ---------- dial ----------

const C = 180, R = 150, A0 = -150, SWEEP = 300, STEP_DEG = SWEEP / (N - 1);
const SVG_NS = 'http://www.w3.org/2000/svg';
const dial = $('dial');
let idx = 9; // 10 kg
let ticks = [];

// Degrees run clockwise from 12 o'clock.
function polar(deg, r) {
  const a = (deg - 90) * Math.PI / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}
const angleOf = (i) => A0 + i * STEP_DEG;

function arc(fromDeg, toDeg) {
  const [x0, y0] = polar(fromDeg, R), [x1, y1] = polar(toDeg, R);
  return `M${x0} ${y0}A${R} ${R} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function svgEl(name, attrs, text) {
  const el = document.createElementNS(SVG_NS, name);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (text != null) el.textContent = text;
  return el;
}

function buildDial() {
  dial.append(svgEl('path', { class: 'track', d: arc(A0, A0 + SWEEP) }));
  dial.append(svgEl('path', { class: 'fill', id: 'dialFill' }));
  STEPS.forEach(([kg], i) => {
    const major = DIAL_LABELS.includes(kg);
    const [x, y] = polar(angleOf(i), R);
    const t = svgEl('circle', { class: 'tick' + (major ? ' major' : ''), cx: x, cy: y, r: major ? 3.2 : 1.8 });
    dial.append(t);
    ticks.push(t);
    if (major) {
      const [lx, ly] = polar(angleOf(i), R - 36);
      dial.append(svgEl('text', { class: 'lbl', x: lx, y: ly }, kg));
    }
  });
  dial.append(svgEl('circle', { class: 'knob', id: 'dialKnob', r: 15 }));
}

function setIndex(i, silent) {
  i = Math.max(0, Math.min(N - 1, i));
  if (i === idx && !silent) return;
  idx = i;
  const [kg, mo] = STEPS[i];
  const [kx, ky] = polar(angleOf(i), R);
  $('dialKnob').setAttribute('cx', kx);
  $('dialKnob').setAttribute('cy', ky);
  $('dialFill').setAttribute('d', arc(A0, angleOf(i) + 0.01));
  ticks.forEach((t, j) => t.classList.toggle('on', j <= i));
  $('goKg').textContent = kg;
  $('goAge').textContent = '≈ ' + ageLabel(mo);
  dial.setAttribute('aria-valuenow', kg);
  dial.setAttribute('aria-valuetext', kg + ' kg, about ' + ageLabel(mo));
  if (!silent && navigator.vibrate) navigator.vibrate(4);
}

function indexFromPointer(e) {
  const r = dial.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
  deg = Math.max(A0, Math.min(A0 + SWEEP, deg));
  return Math.round((deg - A0) / STEP_DEG);
}

let dragging = false;
dial.addEventListener('pointerdown', (e) => {
  dragging = true;
  dial.setPointerCapture(e.pointerId);
  dial.classList.add('drag');
  setIndex(indexFromPointer(e));
});
dial.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const i = indexFromPointer(e);
  // Don't let a drag across the gap at the bottom jump between 3 and 50 kg.
  if (Math.abs(i - idx) > N / 2) return;
  setIndex(i);
});
const endDrag = () => { dragging = false; dial.classList.remove('drag'); };
dial.addEventListener('pointerup', endDrag);
dial.addEventListener('pointercancel', endDrag);

$('home').addEventListener('wheel', (e) => {
  e.preventDefault();
  setIndex(idx + (e.deltaY > 0 ? 1 : -1));
}, { passive: false });

$('go').addEventListener('click', () => open(idx));
$('dec').addEventListener('click', () => setIndex(idx - 1));
$('inc').addEventListener('click', () => setIndex(idx + 1));

function buildGrid() {
  $('grid').innerHTML = STEPS.map(([kg, mo], i) =>
    `<button data-i="${i}"><b>${kg}</b><span>${ageLabel(mo)}</span></button>`).join('');
  $('grid').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) open(+b.dataset.i);
  });
}

// ---------- sheet ----------

function drugRow(d, kg) {
  const per = typeof d.dose === 'function' ? d.dose(kg) : d.dose;
  const [pl, ph] = Array.isArray(per) ? per : [per, per];
  let lo = pl * kg, hi = ph * kg, capped = false;
  if (d.max != null) {
    if (hi > d.max) { hi = d.max; capped = true; }
    if (lo > d.max) lo = d.max;
  }
  const meta = [
    (pl === ph ? num(pl) : num(pl) + '–' + num(ph)) + ' ' + d.unit + '/kg' + (d.suffix || ''),
    d.route,
    d.max != null && 'max ' + range(d.max, d.max, d.unit),
    d.note,
  ].filter(Boolean).join(' · ');
  const vol = d.conc
    ? `<div class="vol">${range(lo / d.conc, hi / d.conc, 'mL')}<small>${d.concLabel}</small></div>`
    : '<div class="vol none"></div>';
  return `<div class="row"><div class="what"><b>${d.name}</b><span>${meta}</span></div>` +
    `<div class="dose">${range(lo, hi, d.unit)}${d.suffix || ''}${capped ? '<small class="cap">max</small>' : ''}</div>${vol}</div>`;
}

function equipRow(d, kg, mo) {
  return `<div class="row"><div class="what"><b>${d.name}</b>${d.note ? `<span>${d.note}</span>` : ''}</div>` +
    `<div class="size">${d.value(kg, mo)}</div></div>`;
}

function renderSheet(i) {
  const [kg, mo] = STEPS[i];
  const v = vitals(kg, mo);
  $('sheetKg').textContent = kg;
  $('sheetAge').textContent = '≈ ' + ageLabel(mo);
  $('prev').disabled = i === 0;
  $('next').disabled = i === N - 1;
  $('vitals').innerHTML =
    `<div><span>HR</span><b>${v.hr}</b></div><div><span>RR</span><b>${v.rr}</b></div>` +
    `<div><span>SBP</span><b>${v.sbp}</b></div><div><span>Blood vol.</span><b>${v.bloodVolume} mL</b></div>`;
  $('cards').innerHTML = SECTIONS.map((s) =>
    `<section class="card ${s.color}" id="s-${s.id}"><h2>${s.title}</h2>` +
    s.items.map((d) => (d.value ? equipRow(d, kg, mo) : drugRow(d, kg))).join('') +
    '</section>').join('');
}

$('chips').innerHTML = SECTIONS.map((s) =>
  `<button class="${s.color}" data-s="${s.id}">${s.title.split(/[ ,&]/)[0]}</button>`).join('');
$('chips').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) $('s-' + b.dataset.s).scrollIntoView({ block: 'start' });
});

// ---------- routing: "#/kg/12" is a sheet, anything else is the dial ----------

const hashFor = (i) => '#/kg/' + STEPS[i][0];

function indexFromHash() {
  const m = location.hash.match(/^#\/kg\/([\d.]+)$/);
  return m ? STEPS.findIndex(([kg]) => kg === +m[1]) : -1;
}

function open(i) {
  location.hash = hashFor(i);
}

// Stepping weight inside the sheet shouldn't pile up history entries.
function stepSheet(delta) {
  const i = indexFromHash() + delta;
  if (i < 0 || i >= N) return;
  history.replaceState(null, '', hashFor(i));
  route(true);
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
    }
  } catch (_) { /* not supported or not allowed: fine */ }
}

function route(keepScroll) {
  const i = indexFromHash();
  const onSheet = i >= 0;
  if (onSheet) {
    renderSheet(i);
    setIndex(i, true);
    try { localStorage.setItem(LAST_KEY, i); } catch (_) {}
  }
  $('home').hidden = onSheet;
  $('sheet').hidden = !onSheet;
  if (!keepScroll) scrollTo(0, 0);
  keepAwake(onSheet);
}

$('back').addEventListener('click', () => { location.hash = ''; });
$('prev').addEventListener('click', () => stepSheet(-1));
$('next').addEventListener('click', () => stepSheet(1));
addEventListener('hashchange', () => route());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake(indexFromHash() >= 0);
});

// ---------- keyboard ----------

let typed = '', typedTimer;
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const onSheet = !$('sheet').hidden;
  const k = e.key;
  if (onSheet) {
    if (k === 'Escape' || k === 'Backspace') location.hash = '';
    else if (k === 'ArrowLeft') stepSheet(-1);
    else if (k === 'ArrowRight') stepSheet(1);
    return;
  }
  if (k === 'ArrowRight' || k === 'ArrowUp') setIndex(idx + 1);
  else if (k === 'ArrowLeft' || k === 'ArrowDown') setIndex(idx - 1);
  else if (k === 'Home') setIndex(0);
  else if (k === 'End') setIndex(N - 1);
  else if (k === 'Enter') open(idx);
  else if (/^[\d.,]$/.test(k)) {
    // Type a weight ("1", "2" -> 12 kg): jump to the nearest step.
    typed += k.replace(',', '.');
    clearTimeout(typedTimer);
    typedTimer = setTimeout(() => { typed = ''; }, 1200);
    const want = parseFloat(typed);
    if (!isNaN(want)) {
      let best = 0;
      STEPS.forEach(([kg], i) => { if (Math.abs(kg - want) < Math.abs(STEPS[best][0] - want)) best = i; });
      setIndex(best);
    }
    return;
  } else return;
  e.preventDefault();
});

// ---------- boot ----------

buildDial();
buildGrid();
let start = 9;
try {
  const saved = parseInt(localStorage.getItem(LAST_KEY), 10);
  if (saved >= 0 && saved < N) start = saved;
} catch (_) {}
setIndex(start, true);
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js');
}
