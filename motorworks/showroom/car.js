// Loads one car from cars.js, gives it its finish and rigs the parts that move.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { finish } from './finishes.js';

const carpet = () => new THREE.MeshStandardMaterial({ name: 'Luggage carpet', color: '#3b3936', roughness: 1, side: THREE.DoubleSide });

// A carpeted tub hung from a rim: [z, half width, rim height] from rear to front of the opening.
function tub(rim, cx, floorY, zClamp) {
  const top = [];
  const bottom = [];
  const side = (sign) => (sign > 0 ? rim : [...rim].reverse());
  for (const sign of [1, -1]) {
    for (const [z, w, y] of side(sign)) {
      top.push(new THREE.Vector3(cx + sign * w, y, z));
      bottom.push(new THREE.Vector3(cx + sign * w * 0.8, floorY, THREE.MathUtils.clamp(z, ...zClamp)));
    }
  }
  const n = top.length;
  const center = bottom.reduce((c, p) => c.add(p), new THREE.Vector3()).divideScalar(n);
  const index = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    index.push(i, j, n + j, i, n + j, n + i, 2 * n, n + j, n + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...top, ...bottom, center].flatMap((p) => p.toArray()), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const well = new THREE.Mesh(geometry, carpet());
  well.name = 'Luggage_well';
  return well;
}

// The 991 model closes the space under the front lid with a flat panel about 10 cm down. This adds a
// carpeted well shaped to the lid's opening (measured from the mesh) and cuts the panel away inside it.
function carreraWell(model, center) {
  const rim = [[0.84, 0.67, 0.8], [1.08, 0.65, 0.79], [1.4, 0.58, 0.735], [1.72, 0.49, 0.66], [1.96, 0.38, 0.58], [2.05, 0.27, 0.555]];
  const cx = 0.055;
  const well = tub(rim, cx, 0.36, [0.92, 1.95]);
  model.add(well);
  const panel = model.getObjectByName('Structure001_168_343')?.getObjectByProperty('isMesh', true);
  if (panel) {
    const [w, , z] = center;
    panel.material = panel.material.clone();
    panel.material.clipIntersection = true;
    panel.material.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -(cx + 0.69 - w)),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), cx - 0.69 - w),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.45),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -(2.1 - z)),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.8 - z),
    ];
  }
  return [well.material, panel?.material].filter(Boolean);
}

// The other models leave the space under the lid empty. The well is shaped from the lid itself:
// its outline, a little inside the edge, sliced along its length.
function wellUnderLid(model, lid) {
  const p = new THREE.Vector3();
  const points = [];
  let zMin = Infinity;
  let zMax = -Infinity;
  lid.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      points.push(p.x, p.y, p.z);
      zMin = Math.min(zMin, p.z);
      zMax = Math.max(zMax, p.z);
    }
  });
  if (!points.length) return [];
  const z0 = zMin + 0.07;
  const z1 = zMax - 0.12;
  const rim = [];
  const slices = 7;
  for (let s = 0; s < slices; s++) {
    const z = z0 + ((z1 - z0) * s) / (slices - 1);
    // Widest point of the lid at this slice, then the lowest point along that edge.
    let w = 0;
    for (let i = 0; i < points.length; i += 3) if (Math.abs(points[i + 2] - z) < 0.06) w = Math.max(w, Math.abs(points[i]));
    if (!w) continue;
    let y = Infinity;
    for (let i = 0; i < points.length; i += 3) {
      if (Math.abs(points[i + 2] - z) < 0.06 && Math.abs(points[i]) > w - 0.05) y = Math.min(y, points[i + 1]);
    }
    rim.push([z, Math.max(0.12, w - 0.07), y - 0.03]);
  }
  const lowest = rim.reduce((low, r) => Math.min(low, r[2]), Infinity);
  const well = tub(rim, 0, Math.max(0.3, lowest - 0.26), [z0 + 0.08, z1 - 0.1]);
  model.add(well);
  return [well.material];
}

function rig(model, rigs) {
  const pivots = {};
  const all = [];
  model.traverse((o) => all.push(o));
  for (const [key, { hinge, parts }] of Object.entries(rigs)) {
    const pivot = new THREE.Group();
    pivot.name = `pivot:${key}`;
    pivot.position.fromArray(hinge);
    model.add(pivot);
    pivot.updateMatrixWorld(true);
    for (const o of all) if (parts.test(o.name) && !o.parent.name.startsWith('pivot:')) pivot.attach(o);
    pivots[key] = pivot;
  }
  return pivots;
}

export async function loadCar(config, onProgress) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(config.model, (event) => onProgress?.(event.loaded, event.lengthComputable ? event.total : 0));
  const model = gltf.scene;
  // Prepared models are already centred; the older one is shifted by its measured centre.
  const center = config.center || [0, 0, 0];
  model.position.set(-center[0], -center[1], -center[2]);
  const car = new THREE.Group();
  car.name = 'car';
  car.add(model);
  car.updateMatrixWorld(true);
  const owned = finish(config.finish, model);
  // Pivots are children of the model, so hinges are in the model's own frame (before any centring).
  const pivots = rig(model, config.rig);
  car.updateMatrixWorld(true);
  // The newer models only shape the outside of the front lid; once it is up, the camera sees its inside.
  if (config.finish !== 'carrera') {
    const twoSided = new Map();
    pivots.hood.traverse((mesh) => {
      if (!mesh.isMesh || mesh.material.transparent) return;
      if (!twoSided.has(mesh.material)) twoSided.set(mesh.material, Object.assign(mesh.material.clone(), { side: THREE.DoubleSide }));
      mesh.material = twoSided.get(mesh.material);
    });
    owned.push(...twoSided.values());
  }
  if (config.finish === 'carrera') owned.push(...carreraWell(model, center));
  else if (config.well && pivots.hood) owned.push(...wellUnderLid(model, pivots.hood));
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });

  // Which part a click or tap lands on decides where the camera goes.
  const partFor = (object) => {
    for (let o = object; o; o = o.parent) for (const [re, state] of config.pick) if (re.test(o.name)) return state;
    return null;
  };

  // Every pose value runs 0 (closed) to 1 (fully open), so animation code never deals in radians.
  const pose = { door: 0, hood: 0, spoiler: 0, steer: 0 };
  const { door, hood, spoiler } = config.rig;
  function apply() {
    pivots.door.rotation.y = door.angle * pose.door;
    pivots.hood.rotation.x = hood.angle * pose.hood;
    if (spoiler) {
      pivots.spoiler.position.y = spoiler.hinge[1] + spoiler.lift * pose.spoiler;
      pivots.spoiler.rotation.x = spoiler.tilt * pose.spoiler;
    }
    pivots.wheelL.rotation.y = pivots.wheelR.rotation.y = -0.38 * pose.steer;
  }

  return {
    object: car,
    pose,
    apply,
    partFor,
    dispose() {
      car.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        for (const key of Object.keys(o.material)) {
          const value = o.material[key];
          if (value?.isTexture) value.dispose();
        }
        o.material.dispose();
      });
      for (const m of owned) m.dispose();
    },
  };
}
