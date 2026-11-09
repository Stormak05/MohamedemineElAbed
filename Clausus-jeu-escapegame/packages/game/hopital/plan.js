// Floor plans of the hospital, read off the two drawings (Étage 0.png and Étage 1.png, same scale).
// Coordinates are in pixels of the ground-floor drawing; the first-floor drawing sits on the main block,
// shifted by F1 (its stairwell and lift line up with the ground floor's).
// World: x = (px - ORIGIN.x) * S, z = (py - ORIGIN.y) * S, in metres. y is up, ground floor at y = 0.
// ORIGIN puts the bedroom of main.js (x in [-2, 2], z in [-3, 3]) inside room 104 of the first floor:
// the drawing's outer walls line up with the back of the room's wall modules.

export const S = 0.075; // metres per pixel: corridors 3 m wide, core rooms 6 × 6 m
export const ORIGIN = { x: 78 + 49, y: 270 + 124 / 3 };
export const F1 = { x: 78, y: 270 }; // first-floor drawing → ground-floor pixels
export const FH = 3.3; // floor to floor
export const CEIL = 2.7; // floor to ceiling: the height of the wall modules
export const DOOR_H = 2.1;
export const T = 0.2; // wall thickness

// Shift room 104 east to align its door wall with the archives and the main corridor.
// Room 103 gives up that width; there is no recessed approach outside room 104.
export const NORTH_HALL_Y = 54 + 2 / 3;
// Ground-floor plan pixels; also reserve this wall space when placing corridor posters.
export const EVAC_PLAN_F1 = { x: F1.x + 99, y: F1.y + NORTH_HALL_Y };
export const CHAMBRE = { x0: 79 - (59 + 1 / 3), y0: 0, x1: 79, y1: 83, doorY: 68, doorW: 0.94 / S };

export const wx = (px) => (px - ORIGIN.x) * S;
export const wz = (py) => (py - ORIGIN.y) * S;

// Walls: [x0, y0, x1, y1], axis-aligned, by floor. Floor 1 values are in its own drawing's pixels.
export const WALLS = {
  0: [
    // Kitchen and canteen annex (north).
    [160, 30, 399, 30], [160, 30, 160, 270], [399, 30, 399, 270], [160, 109.5, 399, 109.5],
    // Main block, outer walls.
    [80, 270, 478.5, 270], [80, 270, 80, 669], [80, 669, 478.5, 669], [478.5, 563, 478.5, 669],
    // Pharmacy (L-shaped: a storage strip runs down the west side), meeting room.
    [219, 270, 219, 349], [118, 349, 219, 349], [118, 349, 118, 589], [80, 589, 118, 589],
    [340, 270, 340, 349], [340, 349, 478.5, 349],
    // Core rooms.
    [160, 390, 399, 390], [160, 470, 399, 470], [160, 549, 399, 549],
    [160, 390, 160, 549], [240, 390, 240, 549], [320, 390, 320, 549], [399, 390, 399, 549],
    // South: security post, entrance hall (open on the corridor), toilets.
    [80, 590, 259, 590], [259, 590, 259, 669], [360, 590, 478.5, 590], [360, 590, 360, 669],
    // The toilets take 3 × 2.4 m each; the rest of that corner is closed off, with no door.
    [380, 590, 380, 622], [420, 590, 420, 622], [460, 590, 460, 622], [380, 622, 460, 622],
  ],
  1: [
    // North outer wall: the room's own window wall replaces it over room 104.
    [0, 0, CHAMBRE.x0, 0], [CHAMBRE.x1, 0, 400.5, 0], [0, 0, 0, 400], [0, 400, 400.5, 400], [400.5, 292, 400.5, 400],
    // North row of rooms.
    [0, 83, 79, 83], [CHAMBRE.x1, NORTH_HALL_Y, 400.5, NORTH_HALL_Y],
    [199, 0, 199, NORTH_HALL_Y], [299, 0, 299, NORTH_HALL_Y],
    // Room 104 opens directly onto the corridor; below it, the west wall stays aligned with the archives.
    [CHAMBRE.x1, 0, CHAMBRE.x1, 83],
    // West side: archives, laundry (the strip below room 104 is closed off, with no door).
    [0, 117, 79, 117], [79, 83, 79, 320], [0, 278, 79, 278],
    // South row.
    [79, 320, 400.5, 320], [99, 320, 99, 400], [199, 320, 199, 400], [299, 320, 299, 400],
    // Core rooms.
    [120, 117, 359, 117], [120, 196, 359, 196], [120, 275, 359, 275],
    [120, 117, 120, 275], [200, 117, 200, 275], [280, 117, 280, 275], [359, 117, 359, 275],
  ],
  // Stairwell and lift shaft: one wall from the ground to the roof.
  shared: [
    [478.5, 270, 478.5, 563], [516.5, 270, 516.5, 563], [478.5, 270, 516.5, 270], [478.5, 525, 516.5, 525], [478.5, 563, 516.5, 563],
  ],
};

