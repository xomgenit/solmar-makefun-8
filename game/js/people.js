// people.js — pedestrians (fresh build)
import { dist } from './util.js';
import { ROADS } from './city.js';

const SHIRTS = ['#e67e22', '#3498db', '#9b59b6', '#1abc9c', '#e74c3c', '#f1c40f', '#ecf0f1'];

export function createPed(game, x, y) {
  return {
    x, y, angle: Math.random() * Math.PI * 2,
    speed: 40 + Math.random() * 35,
    state: 'walk', downT: 0,
    axis: Math.random() < 0.5 ? 'h' : 'v', dir: Math.random() < 0.5 ? 1 : -1,
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
  };
}

export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, x, y) < radius) ped.state = 'flee';
  }
}

export function knockDownPed(game, ped, byPlayer) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downT = 3;
  if (byPlayer && game.police) game.police.addWanted(1);
  if (game.effects) game.effects.blood(ped.x, ped.y, 6);
}

export function updatePeds(game, dt) {
  const p = game.player;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) ped.state = 'walk';
      continue;
    }
    // flee gunfire / speeding cars
    if (ped.state === 'flee') {
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (d > 320) ped.state = 'walk';
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 130 * dt;
      ped.y += Math.sin(away) * 130 * dt;
    } else {
      // walk along a road, turn at intersections sometimes
      const nearX = ROADS.some((r) => Math.abs(ped.x - r) < 24);
      const nearY = ROADS.some((r) => Math.abs(ped.y - r) < 24);
      if (nearX && nearY && Math.random() < dt * 0.4) {
        ped.axis = ped.axis === 'h' ? 'v' : 'h';
        ped.dir = Math.random() < 0.5 ? 1 : -1;
      }
      const sp = ped.speed * dt;
      if (ped.axis === 'h') ped.x += ped.dir * sp; else ped.y += ped.dir * sp;
      ped.angle = ped.axis === 'h' ? (ped.dir === 1 ? 0 : Math.PI) : (ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
      // recycle far peds near the player
      if (dist(ped.x, ped.y, p.x, p.y) > 1500) {
        ped.x = p.x + (Math.random() < 0.5 ? -1 : 1) * (400 + Math.random() * 300);
        ped.y = p.y + (Math.random() < 0.5 ? -1 : 1) * (400 + Math.random() * 300);
      }
    }
    if (game.collideCircle) {
      const r = game.collideCircle(game.city, ped.x, ped.y, 10);
      ped.x = r.x; ped.y = r.y;
    }
    // knocked down by a speeding player car
    if (p.car && Math.hypot(p.car.vx, p.car.vy) > 200 && dist(ped.x, ped.y, p.x, p.y) < 26) {
      knockDownPed(game, ped, true);
      scarePeds(game, ped.x, ped.y, 260);
    }
  }
}
