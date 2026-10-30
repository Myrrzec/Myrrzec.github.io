const WORD = "Make";
const PORTRAIT_SRC = "assets/portrait-dots.webp";
const HEAD_SHARE = 0.47;
const PORTRAIT_SIZE = 1 / 1.5; // the portrait (and the cursor ball with it) at two thirds of its fitted size
const SPHERE_SCALE = 0.24;
const COLLISION_RESPONSE = 0.32;
const PENETRATION_FIX = 0.75;
const TANGENT_TRANSFER = 0.055;
const SLIDE_FORCE = 0.035;
const CRUST = 0.2;
const RESTITUTION = 0.04;
const CONTACT_DAMPING = 0.82;
const RETURN_HALF_LIFE = 0.48;
const FLOW_TURN_SPEED = 1.15;
const FLOW_ENERGY_DECAY = 3.2;
const DRIFT_AMPLITUDE = 2.8;
const DRIFT_SPEED_X = 3.2;
const DRIFT_SPEED_Y = 2.7;
const MODE_HOME = 0;
const MODE_COLLISION = 1;
const MODE_RETURN = 2;
const BG = "#ffffff";
const INK = "#141414";

const track = document.querySelector("#intro");
const stage = track.querySelector(".morph-stage");
const canvas = document.querySelector("#morph-canvas");
const ctx = canvas.getContext("2d");
const profile = document.querySelector(".profile-info");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;

let W = 0, H = 0, dpr = 1, cx = 0, cy = 0;
let portraitCX = 0, portraitCY = 0, figureHeight = 0.6;
let dot = 2, headWidth = 0, font = "";
let wordLeft = 0, wordRight = 0, wordSpan = 1;
let parts = [], portrait = null;
let target = 0, shown = 0, lastTime = 0;
// on first load the word is typed out letter by letter: a short pause after the M, then
// the rest a little quicker, like a hand that has found the word; ms after TYPE_DELAY
const TYPE_DELAY = 300, LETTER_AT = [0, 190, 295, 400];
let typeStart = -Infinity;
// the first screen: the word Click in dots, waiting for the click that lets the page play sound
const GATE_WORD = "Click";
let gateDots = null;

const rand = (() => {
  let seed = 7;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
})();
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (value) => value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
const smooth = (from, to, value) => {
  const amount = clamp((value - from) / (to - from));
  return amount * amount * (3 - 2 * amount);
};

function offscreen(paint) {
  const buffer = document.createElement("canvas");
  buffer.width = W;
  buffer.height = H;
  const bufferCtx = buffer.getContext("2d", { willReadFrequently: true });
  paint(bufferCtx);
  return bufferCtx.getImageData(0, 0, W, H).data;
}

function drawWord(targetCtx, offsetY = 0) {
  targetCtx.font = font;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "middle";
  targetCtx.letterSpacing = `${-parseFloat(font.split(" ")[1]) * 0.045}px`;
  targetCtx.fillText(WORD, cx, cy + offsetY);
}

// how many letters of the word are typed at `now`
const typed = (now) => LETTER_AT.filter((at) => now - typeStart - TYPE_DELAY >= at).length;

function wordPoints(step) {
  const data = offscreen((bufferCtx) => {
    bufferCtx.fillStyle = "#000";
    drawWord(bufferCtx);
  });
  const points = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const px = Math.min(W - 1, Math.round(x + (rand() - 0.5) * step * 0.6));
      const py = Math.min(H - 1, Math.round(y + (rand() - 0.5) * step * 0.6));
      if (data[(py * W + px) * 4 + 3] > 128) points.push({ x: px, y: py });
    }
  }
  return points;
}

const gateGrain = () => Math.max(0.9, parseFloat(font.split(" ")[1]) * 0.016);

