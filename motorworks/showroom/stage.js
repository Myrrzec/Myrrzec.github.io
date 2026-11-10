// The red pavilion around the car: environment lighting, concrete walls with a window band onto a
// misty forest, a glossy floor and a baked contact shadow.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

const FLOOR = new THREE.Color('#5e1c15');
const MIST = new THREE.Color('#d9dbd2');

// Seeded, so the board pattern and the forest come out the same on every visit.
function random(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// Board-formed concrete: 30 cm boards with wood grain, seams, tie holes and a little weathering.
// Drawn once into canvases (colour plus a relief map), so the walls cost no image downloads.
// One tile is 4 m wide and 2.4 m tall.
function concreteTextures() {
  const size = 512;
  const boards = 8;
  const rand = random(7);
  const color = document.createElement('canvas');
  const relief = document.createElement('canvas');
  color.width = color.height = relief.width = relief.height = size;
  const c = color.getContext('2d');
  const h = relief.getContext('2d');
  h.fillStyle = '#808080';
  h.fillRect(0, 0, size, size);
  const board = size / boards;
  for (let i = 0; i < boards; i++) {
    const y = i * board;
    const shade = 0.94 + rand() * 0.12;
    c.fillStyle = `rgb(${Math.round(146 * shade)},${Math.round(56 * shade)},${Math.round(40 * shade)})`;
    c.fillRect(0, y, size, board);
    // Grain: long, slightly wavy streaks that the formwork boards printed into the surface.
    for (let g = 0; g < 26; g++) {
      const gy = y + 3 + rand() * (board - 6);
      const light = rand() > 0.5;
      const amp = 0.6 + rand() * 1.4;
      const phase = rand() * 6;
      c.strokeStyle = light ? `rgba(255,214,190,${0.03 + rand() * 0.05})` : `rgba(40,8,4,${0.05 + rand() * 0.08})`;
      h.strokeStyle = light ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.2)';
      c.lineWidth = h.lineWidth = 0.6 + rand() * 1.4;
      const x0 = rand() * size * 0.3;
      const x1 = x0 + size * (0.4 + rand() * 0.7);
      for (const ctx of [c, h]) {
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 16) ctx.lineTo(x, gy + Math.sin(x / 40 + phase) * amp);
        ctx.stroke();
      }
    }
    // Seam between boards: a fine recessed line with a lighter lip of cement paste.
    c.fillStyle = 'rgba(38,8,4,.45)';
    c.fillRect(0, y, size, 1.5);
    c.fillStyle = 'rgba(255,220,200,.08)';
    c.fillRect(0, y + 2, size, 1);
    h.fillStyle = '#2a2a2a';
    h.fillRect(0, y, size, 2);
  }
  // Tie holes on a 60 cm by 60 cm grid.
  for (let y = board; y < size; y += board * 2) {
    for (let x = size / 12; x < size; x += size / 6.67) {
      const r = 2.6;
      c.fillStyle = 'rgba(30,6,3,.7)';
      h.fillStyle = '#000000';
      for (const ctx of [c, h]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Weathering: a few soft vertical streaks under the holes and a fine speckle across everything.
  for (let i = 0; i < 9; i++) {
    const x = rand() * size;
    const grad = c.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(40,10,6,0)');
    grad.addColorStop(0.4 + rand() * 0.3, `rgba(40,10,6,${0.05 + rand() * 0.06})`);
    grad.addColorStop(1, 'rgba(40,10,6,0)');
    c.fillStyle = grad;
    c.fillRect(x, 0, 6 + rand() * 18, size);
  }
  const image = c.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (rand() - 0.5) * 16;
    image.data[i] += n;
    image.data[i + 1] += n * 0.7;
    image.data[i + 2] += n * 0.6;
  }
  c.putImageData(image, 0, 0);

  // Relief to a normal map (simple Sobel on the grey heights).
  const heights = h.getImageData(0, 0, size, size).data;
  const normal = h.createImageData(size, size);
  const at = (x, y) => heights[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      normal.data[o] = (-dx / len * 0.5 + 0.5) * 255;
      normal.data[o + 1] = (dy / len * 0.5 + 0.5) * 255;
      normal.data[o + 2] = (1 / len * 0.5 + 0.5) * 255;
      normal.data[o + 3] = 255;
    }
  }
  h.putImageData(normal, 0, 0);

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(relief);
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, normalMap };
}

