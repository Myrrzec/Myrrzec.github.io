import { loadInventory, carCard, carArt, carOutline, skeletonCards, money, miles, mountChrome, escapeHtml, reducedMotion } from './shop.js';
import { mountStage } from './stage.js';
import { mountCompare } from './compare.js';

const FACETS = [
  ['model', 'Model'],
  ['body', 'Body'],
  ['fuel', 'Fuel'],
  ['transmission', 'Gearbox'],
];

const SORTS = {
  featured: null,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  'mileage-asc': (a, b) => a.mileage - b.mileage,
  'year-desc': (a, b) => b.year - a.year,
};

const $ = (sel) => document.querySelector(sel);
const els = {
  filters: $('#filters'),
  facets: $('[data-facets]'),
  q: $('#q'),
  min: $('#min'),
  max: $('#max'),
  from: $('#from'),
  to: $('#to'),
  miles: $('#miles'),
  available: $('#available'),
  sort: $('#sort'),
  count: $('[data-count]'),
  chips: $('[data-chips]'),
  grid: $('[data-grid]'),
  toggle: $('.filters-toggle'),
  apply: $('.filters__apply'),
  feature: $('[data-feature]'),
  stock: $('[data-stock]'),
  models: $('[data-models]'),
};

let compare;

let cars = [];
let currency = 'usd';
const state = readState();

function readState() {
  const p = new URLSearchParams(location.search);
  const num = (key) => {
    const v = Number.parseFloat(p.get(key));
    return Number.isFinite(v) ? v : null;
  };
  return {
    q: p.get('q') || '',
    ...Object.fromEntries(FACETS.map(([key]) => [key, new Set(p.getAll(key))])),
    min: num('min'),
    max: num('max'),
    from: num('from'),
    to: num('to'),
    miles: num('miles'),
    available: p.get('available') === '1',
    sort: Object.hasOwn(SORTS, p.get('sort')) ? p.get('sort') : 'featured',
  };
}

// Filters live in the URL so a filtered list can be bookmarked or sent to someone.
function writeState() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  for (const [key] of FACETS) state[key].forEach((v) => p.append(key, v));
  for (const key of ['min', 'max', 'from', 'to', 'miles']) if (state[key] != null) p.set(key, state[key]);
  if (state.available) p.set('available', '1');
  if (state.sort !== 'featured') p.set('sort', state.sort);
  history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
}

