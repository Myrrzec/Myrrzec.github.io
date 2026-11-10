// The 3D studio: renderer, camera choreography and the single source of truth for which view is active.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { createStage } from './stage.js';
import { loadCar } from './car.js';
import { HOTSPOTS, statesFor } from './states.js';
import { CARS } from './cars.js';

export { STATES, ORDER, statesFor } from './states.js';
export { CARS, LINEUP, DEFAULT_CAR } from './cars.js';

// The body as a rounded box (superellipsoid). The camera is pushed back out whenever it would enter it,
// so neither orbiting nor a transition can put the lens inside a panel.
const HULL = { center: new THREE.Vector3(0, 0.62, 0), radii: new THREE.Vector3(1.04, 0.74, 2.4) };
const hullValue = (p) =>
  Math.abs((p.x - HULL.center.x) / HULL.radii.x) ** 4 +
  Math.abs((p.y - HULL.center.y) / HULL.radii.y) ** 4 +
  Math.abs((p.z - HULL.center.z) / HULL.radii.z) ** 4;
function pushOutOfHull(p) {
  const f = hullValue(p);
  if (f >= 1) return false;
  const scale = f > 1e-6 ? f ** -0.25 : 1;
  p.sub(HULL.center).multiplyScalar(scale).add(HULL.center);
  return true;
}

// The only way into the cabin is through the open driver's door.
const DOORWAY = new THREE.Vector3(2.1, 1.05, -0.45);

// Moves around the car along an ellipse that follows its plan shape, rising a little on long swings.
function orbitPoint(a, b, t, out) {
  const ax = a.x / 1.1, az = a.z / 2.4, bx = b.x / 1.1, bz = b.z / 2.4;
  const ra = Math.hypot(ax, az), rb = Math.hypot(bx, bz);
  const ta = Math.atan2(ax, az);
  let dt = Math.atan2(bx, bz) - ta;
  if (dt > Math.PI) dt -= Math.PI * 2;
  if (dt < -Math.PI) dt += Math.PI * 2;
  const angle = ta + dt * t;
  const r = ra + (rb - ra) * t;
  const lift = Math.sin(Math.PI * t) * 0.35 * Math.min(1, Math.abs(dt) / Math.PI);
  return out.set(Math.sin(angle) * r * 1.1, a.y + (b.y - a.y) * t + lift, Math.cos(angle) * r * 2.4);
}

// A camera route made of segments; `free` segments may enter the hull (they pass through the doorway).
function route(from, to, fromInside, toInside) {
  const legs = [];
  if (fromInside && toInside) legs.push({ a: from, b: to, free: true });
  else if (fromInside) legs.push({ a: from, b: DOORWAY, free: true }, { a: DOORWAY, b: to, orbit: true });
  else if (toInside) legs.push({ a: from, b: DOORWAY, orbit: true }, { a: DOORWAY, b: to, free: true });
  else legs.push({ a: from, b: to, orbit: true });
  const lengths = legs.map((l) => l.a.distanceTo(l.b) + (l.orbit ? 0.6 : 0));
  const total = lengths.reduce((s, n) => s + n, 0) || 1;
  return {
    length: total,
    viaDoor: fromInside || toInside,
    at(t, out) {
      let d = t * total;
      for (const [i, leg] of legs.entries()) {
        if (d <= lengths[i] || i === legs.length - 1) {
          const k = lengths[i] ? Math.min(1, d / lengths[i]) : 1;
          if (leg.orbit) orbitPoint(leg.a, leg.b, k, out);
          else out.lerpVectors(leg.a, leg.b, k);
          return leg.free;
        }
        d -= lengths[i];
      }
      return false;
    },
  };
}

