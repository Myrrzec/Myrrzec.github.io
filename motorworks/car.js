import { loadInventory, carArt, carCard, money, miles, shortName, fullName, mountChrome, escapeHtml, tweenNumber, photoCredit, STORE } from './shop.js';

const TERMS = [24, 36, 48, 60, 72];
const DEFAULT_APR = 6.9;

function financeBlock(car, currency) {
  const down = Math.round((car.price * 0.2) / 500) * 500;
  return `<section class="finance" aria-labelledby="finance-title">
    <div class="finance__intro">
      <h2 class="section-title" id="finance-title">Estimate a monthly payment</h2>
      <p>Move the sliders to see what this car could cost per month. Bring the number to your bank, or ask us about finance.</p>
    </div>
    <div class="finance__panel">
      <div class="finance__inputs">
        <div class="field">
          <label for="down">Down payment</label>
          <input class="range-input" id="down" type="range" min="0" max="${Math.round(car.price * 0.9)}" step="500" value="${down}">
          <p class="field__help"><span data-down></span>, <span data-down-pct></span> of the price</p>
        </div>
        <fieldset class="field">
          <legend>Term</legend>
          <div class="segmented">
            ${TERMS.map(
              (n) => `<label><input type="radio" name="term" value="${n}"${n === 48 ? ' checked' : ''}><span>${n} mo</span></label>`,
            ).join('')}
          </div>
        </fieldset>
        <div class="field">
          <label for="apr">Interest rate (APR, %)</label>
          <input class="input" id="apr" type="number" inputmode="decimal" min="0" max="30" step="0.1" value="${DEFAULT_APR}" aria-describedby="apr-help apr-error">
          <p class="field__help" id="apr-help">Use the rate your bank offers you.</p>
          <p class="field__error" id="apr-error" role="alert" data-apr-error></p>
        </div>
      </div>
      <div class="finance__result" aria-live="polite">
        <p class="card__meta">Per month</p>
        <p class="finance__monthly" data-monthly></p>
        <dl class="specs">
          <dt>Financed</dt><dd data-financed></dd>
          <dt>Total interest</dt><dd data-interest></dd>
          <dt>Total paid</dt><dd data-total></dd>
        </dl>
        <p class="reserve__note">An estimate, not a finance offer. Your real rate depends on your credit and the lender. Prices in ${currency.toUpperCase()}.</p>
      </div>
    </div>
  </section>`;
}

function bindFinance(car, currency) {
  const $ = (sel) => root.querySelector(sel);
  const fmt = (n) => money(n, currency);
  const down = $('#down');
  const apr = $('#apr');
  const out = {
    down: $('[data-down]'),
    pct: $('[data-down-pct]'),
    monthly: $('[data-monthly]'),
    financed: $('[data-financed]'),
    interest: $('[data-interest]'),
    total: $('[data-total]'),
    error: $('[data-apr-error]'),
  };
  let rate = DEFAULT_APR;
  let lastMonthly;

  function calc() {
    const d = Number(down.value);
    const months = Number(root.querySelector('input[name="term"]:checked').value);
    const principal = car.price - d;
    const r = rate / 100 / 12;
    const monthly = r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);

    // Fill the slider track up to the thumb.
    down.style.setProperty('--fill', `${(d / Number(down.max)) * 100}%`);
    out.down.textContent = fmt(d);
    out.pct.textContent = `${Math.round((d / car.price) * 100)}%`;
    out.financed.textContent = fmt(principal);
    out.interest.textContent = fmt(Math.round(monthly * months - principal));
    out.total.textContent = fmt(Math.round(monthly * months + d));
    tweenNumber(out.monthly, lastMonthly, Math.round(monthly), fmt, 400);
    lastMonthly = Math.round(monthly);
  }

  down.addEventListener('input', calc);
  root.querySelector('.segmented').addEventListener('change', calc);
  apr.addEventListener('input', () => {
    const value = Number.parseFloat(apr.value);
    const valid = Number.isFinite(value) && value >= 0 && value <= 30;
    apr.setAttribute('aria-invalid', String(!valid));
    out.error.textContent = valid ? '' : 'Enter a rate between 0 and 30.';
    if (!valid) return;
    rate = value;
    calc();
  });
  calc();
}

const root = document.querySelector('[data-car]');
const crumb = document.querySelector('[data-crumb]');