// Click in the same type as Make, as loose dots a little coarser than the word's, so it reads as sand
function gatePoints() {
  const data = offscreen((bufferCtx) => {
    bufferCtx.fillStyle = "#000";
    bufferCtx.font = font;
    bufferCtx.textAlign = "center";
    bufferCtx.textBaseline = "middle";
    bufferCtx.letterSpacing = `${-parseFloat(font.split(" ")[1]) * 0.045}px`;
    bufferCtx.fillText(GATE_WORD, cx, cy);
  });
  // grain size follows the type size, not the portrait's dots, which can be too fine to read as letters
  const grain = gateGrain();
  const step = grain * 2.3;
  const points = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const px = Math.min(W - 1, Math.round(x + (rand() - 0.5) * step * 0.7));
      const py = Math.min(H - 1, Math.round(y + (rand() - 0.5) * step * 0.7));
      if (data[(py * W + px) * 4 + 3] > 128) {
        points.push({ x: px, y: py, seed: rand() * Math.PI * 2, size: 0.8 + rand() * 0.45 });
      }
    }
  }
  return points;
}

function silhouettePoints() {
  const mobile = W < 900;
  const maxWidth = mobile ? W * 0.94 : W * 0.56;
  const scale = Math.min((H * figureHeight) / portrait.h, maxWidth / portrait.w) * PORTRAIT_SIZE;
  const offsetX = portraitCX - portrait.w * scale / 2;
  const offsetY = portraitCY - portrait.h * scale / 2;
  return portrait.dots.map((point) => ({
    x: offsetX + point.x * scale,
    y: offsetY + point.y * scale,
    shade: point.shade,
    size: 1,
  }));
}

const zig = (y) => wordSpan * 0.025 * (
  Math.sin(y * 0.045) + 0.6 * Math.sin(y * 0.13 + 1.7) + 0.3 * Math.sin(y * 0.31 + 4)
);

function build() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.round(canvas.clientWidth);
  H = Math.round(canvas.clientHeight);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = W / 2;
  cy = H / 2;
  const mobile = W < 900;
  portraitCX = mobile ? W * 0.5 : W * 0.305;
  portraitCY = mobile ? H * 0.32 : H * 0.53;
  figureHeight = mobile ? 0.48 : 0.64;
  font = `800 ${Math.round(Math.min(W * 0.1, H * 0.14))}px Outfit, sans-serif`;

  const to = silhouettePoints();
  const step = Math.max(2, Math.sqrt((wordPoints(4).length * 16) / to.length));
  const from = wordPoints(step);
  const count = Math.max(from.length, to.length);
  while (from.length < count) from.push({ ...from[(rand() * from.length) | 0] });
  while (to.length < count) to.push(to[(rand() * to.length) | 0]);

  const maxWidth = mobile ? W * 0.94 : W * 0.56;
  const scale = Math.min((H * figureHeight) / portrait.h, maxWidth / portrait.w) * PORTRAIT_SIZE;
  dot = clamp(portrait.dot * scale, 1, 2.6);
  headWidth = portrait.w * scale * HEAD_SHARE;
  wordLeft = Math.min(...from.map((point) => point.x));
  wordRight = Math.max(...from.map((point) => point.x));
  wordSpan = wordRight - wordLeft || 1;
  from.forEach((point) => { point.distance = (wordRight - point.x) / wordSpan; });
  from.sort((a, b) => a.distance - b.distance);
  to.forEach((point) => {
    point.core = Math.hypot(point.x - portraitCX, point.y - portraitCY) + rand() * 40;
  });
  to.sort((a, b) => a.core - b.core);
  parts = from.map((start, index) => {
    const end = to[index];
    return {
      ax: start.x, ay: start.y, distance: start.distance,
      bx: end.x, by: end.y, shade: end.shade, size: end.size,
      delay: 0.05 + rand() * 0.22,
      seed: rand() * Math.PI * 2,
    };
  });
  if (gateDots && !gateDots.clickAt) gateDots.points = gatePoints();
}

function spiral(x0, y0, x1, y1, amount, turns, wave, seed) {
  const radius0 = Math.max(2, Math.hypot(x0 - cx, y0 - cy));
  const radius1 = Math.max(2, Math.hypot(x1 - cx, y1 - cy));
  const angle0 = Math.atan2(y0 - cy, x0 - cx);
  let delta = Math.atan2(y1 - cy, x1 - cx) - angle0;
  delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const angle = angle0 + (delta + turns * Math.PI * 2) * amount;
  let radius = Math.exp(Math.log(radius0) + (Math.log(radius1) - Math.log(radius0)) * amount);
  radius *= 1 + wave * Math.sin(Math.PI * amount) * Math.sin(angle * 3 + seed);
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}