function matches(car, skipFacet) {
  if (state.q) {
    const haystack = `${car.year} ${car.model} ${car.trim} ${car.body} ${car.color} ${car.fuel} ${car.transmission}`.toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  for (const [key] of FACETS) {
    if (key !== skipFacet && state[key].size && !state[key].has(car[key])) return false;
  }
  if (state.min != null && car.price < state.min) return false;
  if (state.max != null && car.price > state.max) return false;
  if (state.from != null && car.year < state.from) return false;
  if (state.to != null && car.year > state.to) return false;
  if (state.miles != null && car.mileage > state.miles) return false;
  if (state.available && car.status !== 'available') return false;
  return true;
}

function buildFilters() {
  els.facets.innerHTML = FACETS.map(([key, label]) => {
    const values = [...new Set(cars.map((c) => c[key]).filter(Boolean))];
    return `<fieldset class="filter-group">
      <legend>${label}</legend>
      ${values
        .map(
          (v) => `<label class="check" data-facet="${key}" data-value="${escapeHtml(v)}">
            <input type="checkbox" value="${escapeHtml(v)}"${state[key].has(v) ? ' checked' : ''}>
            ${escapeHtml(v)}<span class="check__count"></span>
          </label>`,
        )
        .join('')}
    </fieldset>`;
  }).join('');

  const years = cars.map((c) => c.year).filter(Boolean);
  const range = [];
  for (let y = Math.max(...years); y >= Math.min(...years); y--) range.push(y);
  els.from.innerHTML = `<option value="">From</option>${range.map((y) => `<option>${y}</option>`).join('')}`;
  els.to.innerHTML = `<option value="">To</option>${range.map((y) => `<option>${y}</option>`).join('')}`;

  els.q.value = state.q;
  els.min.value = state.min ?? '';
  els.max.value = state.max ?? '';
  els.from.value = state.from ?? '';
  els.to.value = state.to ?? '';
  els.miles.value = state.miles ?? '';
  els.available.checked = state.available;
  els.sort.value = state.sort;
}

function chipsFor() {
  const chips = [];
  if (state.q) chips.push(['q', null, `"${state.q}"`]);
  for (const [key] of FACETS) state[key].forEach((v) => chips.push([key, v, v]));
  if (state.min != null) chips.push(['min', null, `From ${money(state.min, currency)}`]);
  if (state.max != null) chips.push(['max', null, `Up to ${money(state.max, currency)}`]);
  if (state.from != null) chips.push(['from', null, `${state.from} or newer`]);
  if (state.to != null) chips.push(['to', null, `${state.to} or older`]);
  if (state.miles != null) chips.push(['miles', null, `Under ${miles(state.miles)}`]);
  if (state.available) chips.push(['available', null, 'Available only']);
  return chips;
}

function render() {
  for (const label of els.facets.querySelectorAll('[data-facet]')) {
    const { facet, value } = label.dataset;
    const n = cars.filter((c) => c[facet] === value && matches(c, facet)).length;
    const input = label.querySelector('input');
    input.checked = state[facet].has(value);
    label.querySelector('.check__count').textContent = n;
    label.classList.toggle('is-empty', n === 0 && !input.checked);
  }

  for (const tile of els.models.querySelectorAll('[data-model]')) {
    tile.setAttribute('aria-pressed', String(state.model.size === 1 && state.model.has(tile.dataset.model)));
  }

  let results = cars.filter((c) => matches(c));
  if (SORTS[state.sort]) results = [...results].sort(SORTS[state.sort]);

  const label = `${results.length} ${results.length === 1 ? 'car' : 'cars'}`;
  els.count.textContent = label;
  els.apply.textContent = `Show ${label}`;

  const chips = chipsFor();
  els.chips.innerHTML =
    chips
      .map(
        ([key, value, text]) =>
          `<button class="chip" type="button" data-key="${key}"${value != null ? ` data-value="${escapeHtml(value)}"` : ''} aria-label="Remove filter ${escapeHtml(text)}">${escapeHtml(text)}<span aria-hidden="true">×</span></button>`,
      )
      .join('') + (chips.length > 1 ? '<button class="link-button" type="button" data-clear>Clear all</button>' : '');

  els.grid.innerHTML = results.length
    ? results.map((car, i) => carCard(car, currency, i, { compare: true })).join('')
    : `<div class="empty">
        ${carOutline()}
        <div>
          <h3>No cars match these filters</h3>
          <p>Widen the price or mileage range, or remove a filter above. All ${cars.length} cars are back with one click.</p>
          <button class="btn btn--line" type="button" data-clear>Clear filters</button>
        </div>
      </div>`;

  compare?.sync(els.grid);
  writeState();
}

// Filter changes animate cards to their new positions where the browser supports it.
function update() {
  if (document.startViewTransition && !reducedMotion.matches) document.startViewTransition(render);
  else render();
}

// One tile per model line; picking a tile filters the inventory to that model.
function renderModels() {
  const lines = [...new Set(cars.map((c) => c.model))];
  els.models.innerHTML = lines
    .map((model) => {
      const group = cars.filter((c) => c.model === model);
      const from = money(Math.min(...group.map((c) => c.price)), currency);
      const count = `${group.length} ${group.length === 1 ? 'car' : 'cars'}`;
      return `<button class="model-tile" type="button" data-model="${escapeHtml(model)}" aria-pressed="false"
          aria-label="${escapeHtml(`${model}, ${count} from ${from}`)}">
        <span class="model-tile__art" aria-hidden="true">${carArt(group[0])}</span>
        <span class="model-tile__name">${escapeHtml(model)}</span>
        <span class="model-tile__meta">${count} · from ${from}</span>
      </button>`;
    })
    .join('');
}

function clearAll() {
  state.q = '';
  for (const [key] of FACETS) state[key].clear();
  Object.assign(state, { min: null, max: null, from: null, to: null, miles: null, available: false });
  buildFilters();
  update();
}

const readNumber = (input) => (input.value === '' ? null : Number(input.value));

function bindEvents() {
  els.facets.addEventListener('change', (e) => {
    const label = e.target.closest('[data-facet]');
    if (!label) return;
    const set = state[label.dataset.facet];
    e.target.checked ? set.add(label.dataset.value) : set.delete(label.dataset.value);
    update();
  });

  let timer;
  els.q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = els.q.value.trim();
      update();
    }, 150);
  });

  for (const key of ['min', 'max', 'from', 'to', 'miles']) {
    els[key].addEventListener('change', () => {
      state[key] = readNumber(els[key]);
      update();
    });
  }

  els.available.addEventListener('change', () => {
    state.available = els.available.checked;
    update();
  });

  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    update();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) return clearAll();
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const { key, value } = chip.dataset;
    if (FACETS.some(([k]) => k === key)) state[key].delete(value);
    else if (key === 'q') state.q = '';
    else if (key === 'available') state.available = false;
    else state[key] = null;
    buildFilters();
    update();
  });

  // Tapping the selected model again clears it.
  els.models.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-model]');
    if (!tile) return;
    const model = tile.dataset.model;
    const isOnly = state.model.size === 1 && state.model.has(model);
    state.model = new Set(isOnly ? [] : [model]);
    update();
    if (!isOnly) {
      document.getElementById('inventory').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  });

  const setOpen = (open) => {
    els.filters.classList.toggle('is-open', open);
    els.toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) els.toggle.focus();
  };
  els.toggle.addEventListener('click', () => setOpen(true));
  for (const btn of document.querySelectorAll('[data-close-filters]')) btn.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.filters.classList.contains('is-open')) setOpen(false);
  });
}

mountChrome('inventory');
els.grid.innerHTML = skeletonCards(6);

try {
  const data = await loadInventory();
  cars = data.cars;
  currency = data.currency;
  for (const el of document.querySelectorAll('[data-deposit]')) el.textContent = `${money(data.deposit, currency)} deposit`;
  const available = cars.filter((c) => c.status === 'available').length;
  els.stock.textContent = `${available} of ${cars.length} cars available now`;
  mountStage(els.feature, cars, currency);
  renderModels();
  compare = mountCompare(cars, currency);
  buildFilters();
  bindEvents();
  els.grid.classList.add('is-entering');
  render();
  setTimeout(() => els.grid.classList.remove('is-entering'), 1200);
} catch (err) {
  els.grid.innerHTML = `<p class="notice" style="grid-column: 1 / -1">${escapeHtml(err.message)}</p>`;
  els.stock.textContent = 'Stock unavailable';
  els.feature.remove();
  els.models.closest('section').remove();
} finally {
  els.grid.removeAttribute('aria-busy');
}