export async function createShowroom({ host, hotspotLayer, carId, reducedMotion, onProgress, onState, onBusy, onError }) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.localClippingEnabled = true; // used once, to open up the luggage well
  const canvas = renderer.domElement;
  canvas.className = 'showroom-canvas';
  canvas.setAttribute('role', 'img');
  host.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const size = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // On portrait screens the caption sits on top and the menu at the bottom: lower the frame's centre
    // a little (a lens shift, not a camera move) so the car lands in the free band between them.
    // On wide screens the caption takes the left and the spec sheet and menu the right, and the left
    // block is the wider one: move the frame's centre a little to the right instead.
    if (camera.aspect < 0.9) camera.setViewOffset(w, h, 0, -h * 0.09, w, h);
    else if (w > 700) camera.setViewOffset(w, h, -w * 0.06, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    stage?.resize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    invalidate();
  };
  let stage = null;
  let frames = 0;
  const invalidate = (n = 2) => (frames = Math.max(frames, n));
  size();

  stage = createStage(renderer, { reflections: !coarse });
  scene.add(stage.group);
  scene.environment = stage.environment;
  scene.background = stage.background;
  scene.fog = new THREE.Fog(stage.background, ...stage.fog);
  const sun = new THREE.DirectionalLight('#ffe1c2', 1.5);
  sun.position.set(6, 7, 7);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#e8eef4', 0.55);
  fill.position.set(-6, 4, -3);
  scene.add(fill);

  let carKey = carId;
  let STATES = statesFor(CARS[carKey]);
  let car;
  try {
    car = await loadCar(CARS[carKey], onProgress);
  } catch (error) {
    // Nothing else holds GPU memory yet: release the stage and the context before reporting.
    stage.dispose();
    renderer.dispose();
    canvas.remove();
    throw error;
  }
  scene.add(car.object);
  car.apply();
  stage.bakeShadow(scene);
  let occluders = [];
  const collectOccluders = () => {
    occluders = [];
    car.object.traverse((o) => o.isMesh && o.visible && !o.material.transparent && occluders.push(o));
  };
  collectOccluders();

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.enabled = false;
  // Vertical swipes keep scrolling the page on touch screens; sideways drags turn the car.
  canvas.style.touchAction = 'pan-y';
  controls.addEventListener('change', () => invalidate());
  // A plain mouse wheel keeps scrolling the page. Zoom needs intent: a trackpad pinch (reported as
  // ctrl + wheel), ctrl/cmd + wheel, a touch pinch or a double-click.
  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation();
  };
  canvas.addEventListener('wheel', onWheel, { capture: true });

  // ---- views ----------------------------------------------------------------------------------
  let current = 'exterior';
  let timeline = null;
  let busy = false;
  let arrived = null;
  const target = new THREE.Vector3(...STATES.exterior.target);
  const setBusy = (value) => {
    busy = value;
    hotspotLayer.classList.toggle('is-hidden', value);
    onBusy?.(value);
  };

  // Narrow screens see the same composition from further away instead of a cropped car.
  function framed(state) {
    const at = new THREE.Vector3(...state.camera);
    const look = new THREE.Vector3(...state.target);
    if (state.interior) {
      // A tall screen shows more windscreen than dashboard; tilt the gaze down to keep the instruments in view.
      if (camera.aspect < 0.9) look.y -= 0.24;
      return { at, look, fov: camera.aspect < 0.9 ? state.fov + 12 : state.fov };
    }
    const fit = camera.aspect < 1.35 ? (1.35 / camera.aspect) ** 0.62 : 1;
    at.sub(look).multiplyScalar(fit).add(look);
    return { at, look, fov: state.fov + (camera.aspect < 0.9 ? 10 : 0), fit };
  }

  function settle(state, view) {
    timeline = null;
    controls.target.copy(view.look);
    if (state.interior) {
      // Look-around: orbit a point a couple of centimetres ahead of the driver's eyes.
      const ahead = view.look.clone().sub(view.at).normalize().multiplyScalar(0.02);
      controls.target.copy(view.at).add(ahead);
      controls.enableZoom = false;
      controls.rotateSpeed = -0.45;
      controls.minPolarAngle = 1.0;
      controls.maxPolarAngle = 2.05;
      controls.minAzimuthAngle = Math.PI - 1.4;
      controls.maxAzimuthAngle = -Math.PI + 1.4;
      controls.minDistance = controls.maxDistance = 0.02;
    } else {
      controls.enableZoom = true;
      controls.rotateSpeed = 0.6;
      controls.minPolarAngle = 0.3;
      controls.maxPolarAngle = 1.5;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minDistance = Math.min(state.distance[0] * (view.fit || 1), camera.position.distanceTo(controls.target));
      // Stay inside the pavilion (radius 13 m): beyond it there is no floor to stand on.
      controls.maxDistance = Math.min(state.distance[1] * (view.fit || 1), 12);
    }
    controls.enabled = true;
    controls.update();
    setBusy(false);
    invalidate();
    arrived?.();
    arrived = null;
  }

  // Moves the camera and the parts to `name`. Safe to call at any moment: a running transition is
  // dropped and the new one starts from wherever the camera and the parts are right now.
  function travel(name, override) {
    const state = STATES[name];
    const view = override || framed(state);
    timeline?.kill();
    gsap.killTweensOf(car.pose);
    if (controls.enabled) {
      // Flush leftover orbit momentum so the route starts from a still camera.
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = true;
    }
    controls.enabled = false;
    setBusy(true);

    const from = camera.position.clone();
    const fromTarget = controls.target.clone();
    const fromFov = camera.fov;
    const fromInside = hullValue(from) < 1;
    const path = route(from, view.at, fromInside, Boolean(state.interior));
    const speed = reducedMotion ? 0 : 1;
    const duration = speed * gsap.utils.clamp(1.1, 2.4, 0.85 + path.length * 0.13);
    const pose = { door: 0, hood: 0, spoiler: 0, steer: 0, ...state.pose };
    // Passing through the doorway needs the door fully open first, and it shuts only after the camera is out.
    const doorWait = path.viaDoor ? speed * 0.85 * (1 - car.pose.door) : 0;

    const tl = gsap.timeline({ onComplete: () => settle(state, view) });
    timeline = tl;
    const proxy = { t: 0 };
    const look = new THREE.Vector3();
    tl.to(proxy, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate() {
        const free = path.at(proxy.t, camera.position);
        if (!free) pushOutOfHull(camera.position);
        look.lerpVectors(fromTarget, view.look, proxy.t);
        controls.target.copy(look);
        camera.fov = fromFov + (view.fov - fromFov) * proxy.t;
        camera.updateProjectionMatrix();
        camera.lookAt(look);
        invalidate();
      },
    }, doorWait);
    const moved = () => (car.apply(), invalidate());
    const animatePart = (key, value, at, length = speed * 0.95) =>
      tl.to(car.pose, { [key]: value, duration: length, ease: 'power2.inOut', onUpdate: moved }, at);
    for (const key of ['hood', 'spoiler', 'steer']) {
      if (car.pose[key] !== pose[key]) animatePart(key, pose[key], pose[key] > car.pose[key] ? doorWait + duration * 0.35 : 0);
    }
    if (path.viaDoor) {
      if (car.pose.door < 1) animatePart('door', 1, 0, doorWait);
      if (pose.door < 1) animatePart('door', pose.door, doorWait + duration);
    } else if (car.pose.door !== pose.door) {
      animatePart('door', pose.door, pose.door > car.pose.door ? duration * 0.3 : 0);
    }
    return new Promise((resolve) => {
      arrived?.();
      arrived = resolve;
    });
  }

  function go(name) {
    if (!STATES[name]) return;
    current = name;
    onState?.(name, STATES[name]);
    travel(name);
  }

  // Double-click or double-tap: glide toward the point on the car under the pointer.
  function focusOn(point, normal) {
    if (STATES[current].interior) return;
    const away = camera.position.clone().sub(point).normalize().add(normal).normalize();
    const at = point.clone().addScaledVector(away, 1.45);
    if (at.y < 0.25) at.y = 0.25;
    pushOutOfHull(at);
    const state = STATES[current];
    travel(current, { at, look: point.clone(), fov: state.fov, fit: framed(state).fit });
  }

  // ---- pointer: click a part to open it, double-click to look closer -------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(event, list = [car.object]) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(list, true).find((hit) => hit.object.visible && hit.object.material.opacity > 0.05);
  }
  // A single click opens the part under the pointer; a second click within 280 ms turns it into a
  // double-click that zooms instead. Works the same for taps, which do not reliably fire dblclick.
  let down = null;
  let tap = null;
  const onDown = (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onUp = (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 450) return;
    down = null;
    const point = { clientX: e.clientX, clientY: e.clientY };
    if (tap && performance.now() - tap.t < 280 && Math.hypot(point.clientX - tap.clientX, point.clientY - tap.clientY) < 30) {
      clearTimeout(tap.timer);
      tap = null;
      const hit = pick(point, occluders);
      if (hit) {
        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        focusOn(hit.point, normal);
      }
      return;
    }
    clearTimeout(tap?.timer);
    tap = { ...point, t: performance.now() };
    tap.timer = setTimeout(() => {
      tap = null;
      if (STATES[current].interior) return;
      const hit = pick(point);
      const part = hit && car.partFor(hit.object);
      if (part) go(part === current ? 'exterior' : part);
    }, 280);
  };
  let hoverQueued = false;
  const onMove = (e) => {
    if (e.pointerType !== 'mouse' || e.buttons || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const hit = !STATES[current].interior && pick(e);
      canvas.style.cursor = hit && car.partFor(hit.object) ? 'pointer' : '';
    });
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);

  // ---- hotspots ------------------------------------------------------------------------------
  const spots = HOTSPOTS.map((spot) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hotspot';
    el.tabIndex = -1; // the text menu is the keyboard route; these are pointer shortcuts
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="hotspot-dot"></span><span class="hotspot-label"></span>';
    el.lastChild.textContent = spot.label;
    el.addEventListener('click', () => go(spot.state));
    hotspotLayer.append(el);
    return { ...spot, el, at: new THREE.Vector3(...(spot.at || [0, 0, 0])), normal: new THREE.Vector3(...spot.normal).normalize(), clear: true, checked: 0 };
  });
  // Each hotspot lands where its ray first meets the car, so it fits whichever car is loaded.
  function findHotspots() {
    const wheelZ = CARS[carKey].rig.wheelL.hinge[2] - (CARS[carKey].center?.[2] || 0);
    const v = (list) => new THREE.Vector3(...list.map((n) => (n === 'wheel' ? wheelZ : n)));
    for (const spot of spots) {
      if (!spot.from) continue;
      const from = v(spot.from);
      raycaster.set(from, v(spot.to).sub(from).normalize());
      const hit = raycaster.intersectObjects(occluders, false)[0];
      if (hit) spot.at.copy(hit.point).addScaledVector(raycaster.ray.direction, -0.03);
      spot.checked = 0;
    }
  }
  findHotspots();
  const toSpot = new THREE.Vector3();
  const projected = new THREE.Vector3();
  function placeHotspots(now, force = false) {
    const wanted = STATES[current].hotspots;
    const { clientWidth: w, clientHeight: h } = host;
    for (const spot of spots) {
      let show = !busy && wanted.includes(spot.id);
      if (show) {
        toSpot.subVectors(camera.position, spot.at);
        const distance = toSpot.length();
        show = toSpot.divideScalar(distance).dot(spot.normal) > 0.12;
        // Occlusion is a ray test, so it runs at most every 150 ms per hotspot.
        if (show && (force || now - spot.checked > 150)) {
          spot.checked = now;
          raycaster.set(camera.position, toSpot.clone().negate());
          raycaster.far = distance - 0.04;
          spot.clear = raycaster.intersectObjects(occluders, false).length === 0;
          raycaster.far = Infinity;
        }
        show = show && spot.clear;
        projected.copy(spot.at).project(camera);
        const x = (projected.x * 0.5 + 0.5) * w;
        const y = (-projected.y * 0.5 + 0.5) * h;
        show = show && x > 24 && x < w - 24 && y > 24 && y < h - 24;
        if (show) spot.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
      if (spot.el.classList.contains('is-on') !== show) spot.el.classList.toggle('is-on', show);
    }
  }

  // ---- render loop: draws only while something moves, and only while visible ----------------
  let owesHotspotPass = false;
  let renders = 0;
  function frame(now) {
    if (controls.enabled && controls.update()) invalidate(1);
    if (timeline?.isActive()) invalidate(1);
    if (frames <= 0) {
      // Once the camera stops, run one full occlusion pass for its final position.
      if (owesHotspotPass) placeHotspots(now, true);
      owesHotspotPass = false;
      return;
    }
    frames -= 1;
    if (controls.enabled && !STATES[current].interior && pushOutOfHull(camera.position)) camera.lookAt(controls.target);
    renderer.render(scene, camera);
    renders += 1;
    placeHotspots(now);
    owesHotspotPass = true;
  }
  let visible = false;
  let active = false;
  const run = () => renderer.setAnimationLoop(active && visible && !document.hidden ? frame : null);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    run();
  });
  io.observe(host);
  const onVisibility = () => run();
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(size);
  ro.observe(host);
  const onLost = (e) => {
    e.preventDefault();
    active = false;
    run();
    onError?.(new Error('The graphics context was lost.'));
  };
  canvas.addEventListener('webglcontextlost', onLost);

  // compileAsync polls with timers, which a background tab slows to a crawl; compile in one go there.
  const compile = (object, ...rest) => (document.hidden ? Promise.resolve(renderer.compile(object, ...rest)) : renderer.compileAsync(object, ...rest));
  await compile(scene, camera);

  // Start wide and high, then let `enter` bring the camera in to the opening view.
  function stageEntrance() {
    const view = framed(STATES.exterior);
    camera.position.copy(view.at).sub(view.look).multiplyScalar(1.7).add(view.look);
    camera.position.y += 1.4;
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    controls.target.copy(view.look);
    camera.lookAt(view.look);
    invalidate();
  }
  stageEntrance();

  // ---- changing cars ---------------------------------------------------------------------------
  // The next car loads while the current one stays on screen. Then the last frame of the old car is
  // frozen on a 2D canvas laid over the studio, the cars are swapped underneath, and the frozen frame
  // fades away while the camera settles: a dissolve from one car to the other in the same room.
  const veil = document.createElement('canvas');
  veil.className = 'showroom-veil';
  veil.setAttribute('aria-hidden', 'true');
  host.append(veil);
  let switching = 0;
  async function switchCar(id, onLoad) {
    if (!CARS[id] || id === carKey) return false;
    const mine = ++switching;
    // Head outside first: the door and lid close, and the new car is met from the opening view.
    if (current !== 'exterior') go('exterior');
    const next = await loadCar(CARS[id], onLoad);
    if (mine !== switching) {
      next.dispose();
      return false;
    }
    await compile(next.object, camera, scene);
    if (mine !== switching) {
      next.dispose();
      return false;
    }
    // Freeze the current frame (drawn and copied in the same task, so the buffer is still intact).
    renderer.render(scene, camera);
    veil.width = canvas.width;
    veil.height = canvas.height;
    veil.getContext('2d').drawImage(canvas, 0, 0);
    gsap.killTweensOf(veil);
    gsap.set(veil, { opacity: 1, display: 'block' });

    timeline?.kill();
    gsap.killTweensOf(car.pose);
    scene.remove(car.object);
    car.dispose();
    car = next;
    carKey = id;
    STATES = statesFor(CARS[id]);
    scene.add(car.object);
    car.apply();
    stage.bakeShadow(scene);
    collectOccluders();
    findHotspots();
    current = 'exterior';
    onState?.('exterior', STATES.exterior);
    // A short glide in from a little further out, under the dissolve.
    const view = framed(STATES.exterior);
    if (!reducedMotion) camera.position.copy(view.at).sub(view.look).multiplyScalar(1.18).add(view.look);
    const arrival = travel('exterior');
    gsap.to(veil, { opacity: 0, duration: reducedMotion ? 0 : 0.9, ease: 'power1.inOut', onComplete: () => gsap.set(veil, { display: 'none' }) });
    invalidate();
    await arrival;
    return true;
  }

  return {
    get state() {
      return current;
    },
    get car() {
      return carKey;
    },
    get states() {
      return STATES;
    },
    switchCar,
    go,
    reset() {
      go('exterior');
    },
    enter() {
      // The studio was hidden while it loaded, so measure it now that it is on screen.
      size();
      active = true;
      run();
      controls.enabled = false;
      stageEntrance();
      current = 'exterior';
      onState?.('exterior', STATES.exterior);
      return travel('exterior');
    },
    setActive(value) {
      active = value;
      if (!value) {
        timeline?.kill();
        timeline = null;
      }
      run();
    },
    // For automated checks in a hidden tab, where animation frames do not run: draw one frame now.
    renderOnce(now = performance.now()) {
      invalidate(1);
      frame(now);
    },
    // Read-only snapshot for automated checks (camera inside the body, part poses, busy flag).
    inspect() {
      return { car: carKey, camera: camera.position.toArray(), target: controls.target.toArray(), insideBody: hullValue(camera.position) < 1, renders, looping: Boolean(active && visible && !document.hidden), pose: { door: car.pose.door, hood: car.pose.hood, spoiler: car.pose.spoiler, steer: car.pose.steer }, busy, state: current };
    },
    destroy() {
      active = false;
      renderer.setAnimationLoop(null);
      timeline?.kill();
      gsap.killTweensOf(car.pose);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      clearTimeout(tap?.timer);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('wheel', onWheel, { capture: true });
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      for (const spot of spots) spot.el.remove();
      gsap.killTweensOf(veil);
      veil.remove();
      car.dispose();
      stage.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