const A0 = 0.08, A1 = 0.92, FLY = 0.8;
const pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false };
// the sand is synthesized live, so it follows the scroll instead of playing a fixed clip:
// a soft hiss carries the flow, a sparse crackle the first grains breaking off, a dense crackle
// the pour as the portrait forms. Level, density and brightness follow the morph and its speed
const SOUND_VOLUME = 0.12;
let sand = null;

// stereo noise with a fixed loudness; grainsPerSecond 0 gives a smooth pinkish hiss,
// otherwise the buffer is made of short decaying clicks, one per grain
function sandBuffer(audioCtx, seconds, grainsPerSecond) {
  const rate = audioCtx.sampleRate;
  const length = Math.round(seconds * rate);
  const buffer = audioCtx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    if (!grainsPerSecond) {
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965335;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = b0 + b1 + b2 + white * 0.1848;
      }
    } else {
      const count = Math.round(seconds * grainsPerSecond);
      for (let grain = 0; grain < count; grain++) {
        const start = Math.floor(Math.random() * length);
        // fine sand: tiny ticks of nearly even loudness, so no single grain pops out like a pea
        const size = Math.floor(rate * (0.00008 + Math.random() * 0.00035)) + 2;
        const amplitude = (0.35 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1);
        for (let k = 0; k < size; k++) {
          data[(start + k) % length] += amplitude * (Math.random() * 2 - 1) * Math.exp(-k / (size * 0.25));
        }
      }
    }
    let sum = 0;
    for (let i = 0; i < length; i++) sum += data[i] * data[i];
    const gain = 0.15 / Math.max(1e-6, Math.sqrt(sum / length));
    for (let i = 0; i < length; i++) data[i] *= gain;
  }
  return buffer;
}

function createSand() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const audioCtx = new AudioCtx();
  const master = audioCtx.createGain();
  master.gain.value = 0;
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 1800; // no low thud: fine sand has no body
  const tone = audioCtx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2000;
  tone.Q.value = 0.4;
  highpass.connect(tone).connect(master).connect(audioCtx.destination);
  const layer = (buffer) => {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(highpass);
    source.start(0, Math.random() * buffer.duration);
    return gain;
  };
  return {
    audioCtx, master, tone,
    hiss: layer(sandBuffer(audioCtx, 4, 0)),
    sparse: layer(sandBuffer(audioCtx, 3, 700)),
    dense: layer(sandBuffer(audioCtx, 3, 6000)),
  };
}

// browsers only start audio after a click, tap or key press
function unlockSand() {
  if (!sand) sand = createSand();
  if (sand && sand.audioCtx.state === "suspended") sand.audioCtx.resume().catch(() => {});
}

function updateSand(amount) {
  if (!sand || sand.audioCtx.state !== "running") return;
  // how much the grains are moving right now: nothing while the scroll rests
  const motion = smooth(0.0006, 0.02, Math.abs(target - shown));
  // how far into the morph: a faint start as the word begins to break, swelling as the
  // portrait forms, falling quiet as the last grains land
  const build = smooth(0, 0.85, amount);
  const arc = (0.12 + 0.88 * build) * smooth(0, 0.05, amount) * (1 - smooth(0.9, 1, amount));
  const level = arc * motion;
  const now = sand.audioCtx.currentTime;
  // slow attack and release, so the sand swells and settles instead of switching on and off
  sand.master.gain.setTargetAtTime(SOUND_VOLUME * level, now, 0.25);
  // the soft hiss leads; the grain layers stay underneath as texture
  sand.hiss.gain.setTargetAtTime(0.7 + 0.3 * build, now, 0.25);
  sand.sparse.gain.setTargetAtTime(0.18 * (1 - 0.6 * build), now, 0.25);
  sand.dense.gain.setTargetAtTime(0.25 * build + 0.05 * motion, now, 0.25);
  // a darker top end keeps the hiss soft rather than airy and sharp
  sand.tone.frequency.setTargetAtTime(3000 + 2200 * build + 400 * motion, now, 0.25);
}

