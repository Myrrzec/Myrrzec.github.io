import { carArt, money, miles, shortName, escapeHtml, ICON_PLUS, ICON_CHECK } from './shop.js';

const KEY = 'motorworks-compare';
const MAX = 3;

function readSaved() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

// Compare up to three cars: toggles on each card, a tray at the bottom of the screen,
// and a dialog with the specs side by side.
export function mountCompare(cars, currency) {
  const byId = new Map(cars.map((c) => [c.id, c]));
  let ids = readSaved().filter((id) => byId.has(id)).slice(0, MAX);
  let msgTimer;

  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="tray" data-tray aria-label="Cars to compare" role="region">
      <div class="tray__items" data-tray-items></div>
      <p class="tray__msg" role="status" data-tray-msg></p>
      <div class="tray__actions">
        <button class="link-button" type="button" data-compare-clear>Clear</button>
        <button class="btn btn--primary" type="button" data-compare-open></button>
      </div>
    </div>
    <dialog class="compare" data-compare-dialog aria-labelledby="compare-title">
      <div class="compare__head">
        <h2 id="compare-title">Side by side</h2>
        <button class="link-button" type="button" data-compare-close>Close</button>
      </div>
      <div class="compare__body" data-compare-table></div>
    </dialog>`,
  );

  const tray = document.querySelector('[data-tray]');
  const items = tray.querySelector('[data-tray-items]');
  const msg = tray.querySelector('[data-tray-msg]');
  const openBtn = tray.querySelector('[data-compare-open]');
  const dialog = document.querySelector('[data-compare-dialog]');
  const table = dialog.querySelector('[data-compare-table]');

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {}
  }

  function say(text) {
    clearTimeout(msgTimer);
    msg.textContent = text;
    msgTimer = setTimeout(() => (msg.textContent = ''), 3200);
  }

  function sync(scope = document) {
    for (const btn of scope.querySelectorAll('.compare-toggle')) {
      const on = ids.includes(btn.dataset.compare);
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = `${on ? ICON_CHECK : ICON_PLUS}<span>${on ? 'Comparing' : 'Compare'}</span>`;
    }
    tray.classList.toggle('is-open', ids.length > 0);
    tray.inert = ids.length === 0;
    items.innerHTML = ids
      .map((id) => {
        const car = byId.get(id);
        return `<span class="tray__item">
          <span class="swatch" style="background: ${escapeHtml(car.hex)}"></span>
          ${escapeHtml(shortName(car))}
          <button type="button" data-compare="${escapeHtml(id)}" class="tray__remove" aria-label="Remove ${escapeHtml(shortName(car))}">×</button>
        </span>`;
      })
      .join('');
    openBtn.disabled = ids.length < 2;
    openBtn.textContent = ids.length < 2 ? 'Add one more car' : `Compare ${ids.length} cars`;
  }

  function toggle(id) {
    if (ids.includes(id)) ids = ids.filter((x) => x !== id);
    else if (ids.length >= MAX) return say(`You can compare up to ${MAX} cars. Remove one first.`);
    else ids = [...ids, id];
    save();
    sync();
  }

  // Lowest price and mileage and the newest year are marked so the table reads at a glance.
  function renderTable() {
    const list = ids.map((id) => byId.get(id));
    const best = {
      price: Math.min(...list.map((c) => c.price)),
      mileage: Math.min(...list.map((c) => c.mileage)),
      year: Math.max(...list.map((c) => c.year)),
    };
    const rows = [
      ['Price', (c) => money(c.price, currency), (c) => c.price === best.price],
      ['Year', (c) => c.year, (c) => c.year === best.year],
      ['Mileage', (c) => miles(c.mileage), (c) => c.mileage === best.mileage],
      ['Body', (c) => escapeHtml(c.body)],
      ['Fuel', (c) => escapeHtml(c.fuel)],
      ['Gearbox', (c) => escapeHtml(c.transmission)],
      ['Colour', (c) => `<span class="swatch" style="background: ${escapeHtml(c.hex)}"></span>${escapeHtml(c.color)}`],
      ['Status', (c) => (c.status === 'available' ? 'Available' : 'Reserved')],
    ];

    table.style.setProperty('--cols', list.length);
    table.innerHTML = `<div class="compare__grid">
      <div></div>
      ${list
        .map(
          (c) => `<a class="compare__car" href="./car?id=${encodeURIComponent(c.id)}">
            <div class="art">${carArt(c)}</div>
            <span>${c.year} ${escapeHtml(shortName(c))}</span>
          </a>`,
        )
        .join('')}
      ${rows
        .map(
          ([label, value, isBest]) =>
            `<div class="compare__label">${label}</div>${list
              .map((c) => {
                const mark = list.length > 1 && isBest?.(c);
                return `<div class="compare__cell${mark ? ' is-best' : ''}">${value(c)}${mark ? '<span class="best">Best</span>' : ''}</div>`;
              })
              .join('')}`,
        )
        .join('')}
    </div>`;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-compare]');
    if (btn) return toggle(btn.dataset.compare);
    if (e.target.closest('[data-compare-clear]')) {
      ids = [];
      save();
      sync();
    }
  });

  openBtn.addEventListener('click', () => {
    renderTable();
    dialog.showModal();
  });
  dialog.querySelector('[data-compare-close]').addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  sync();
  return { sync };
}
