// Paint, glass, metal and trim for each car, set by material name. The source exports differ a lot:
// the GT3 arrives with every material flat (no metal, the same roughness everywhere), the Turbo S with
// real PBR textures that only need a few fixes, the Carrera S somewhere between.
// Each finisher returns the materials it created so the car can free them later.
import * as THREE from 'three';

const physical = (name, props) => new THREE.MeshPhysicalMaterial({ name, ...props });
const standard = (name, props) => new THREE.MeshStandardMaterial({ name, ...props });

function tintedGlass(opacity = 0.38) {
  return physical('Tinted glass', { color: '#1d2226', metalness: 0, roughness: 0.03, transparent: true, opacity, depthWrite: false, envMapIntensity: 1.5 });
}
function lampGlass() {
  return physical('Lamp glass', { color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.5 });
}
// Silver as in the campaign image: a bright metallic under a deep clear coat.
function silverPaint(name = 'Motorworks silver') {
  return physical(name, { color: '#c9ccd0', metalness: 0.62, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.035 });
}
// Porsche paints the calipers of its ceramic brakes yellow.
const CALIPER_YELLOW = '#e8b818';

// Swaps every mesh whose material name matches a key for one shared replacement.
function swap(root, table) {
  const made = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const make = table[mesh.material.name];
    if (!make) return;
    if (!made.has(make)) made.set(make, make(mesh.material));
    const next = made.get(make);
    if (next) mesh.material = next;
  });
  return [...made.values()].filter(Boolean);
}