// A concrete material whose texture is tiled to a surface of the given size in metres.
function concrete(textures, width, height, extra = {}) {
  const map = textures.map.clone();
  const normalMap = textures.normalMap.clone();
  for (const t of [map, normalMap]) {
    t.repeat.set(width / 4, height / 2.4);
    t.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.9, envMapIntensity: 0.55, fog: false, ...extra });
}

// The forest: three rings of spruce silhouettes at 40, 62 and 92 m, each paler than the one in front,
// like a wood seen through morning mist. Painted once into canvases; orbiting the car gives real
// parallax between the rings.
const FOREST = [
  { radius: 40, height: 18, color: '#46544a', repeat: 3, trees: 46, seed: 3 },
  { radius: 62, height: 24, color: '#7d897f', repeat: 4, trees: 52, seed: 11 },
  { radius: 92, height: 30, color: '#aeb5ad', repeat: 5, trees: 56, seed: 23 },
];
function treeline({ radius, height, color, repeat, trees, seed }) {
  const w = 2048;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rand = random(seed);
  ctx.fillStyle = '#fff';
  // Undergrowth fading up into the mist, so the trunks never stand on nothing.
  const scrub = ctx.createLinearGradient(0, h * 0.78, 0, h);
  scrub.addColorStop(0, 'rgba(255,255,255,0)');
  scrub.addColorStop(0.6, 'rgba(255,255,255,.8)');
  scrub.addColorStop(1, '#fff');
  ctx.fillStyle = scrub;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < trees; i++) {
    const x = rand() * w;
    const top = h * (0.12 + rand() * 0.45);
    const base = h * 0.94;
    // Old spruces lose their lowest branches: the crown stops a little above the ground.
    const crown = base - (base - top) * (0.12 + rand() * 0.14);
    const half = (crown - top) * (0.17 + rand() * 0.07);
    ctx.fillRect(x - 1.5, crown - 4, 3, base - crown + 4);
    ctx.fillRect(x - 1.5 - w, crown - 4, 3, base - crown + 4);
    ctx.fillRect(x - 1.5 + w, crown - 4, 3, base - crown + 4);
    const tiers = 9 + Math.floor(rand() * 5);
    const left = [];
    const right = [];
    for (let k = 1; k <= tiers; k++) {
      const y = top + ((crown - top) * k) / tiers;
      const spread = half * (k / tiers) ** 0.85 * (0.75 + rand() * 0.45);
      const droop = ((crown - top) / tiers) * 0.45;
      left.push([x - spread, y], [x - spread * 0.45, y - droop * 0.3]);
      right.push([x + spread * (0.75 + rand() * 0.45), y], [x + spread * 0.45, y - droop * 0.3]);
    }
    for (const offset of [-w, 0, w]) {
      ctx.beginPath();
      ctx.moveTo(x + offset, top);
      for (const [px, py] of left) ctx.lineTo(px + offset, py);
      ctx.lineTo(x + offset, crown);
      for (const [px, py] of [...right].reverse()) ctx.lineTo(px + offset, py);
      ctx.closePath();
      ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.set(repeat, 1);
  map.anisotropy = 4;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 96, 1, true),
    new THREE.MeshBasicMaterial({ map, color, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  ring.position.y = height / 2 - height * 0.06 - 0.6;
  ring.renderOrder = -radius; // far rings first
  return ring;
}

// Low mist lying between the rings of trees: a band that fades from the mist colour at the ground to nothing.
function groundMist(radius) {
  const geometry = new THREE.CylinderGeometry(radius, radius, 9, 64, 1, true);
  const colors = [];
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) colors.push(MIST.r, MIST.g, MIST.b, p.getY(i) < 0 ? 0.75 : 0);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  const mist = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mist.position.y = 3.5;
  mist.renderOrder = -radius;
  return mist;
}

// Sky dome: mist at the horizon, a soft grey-blue overhead. Unaffected by fog so the trees melt into it.
function sky() {
  const geometry = new THREE.SphereGeometry(150, 32, 16);
  const colors = [];
  const top = new THREE.Color('#9fb0b8');
  const c = new THREE.Color();
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.smoothstep(p.getY(i) / 150, 0.02, 0.6);
    c.copy(MIST).lerp(top, t);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}

// A small studio of emissive panels, prefiltered once. It gives the silver paint something to reflect:
// a broad warm skylight, a low sun strip from the front left, red concrete low down and the
// misty forest through the window band.
function environment(renderer) {
  const env = new THREE.Scene();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(20, 10, 20),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#2b2523'), side: THREE.BackSide }),
  );
  box.position.y = 4;
  env.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: '#2a0c08' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  env.add(floor);
  const panel = (w, h, color, intensity, pos, look) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    mesh.position.set(...pos);
    mesh.lookAt(...look);
    env.add(mesh);
  };
  panel(10, 5, '#ffffff', 2.6, [0, 8.5, 0], [0, 0, 0]);
  panel(10, 1.2, '#ffe2c4', 4, [7, 2.2, 6], [0, 0.6, 0]);
  panel(4, 4, '#f4f6f8', 1.6, [-8.5, 3, -2], [0, 1, 0]);
  panel(3, 6, '#ffffff', 1.2, [0, 3, 9.5], [0, 1, 0]);
  panel(16, 1.4, '#9a3a2a', 0.6, [0, 0.6, -9.5], [0, 0.6, 0]);
  // The window band: misty green all round at eye height.
  for (const a of [0, 1, 2, 3]) {
    const angle = (a * Math.PI) / 2 + Math.PI / 4;
    panel(13, 3, '#8f9a88', 0.55, [Math.sin(angle) * 9.4, 2.6, Math.cos(angle) * 9.4], [0, 2.6, 0]);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  env.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return target;
}

