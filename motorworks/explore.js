// "Explore the car": takes the hero from the campaign photo into the 3D studio and back.
// Loaded only when the visitor shows intent, so the first screen never waits for Three.js.
import { gsap } from 'gsap';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector, root = document) => root.querySelector(selector);

const hero = $('.hero-scene');
const button = $('#explore');
const note = $('#explore-note');
const showroom = $('#showroom');
const curtain = $('#studio-curtain');
const status = $('.curtain-status', curtain);
const titleLines = [...curtain.querySelectorAll('.curtain-line')];
const statusLabel = $('.curtain-label', status);
const bar = $('.curtain-bar', status);
const failure = $('.curtain-error', curtain);
const caption = $('.showroom-caption', showroom);
const menu = $('.showroom-menu ol', showroom);
const exitButton = $('.showroom-exit', showroom);
const action = $('.showroom-action', showroom);
const specs = $('.showroom-specs', showroom);
const carRow = $('.showroom-cars-row', showroom);
const carStatus = $('.showroom-cars-status', showroom);
const heroParts = [$('.hero-top', hero), $('.hero-bottom', hero), $('.image-label', hero)];
const headline = [...hero.querySelectorAll('.h1-line')];
const photo = $('.hero-image', hero);
const chrome = [$('.showroom-top', showroom), caption, specs, $('.showroom-menu', showroom)];

const t = (seconds) => (reduced ? 0 : seconds);
// Opening and closing animate the same elements; a new one takes over from wherever the last one stopped.
// Each one takes a ticket; an older one that is still awaiting stops as soon as it wakes up.
let ticket = 0;
const stopTransitions = () => {
  gsap.killTweensOf([showroom, curtain, photo, status, ...chrome, ...titleLines, ...headline, ...heroParts]);
  return ++ticket;
};
let room = null;
let loading = null;
let open = false;
let lastState = null;
let cars = null;
// Start fetching the 3D code as soon as this module loads (on hover or focus); the model waits for the click.
let modules = import('./showroom/showroom.js');
modules.catch(() => {});

