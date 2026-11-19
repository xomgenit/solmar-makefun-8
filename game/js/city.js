// city.js — seeded procedural city of Solmar Bay (3600x3600), fresh build
import { makeRng, clamp, pushCircleOutOfRect } from './util.js';

export const WORLD = 3600;
export const ROAD_STEP = 300;
export const ROAD_HALF = 45;
export const ROADS = [];
for (let k = 0; k < 12; k++) ROADS.push(150 + 300 * k);

export const LANDMARKS = [
  { id: 'hideout', cx: 600, cy: 300, name: "Dice's Hideout" },
  { id: 'diner', cx: 900, cy: 600, name: "Vera's Diner" },
  { id: 'garage', cx: 1500, cy: 900, name: "Vera's Garage" },
  { id: 'bank', cx: 2100, cy: 600, name: 'Solmar National Bank' },
  { id: 'docks', cx: 2700, cy: 1800, name: 'East Harbour Docks' },
  { id: 'pier', cx: 3420, cy: 1800, name: 'Solmar Pier' },
  { id: 'spa', cx: 1200, cy: 2100, name: 'Sunset Auto Spa' },
  { id: 'hospital', cx: 1800, cy: 2400, name: 'Solmar General' },
  { id: 'hq', cx: 2400, cy: 300, name: 'SBPD Headquarters' },
];
export const PIER = { x: 3300, y: 1770, w: 260, h: 60 };

const BUILDING_COLORS = ['#8d7d6b', '#7a6f5d', '#9c8f7a', '#6b7a8d', '#8d6b6b', '#7d8d6b', '#a08a6a'];

export function zoneAt(x, y) {
  if (x >= 3100) return 'PALMA BEACH';
  if (y < 1500) return x < 1800 ? 'OLD TOWN' : 'DOWNTOWN';
  return x >= 1800 ? 'EAST HARBOUR' : 'SOUTH SIDE';
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const landmarkById = {};
  for (const lm of LANDMARKS) landmarkById[lm.id] = lm;
  // landmark building rects (pier + docks are open areas, no blocking rect)
  const blocking = [];
  for (const lm of LANDMARKS) {
    if (lm.id === 'pier' || lm.id === 'docks') continue;
    blocking.push({ x: lm.cx - 70, y: lm.cy - 50, w: 140, h: 100, lm: lm.id, name: lm.name });
  }
  const landmarkBlocks = new Set();
  for (const lm of LANDMARKS) {
    const bx = Math.floor((lm.cx - 195) / 300);
    const by = Math.floor((lm.cy - 195) / 300);
    landmarkBlocks.add(bx + ',' + by);
  }
  for (let bx = 0; bx < 11; bx++) {
    for (let by = 0; by < 11; by++) {
      const x0 = 150 + 300 * bx + ROAD_HALF + 10;
      const y0 = 150 + 300 * by + ROAD_HALF + 10;
      if (x0 > 3080) continue; // beach strip: no buildings
      if (landmarkBlocks.has(bx + ',' + by)) continue;
      const r = rng();
      if (r < 0.14) {
        // plaza with palms
        for (let i = 0; i < 4; i++) palms.push({ x: x0 + 30 + rng() * 150, y: y0 + 30 + rng() * 150 });
        continue;
      }
      const w = 120 + rng() * 60, h = 110 + rng() * 60;
      const x = x0 + (210 - w) / 2, y = y0 + (210 - h) / 2;
      buildings.push({ x, y, w, h, c: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)] });
    }
  }
  // scattered palms along sidewalks
  for (let i = 0; i < 90; i++) {
    const x = 200 + rng() * 2900, y = 200 + rng() * 3200;
    palms.push({ x, y });
  }
  const city = { seed, buildings, palms, landmarkById, blocking };
  city.allBlockers = buildings.concat(blocking);
  return city;
}

export function collideCircle(city, x, y, r) {
  let hit = false;
  x = clamp(x, 20, WORLD - 20);
  y = clamp(y, 20, WORLD - 20);
  for (const b of city.allBlockers) {
    const p = pushCircleOutOfRect(x, y, r, b);
    if (p.hit) { x = p.x; y = p.y; hit = true; }
  }
  // sea: x > 3450 is water, except the pier deck
  if (x > 3450 - r) {
    const onPier = y >= PIER.y - r && y <= PIER.y + PIER.h + r && x <= PIER.x + PIER.w + r;
    if (!onPier) { x = 3450 - r; hit = true; }
  }
  return { x, y, hit };
}

export function nearestRoadPoint(city, x, y) {
  let best = null, bd = Infinity;
  for (const rc of ROADS) {
    const d1 = Math.abs(x - rc);
    if (d1 < bd) { bd = d1; best = { x: rc, y }; }
    const d2 = Math.abs(y - rc);
    if (d2 < bd) { bd = d2; best = { x, y: rc }; }
  }
  return best;
}
