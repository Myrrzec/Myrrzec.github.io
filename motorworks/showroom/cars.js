// The cars in the studio. Each entry says where its model lives, how its parts move and what the studio
// says about it. Coordinates are metres around the car's centre on the floor (+z nose, +x driver's side).
// Spec figures are Porsche's published data for that version; see README.md for sources.
//
// Rig: `hinge` is the pivot of a moving part in the model's own frame, `parts` matches the node(s) that
// move with it, `angle` is how far it turns fully open (radians).
// Models built by tools/prepare-car.mjs carry their moving parts as `part:<key>` groups.
// (three.js drops the colon from node names on load, so `part:door` arrives as `partdoor`.)
const part = (key) => new RegExp(`^part:?${key}$`);

export const CARS = {
  'gt3-992': {
    name: '911 GT3',
    generation: '992',
    year: 2021,
    model: './models/911-gt3-992.glb',
    finish: 'gt3',
    rig: {
      door: { hinge: [0.82, 0.6, 0.69], parts: part('door'), angle: -1.08 },
      hood: { hinge: [0, 0.875, 0.75], parts: part('hood'), angle: -0.95 },
      wheelL: { hinge: [0.785, 0.338, 1.2235], parts: part('wheelL') },
      wheelR: { hinge: [-0.785, 0.338, 1.2235], parts: part('wheelR') },
    },
    pick: [[part('door'), 'door'], [part('hood'), 'frunk'], [/^part:?wheel/, 'wheels']],
    well: true,
    seat: { camera: [0.34, 0.99, -0.27], target: [0.34, 0.84, 0.72] },
    views: {
      exterior: { title: 'GT3. 992, 2021.' },
      door: {
        title: 'Light door, lighter car.',
        text: 'The door hinges at its leading edge and swings wide. Every window is lightweight glass, part of a diet that keeps the GT3 as light as the car before it. Step inside to take the seat.',
        specs: [
          ['Weight', '1,418 kg', 'manual; 1,435 kg with PDK'],
          ['Power to weight', '2.8 kg/PS', 'with the manual gearbox'],
          ['Glass', 'Lightweight', 'in all the windows'],
        ],
      },
      interior: {
        title: 'Two seats. One rev counter.',
        text: 'A two-seater cockpit: the analogue rev counter in the middle reads to 10,000 rpm for an engine that stops at 9,000. Drag to look around.',
        specs: [
          ['As standard', 'Sports Seats Plus', 'black leather, Race-Tex centres'],
          ['Seats', '2', 'a cover replaces the rear seats'],
          ['Rev counter', '10,000 rpm', 'analogue, in the centre'],
          ['Option', 'Full bucket seats', 'carbon, 12 kg lighter as a pair'],
        ],
      },
      frunk: {
        title: 'Carbon lid, open vents.',
        text: 'The front lid is carbon fibre. Air from the central radiator leaves through its two-part vent and helps push the nose down on its way out. The luggage well sits beneath.',
        specs: [
          ['Front lid', 'Carbon fibre', 'reinforced plastic, as is the rear wing'],
          ['Vent', 'Two-part', 'radiator air exits through the lid'],
          ['Downforce', 'About +50%', 'over the previous GT3, standard setting'],
        ],
      },
      engine: {
        title: 'Four litres. 9,000 rpm.',
        text: 'A naturally aspirated flat-six behind the rear axle. The wing hangs from swan-neck mounts so air flows freely under it. It is fixed, so nothing opens here: this is the view a GT3 owner gets.',
        specs: [
          ['Engine', '4.0 l flat-six', 'naturally aspirated, revs to 9,000 rpm'],
          ['Power', '510 PS', '375 kW at 8,400 rpm; 470 Nm'],
          ['0 to 100 km/h', '3.4 s', 'PDK; 3.9 s with the six-speed manual'],
          ['Top speed', '318 km/h', 'PDK; 320 km/h manual'],
        ],
      },
      wheels: {
        title: 'One nut. Two sizes.',
        text: 'Front wheels turned for a clear view: forged, held by a single centre-lock nut, 20 inches at the front and 21 at the rear. Yellow calipers mark the optional ceramic brakes.',
        specs: [
          ['Wheels', '20 / 21 in', 'forged, centre-lock; 9.5 J front'],
          ['Tyres', '255/35 & 315/30', 'ZR20 front, ZR21 rear'],
          ['Ceramic brakes', '410 / 390 mm', 'option; yellow calipers, as here'],
          ['As standard', '408 / 380 mm', 'cast iron; six- and four-piston calipers'],
        ],
      },
    },
    credit: {
      title: 'Porsche 911 GT3 2022',
      url: 'https://sketchfab.com/3d-models/porsche-911-gt3-2022-39df8be273464c6980171f5758bfde97',
      author: 'kevin (ケビン)',
      authorUrl: 'https://sketchfab.com/sohyalebret',
    },
  },

  'turbo-s-992': {
    name: '911 Turbo S',
    generation: '992',
    year: 2020,
    model: './models/911-turbo-s-992.glb',
    finish: 'turbo',
    rig: {
      door: { hinge: [0.84, 0.6, 0.71], parts: part('door'), angle: -1.08 },
      hood: { hinge: [0, 0.912, 0.76], parts: part('hood'), angle: -0.95 },
      spoiler: { hinge: [0, 0.88, -1.8], parts: part('spoiler'), lift: 0.06, tilt: 0.12 },
      wheelL: { hinge: [0.775, 0.349, 1.2525], parts: part('wheelL') },
      wheelR: { hinge: [-0.775, 0.349, 1.2525], parts: part('wheelR') },
    },
    pick: [[part('door'), 'door'], [part('hood'), 'frunk'], [part('spoiler'), 'engine'], [/^part:?wheel/, 'wheels']],
    well: true,
    seat: { camera: [0.34, 1.0, -0.3], target: [0.34, 0.85, 0.7] },
    views: {
      exterior: { title: 'Turbo S. 992, 2020.' },
      door: {
        title: 'Flush handle, wide hips.',
        text: 'The handle sits flush with the door and slides out at a touch. Behind it the body swells over the rear wheels, wider than any Carrera. Step inside to take the seat.',
        specs: [
          ['Width at the rear', '1,900 mm', 'across the rear axle'],
          ['Width at the front', '1,840 mm', 'about 45 mm more than before'],
          ['Track', '1,583 / 1,600 mm', 'front / rear'],
        ],
      },
      interior: {
        title: 'Leather, all of it.',
        text: 'Full leather is standard, stitched in a pattern borrowed from the first 911 Turbo: diagonal on the door inlays, across the seat centres. Drag to look around.',
        specs: [
          ['As standard', 'Full leather', 'with carbon trim and Light Silver accents'],
          ['Stitching', 'After the 930', 'the first 911 Turbo'],
          ['Centre screen', '10.9 in', 'touchscreen'],
          ['Rear seats', 'Standard', 'dropped with the Lightweight Package'],
        ],
      },
      frunk: {
        title: 'An active nose.',
        text: 'The boot is up front. Below it, a spoiler extends on air pressure and flaps in the intakes stay shut until the radiators need the air.',
        specs: [
          ['Front spoiler', 'Pneumatic', 'extends 10 mm further than before'],
          ['Cooling flaps', 'Active', 'closed between about 70 and 150 km/h'],
          ['Downforce', 'About 170 kg', 'front and rear, performance position'],
        ],
      },
      engine: {
        title: 'Twin turbos. Wing up.',
        text: 'The rear wing rises and tilts as speed builds; here it is raised. The intakes beside it feed the air filters, which now live in the rear wings.',
        specs: [
          ['Engine', '3.8 l flat-six', 'two VTG turbochargers'],
          ['Power', '650 PS', '478 kW; 800 Nm'],
          ['0 to 100 km/h', '2.7 s', 'eight-speed PDK, all-wheel drive'],
          ['Top speed', '330 km/h', '205 mph'],
        ],
      },
      wheels: {
        title: 'Ten pistons.',
        text: 'The first 911 with ten-piston front calipers, closing on 420 mm ceramic discs. Ceramic brakes are standard on the Turbo S, and their calipers are yellow.',
        specs: [
          ['Wheels', '20 / 21 in', 'centre-lock; 9.5 J front, up to 12 J rear'],
          ['Tyres', '255/35 & 315/30', 'R20 front, R21 rear'],
          ['Front brakes', '420 mm', 'ceramic, ten-piston calipers'],
          ['Rear brakes', '390 mm', 'ceramic, four-piston calipers'],
        ],
      },
    },
    credit: {
      title: 'Porsche 911 with interior',
      url: 'https://sketchfab.com/3d-models/porsche-911-with-interior-877b1bc1739f4a2bb65d62fd7ffd9f75',
      author: 'n.brizitskaya',
      authorUrl: 'https://sketchfab.com/n.brizitskaya',
    },
  },

  'targa-4s-992': {
    name: '911 Targa 4S',
    generation: '992',
    year: 2020,
    model: './models/911-targa-s-992.glb',
    finish: 'targa',
    rig: {
      door: { hinge: [0.84, 0.6, 0.69], parts: part('door'), angle: -1.08 },
      hood: { hinge: [0, 0.86, 0.74], parts: part('hood'), angle: -0.95 },
      wheelL: { hinge: [0.775, 0.342, 1.225], parts: part('wheelL') },
      wheelR: { hinge: [-0.775, 0.342, 1.225], parts: part('wheelR') },
    },
    pick: [[part('door'), 'door'], [part('hood'), 'frunk'], [/^part:?wheel/, 'wheels']],
    well: true,
    seat: { camera: [0.36, 1.02, -0.38], target: [0.36, 0.86, 0.72] },
    views: {
      exterior: { title: 'Targa 4S. 992, 2020.' },
      door: {
        title: 'A roof that folds away.',
        text: 'Behind the door stands the Targa bar, as on the 1965 original, with a wraparound rear window behind it. The roof section above the front seats opens at the press of a button. Step inside to take the seat.',
        specs: [
          ['Roof', '19 s', 'to open or close, fully automatic'],
          ['Outer skin', 'Aluminium', 'apart from the front and rear sections'],
          ['Drive', 'All-wheel', 'every 992 Targa is a Targa 4'],
        ],
      },
      interior: {
        title: 'Open above, 2+2 below.',
        text: 'The rev counter stays in the middle, flanked by two thin displays, with the 10.9-inch centre screen and five direct buttons below. Drag to look around.',
        specs: [
          ['Seats', '2 + 2', 'rear seats as standard'],
          ['Instruments', 'Central rev counter', 'with two freeform displays'],
          ['Centre screen', '10.9 in', 'touchscreen'],
        ],
      },
      frunk: {
        title: 'Luggage up front.',
        text: 'With the engine behind the rear axle, the nose carries the luggage. The lid is aluminium, like the doors and the wings around it.',
        specs: [
          ['Front lid', 'Aluminium', 'as is the rest of the outer skin'],
          ['Drive', 'PTM', 'all-wheel drive, standard'],
        ],
      },
      engine: {
        title: 'Three litres, two turbos.',
        text: 'A twin-turbocharged flat-six sits behind the rear axle, under the grille. Nothing opens here: this is the view an owner gets, the Targa bar and the light strip across the tail.',
        specs: [
          ['Engine', '3.0 l flat-six', 'twin turbochargers'],
          ['Power', '450 PS', '331 kW; 530 Nm from 2,300 rpm'],
          ['0 to 100 km/h', '3.6 s', 'with the optional Sport Chrono'],
          ['Top speed', '304 km/h', 'eight-speed PDK or seven-speed manual'],
        ],
      },
      wheels: {
        title: 'Red calipers, staggered wheels.',
        text: 'Front wheels turned for a clear view: a 20-inch wheel at the front, 21 inches at the rear, and red six-piston calipers on 350 mm discs.',
        specs: [
          ['Wheels', '20 / 21 in', 'front / rear'],
          ['Tyres', '245/35 & 305/30', 'ZR20 front, ZR21 rear'],
          ['Brakes', '350 mm', 'discs front and rear'],
          ['Calipers', 'Red', 'six-piston front, four-piston rear'],
        ],
      },
    },
    credit: {
      title: 'Porsche 911 992 Targa S',
      url: 'https://sketchfab.com/3d-models/porsche-911-992-targa-s-2c929bad2b6c41a2a35867e5d8a4f5f3',
      author: 'niev',
      authorUrl: 'https://sketchfab.com/niev',
    },
  },
  'carrera-s-991': {
    name: '911 Carrera S',
    generation: '991',
    year: 2015,
    model: './models/911-carrera-s.glb',
    finish: 'carrera',
    // This model predates tools/prepare-car.mjs: it is centred at load time and its parts keep their source names.
    center: [0.053, 0, 0.03],
    rig: {
      door: { hinge: [0.8, 0.6, 0.755], parts: /^(Left_door|Mirror001_)/, angle: -1.08 },
      hood: { hinge: [0.053, 0.885, 0.79], parts: /^(Hood_|Structure002_|Indicator_)/, angle: -0.95 },
      spoiler: { hinge: [0.053, 0.8, -1.79], parts: /^(Spoiler_\d|Spoiler_base_)/, lift: 0.07, tilt: 0.1 },
      wheelL: { hinge: [0.8225, 0.3385, 1.284], parts: /^(wheelFtL_|wheelbrakeFtL_)/ },
      wheelR: { hinge: [-0.7155, 0.3385, 1.284], parts: /^(wheelFtR_|wheelbrakeFtR_)/ },
    },
    pick: [
      [/^(Left_door|Mirror001_)/, 'door'],
      [/^(Hood_|Structure002_|Indicator_|Luggage)/, 'frunk'],
      [/^(Spoiler|Engine_)/, 'engine'],
      [/^(wheel|Rim|Rotor|Caliper|Tyre)/, 'wheels'],
    ],
    seat: { camera: [0.335, 1.0, -0.22], target: [0.335, 0.86, 0.75] },
    views: {
      exterior: { title: 'Carrera S. 991, 2015.' },
      door: {
        title: 'Long door, frameless glass.',
        text: 'The door hinges at its leading edge and swings wide for an easy way in. Step inside to take the seat.',
        specs: [
          ['Body', 'Aluminium and steel', 'the first 911 built from both'],
          ['Body shell', '80 kg lighter', 'than the 997 before it'],
          ['Side glass', 'Frameless', 'no window frame on the door'],
        ],
      },
      interior: {
        title: "The driver's seat.",
        text: 'Five round instruments with the rev counter in the middle and the key to the left of the wheel, as in every 911. Drag to look around.',
        specs: [
          ['In this car', 'Black leather', 'smooth leather on seats, door cards and dash'],
          ['As standard', 'Part leather', 'seat centres and bolsters in leather, the rest leatherette'],
          ['Seats', '2 + 2', 'rear backrests fold flat'],
          ['Instruments', '5 dials', 'rev counter in the centre'],
        ],
      },
      frunk: {
        title: 'The boot is up front.',
        text: 'The engine lives behind the rear axle, so the nose carries the luggage. The lid hinges at the windscreen and the well runs forward under it.',
        specs: [
          ['Front luggage', 'About 135 l', 'rear-wheel-drive coupé'],
          ['More room', 'Fold the rear seats', 'their backs become a flat shelf'],
          ['Fuel tank', '64 l', 'standard size'],
        ],
      },
      engine: {
        title: 'Flat-six at the back.',
        text: 'On the 991 the rear lid opens onto service points, not the engine. This model stops at what you see from outside: the intake grille and the rear spoiler, raised here.',
        specs: [
          ['Engine', '3.8 l flat-six', 'direct injection, behind the rear axle'],
          ['Power', '400 PS', '294 kW at 7,400 rpm; 440 Nm at 5,600 rpm'],
          ['0 to 100 km/h', '4.1 s', 'PDK with Sport Chrono; 4.5 s with the seven-speed manual'],
          ['Top speed', '304 km/h', 'manual; 302 km/h with PDK'],
        ],
      },
      wheels: {
        title: 'Twenty inches. Six pistons.',
        text: 'Front wheels turned for a clear view past the spokes: a drilled, vented disc and the monobloc caliper that grips it. The rear wheels are wider, where the weight sits.',
        specs: [
          ['Wheels', '20 in', '8.5 J front, 11 J rear'],
          ['Tyres', '245/35 & 295/30', 'ZR20, front and rear'],
          ['Front brakes', '340 mm', 'drilled discs, six-piston calipers'],
          ['Rear brakes', '330 mm', 'drilled discs, four-piston calipers'],
        ],
      },
    },
    credit: {
      title: '2015 porsche 911 carrera s rigged mid-poly',
      url: 'https://sketchfab.com/3d-models/2015-porsche-911-carrera-s-rigged-mid-poly-7fd67e408409449c98e3c7be35b40aa7',
      author: 'ShaheerHashmi',
      authorUrl: 'https://sketchfab.com/ShaheerHashmi',
    },
  },
};

// Picker order: the campaign car first.
export const LINEUP = ['gt3-992', 'turbo-s-992', 'targa-4s-992', 'carrera-s-991'];
export const DEFAULT_CAR = 'gt3-992';