export function supportsWebGL() {
  try {
    return Boolean(window.WebGL2RenderingContext && document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);
function progress(loaded, total) {
  if (total) {
    statusLabel.textContent = `Loading the 3D model: ${mb(loaded)} of ${mb(total)} MB`;
    bar.hidden = false;
    bar.firstElementChild.style.transform = `scaleX(${Math.min(1, loaded / total)})`;
  } else {
    statusLabel.textContent = `Loading the 3D model: ${mb(loaded)} MB received`;
  }
  if (total && loaded >= total) statusLabel.textContent = 'Preparing paint, glass and light';
}

// Text, menu and buttons follow the studio's state; nothing here runs per frame.
function showState(name, state) {
  for (const b of menu.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.state === name));
  // If the control that had focus is about to disappear, hand focus to the obvious next control.
  const orphaned = (document.activeElement === action && !state.action) || (document.activeElement === exitButton && !state.interior);
  exitButton.hidden = !state.interior;
  if (orphaned) (state.interior ? exitButton : menu.querySelector(`[data-state="${name}"]`))?.focus({ preventScroll: true });
  $('canvas', showroom)?.setAttribute('aria-label', `3D view of the car: ${state.label}`);
  // A new car can arrive on the same view name, so the text is keyed by car and view.
  const key = `${room?.car}:${name}`;
  if (lastState === key) return;
  lastState = key;
  const fill = () => {
    $('[data-eyebrow]', caption).textContent = state.eyebrow;
    $('[data-title]', caption).textContent = state.title;
    $('[data-text]', caption).textContent = state.text;
    specs.hidden = !state.specs;
    specs.replaceChildren(...(state.specs || []).map(([term, figure, detail]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      const strong = document.createElement('strong');
      const note = document.createElement('span');
      dt.textContent = term;
      strong.textContent = figure;
      note.textContent = detail;
      dd.append(strong, note);
      row.append(dt, dd);
      return row;
    }));
    action.hidden = !state.action;
    if (state.action) {
      action.innerHTML = '';
      const arrow = document.createElement('span');
      arrow.textContent = '→';
      arrow.setAttribute('aria-hidden', 'true');
      action.append(state.action.label, arrow);
      action.dataset.state = state.action.state;
    }
  };
  const text = [caption, specs];
  gsap.killTweensOf(text);
  if (reduced || !open) return fill();
  gsap.to(text, { opacity: 0, y: 10, duration: 0.18, onComplete: () => (fill(), gsap.to(text, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' })) });
}

const carTitle = (car) => `Porsche ${car.name} (${car.generation}), ${car.year}`;
function showCar(id) {
  for (const b of carRow.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.car === id));
  showroom.setAttribute('aria-label', `3D studio: ${carTitle(cars[id])}`);
}

// The car picker. A choice loads in the background while the current car stays; the studio then
// dissolves from one to the other. Choosing again mid-load simply takes over.
function buildPicker(list, order) {
  if (carRow.children.length) return;
  cars = list;
  for (const id of order) {
    const car = list[id];
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.car = id;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', carTitle(car));
    const name = document.createElement('strong');
    name.textContent = car.name.replace(/^911 /, '');
    const gen = document.createElement('span');
    gen.textContent = `${car.generation} / ${car.year}`;
    b.append(name, gen);
    b.addEventListener('click', () => pickCar(id));
    carRow.append(b);
  }
}

let picking = 0;
async function pickCar(id) {
  if (!room || id === room.car) return;
  const mine = ++picking;
  const car = cars[id];
  showCar(id);
  carRow.setAttribute('aria-busy', 'true');
  carStatus.textContent = `Loading the ${car.name}`;
  const onLoad = (loaded, total) => {
    if (mine !== picking) return;
    carStatus.textContent = total ? `Loading the ${car.name}: ${mb(loaded)} of ${mb(total)} MB` : `Loading the ${car.name}: ${mb(loaded)} MB received`;
  };
  try {
    const done = await room.switchCar(id, onLoad);
    if (mine !== picking) return;
    carStatus.textContent = done ? '' : carStatus.textContent;
  } catch {
    if (mine !== picking) return;
    showCar(room.car);
    carStatus.textContent = `The ${car.name} didn't load. Check the connection and pick it again.`;
  }
  carRow.removeAttribute('aria-busy');
}

function buildMenu(states, order) {
  if (menu.children.length) return;
  for (const [i, name] of order.entries()) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.state = name;
    b.setAttribute('aria-pressed', 'false');
    const n = document.createElement('span');
    n.textContent = String(i + 1).padStart(2, '0');
    b.append(n, states[name].label);
    b.addEventListener('click', () => room?.go(name));
    li.append(b);
    menu.append(li);
  }
}

async function load() {
  let code;
  try {
    code = await modules;
  } catch (error) {
    modules = import('./showroom/showroom.js');
    throw error;
  }
  buildMenu(code.STATES, code.ORDER);
  buildPicker(code.CARS, code.LINEUP);
  showCar(code.DEFAULT_CAR);
  room = await code.createShowroom({
    host: $('.showroom-stage', showroom),
    hotspotLayer: $('.showroom-hotspots', showroom),
    carId: code.DEFAULT_CAR,
    reducedMotion: reduced,
    onProgress: progress,
    onState: showState,
    onBusy: (busy) => showroom.setAttribute('aria-busy', String(busy)),
    onError: (error) => fail(error),
  });
  if (new URLSearchParams(location.search).has('debug')) {
    window.__studio = room;
    // Steps animation by hand for `seconds` (GSAP and the renderer both wait on animation frames).
    window.__advance = (seconds, step = 1 / 30) => {
      for (let t = 0; t < seconds; t += step) {
        const until = performance.now() + step * 1000;
        while (performance.now() < until);
        gsap.ticker.tick();
        room.renderOnce();
      }
      return room.inspect();
    };
  }
  return room;
}

function fail(error) {
  loading = null;
  status.hidden = true;
  failure.hidden = false;
  $('.curtain-detail', failure).textContent =
    error?.message?.includes('graphics')
      ? 'The browser stopped the 3D view. Reloading the page usually brings it back.'
      : 'Check the connection and try again. The photo and the rest of the site still work.';
  if (open) {
    showroom.hidden = true;
    gsap.set(curtain, { opacity: 1 });
    curtain.classList.add('is-up');
  }
  $('.curtain-retry', failure).focus();
}

// `covered` means the curtain is already up (retrying after a failed load), so the photo is not replayed.
export async function enter({ covered = false } = {}) {
  if (open) return;
  if (!supportsWebGL()) {
    note.hidden = false;
    note.textContent = "This browser can't show the 3D studio (WebGL 2 is turned off or not supported). The photo is the closest view we can offer here.";
    return;
  }
  open = true;
  button.setAttribute('aria-expanded', 'true');
  status.hidden = false;
  failure.hidden = true;
  bar.hidden = true;
  bar.firstElementChild.style.transform = 'scaleX(0)';
  statusLabel.textContent = 'Opening the studio';
  if (!loading) {
    loading = room ? Promise.resolve(room) : load();
    loading.catch(() => {}); // handled below once the curtain is up; this keeps the console clean meanwhile
  }

  // The headline hands over to the studio's: "For the feeling" lifts away, the photo leans in under a
  // warm scrim and "Into the studio" rises in its place while the model loads. A studio that is
  // already loaded skips the title and fades straight in.
  const cached = Boolean(room) && !covered;
  const mine = stopTransitions();
  // The studio fills the hero; bring all of it on screen if the page was scrolled.
  if (hero.getBoundingClientRect().top < 0) scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  curtain.classList.add('is-up');
  const out = gsap.timeline({ paused: covered });
  out.to(headline, { yPercent: -60, opacity: 0, duration: t(0.6), stagger: t(0.08), ease: 'power3.in' }, 0)
    .to(heroParts, { opacity: 0, y: 20, duration: t(0.4), ease: 'power2.in' }, 0)
    .to(photo, { scale: 1.08, duration: t(1.8), ease: 'power2.out' }, 0)
    .fromTo(curtain, { opacity: 0 }, { opacity: 1, duration: t(0.7), ease: 'power1.out' }, t(0.15));
  if (!cached) {
    out.fromTo(titleLines, { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: t(0.75), stagger: t(0.08), ease: 'power3.out' }, t(0.45))
      .fromTo(status, { opacity: 0 }, { opacity: 1, duration: t(0.4) }, t(0.8));
  } else {
    gsap.set(titleLines, { opacity: 0 });
    gsap.set(status, { opacity: 0 });
  }
  if (covered) out.progress(1);
  else if (cached) await new Promise((resolve) => gsap.delayedCall(t(0.35), resolve));
  else await out;

  let ready;
  try {
    ready = await loading;
  } catch (error) {
    if (mine === ticket) fail(error);
    return;
  }
  if (mine !== ticket) return;

  // The studio fades in over the photo while the camera glides from wide and high to the opening view.
  showroom.hidden = false;
  gsap.set(showroom, { opacity: 0 });
  gsap.set(chrome, { opacity: 0, y: 16 });
  const arrival = ready.enter();
  await gsap.timeline()
    .to(titleLines, { yPercent: -60, opacity: 0, duration: t(0.5), stagger: t(0.06), ease: 'power3.in' }, 0)
    .to(status, { opacity: 0, duration: t(0.3) }, 0)
    .to(showroom, { opacity: 1, duration: t(1.1), ease: 'power2.inOut' }, t(0.2))
    .to(curtain, { opacity: 0, duration: t(0.6), ease: 'power1.in' }, t(0.7))
    .to(chrome, { opacity: 1, y: 0, duration: t(0.6), stagger: t(0.1), ease: 'power2.out' }, t(0.9));
  if (mine !== ticket) return;
  curtain.classList.remove('is-up');
  menu.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  await arrival;
}

export async function leave({ covered = false } = {}) {
  if (!open) return;
  open = false;
  button.setAttribute('aria-expanded', 'false');
  status.hidden = true;
  failure.hidden = true;
  // The reverse: the studio (or, after a failed load, the scrim) fades back into the photo,
  // which settles while the headline drops back in.
  const mine = stopTransitions();
  const tl = gsap.timeline();
  if (!covered) {
    tl.to(chrome, { opacity: 0, duration: t(0.25) }, 0)
      .to(showroom, { opacity: 0, duration: t(0.8), ease: 'power2.inOut' }, t(0.1));
  }
  tl.to(curtain, { opacity: 0, duration: t(0.5) }, 0)
    .to(photo, { scale: 1, duration: t(1.2), ease: 'power2.out' }, t(0.1))
    .to(headline, { yPercent: 0, opacity: 1, duration: t(0.7), stagger: t(0.08), ease: 'power3.out' }, t(0.45))
    .to(heroParts, { opacity: 1, y: 0, duration: t(0.5), ease: 'power2.out' }, t(0.6));
  await tl;
  if (mine !== ticket) return;
  room?.setActive(false);
  showroom.hidden = true;
  curtain.classList.remove('is-up');
  button.focus({ preventScroll: true });
}

$('.showroom-close', showroom).addEventListener('click', leave);
$('.showroom-reset', showroom).addEventListener('click', () => room?.reset());
exitButton.addEventListener('click', () => room?.go('door'));
action.addEventListener('click', () => room?.go(action.dataset.state));
$('.curtain-retry', failure).addEventListener('click', () => {
  open = false;
  enter({ covered: true });
});
$('.curtain-back', failure).addEventListener('click', () => {
  open = true;
  leave({ covered: true });
});
showroom.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !room) return;
  e.preventDefault();
  if (room.state === 'interior') room.go('door');
  else if (room.state !== 'exterior') room.go('exterior');
  else leave();
});
addEventListener('pagehide', (e) => {
  if (e.persisted) return;
  room?.destroy();
  room = null;
});