function reserveBox(car, data) {
  const enquire = `mailto:${STORE.email}?subject=${encodeURIComponent(fullName(car))}`;
  const deposit = money(data.deposit, data.currency);

  if (car.status !== 'available') {
    return `<div class="reserve">
      <button class="btn btn--primary" type="button" disabled>Reserved</button>
      <a class="btn btn--line" href="${enquire}">Ask to be told if it comes back</a>
      <p class="reserve__note">Someone has put a deposit on this car. Deals do fall through, so it is worth asking.</p>
    </div>`;
  }
  // The static copy on makeworks.dev has no server behind it, so it says plainly that nothing can be bought.
  if (data.concept) {
    return `<div class="reserve">
      <button class="btn btn--primary" type="button" disabled>Reserve for ${deposit}</button>
      <p class="reserve__note">This is a concept site. It takes no reservations or payments, and the cars, prices and contact details are made up.</p>
    </div>`;
  }
  if (!data.payments) {
    return `<div class="reserve">
      <a class="btn btn--primary" href="tel:${STORE.phone.replace(/\s/g, '')}">Call to reserve</a>
      <a class="btn btn--line" href="${enquire}">Ask a question</a>
      <p class="reserve__note">Online reservations are not switched on yet. Call us and we will hold the car for you.</p>
    </div>`;
  }
  return `<div class="reserve">
    <button class="btn btn--primary" type="button" data-reserve>Reserve for ${deposit}</button>
    <a class="btn btn--line" href="${enquire}">Ask a question</a>
    <p class="reserve__note">The deposit takes the car off the market and is taken off the final price. It is refunded in full if you decide not to buy before signing the purchase agreement.</p>
    <p class="reserve__error" role="alert" data-error></p>
  </div>`;
}

async function reserve(car, button) {
  const error = root.querySelector('[data-error]');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Opening secure checkout…';
  error.textContent = '';

  try {
    const res = await fetch('./api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: car.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) throw new Error(body.error || 'Checkout did not open. Please try again.');
    location.href = body.url;
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = label;
  }
}

function render(car, data) {
  document.title = `${fullName(car)} | ${STORE.name}`;
  crumb.textContent = shortName(car);

  const related = data.cars
    .filter((c) => c.id !== car.id && (c.model === car.model || c.body === car.body))
    .slice(0, 3);

  root.innerHTML = `<div class="car">
      <figure class="car__media">
        <div class="art">${carArt(car, { eager: true })}${car.status !== 'available' ? '<span class="tag">Reserved</span>' : ''}</div>
        ${car.photo ? `<figcaption class="photo-credit">${photoCredit(car)}</figcaption>` : ''}
      </figure>
      <div class="car__info">
        <p class="card__meta">${escapeHtml(car.body)} · ${escapeHtml(car.color)}</p>
        <h1>${escapeHtml(fullName(car))}</h1>
        <p class="car__price">${money(car.price, data.currency)}</p>
        <dl class="specs">
          <dt>Year</dt><dd>${car.year}</dd>
          <dt>Mileage</dt><dd>${miles(car.mileage)}</dd>
          <dt>Body</dt><dd>${escapeHtml(car.body)}</dd>
          <dt>Fuel</dt><dd>${escapeHtml(car.fuel)}</dd>
          <dt>Gearbox</dt><dd>${escapeHtml(car.transmission)}</dd>
          <dt>Colour</dt><dd><span class="swatch" style="background:${escapeHtml(car.hex)}"></span>${escapeHtml(car.color)}</dd>
        </dl>
        ${car.description ? `<p class="car__desc">${escapeHtml(car.description)}</p>` : ''}
        ${reserveBox(car, data)}
      </div>
    </div>
    ${financeBlock(car, data.currency)}
    ${
      related.length
        ? `<section class="related"><h2 class="section-title">Similar cars</h2>
            <div class="grid">${related.map((c) => carCard(c, data.currency)).join('')}</div></section>`
        : ''
    }`;

  root.querySelector('[data-reserve]')?.addEventListener('click', (e) => reserve(car, e.currentTarget));
  bindFinance(car, data.currency);
}

mountChrome();

try {
  const data = await loadInventory();
  const car = data.cars.find((c) => c.id === new URLSearchParams(location.search).get('id'));
  if (car) {
    render(car, data);
  } else {
    crumb.textContent = 'Not found';
    root.innerHTML = `<div class="empty"><p>This car is no longer listed. It may have been sold.</p>
      <a class="btn btn--line" href="./">Back to inventory</a></div>`;
  }
} catch (err) {
  root.innerHTML = `<p class="notice">${escapeHtml(err.message)}</p>`;
} finally {
  root.removeAttribute('aria-busy');
}