// one recorded keystroke per typed letter: assets/keys.mp3 holds four single keys, one every
// KEY_SLOT seconds. Each starts just before its hit, so the encoder's lead-in doesn't matter,
// and each is brought to the same peak, KEY_PEAK, so no key jumps out
const KEY_PEAK = 0.16, KEY_SLOT = 0.25, KEY_LENGTH = 0.12;
let keys = null;

function loadKeys(audioCtx) {
  keys ??= fetch("assets/keys.mp3")
    .then((response) => response.arrayBuffer())
    .then((data) => audioCtx.decodeAudioData(data))
    .then((buffer) => {
      const samples = buffer.getChannelData(0);
      const rate = buffer.sampleRate;
      const starts = [], gains = [];
      for (let slot = 0; slot * KEY_SLOT < buffer.duration - 0.05; slot++) {
        const from = Math.floor(slot * KEY_SLOT * rate);
        const end = Math.min(samples.length, from + Math.floor(KEY_SLOT * rate));
        let peak = 0;
        for (let i = from; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
        let hit = from;
        while (hit < end && Math.abs(samples[hit]) < peak * 0.3) hit++;
        starts.push(Math.max(from / rate, hit / rate - 0.006));
        gains.push(KEY_PEAK / Math.max(peak, 0.001));
      }
      return { buffer, starts, gains };
    })
    .catch(() => null);
  return keys;
}

function keystroke(audioCtx, { buffer, starts, gains }, letter, when) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = gains[letter % gains.length];
  source.connect(gain).connect(audioCtx.destination);
  source.start(Math.max(when, audioCtx.currentTime), starts[letter % starts.length], KEY_LENGTH);
}

// schedules the keystrokes of the letters still to come; a browser that hasn't been clicked yet
// keeps audio locked, so the letters typed before the first click stay silent
async function typingSound() {
  if (!sand || sand.audioCtx.state !== "running") return;
  const audioCtx = sand.audioCtx;
  const sounds = await loadKeys(audioCtx);
  if (!sounds) return;
  for (let letter = 0; letter < WORD.length; letter++) {
    const delay = (typeStart + TYPE_DELAY + LETTER_AT[letter] - performance.now()) / 1000;
    if (delay >= -0.02) keystroke(audioCtx, sounds, letter, audioCtx.currentTime + delay);
  }
}

for (const type of ["pointerdown", "keydown", "touchend", "wheel"]) {
  addEventListener(type, unlockSand, { capture: true, passive: true });
}

function trackPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  if (pointer.active && event.type === "pointermove") {
    pointer.vx = clamp(localX - pointer.x, -40, 40);
    pointer.vy = clamp(localY - pointer.y, -40, 40);
  }
  pointer.x = localX;
  pointer.y = localY;
  pointer.active = true;
}
stage.addEventListener("pointermove", trackPointer, { passive: true });
stage.addEventListener("pointerenter", trackPointer, { passive: true });
stage.addEventListener("pointerleave", () => { pointer.active = false; }, { passive: true });

function updateProgress() {
  const rect = track.getBoundingClientRect();
  target = clamp(-rect.top / Math.max(1, rect.height - innerHeight));
  shown += (target - shown) * (reduce ? 1 : 0.075);
  const infoAmount = smooth(0.73, 0.95, shown);
  document.documentElement.style.setProperty("--profile-opacity", infoAmount.toFixed(4));
  document.documentElement.style.setProperty("--profile-shift", `${(1 - infoAmount) * 30}px`);
  profile.classList.toggle("is-visible", infoAmount > 0.85);
  document.body.classList.toggle("intro-complete", shown > 0.86);
  document.body.classList.toggle("dock-visible", shown > 0.92);
}

