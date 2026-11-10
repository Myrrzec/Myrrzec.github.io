// Shared helpers for every page. Contact details live here so they are edited in one place.
export const STORE = {
  name: 'Make Motorworks',
  phone: '+1 555 010 0199',
  email: 'sales@example.com',
  address: '1200 Example Avenue, Austin, TX',
  hours: 'Mon to Sat, 9:00 to 18:00',
};

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let inventory;

export function loadInventory() {
  inventory ??= fetch('./api/cars').then((res) => {
    if (!res.ok) throw new Error('We could not load the inventory. Please refresh the page.');
    return res.json();
  });
  return inventory;
}

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (amount, currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount);

export const miles = (n) => `${n.toLocaleString('en-US')} mi`;

// "911 Carrera S", or just "Macan" when the trim is Base.
export const shortName = (car) => (car.trim && car.trim !== 'Base' ? `${car.model} ${car.trim}` : car.model);

export const fullName = (car) => `${car.year} Porsche ${shortName(car)}`;

// Counts a number up or down in place, e.g. a price changing from one car to the next.
export function tweenNumber(el, from, to, format, duration = 600) {
  cancelAnimationFrame(el._tween);
  if (reducedMotion.matches || from === to || !Number.isFinite(from)) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = format(Math.round(from + (to - from) * eased));
    if (t < 1) el._tween = requestAnimationFrame(step);
  };
  el._tween = requestAnimationFrame(step);
}

// Side profiles drawn per body style, used until real photos are added to cars.csv.
const SHAPES = {
  coupe: {
    body: 'M18 96 C14 88 18 82 30 80 L74 75 C98 69 116 50 146 44 C172 39 198 40 220 46 C248 54 276 70 296 81 C305 86 307 92 304 96 Z',
    glass: 'M120 70 C134 57 150 50 170 49 C192 48 214 53 234 63 L246 70 Z',
    wheels: [74, 246],
  },
  suv: {
    body: 'M16 96 C13 84 18 76 30 74 L80 68 L112 44 C118 38 128 36 140 36 L238 36 C254 36 266 42 278 54 L298 70 C306 74 308 84 306 96 Z',
    glass: 'M120 66 L138 46 C142 42 146 41 152 41 L232 41 C244 41 254 46 262 56 L270 66 Z',
    wheels: [78, 248],
  },
  sedan: {
    body: 'M16 96 C13 88 18 82 28 80 L78 74 C102 66 120 50 150 44 C176 39 210 40 236 48 C262 56 284 68 298 78 C306 82 308 90 306 96 Z',
    glass: 'M118 70 C132 58 150 50 172 48 C198 46 224 50 244 62 L254 70 Z',
    wheels: [76, 248],
  },
  wagon: {
    body: 'M16 96 C13 88 18 82 28 80 L78 74 C102 64 120 48 150 42 C176 38 222 38 256 44 C276 48 290 58 300 72 C306 80 308 90 306 96 Z',
    glass: 'M118 70 C132 56 150 49 174 47 C202 45 236 45 262 52 C272 56 280 62 284 70 Z',
    wheels: [76, 250],
  },
};

const SHAPE_FOR_BODY = { Coupe: 'coupe', Targa: 'coupe', Cabriolet: 'coupe', SUV: 'suv', Sedan: 'sedan', Wagon: 'wagon' };

// Five spokes so a spinning wheel actually reads as spinning.
function wheel(x) {
  const spokes = [0, 72, 144, 216, 288]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return `M${x} 96L${(x + 8 * Math.sin(rad)).toFixed(1)} ${(96 - 8 * Math.cos(rad)).toFixed(1)}`;
    })
    .join('');
  return `<g class="wheel" style="transform-origin: ${x}px 96px">
    <circle cx="${x}" cy="96" r="18" fill="#1b1c1e"/>
    <circle cx="${x}" cy="96" r="10" fill="#9a9da1"/>
    <path d="${spokes}" stroke="#55585c" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="${x}" cy="96" r="2.6" fill="#3a3c3f"/>
  </g>`;
}