// Doors. o: 'h' (in a wall along x) or 'v' (along y). at: position along the wall, w: width (px).
// into: the side the leaf swings to (+1 = towards +x / +y). kind: single, double, lift.
// look: the leaf's model (decor/door_<look>_<state>): service, wc, fire (stairs, archives), swing (porthole, kitchen and
// canteen), exit (glazed). Without it, the patient-room door module (door_<state>c).
// need: the item that unlocks it (main.js keeps the inventory): cles (Dr Morel's keyring), cleReunion, carte (exit card).
export const DOORS = [
  // Ground floor.
  { f: 0, o: 'h', x: 280, y: 270, w: 30, kind: 'double', into: -1, name: 'Cantine', look: 'swing' },
  { f: 0, o: 'h', x: 372, y: 109.5, w: 15, into: -1, name: 'Cuisine', look: 'swing' },
  { f: 0, o: 'v', x: 219, y: 309, w: 15, into: -1, name: 'Pharmacie 009', look: 'service' },
  { f: 0, o: 'v', x: 340, y: 309, w: 15, into: 1, name: 'Salle de réunion 008', look: 'service', need: 'cleReunion' },
  { f: 0, o: 'h', x: 172, y: 390, w: 15, into: 1, name: 'Cabinet Dr W. Morel 007', look: 'service', need: 'cles' },
  { f: 0, o: 'h', x: 253, y: 390, w: 15, into: 1, name: '006', look: 'service' },
  { f: 0, o: 'h', x: 358, y: 390, w: 15, into: 1, name: '005', look: 'service' },
  { f: 0, o: 'h', x: 201, y: 549, w: 15, into: -1, name: '002', look: 'service' },
  { f: 0, o: 'h', x: 280, y: 549, w: 15, into: -1, name: '003', look: 'service' },
  { f: 0, o: 'h', x: 359, y: 549, w: 15, into: -1, name: '004', look: 'service' },
  { f: 0, o: 'h', x: 231, y: 590, w: 15, into: 1, name: 'Poste de sécurité 001', look: 'service', need: 'cles' },
  { f: 0, o: 'h', x: 400, y: 590, w: 15, into: 1, name: 'WC Hommes', look: 'wc' },
  { f: 0, o: 'h', x: 440, y: 590, w: 15, into: 1, name: 'WC Femmes', look: 'wc' },
  { f: 0, o: 'h', x: 296, y: 669, w: 32, kind: 'double', into: 1, name: 'Sortie', look: 'exit', need: 'carte' },
  { f: 0, o: 'v', x: 478.5, y: 466, w: 15, into: 1, name: 'Escalier', stair: true, look: 'fire' },
  { f: 0, o: 'v', x: 478.5, y: 544, w: 16, kind: 'lift', name: 'Ascenseur' },
  // First floor (its own drawing's pixels).
  // Room 104's door (the room's own door module): only an opening in its wall, onto the corridor.
  { f: 1, o: 'v', x: CHAMBRE.x1, y: CHAMBRE.doorY, w: CHAMBRE.doorW, kind: 'open', name: 'Chambre 104' },
  { f: 1, o: 'h', x: 150, y: NORTH_HALL_Y, w: 15, into: -1, name: '103' },
  { f: 1, o: 'h', x: 253, y: NORTH_HALL_Y, w: 15, into: -1, name: 'Chambre 102' },
  { f: 1, o: 'h', x: 351, y: NORTH_HALL_Y, w: 15, into: -1, name: '101' },
  { f: 1, o: 'v', x: 79, y: 187, w: 28, kind: 'double', into: -1, name: 'Archives', look: 'fire' },
  { f: 1, o: 'v', x: 79, y: 297, w: 15, into: -1, name: 'Laverie', look: 'service' },
  { f: 1, o: 'h', x: 160, y: 117, w: 15, into: 1, name: '105' },
  { f: 1, o: 'h', x: 240, y: 117, w: 15, into: 1, name: '106' },
  { f: 1, o: 'h', x: 320, y: 117, w: 15, into: 1, name: '107' },
  { f: 1, o: 'h', x: 160, y: 275, w: 15, into: -1, name: '108' },
  { f: 1, o: 'h', x: 240, y: 275, w: 15, into: -1, name: '109' },
  { f: 1, o: 'h', x: 320, y: 275, w: 15, into: -1, name: '110' },
  { f: 1, o: 'h', x: 150, y: 320, w: 15, into: 1, name: '112' },
  { f: 1, o: 'h', x: 250, y: 320, w: 15, into: 1, name: '113' },
  { f: 1, o: 'h', x: 350, y: 320, w: 15, into: 1, name: '114' },
  { f: 1, o: 'v', x: 478.5 - 78, y: 466 - 270, w: 15, into: 1, name: 'Escalier', stair: true, look: 'fire', need: 'cles' },
  { f: 1, o: 'v', x: 478.5 - 78, y: 544 - 270, w: 16, kind: 'lift', name: 'Ascenseur' },
];