function frame(now) {
  updateProgress();
  const time = now / 1000;
  const dt = lastTime ? Math.min((now - lastTime) / 16.667, 2) : 1;
  const dtSeconds = lastTime ? Math.min((now - lastTime) / 1000, 0.033) : 1 / 60;
  lastTime = now;
  const amount = clamp((shown - A0) / (A1 - A0));
  updateSand(amount);
  const wordLift = H * 0.2 * smooth(0.02, 0.68, amount);
  // the front starts just past the word's right edge, so the jagged edge can't bite into it before
  // the scroll begins; ZIG_REACH is the furthest that edge swings either way, in word widths
  const ZIG_REACH = 0.05;
  const front = amount * (1 + 0.27 + FLY + ZIG_REACH) - ZIG_REACH;
  // the solid word is drawn lifted, so its jagged edge is read at the word's own height
  const edgeX = (y) => wordRight - (front * wordSpan - zig(y + wordLift));

  // light trails while things move, a clean frame when they settle; no trails while the solid
  // word is still on screen, or it smears into faint copies of itself as it rises
  const moving = Math.abs(target - shown) > 0.0005;
  ctx.globalAlpha = moving && front >= 1.1 ? 0.38 : 1;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  if (gateDots) drawGate(now, dtSeconds);
  if (front < 1.1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y <= H; y += 8) ctx.lineTo(edgeX(y), y);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = INK;
    const letters = amount > 0 ? WORD.length : typed(now);
    if (letters < WORD.length) {
      // the word is centred, so its typed part is the left slice of the full word
      ctx.font = font;
      ctx.letterSpacing = `${-parseFloat(font.split(" ")[1]) * 0.045}px`;
      const left = cx - ctx.measureText(WORD).width / 2;
      const typedRight = left + (letters ? ctx.measureText(WORD.slice(0, letters)).width : 0);
      ctx.beginPath();
      ctx.rect(0, 0, typedRight, H);
      ctx.clip();
      drawWord(ctx, -wordLift);
    } else {
      drawWord(ctx, -wordLift);
    }
    ctx.restore();
  }

  const interactionMix = reduce ? 0 : smooth(0.78, 0.95, shown);
  const pushes = pointer.active && interactionMix > 0;
  const sphere = headWidth * SPHERE_SCALE * (coarse ? 0.78 : 1) * interactionMix;
  const maxOffset = sphere * (1.15 + CRUST);
  const levels = Array.from({ length: 11 }, () => []);
  const radius = dot / 2;

  for (const particle of parts) {
    const loose = front - zig(particle.ay) / wordSpan - particle.distance;
    if (loose <= 0) {
      particle.ox = undefined;
      continue;
    }
    const flight = ease(clamp((loose - particle.delay) / FLY));
    let x, y;
    if (flight > 0) {
      const liftedStartY = particle.ay - wordLift * (1 - flight * 0.3);
      [x, y] = spiral(particle.ax, liftedStartY, particle.bx, particle.by, flight, 2, 0.22, particle.seed);
      const lift = Math.sin(Math.PI * Math.min(1, flight * 1.8));
      x += lift * 30 * Math.cos(particle.seed);
      y -= lift * 22 * (0.5 + Math.sin(particle.seed) * 0.5);
      const homeX = x, homeY = y;
      if (particle.ox === undefined || reduce) {
        particle.ox = particle.oy = particle.vx = particle.vy = 0;
        particle.mode = MODE_HOME;
        particle.flowEnergy = 0;
        particle.flowDirection = 1;
      }
      if (!reduce) {
        const structure = clamp(particle.shade);
        const protection = 1 - structure * 0.45;
        let hit = false;
        let shell = sphere;
        if (pushes) {
          const depth = Math.max(0, sphere - Math.hypot(homeX - pointer.x, homeY - pointer.y));
          shell = sphere + depth * CRUST * (0.85 + 0.15 * Math.sin(particle.seed * 7));
          let dx = homeX + particle.ox - pointer.x;
          let dy = homeY + particle.oy - pointer.y;
          let distance = Math.hypot(dx, dy);
          if (distance < shell) {
            hit = true;
            if (distance < 0.01) {
              dx = Math.cos(particle.seed * 9);
              dy = Math.sin(particle.seed * 9);
              distance = 0.001;
            }
            const nx = dx / distance, ny = dy / distance;
            if (particle.mode !== MODE_COLLISION) particle.vx = particle.vy = 0;
            particle.mode = MODE_COLLISION;
            particle.ox += nx * (shell - distance) * COLLISION_RESPONSE;
            particle.oy += ny * (shell - distance) * COLLISION_RESPONSE;
            particle.vx *= CONTACT_DAMPING ** dt;
            particle.vy *= CONTACT_DAMPING ** dt;
            const normalVelocity = particle.vx * nx + particle.vy * ny;
            if (normalVelocity < 0) {
              particle.vx -= nx * normalVelocity * (1 + RESTITUTION);
              particle.vy -= ny * normalVelocity * (1 + RESTITUTION);
            }
            const tangentX = -ny, tangentY = nx;
            const drag = (pointer.vx * tangentX + pointer.vy * tangentY) * TANGENT_TRANSFER * protection * dt;
            const slide = tangentY * SLIDE_FORCE * protection * dt;
            particle.vx += tangentX * (drag + slide);
            particle.vy += tangentY * (drag + slide);
            particle.ox += particle.vx * dt;
            particle.oy += particle.vy * dt;
          }
        }
        if (!hit && particle.mode === MODE_COLLISION) {
          particle.mode = MODE_RETURN;
          particle.flowEnergy = clamp(Math.hypot(particle.vx, particle.vy) / 8);
          particle.flowDirection = particle.ox * particle.vy - particle.oy * particle.vx >= 0 ? 1 : -1;
          particle.vx = particle.vy = 0;
        }
        if (particle.mode === MODE_RETURN) {
          const previousDistance = Math.hypot(particle.ox, particle.oy);
          const halfLife = RETURN_HALF_LIFE * (1 - structure * 0.18);
          const decay = Math.exp((-Math.LN2 * dtSeconds) / halfLife);
          const turn = FLOW_TURN_SPEED * particle.flowEnergy * particle.flowDirection * dtSeconds;
          const cosine = Math.cos(turn), sine = Math.sin(turn);
          const rotatedX = particle.ox * cosine - particle.oy * sine;
          const rotatedY = particle.ox * sine + particle.oy * cosine;
          particle.ox = rotatedX * decay;
          particle.oy = rotatedY * decay;
          particle.flowEnergy *= Math.exp(-FLOW_ENERGY_DECAY * dtSeconds);
          const newDistance = Math.hypot(particle.ox, particle.oy);
          if (newDistance > previousDistance) {
            const correction = previousDistance / Math.max(newDistance, 0.0001);
            particle.ox *= correction;
            particle.oy *= correction;
          }
          if (newDistance < 0.12) {
            particle.ox = particle.oy = 0;
            particle.mode = MODE_HOME;
            particle.flowEnergy = 0;
          }
        }
        if (pushes) {
          const dx = homeX + particle.ox - pointer.x;
          const dy = homeY + particle.oy - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < shell && distance > 0.001) {
            if (particle.mode !== MODE_COLLISION) particle.vx = particle.vy = 0;
            particle.mode = MODE_COLLISION;
            particle.ox += dx / distance * (shell - distance) * PENETRATION_FIX;
            particle.oy += dy / distance * (shell - distance) * PENETRATION_FIX;
          }
        }
        if (particle.mode === MODE_COLLISION) {
          const offset = Math.hypot(particle.ox, particle.oy);
          if (offset > maxOffset) {
            particle.ox *= maxOffset / offset;
            particle.oy *= maxOffset / offset;
          }
        }
        x = homeX + particle.ox;
        y = homeY + particle.oy;
        x += (Math.sin(time * DRIFT_SPEED_X + particle.by * 0.018 + particle.seed) * DRIFT_AMPLITUDE + Math.sin(time * 1.7 + particle.seed * 2.1) * 0.65) * flight;
        y += (Math.cos(time * DRIFT_SPEED_Y + particle.bx * 0.018 + particle.seed * 1.3) * DRIFT_AMPLITUDE + Math.cos(time * 1.45 + particle.seed * 1.8) * 0.65) * flight;
      }
    } else {
      particle.ox = undefined;
      // loose but not yet flying: it shivers where the lifted word is now, not where it started
      x = particle.ax + Math.sin(time * 7 + particle.seed * 5) * 0.8;
      y = particle.ay - wordLift + Math.cos(time * 6 + particle.seed * 3) * 0.8;
    }
    const level = Math.round((1 + (particle.shade - 1) * flight) * 10);
    levels[level].push(x, y, radius * (1 + (particle.size - 1) * flight));
  }

  ctx.fillStyle = INK;
  levels.forEach((points, level) => {
    if (!points.length) return;
    ctx.globalAlpha = level / 10;
    ctx.beginPath();
    for (let index = 0; index < points.length; index += 3) {
      ctx.moveTo(points[index] + points[index + 2], points[index + 1]);
      ctx.arc(points[index], points[index + 1], points[index + 2], 0, Math.PI * 2);
    }
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  pointer.vx *= 0.82 ** dt;
  pointer.vy *= 0.82 ** dt;
  requestAnimationFrame(frame);
}

let resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(build, 150);
});