// "Photo: Alexander Migl, CC BY-SA 4.0", with links to the original file and the licence.
export function photoCredit(car) {
  const p = car.photo;
  if (!p) return '';
  const link = (url, text) => (url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>` : escapeHtml(text));
  return `Photo: ${link(p.source, p.credit)}${p.license ? `, ${link(p.licenseUrl, p.license)}` : ''}, via Wikimedia Commons`;
}

export function carArt(car, { eager = false } = {}) {
  if (car.image) {
    const src = /^https?:\/\//.test(car.image) ? car.image : `./images/${encodeURIComponent(car.image)}`;
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(`${car.color} ${fullName(car)}`)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
  }
  const shape = SHAPES[SHAPE_FOR_BODY[car.body]] || SHAPES.coupe;
  return `<svg viewBox="0 0 320 124" role="img" aria-label="${escapeHtml(`${car.color} ${shortName(car)}, illustration`)}">
    <ellipse cx="160" cy="114" rx="146" ry="5" fill="#16181a" opacity=".08"/>
    <g class="car-body">
      <path d="${shape.body}" fill="${escapeHtml(car.hex)}" stroke="rgb(0 0 0 / .14)" stroke-width="1"/>
      <path d="${shape.glass}" fill="#1d2329" fill-opacity=".82" stroke="rgb(255 255 255 / .3)" stroke-width="1.5"/>
    </g>
    ${shape.wheels.map(wheel).join('')}
  </svg>`;
}

// Line drawing of a coupe for empty states; takes its colour from CSS.
export function carOutline() {
  const { body, glass, wheels } = SHAPES.coupe;
  return `<svg viewBox="0 0 320 124" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
    <path d="${body}"/><path d="${glass}"/>
    ${wheels.map((x) => `<circle cx="${x}" cy="96" r="18" fill="var(--bg)"/>`).join('')}
  </svg>`;
}

export const skeletonCards = (n) =>
  Array.from(
    { length: n },
    () => `<div class="card card--skeleton" aria-hidden="true">
      <div class="art skeleton"></div>
      <div class="card__body">
        <div class="skel-line skeleton" style="width: 45%"></div>
        <div class="skel-line skeleton" style="width: 60%; height: 16px"></div>
        <div class="skel-line skeleton" style="width: 70%"></div>
        <div class="skel-line skeleton" style="width: 32%; height: 16px; margin-top: 20px"></div>
      </div>
    </div>`,
  ).join('');

export const ICON_PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// The view-transition name lets the browser slide each card to its new spot when filters change.
export function carCard(car, currency, index = 0, { compare = false } = {}) {
  const reserved = car.status !== 'available';
  const vtName = `car-${car.id.replace(/[^a-z0-9_-]/gi, '_')}`;
  return `<article class="card${reserved ? ' is-reserved' : ''}" style="--i: ${index}; view-transition-name: ${vtName}">
    <a class="card__link" href="./car?id=${encodeURIComponent(car.id)}">
      <div class="art">${carArt(car)}${reserved ? '<span class="tag">Reserved</span>' : ''}</div>
      <div class="card__body">
        <p class="card__meta">${car.year} · ${escapeHtml(car.body)} · ${escapeHtml(car.color)}</p>
        <h3 class="card__title">${escapeHtml(shortName(car))}</h3>
        <p class="card__specs">${miles(car.mileage)} · ${escapeHtml(car.transmission)} · ${escapeHtml(car.fuel)}</p>
        <p class="card__price">${money(car.price, currency)}</p>
      </div>
    </a>
    ${
      compare
        ? `<button class="compare-toggle" type="button" data-compare="${escapeHtml(car.id)}" aria-pressed="false" aria-label="Compare ${escapeHtml(shortName(car))}">
            ${ICON_PLUS}<span>Compare</span>
          </button>`
        : ''
    }
  </article>`;
}

// Header and footer are injected so every page shares one copy.
export function mountChrome(current) {
  const nav = [
    ['inventory', './', 'Inventory'],
    ['how', './#how', 'How buying works', 'hide-sm'],
    ['contact', '#contact', 'Contact'],
  ];
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<header class="site-header"><div class="container">
      <a class="brand" href="./">${STORE.name}</a>
      <nav class="site-nav" aria-label="Main">
        ${nav
          .map(([key, href, label, cls]) => `<a href="${href}"${cls ? ` class="${cls}"` : ''}${key === current ? ' aria-current="page"' : ''}>${label}</a>`)
          .join('')}
      </nav>
    </div></header>`,
  );
  document.body.insertAdjacentHTML(
    'beforeend',
    `<footer class="site-footer" id="contact"><div class="container">
      <div class="footer-grid">
        <div>
          <h2>${STORE.name}</h2>
          <p>${STORE.address}</p>
          <p>${STORE.hours}</p>
        </div>
        <div>
          <h2>Contact</h2>
          <p><a href="tel:${STORE.phone.replace(/\s/g, '')}">${STORE.phone}</a></p>
          <p><a href="mailto:${STORE.email}">${STORE.email}</a></p>
        </div>
        <div>
          <h2>Legal</h2>
          <p><a href="./privacy">Privacy policy</a></p>
          <p><a href="./terms">Terms of sale</a></p>
          <p><a href="./credits">Photo credits</a></p>
        </div>
      </div>
      <p class="footer-note">${STORE.name} is an independent dealer and is not affiliated with Porsche AG. Porsche and the model names are trademarks of Porsche AG.</p>
    </div></footer>`,
  );
}