// Rooms: [x0, y0, x1, y1, name, kind]. kind: room (dim light), bright (working room, no dead lamp), hall (corridor lights),
// none (no fixture: the laundry is dark, énigme 3).
// Listed small first: the HUD shows the first one containing the player.
export const ROOMS = {
  0: [
    [160, 30, 399, 109.5, 'Cuisine', 'bright'], [160, 109.5, 399, 270, 'Cantine', 'room'],
    [80, 270, 219, 349, 'Pharmacie 009', 'room'], [80, 349, 118, 589, 'Pharmacie 009 (réserve)', 'none'],
    [340, 270, 478.5, 349, 'Salle de réunion 008', 'room'],
    [160, 390, 240, 470, 'Cabinet Dr W. Morel 007', 'room'], [240, 390, 320, 470, '006', 'room'], [320, 390, 399, 470, '005', 'room'],
    [160, 470, 240, 549, '002', 'room'], [240, 470, 320, 549, '003', 'room'], [320, 470, 399, 549, '004', 'room'],
    [80, 590, 259, 669, 'Poste de sécurité 001', 'room'], [259, 590, 360, 669, 'Accueil', 'hall'],
    [380, 590, 420, 622, 'WC Hommes', 'room'], [420, 590, 460, 622, 'WC Femmes', 'room'],
    [219, 270, 340, 349, 'Hall', 'hall'],
    [118, 349, 478.5, 390, 'Couloir', 'hall'], [118, 390, 160, 549, 'Couloir', 'hall'], [399, 390, 478.5, 590, 'Couloir', 'hall'],
    [118, 549, 399, 590, 'Couloir', 'hall'],
  ],
  1: [
    [CHAMBRE.x0, CHAMBRE.y0, CHAMBRE.x1, CHAMBRE.y1, 'Chambre 104', 'none'],
    [CHAMBRE.x1, 0, 199, NORTH_HALL_Y, '103', 'room'], [199, 0, 299, NORTH_HALL_Y, 'Chambre 102', 'room'], [299, 0, 400, NORTH_HALL_Y, '101', 'room'],
    [0, 117, 79, 278, 'Archives', 'room'],
    [120, 117, 200, 196, '105', 'room'], [200, 117, 280, 196, '106', 'room'], [280, 117, 359, 196, '107', 'room'],
    [120, 196, 200, 275, '108', 'room'], [200, 196, 280, 275, '109', 'room'], [280, 196, 359, 275, '110', 'room'],
    [99, 320, 199, 400, '112', 'room'], [199, 320, 299, 400, '113', 'room'], [299, 320, 400, 400, '114', 'room'],
    [79, NORTH_HALL_Y, 400, 117, 'Couloir', 'hall'], [79, 117, 120, 320, 'Couloir', 'hall'], [359, 117, 400, 320, 'Couloir', 'hall'],
    [120, 275, 359, 320, 'Couloir', 'hall'],
    // After the corridors: its box overlaps the west corridor (x 79–99 above y 320), which must win there.
    [0, 278, 99, 400, 'Laverie', 'none'],
  ],
};

// Walkable floors: [x0, y0, x1, y1] in ground-floor pixels (stairs and lift are added by the builder).
export const FLOORS = {
  0: [[80, 270, 478.5, 669], [160, 30, 399, 270]],
  1: [[F1.x, F1.y, 478.5, F1.y + 400]],
};

// Stairwell: two flights in a U. Ground landing and first-floor landing at the door, a half landing to the north.
export const STAIR = {
  x0: 478.5, x1: 516.5, xMid: 497.5, // west lane goes up first, east lane comes back
  yLanding: 440, // landings span yLanding..525
  yHalf: 399, // flights span yHalf..yLanding
  yNorth: 371, // half landing spans yNorth..yHalf; the well is walled off beyond
  steps: 11,
};
export const LIFT = { x0: 478.5, x1: 516.5, y0: 525, y1: 563, door: 544, doorW: 16 };

// Converts a first-floor pixel position into ground-floor pixels.
export const toF0 = (f, x, y) => (f === 1 ? [x + F1.x, y + F1.y] : [x, y]);

// Metres in the room frame, shared by the counter and its live CCTV monitors.
export const SECURITY_DESKS = [-2.6, -1.3, 0, 1.3, 2.6];
export const SECURITY_MONITORS = [-2.92, -2.28, -1.62, -0.98, 1.3];
export const SECURITY_DESK_GAP = 0.42;
export const SECURITY_DESK_H = 0.74;