function loadPortrait() {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = image.width, height = image.height;
      const buffer = document.createElement("canvas");
      buffer.width = width;
      buffer.height = height;
      const bufferCtx = buffer.getContext("2d", { willReadFrequently: true });
      bufferCtx.fillStyle = "#fff";
      bufferCtx.fillRect(0, 0, width, height);
      bufferCtx.drawImage(image, 0, 0);
      const data = bufferCtx.getImageData(0, 0, width, height).data;
      const luminance = new Uint8Array(width * height);
      for (let index = 0; index < width * height; index++) {
        luminance[index] = (data[index * 4] * 0.3 + data[index * 4 + 1] * 0.59 + data[index * 4 + 2] * 0.11) | 0;
      }
      const dots = [];
      const taken = new Uint8Array(width * height);
      let x0 = width, y0 = height, x1 = 0, y1 = 0, area = 0;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const index = y * width + x, value = luminance[index];
          if (value > 225 || taken[index]) continue;
          if (value >= luminance[index - width - 1] || value >= luminance[index - width] || value >= luminance[index - width + 1] || value >= luminance[index - 1]) continue;
          if (value > luminance[index + 1] || value > luminance[index + width - 1] || value > luminance[index + width] || value > luminance[index + width + 1]) continue;
          for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) taken[index + yy * width + xx] = 1;
          dots.push({ x, y, shade: clamp((235 - value) / 200, 0.12, 1) });
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      for (let index = 0; index < width * height; index++) if (luminance[index] < 200) area++;
      dots.forEach((point) => { point.x -= x0; point.y -= y0; });
      portrait = {
        dots,
        w: x1 - x0 + 1,
        h: y1 - y0 + 1,
        dot: clamp(2 * Math.sqrt(area / dots.length / Math.PI), 1.5, 4),
      };
      resolve();
    };
    image.src = PORTRAIT_SRC;
  });
}

