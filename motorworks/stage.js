import { carArt, money, miles, shortName, escapeHtml, tweenNumber, photoCredit, reducedMotion } from './shop.js';

const CYCLE_MS = 6000;

// Hero showcase: one swatch per car in stock. Picking a colour drives the current car off
// to the right and the chosen one in from the left. It cycles on its own until someone
// interacts, and only while it is on screen.
export function mountStage(root, cars, currency) {
  const picks = cars.filter((c) => c.status === 'available');
  if (!picks.length) return root.remove();

  root.className = 'stage';
  root.removeAttribute('aria-hidden');
  root.innerHTML = `
    <div class="stage__art art">
      <div class="stage__car" data-stage-car></div>
    </div>
    <div class="stage__picker">
      <p class="stage__hint" id="stage-hint">Paint in stock</p>
      <div class="stage__swatches" role="group" aria-labelledby="stage-hint">
        ${picks
          .map(
            (car, i) => `<button type="button" class="swatch-btn" data-i="${i}" style="--paint: ${escapeHtml(car.hex)}"
              aria-pressed="${i === 0}" aria-label="${escapeHtml(`${car.color}, ${car.year} ${shortName(car)}`)}"></button>`,
          )
          .join('')}
      </div>
    </div>
    <a class="hero__caption" data-stage-link>
      <p class="card__meta" data-stage-meta></p>
      <p class="hero__name" data-stage-name></p>
      <p class="card__specs" data-stage-specs></p>
      <p class="hero__price" data-stage-price></p>
    </a>
    <p class="photo-credit stage__credit" data-stage-credit></p>`;

  const q = (sel) => root.querySelector(sel);
  const carEl = q('[data-stage-car]');
  const swatches = [...root.querySelectorAll('.swatch-btn')];
  const caption = {
    link: q('[data-stage-link]'),
    meta: q('[data-stage-meta]'),
    name: q('[data-stage-name]'),
    specs: q('[data-stage-specs]'),
    price: q('[data-stage-price]'),
    credit: q('[data-stage-credit]'),
  };

  // Load the next photo before the old car drives off, so the new one never arrives blank.
  // Gives up after a moment on a slow connection rather than stalling the showcase.
  function preload(car) {
    if (!car.image) return Promise.resolve();
    const img = new Image();
    img.src = car.image;
    return Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  }

  let current = -1;
  let busy = false;
  let pending = null;
  let autoplay = !reducedMotion.matches;
  let onScreen = true;
  let timer;

  function showCaption(car, prevPrice) {
    caption.link.href = `./car?id=${encodeURIComponent(car.id)}`;
    caption.meta.textContent = `In stock · ${car.color}`;
    caption.name.textContent = `${car.year} ${shortName(car)}`;
    caption.specs.textContent = `${miles(car.mileage)} · ${car.transmission} · ${car.fuel}`;
    tweenNumber(caption.price, prevPrice, car.price, (n) => money(n, currency));
    caption.credit.innerHTML = photoCredit(car);
  }

  async function select(i) {
    if (i === current) return;
    // Mark the swatch straight away so the click feels answered while the car drives.
    swatches.forEach((s, idx) => s.setAttribute('aria-pressed', String(idx === i)));
    if (busy) {
      pending = i;
      return;
    }
    busy = true;
    const prevPrice = picks[current]?.price;
    const animate = !reducedMotion.matches && current !== -1;
    let leave;

    await preload(picks[i]);
    carEl.classList.add('is-driving');
    if (animate) {
      leave = carEl.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(115%)', opacity: 0 }],
        { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
      );
      await leave.finished;
    }

    current = i;
    carEl.innerHTML = carArt(picks[i], { eager: true });
    showCaption(picks[i], prevPrice);

    if (animate) {
      const arrive = carEl.animate(
        [{ transform: 'translateX(-115%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
        { duration: 900, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
      leave.cancel();
      await arrive.finished;
    }
    carEl.classList.remove('is-driving');
    busy = false;

    if (pending != null) {
      const next = pending;
      pending = null;
      select(next);
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!autoplay || !onScreen || document.hidden) return;
    timer = setTimeout(async () => {
      await select((current + 1) % picks.length);
      schedule();
    }, CYCLE_MS);
  }

  root.addEventListener('click', (e) => {
    const swatch = e.target.closest('.swatch-btn');
    if (!swatch) return;
    autoplay = false;
    clearTimeout(timer);
    select(Number(swatch.dataset.i));
  });

  // Pause while the pointer or keyboard focus is on the showcase.
  root.addEventListener('pointerenter', () => clearTimeout(timer));
  root.addEventListener('pointerleave', schedule);
  root.addEventListener('focusin', () => clearTimeout(timer));
  root.addEventListener('focusout', schedule);
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    schedule();
  }).observe(root);

  select(0);
}