export function createStage(renderer, { reflections }) {
  const group = new THREE.Group();
  const disposables = [];
  const envTarget = environment(renderer);
  disposables.push(envTarget);

  const textures = concreteTextures();
  disposables.push(textures.map, textures.normalMap);

  // Pavilion drum, 13 m across the floor: a solid parapet, a window band all the way round
  // (concrete fins every 30 degrees) and a deep band above that carries the roof slab.
  const R = 13;
  const round = 2 * Math.PI * R;
  const SILL = 1.0;
  const HEAD = 5.4;
  const TOP = 9;
  const parapet = new THREE.Mesh(new THREE.CylinderGeometry(R, R, SILL, 128, 1, true), concrete(textures, round, SILL, { side: THREE.DoubleSide }));
  parapet.position.y = SILL / 2;
  group.add(parapet);
  const sill = new THREE.Mesh(new THREE.RingGeometry(R - 0.4, R + 0.02, 128), concrete(textures, round, 0.4));
  sill.rotation.x = -Math.PI / 2;
  sill.position.y = SILL;
  group.add(sill);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R, R, TOP - HEAD, 128, 1, true), concrete(textures, round, TOP - HEAD, { side: THREE.DoubleSide }));
  band.position.y = (HEAD + TOP) / 2;
  group.add(band);
  const soffit = new THREE.Mesh(new THREE.RingGeometry(R - 0.4, R + 0.02, 128), concrete(textures, round, 0.4, { side: THREE.DoubleSide }));
  soffit.rotation.x = Math.PI / 2;
  soffit.position.y = HEAD;
  group.add(soffit);
  const FINS = 12;
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, HEAD - SILL, 1.1), concrete(textures, 1.1, HEAD - SILL), FINS);
  const m = new THREE.Matrix4();
  for (let i = 0; i < FINS; i++) {
    // Offset by half a bay so no fin stands straight behind the car in the opening view.
    const a = ((i + 0.5) / FINS) * Math.PI * 2;
    m.makeRotationY(a).setPosition(Math.sin(a) * (R - 0.15), (SILL + HEAD) / 2, Math.cos(a) * (R - 0.15));
    fins.setMatrixAt(i, m);
  }
  group.add(fins);

  // Outside: forest floor, the trees and the sky they fade into.
  const ground = new THREE.Mesh(
    new THREE.RingGeometry(R, 140, 96, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#2f3a30', roughness: 1, envMapIntensity: 0.2 }),
  );
  ground.position.y = -0.02;
  group.add(ground);
  group.add(sky(), ...FOREST.map(treeline), ...[34, 52, 76].map(groundMist));

  // Overhang slab with a round cut, echoing the campaign image.
  const slabShape = new THREE.Shape();
  slabShape.absarc(0, 0, R + 0.6, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(3.5, 4.5, 5.5, 0, Math.PI * 2, true);
  slabShape.holes.push(hole);
  const slab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(slabShape, { depth: 0.6, bevelEnabled: false, curveSegments: 64 }),
    concrete(textures, 4, 2.4, { color: '#e8dcd6', roughness: 0.95, envMapIntensity: 0.5 }),
  );
  slab.material.map.repeat.set(0.25, 0.25);
  slab.material.normalMap.repeat.set(0.25, 0.25);
  slab.rotation.x = Math.PI / 2;
  slab.position.y = 8.6;
  group.add(slab);

  // Floor: a mirror underneath a mostly opaque red layer gives a soft, moderate reflection.
  const floorGeometry = new THREE.CircleGeometry(R + 0.05, 96).rotateX(-Math.PI / 2);
  let reflector = null;
  if (reflections) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    reflector = new Reflector(floorGeometry, {
      textureWidth: Math.round(size.x * 0.5),
      textureHeight: Math.round(size.y * 0.5),
      color: new THREE.Color('#7f7f7f'),
      clipBias: 0.003,
    });
    reflector.position.y = -0.002;
    group.add(reflector);
  }
  const floor = new THREE.Mesh(
    floorGeometry,
    new THREE.MeshStandardMaterial({
      color: FLOOR,
      roughness: 0.35,
      metalness: 0,
      transparent: Boolean(reflector),
      opacity: reflector ? 0.8 : 1,
      envMapIntensity: 0.7,
      fog: false,
    }),
  );
  group.add(floor);

  // Baked contact shadow: render the car's depth from below once, blur it, lay it on the floor.
  const shadowSize = { w: 3.6, d: 6.2 };
  const shadowTarget = new THREE.WebGLRenderTarget(512, 512);
  const blurTarget = new THREE.WebGLRenderTarget(512, 512);
  shadowTarget.texture.generateMipmaps = blurTarget.texture.generateMipmaps = false;
  disposables.push(shadowTarget, blurTarget);
  const shadowPlaneGeometry = new THREE.PlaneGeometry(shadowSize.w, shadowSize.d).rotateX(Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowPlaneGeometry,
    new THREE.MeshBasicMaterial({ map: shadowTarget.texture, transparent: true, opacity: 0.92, depthWrite: false }),
  );
  shadow.scale.y = -1;
  shadow.position.y = 0.003;
  shadow.renderOrder = 1;
  group.add(shadow);
  const blurPlane = new THREE.Mesh(shadowPlaneGeometry);
  const shadowCamera = new THREE.OrthographicCamera(-shadowSize.w / 2, shadowSize.w / 2, shadowSize.d / 2, -shadowSize.d / 2, 0, 0.9);
  shadowCamera.rotation.x = Math.PI / 2;
  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.depthTest = depthMaterial.depthWrite = false;
  depthMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 1.6 ) * 1.25 );',
    );
  };
  const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
  const vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
  hBlur.depthTest = vBlur.depthTest = false;
  disposables.push(depthMaterial, hBlur, vBlur);

  function blur(amount) {
    blurPlane.material = hBlur;
    hBlur.uniforms.tDiffuse.value = shadowTarget.texture;
    hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(blurTarget);
    renderer.render(blurPlane, shadowCamera);
    blurPlane.material = vBlur;
    vBlur.uniforms.tDiffuse.value = blurTarget.texture;
    vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(shadowTarget);
    renderer.render(blurPlane, shadowCamera);
  }

  function bakeShadow(scene) {
    const background = scene.background;
    const clearAlpha = renderer.getClearAlpha();
    scene.background = null;
    group.visible = false;
    scene.overrideMaterial = depthMaterial;
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(shadowTarget);
    renderer.clear();
    renderer.render(scene, shadowCamera);
    scene.overrideMaterial = null;
    blur(2.2);
    blur(0.9);
    renderer.setRenderTarget(null);
    renderer.setClearAlpha(clearAlpha);
    scene.background = background;
    group.visible = true;
  }

  return {
    group,
    environment: envTarget.texture,
    background: MIST.clone(),
    fog: [14, 95], // only the ground outside takes fog; the pavilion stays crisp
    bakeShadow,
    resize(width, height) {
      reflector?.getRenderTarget().setSize(Math.round(width * 0.5), Math.round(height * 0.5));
    },
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose();
        if (!o.material || o.material === depthMaterial) return;
        o.material.map?.dispose();
        o.material.normalMap?.dispose();
        o.material.dispose();
      });
      reflector?.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
