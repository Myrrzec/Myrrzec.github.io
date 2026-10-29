const WORD = "Make";
const PORTRAIT_SRC = "assets/portrait-dots.webp";
const HEAD_SHARE = 0.47;
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
const soundToggle = document.querySelector(".sound-toggle");
const soundLabel = soundToggle.querySelector(".sound-label");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;

let W = 0, H = 0, dpr = 1, cx = 0, cy = 0;
let portraitCX = 0, portraitCY = 0, figureHeight = 0.6;
let dot = 2, headWidth = 0, font = "";
let wordLeft = 0, wordRight = 0, wordSpan = 1;
let parts = [], portrait = null;
let target = 0, shown = 0, lastTime = 0;

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

function silhouettePoints() {
  const mobile = W < 900;
  const maxWidth = mobile ? W * 0.94 : W * 0.56;
  const scale = Math.min((H * figureHeight) / portrait.h, maxWidth / portrait.w);
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
  portraitCY = mobile ? H * 0.34 : H * 0.58;
  figureHeight = mobile ? 0.48 : 0.64;
  font = `800 ${Math.round(Math.min(W * 0.15, H * 0.21))}px Outfit, sans-serif`;

  const to = silhouettePoints();
  const step = Math.max(2, Math.sqrt((wordPoints(4).length * 16) / to.length));
  const from = wordPoints(step);
  const count = Math.max(from.length, to.length);
  while (from.length < count) from.push({ ...from[(rand() * from.length) | 0] });
  while (to.length < count) to.push(to[(rand() * to.length) | 0]);

  const maxWidth = mobile ? W * 0.94 : W * 0.56;
  const scale = Math.min((H * figureHeight) / portrait.h, maxWidth / portrait.w);
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
let soundEnabled = true;
let sand = null;
let sandPlaying = false;

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
  if (!soundEnabled) return;
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
  const level = soundEnabled ? arc * motion : 0;
  const now = sand.audioCtx.currentTime;
  // slow attack and release, so the sand swells and settles instead of switching on and off
  sand.master.gain.setTargetAtTime(SOUND_VOLUME * level, now, 0.25);
  // the soft hiss leads; the grain layers stay underneath as texture
  sand.hiss.gain.setTargetAtTime(0.7 + 0.3 * build, now, 0.25);
  sand.sparse.gain.setTargetAtTime(0.18 * (1 - 0.6 * build), now, 0.25);
  sand.dense.gain.setTargetAtTime(0.25 * build + 0.05 * motion, now, 0.25);
  // a darker top end keeps the hiss soft rather than airy and sharp
  sand.tone.frequency.setTargetAtTime(3000 + 2200 * build + 400 * motion, now, 0.25);
  const playing = level > 0.02;
  if (playing !== sandPlaying) {
    sandPlaying = playing;
    soundToggle.classList.toggle("is-playing", playing);
  }
}

function updateSoundControl() {
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.setAttribute("aria-label", soundEnabled ? "Turn transition sound off" : "Turn transition sound on");
  soundLabel.textContent = soundEnabled ? "Sound on" : "Sound off";
}

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateSoundControl();
  unlockSand();
});

for (const type of ["pointerdown", "keydown", "touchend", "wheel"]) {
  addEventListener(type, unlockSand, { capture: true, passive: true });
}
updateSoundControl();

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
  const moving = Math.abs(target - shown) > 0.0005;
  ctx.globalAlpha = moving ? 0.38 : 1;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  const amount = clamp((shown - A0) / (A1 - A0));
  updateSand(amount);
  const wordLift = H * 0.2 * smooth(0.02, 0.68, amount);
  const front = amount * (1 + 0.27 + FLY);
  const edgeX = (y) => wordRight - (front * wordSpan - zig(y));
  if (front < 1.1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y <= H; y += 8) ctx.lineTo(edgeX(y), y);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = INK;
    drawWord(ctx, -wordLift);
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
      x = particle.ax + Math.sin(time * 7 + particle.seed * 5) * 0.8;
      y = particle.ay + Math.cos(time * 6 + particle.seed * 3) * 0.8;
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

document.querySelectorAll("[data-close-and-home]").forEach((link) => {
  link.addEventListener("click", () => link.closest("dialog")?.close());
});

Promise.all([document.fonts.load("800 100px Outfit"), loadPortrait()]).then(() => {
  build();
  updateProgress();
  shown = target;
  document.body.classList.add("is-ready");
  requestAnimationFrame(frame);
});