const reveals = document.querySelectorAll(".reveal");
if (reduce) reveals.forEach((item) => item.classList.add("in"));
else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -7%" });
  reveals.forEach((item) => observer.observe(item));
}

document.querySelectorAll("[data-project]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.querySelector(`#project-${button.dataset.project}`);
    if (dialog && !dialog.open) dialog.showModal();
  });
});

document.querySelectorAll(".service-dialog").forEach((dialog) => {
  dialog.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

// the first screen asks for one click: browsers only play sound after one, and the typing and
// the sand both want it. A shockwave runs out from the click, the dots it reaches are thrown off and
// fall away like sand with a short pour of sound, then Make is typed
const gate = document.querySelector(".sound-gate");
const GATE_WAVE = 1.4;     // px per ms the shockwave travels
const GATE_BLAST = 520;    // px/s a dot right at the click is thrown
const GATE_GRAVITY = 950;  // px/s²
const GATE_FADE = 0.85;    // s a thrown dot takes to vanish
const GATE_TYPE_AFTER = 650; // ms from the click to the first letter

function drawGate(now, dtSeconds) {
  const time = now / 1000;
  const { points, clickAt, x: hitX, y: hitY } = gateDots;
  let alive = 0;
  const grain = gateGrain();
  ctx.fillStyle = INK;
  for (const point of points) {
    let x = point.x, y = point.y, alpha = 1;
    if (clickAt === null || now < clickAt + point.delay) {
      // waiting: each grain trembles a little in place
      x += Math.sin(time * 2.3 + point.seed * 5) * 0.55;
      y += Math.cos(time * 1.9 + point.seed * 3) * 0.55;
      alive++;
    } else {
      if (point.vx === undefined) {
        const dx = point.x - hitX, dy = point.y - hitY;
        const distance = Math.hypot(dx, dy) || 1;
        const push = GATE_BLAST * (0.55 + Math.random() * 0.6) / (1 + distance / 160);
        point.vx = (dx / distance) * push + (Math.random() - 0.5) * 60;
        point.vy = (dy / distance) * push - 120 * Math.random();
        point.ox = 0;
        point.oy = 0;
        point.age = 0;
      }
      point.age += dtSeconds;
      point.vy += GATE_GRAVITY * dtSeconds;
      const drag = Math.exp(-2.2 * dtSeconds);
      point.vx *= drag;
      point.vy *= drag;
      point.ox += point.vx * dtSeconds;
      point.oy += point.vy * dtSeconds;
      x += point.ox;
      y += point.oy;
      alpha = 1 - point.age / GATE_FADE;
      if (alpha <= 0) continue;
      alive++;
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, grain * point.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!alive) {
    gateDots = null;
    gate.hidden = true;
    document.documentElement.classList.remove("gate-open");
  }
}

// a short pour of fine sand for the burst, from the same grains as the scroll sound
function sandBurst(audioCtx) {
  const source = audioCtx.createBufferSource();
  source.buffer = sandBuffer(audioCtx, 1.3, 5000);
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 1800;
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 5200;
  lowpass.Q.value = 0.4;
  const gain = audioCtx.createGain();
  const start = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.32, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
  source.connect(highpass).connect(lowpass).connect(gain).connect(audioCtx.destination);
  source.start(start);
  source.stop(start + 1.3);
}

function openGate(event) {
  gate.disabled = true;
  unlockSand();
  if (sand) loadKeys(sand.audioCtx);
  const rect = canvas.getBoundingClientRect();
  // a keyboard press has no point, so the wave starts from the middle of the word
  const x = event.clientX ? event.clientX - rect.left : cx;
  const y = event.clientY ? event.clientY - rect.top : cy;
  const now = performance.now();
  gateDots.x = x;
  gateDots.y = y;
  gateDots.clickAt = now;
  gateDots.points.forEach((point) => {
    point.delay = Math.hypot(point.x - x, point.y - y) / GATE_WAVE + Math.random() * 40;
  });
  typeStart = now + GATE_TYPE_AFTER - TYPE_DELAY;
  sand?.audioCtx.resume().then(() => {
    sandBurst(sand.audioCtx);
    typingSound();
  }, () => {});
}

Promise.all([document.fonts.load("800 100px Outfit"), loadPortrait()]).then(() => {
  build();
  updateProgress();
  shown = target;
  if (shown < A0) {
    if (reduce) {
      typeStart = -Infinity;
    } else {
      typeStart = Infinity; // nothing typed until the click
      gateDots = { points: gatePoints(), clickAt: null, x: 0, y: 0 };
      gate.hidden = false;
      document.documentElement.classList.add("gate-open");
      gate.addEventListener("click", openGate, { once: true });
    }
  }
  document.body.classList.add("is-ready");
  requestAnimationFrame(frame);
});

// bottom dock: mark the link of the section in the middle of the screen and slide the pill under it
const dock = document.querySelector(".bottom-dock");
const dockIndicator = dock.querySelector(".dock-indicator");
const dockLinks = [...dock.querySelectorAll("a[data-section]")];
let dockActive = null;

function placeDockIndicator() {
  if (!dockActive) return;
  dockIndicator.style.width = `${dockActive.offsetWidth}px`;
  dockIndicator.style.transform = `translateX(${dockActive.offsetLeft}px)`;
}

function updateDock() {
  const middle = innerHeight / 2;
  // the last section may be too short to reach the middle line, so the page's end counts as it
  const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const current = (atEnd && dockLinks[dockLinks.length - 1]) || dockLinks.find((link) => {
    const rect = document.getElementById(link.dataset.section).getBoundingClientRect();
    return rect.top <= middle && rect.bottom > middle;
  }) || dockActive || dockLinks[0];
  if (current === dockActive) return;
  dockActive = current;
  dockLinks.forEach((link) => link.setAttribute("aria-current", String(link === current)));
  placeDockIndicator();
}

addEventListener("scroll", updateDock, { passive: true });
addEventListener("resize", placeDockIndicator);
document.fonts.ready.then(placeDockIndicator);
updateDock();