const FINISHES = {
  // 911 GT3 (992). Names come from the source; everything is defined here.
  gt3(root) {
    const black = (roughness, name) => () => standard(name, { color: '#0d0e0f', roughness, metalness: 0 });
    const keepTexture = (props) => (m) => standard(m.name, { map: m.map, ...props });
    const glass = tintedGlass(0.4);
    const owned = swap(root, {
      body: () => silverPaint('GT3 silver'),
      glass: () => glass,
      d_glass: () => glass,
      lights_glass: lampGlass,
      r_glass: () => physical('Rear lamp lens', { color: '#8a0a0a', roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, clearcoat: 1 }),
      r_lights: () => standard('Rear lamp', { color: '#5a0505', emissive: '#a01010', emissiveIntensity: 0.35, roughness: 0.4 }),
      lights: () => standard('Lamp', { color: '#f4f4f2', emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.3 }),
      d_red: () => standard('Red detail', { color: '#9e1111', roughness: 0.35 }),
      material: () => standard('Crest red', { color: '#a01212', roughness: 0.3 }),
      red: () => standard('Red detail', { color: '#9e1111', roughness: 0.35 }),
      gold: () => standard('Crest gold', { color: '#d9a542', metalness: 1, roughness: 0.25 }),
      chrome: () => standard('Chrome', { color: '#e8e9ea', metalness: 1, roughness: 0.08 }),
      chrome_d: () => standard('Dark chrome', { color: '#6b6e72', metalness: 1, roughness: 0.15 }),
      silver: () => standard('Brushed metal', { color: '#b8babd', metalness: 1, roughness: 0.32 }),
      silver_d: () => standard('Disc', { color: '#7b7d80', metalness: 1, roughness: 0.42 }),
      white: () => standard('White print', { color: '#e9e9e7', roughness: 0.5 }),
      black_matt: black(0.72, 'Black plastic'),
      black: black(0.9, 'Black'),
      black_shiny: () => standard('Satin black', { color: '#131416', metalness: 0.55, roughness: 0.3 }),
      tire_mat5: keepTexture({ roughness: 0.9, metalness: 0 }),
      brakes2: (m) => standard(m.name, { color: CALIPER_YELLOW, map: m.map, roughness: 0.35 }),
      grid: keepTexture({ roughness: 0.6 }),
      logo: keepTexture({ roughness: 0.4, metalness: 0.4 }),
      plate: keepTexture({ roughness: 0.6 }),
      // Cabin: black leather and Race-Tex, carbon, silver trim.
      interior_color1: () => standard('Leather', { color: '#1a1918', roughness: 0.55 }),
      interior_color2: () => standard('Race-Tex', { color: '#202020', roughness: 0.95 }),
      interior_color3: () => standard('Cabin lining', { color: '#1b1b1c', roughness: 0.9 }),
      interior_black: black(0.7, 'Cabin plastic'),
      interior_glossy: () => standard('Gloss black', { color: '#0a0a0b', roughness: 0.12 }),
      interior_carbon: () => physical('Carbon', { color: '#16181a', metalness: 0.3, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 }),
      interior_silver: () => standard('Silver trim', { color: '#a9abae', metalness: 1, roughness: 0.3 }),
      interior_red: () => standard('Red mark', { color: '#a01818', roughness: 0.5 }),
      interior_blue: () => standard('Screen', { color: '#0c1116', roughness: 0.15, metalness: 0.2 }),
      interior_speakers: black(0.85, 'Speaker grille'),
      interior_stripes: black(0.8, 'Stitching'),
      interior_decals: keepTexture({ roughness: 0.6 }),
      interior_bump: keepTexture({ roughness: 0.8 }),
    });
    return owned;
  },

  // 911 Turbo S (992). Good textures already; fix the glass, the calipers and a few flat values.
  turbo(root) {
    const owned = [];
    const tuned = new Set();
    const paint = physical('Turbo paint', { color: '#8a8676', metalness: 0.15, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 });
    const glass = tintedGlass(0.4);
    const head = lampGlass();
    owned.push(paint, glass, head);
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const m = mesh.material;
      if (m.name === 'body_main') {
        // Keep the source's roughness map (it carries panel wear and seams) on a clear-coated paint.
        paint.roughnessMap ??= m.roughnessMap;
        mesh.material = paint;
      } else if (m.name === 'windows') mesh.material = glass;
      else if (m.name === 'lights' || m.name === 'headlights_pattern') mesh.material = head;
      else if (!tuned.has(m)) {
        tuned.add(m);
        // Ceramic brakes are standard on the Turbo S, so the calipers are yellow.
        if (m.name === 'brakes') {
          m.color.set(CALIPER_YELLOW);
          m.roughness = 0.35;
        }
        // The source belts are green; the standard belts are black.
        if (m.name === 'belts') m.color.set('#111111');
        if (m.name === 'rim_black') m.roughness = 0.3;
        if (m.name === 'tires') m.roughness = 0.85;
        if (m.name === 'red_light_main') {
          m.color.set('#6a0606');
          m.emissive.set('#a01010');
          m.emissiveIntensity = 0.3;
        }
      }
    });
    return owned;
  },

  // 911 Targa 4S (992). The source is untextured with every material white, so all of it is defined here.
  targa(root) {
    const dark = (name, roughness = 0.6) => () => standard(name, { color: '#121314', roughness, metalness: 0 });
    const brushed = () => standard('Brushed metal', { color: '#b4b7bb', metalness: 1, roughness: 0.3 });
    const screen = () => standard('Screen', { color: '#0c1116', roughness: 0.15, metalness: 0.2 });
    return swap(root, {
      Carpaint_Pearl_Blue: () => physical('Targa blue', { color: '#24395e', metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.035 }),
      Glass_Clear322: () => tintedGlass(0.4),
      Glass_black: () => tintedGlass(0.7),
      Glass_Clear3: lampGlass,
      Chrome_Clean2: () => standard('Chrome', { color: '#e8e9ea', metalness: 1, roughness: 0.08 }),
      Chrome_Clean22: () => standard('Silver trim', { color: '#a9abae', metalness: 1, roughness: 0.3 }),
      // The Targa bar's trim is silver, like the rims.
      Iron_Clean: brushed,
      Iron_Clean2: brushed,
      Iron_Clean_Distorted: () => standard('Disc', { color: '#7b7d80', metalness: 1, roughness: 0.42 }),
      // Red six-piston calipers come with the Targa 4S brakes.
      material: () => standard('Caliper red', { color: '#b3141c', roughness: 0.35 }),
      Rubber_Rough: () => standard('Tyre', { color: '#141414', roughness: 0.88 }),
      black: dark('Black plastic', 0.7),
      Material_2125646428: () => standard('Satin black', { color: '#131416', metalness: 0.4, roughness: 0.32 }),
      '05_-_Default': dark('Dark trim', 0.5),
      '04_-_Default': () => standard('Plate', { color: '#d9d9d5', roughness: 0.6 }),
      '07_-_Default': () => standard('Rear lamp', { color: '#5a0505', emissive: '#a01010', emissiveIntensity: 0.35, roughness: 0.3 }),
      black_top: () => standard('Roof fabric', { color: '#141414', roughness: 0.95 }),
      Leather_Uph3_Black: () => standard('Leather', { color: '#1a1918', roughness: 0.55 }),
      '07_-_Default223': dark('Cabin plastic', 0.7),
      '07_-_Default34342': screen,
      '07_-_Default34341': screen,
      '07_-_Default343412': screen,
      '07_-_D1': screen,
      '07_-_Default3434': dark('Cabin plastic', 0.7),
    });
  },

  // 911 Carrera S (991).
  carrera(root) {
    const paint = silverPaint();
    const glass = tintedGlass();
    const head = lampGlass();
    const rims = standard('Satin wheel', { color: '#3a3c3f', metalness: 0.85, roughness: 0.34 });
    const tuned = new Set();
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const owner = mesh.parent?.parent?.name || '';
      const name = mesh.material.name;
      if (/^Body_[Pp]aint/.test(name)) mesh.material = paint;
      else if (/^Window_Glass/.test(name)) mesh.material = /^(Headlight|Front_Signal)/.test(owner) ? head : glass;
      else if (name === 'Aluminum' && /^Rim/.test(owner)) mesh.material = rims;
      else if (!tuned.has(mesh.material)) {
        const m = mesh.material;
        tuned.add(m);
        // The export marks leather, fabric and plastics as partly metallic; real ones are not.
        if (/Leather|Fabric|Plastic|Belt|Stich|Tyre|Rubber|Structure/.test(name)) m.metalness = 0;
        if (/^Leather/.test(name)) {
          m.color.set('#1f1c1a');
          m.roughness = 0.58;
        }
        if (name === 'Tyre') m.roughness = 0.88;
        // The export wires a normal map into the caliper's base colour, which renders bright blue.
        if (name === 'Caliper') {
          m.normalMap = m.map;
          m.map = null;
          m.color.set('#a8221b');
          m.roughness = 0.32;
          m.metalness = 0.1;
        }
        if (name === 'Plastic_-_Black') m.roughness = 0.7;
      }
      // Same fault on the caliper lettering decal: its colours are normal-map data. Six triangles, hidden.
      if (mesh.material.name === 'Caliper_Detail') mesh.visible = false;
    });
    return [paint, glass, head, rims];
  },
};

export function finish(key, root) {
  return FINISHES[key](root);
}
