// VBT - Virtual Bike Trainer: centrale instellingen en kleurenpalet
window.VBT = window.VBT || {};

VBT.cfg = {
  segmentLength: 200,     // wereld-eenheden per wegsegment
  unitsPerMeter: 400,     // 1 segment = 0,5 m -> genoeg snelheidsgevoel
  rumbleLength: 3,
  roadWidth: 2000,        // halve wegbreedte
  lanes: 3,
  fieldOfView: 100,
  cameraHeight: 1000,
  playerDepth: 1.6,       // renner iets voor de camera, zodat er weg onder hem zichtbaar is
  drawDistance: 320,
  fogDensity: 4,
  verticalExaggeration: 4, // hoogte visueel x4 overdrijven (arcade), fysica gebruikt de echte helling
  maxGrade: 0.25,         // climbs (Stelvio, Bealach na Ba) gaan tot ~20%
  rider: { mass: 85, crr: 0.004, cda: 0.32, rho: 1.225, ftp: 180 },   // ftp: instelbaar in de kalender
  riderUnitsPerMeter: 330, // tekenschaal van de renners
  pelotonSize: 15,
  draftDistance: 10,      // meter achter de ghost waarbinnen je in de slipstream zit
  draftBonus: 0.3,        // minder luchtweerstand in de slipstream
};

VBT.palette = {
  skyTop: '#07011a',
  skyMid: '#2a0750',
  skyLow: '#b0157a',
  horizon: '#ff7a3d',
  sunTop: '#ffe66d',
  sunBottom: '#ff2e88',
  ground: '#0e0123',
  grid: '#ff2ef0',
  road: '#1a1430',
  roadAlt: '#1f1838',
  rumble: '#ff2e88',
  rumbleAlt: '#2b1450',
  lane: '#f4f1ff',
  fog: '#3a0a4f',
  pink: '#ff2e88',
  cyan: '#24e8ff',
  yellow: '#ffe66d',
  purple: '#9b5cff',
};

// Hartslagzones als fractie van de max-hartslag (instelbaar in Settings)
VBT.hrZones = [
  { max: 0.60, name: 'Z1', color: '#8a8aa8', label: 'Recovery' },
  { max: 0.70, name: 'Z2', color: '#3d8bff', label: 'Endurance' },
  { max: 0.80, name: 'Z3', color: '#2bd67b', label: 'Tempo' },
  { max: 0.90, name: 'Z4', color: '#ff9e3d', label: 'Threshold' },
  { max: 9.99, name: 'Z5', color: '#ff3d5a', label: 'VO2 max' },
];

// Vermogenszones (Coggan) als fractie van FTP
VBT.zones = [
  { max: 0.55, name: 'Z1', color: '#8a8aa8' },
  { max: 0.75, name: 'Z2', color: '#3d8bff' },
  { max: 0.90, name: 'Z3', color: '#2bd67b' },
  { max: 1.05, name: 'Z4', color: '#ffe66d' },
  { max: 1.20, name: 'Z5', color: '#ff9e3d' },
  { max: 1.50, name: 'Z6', color: '#ff3d5a' },
  { max: 9.99, name: 'Z7', color: '#c04dff' },
];
