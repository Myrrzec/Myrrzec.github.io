// Every view of the car in one table. Coordinates are metres around the car's centre on the floor:
// +z is the nose, +x the driver's side (left-hand drive), +y up.
// `pose` values run from 0 (closed, straight) to 1 (open, raised, turned); anything left out is 0.
// The camera work is shared; each car in cars.js adds its own titles, copy, spec sheet and seat position.
export const STATES = {
  exterior: {
    label: 'Exterior',
    camera: [4.15, 1.02, 4.75],
    target: [0, 0.56, 0.1],
    fov: 30,
    distance: [3.4, 9.5],
    hotspots: ['door', 'frunk', 'engine', 'wheels'],
    eyebrow: '01 / Exterior',
    text: 'Drag to walk around the car. Double-click a panel or pinch to look closer, or pick a part from the list.',
  },
  door: {
    label: "Driver's door",
    pose: { door: 1 },
    camera: [4.7, 1.55, -3.2],
    target: [0.45, 0.72, 0.15],
    fov: 32,
    distance: [2.2, 7],
    hotspots: ['interior'],
    eyebrow: "02 / Driver's door",
    action: { label: 'Step inside', state: 'interior' },
  },
  interior: {
    label: 'Interior',
    pose: { door: 1 },
    camera: [0.335, 1.0, -0.22],
    target: [0.335, 0.86, 0.75],
    fov: 62,
    interior: true,
    hotspots: [],
    eyebrow: '03 / Interior',
  },
  frunk: {
    label: 'Front luggage',
    pose: { hood: 1 },
    camera: [1.2, 2.6, 4.55],
    target: [0.2, 0.62, 1.3],
    fov: 32,
    distance: [2.2, 7.5],
    hotspots: [],
    eyebrow: '04 / Front luggage',
  },
  engine: {
    label: 'Engine',
    pose: { spoiler: 1 },
    camera: [2.25, 1.8, -4.35],
    target: [0, 0.78, -1.65],
    fov: 30,
    distance: [2.2, 8],
    hotspots: [],
    eyebrow: '05 / Engine',
  },
  wheels: {
    label: 'Wheels',
    pose: { steer: 1 },
    camera: [2.75, 0.55, 2.55],
    target: [0.72, 0.38, 1.15],
    fov: 30,
    distance: [1.3, 5],
    hotspots: [],
    eyebrow: '06 / Wheels',
  },
};

// Few, large targets. Each is found on the loaded car by a ray (`from` toward `to`) and sits a few
// centimetres off the surface it hits; `normal` faces outward so a hotspot hides when its panel turns
// away from the camera. `at` is used as is (the doorway has no surface to land on).
export const HOTSPOTS = [
  { id: 'door', state: 'door', label: 'Door', from: [3, 0.62, 0.05], to: [0, 0.62, 0.05], normal: [1, 0.15, 0] },
  { id: 'frunk', state: 'frunk', label: 'Front luggage', from: [0, 3, 1.45], to: [0, 0, 1.45], normal: [0, 1, 0.45] },
  { id: 'engine', state: 'engine', label: 'Engine', from: [0, 3, -1.85], to: [0, 0, -1.85], normal: [0, 1, -0.7] },
  { id: 'wheels', state: 'wheels', label: 'Wheel', from: [3, 0.34, 'wheel'], to: [0, 0.34, 'wheel'], normal: [1, 0, 0.2] },
  { id: 'interior', state: 'interior', label: 'Step inside', at: [0.78, 0.86, -0.12], normal: [1, 0.2, -0.4] },
];

// The views of one car: the shared camera work with that car's words, figures and driver's seat.
export function statesFor(car) {
  const out = {};
  for (const [name, base] of Object.entries(STATES)) {
    const state = { ...base, ...car.views[name] };
    if (name === 'interior') Object.assign(state, car.seat);
    if (state.pose?.spoiler && !car.rig.spoiler) state.pose = { ...state.pose, spoiler: 0 };
    out[name] = state;
  }
  return out;
}

export const ORDER = ['exterior', 'door', 'interior', 'frunk', 'engine', 'wheels'];
