// police.js — wanted system 0-5: foot cops + cruisers, heat can cool (fresh build)
import { clamp, dist, angleDiff } from './util.js';
import { ROADS, nearestRoadPoint } from './city.js';
import { spawnEnemy, hasLineOfSight } from './combat.js';
import { createCar, driveCar } from './vehicles.js';

export function createPolice(game) {
  const pol = {
    freshT: 0, coolT: 0,
    addWanted(n) {
      game.wanted = clamp((game.wanted || 0) + n, 0, 5);
      if (n > 0) pol.freshT = 3; // fresh heat draws a first response for 3s
    },
    clearWanted() { game.wanted = 0; pol.coolT = 0; pol.freshT = 0; },
    setWanted(n) {
      game.wanted = clamp(n, 0, 5);
      if (n > 0) pol.freshT = 3;
    },
    isSeen() {
      const p = game.player;
      for (const e of game.enemies) {
        if (e.type !== 'cop') continue;
        if (dist(e.x, e.y, p.x, p.y) < 650 && hasLineOfSight(game, e.x, e.y, p.x, p.y)) return true;
      }
      for (const c of game.cars) {
        if (c.role !== 'cruiser' || c.wrecked) continue;
        if (dist(c.x, c.y, p.x, p.y) < 700) return true;
      }
      return false;
    },
    update(dt) {
      if (game.wanted > 0) pol.freshT = Math.max(0, pol.freshT - dt);
      const p = game.player;
      if (game.wanted === 0) {
        // no heat, no units: leftover cops/cruisers stand down
        game.enemies = game.enemies.filter((e) => e.type !== 'cop');
        game.cars = game.cars.filter((c) => c.role !== 'cruiser');
        return;
      }
      const wantFoot = p.car ? 0 : game.wanted;
      const wantCruiser = p.car ? game.wanted : 0;
      // maintain foot cops
      let foot = game.enemies.filter((e) => e.type === 'cop').length;
      let cruisers = game.cars.filter((c) => c.role === 'cruiser' && !c.wrecked).length;
      const canSpawn = pol.freshT > 0 || pol.isSeen();
      if (game.wanted > 0 && canSpawn) {
        while (foot < wantFoot) {
          const spot = nearestRoadPoint(game.city, p.x + (Math.random() < 0.5 ? -1 : 1) * 550, p.y + (Math.random() < 0.5 ? -1 : 1) * 550);
          spawnEnemy(game, spot.x, spot.y, 'cop');
          foot++;
        }
        while (cruisers < wantCruiser) {
          const road = ROADS[Math.floor(Math.random() * ROADS.length)];
          const horiz = Math.random() < 0.5;
          const x = horiz ? clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * 600, 100, 3400) : road;
          const y = horiz ? road : clamp(p.y + (Math.random() < 0.5 ? -1 : 1) * 600, 100, 3400);
          const c = createCar(x, y, 0, 'cruiser', 'cruiser', '#1a1a2e');
          game.cars.push(c);
          cruisers++;
        }
      }
      // despawn far units
      game.enemies = game.enemies.filter((e) => {
        if (e.type === 'cop' && dist(e.x, e.y, p.x, p.y) > 1900) return false;
        return true;
      });
      game.cars = game.cars.filter((c) => {
        if (c.role === 'cruiser' && dist(c.x, c.y, p.x, p.y) > 2100) return false;
        return true;
      });
      // cruiser pursuit AI
      for (const c of game.cars) {
        if (c.role !== 'cruiser' || c.wrecked) continue;
        const want = Math.atan2(p.y - c.y, p.x - c.x);
        const steer = clamp(angleDiff(c.angle, want) * 1.8, -1, 1);
        // stuck recovery: barely moved in 2s -> reverse
        const moved = dist(c.x, c.y, c.lastX, c.lastY);
        if (moved < 4) c.stuckT += dt; else c.stuckT = 0;
        c.lastX = c.x; c.lastY = c.y;
        let throttle = 1;
        if (c.stuckT > 2) { c.reverseT = 1; c.stuckT = 0; }
        if (c.reverseT > 0) { c.reverseT -= dt; throttle = -0.8; }
        driveCar(game, c, { throttle, steer: c.reverseT > 0 ? -steer : steer, handbrake: false }, dt);
        // ramming the player's car
        if (p.car && dist(c.x, c.y, p.x, p.y) < 46) {
          const rel = Math.hypot(c.vx - p.car.vx, c.vy - p.car.vy);
          if (rel > 120) {
            // damage is handled by collideCars; give a nudge
            p.car.vx += (p.x - c.x) * 0.4;
            p.car.vy += (p.y - c.y) * 0.4;
          }
        }
      }
      // heat cools when unseen
      if (game.wanted > 0 && !pol.isSeen() && pol.freshT <= 0) {
        pol.coolT += dt;
        if (pol.coolT > 4) {
          pol.coolT = 0;
          game.wanted = Math.max(0, game.wanted - 1);
          // remove one unit
          const cop = game.enemies.find((e) => e.type === 'cop');
          if (cop) game.enemies = game.enemies.filter((e) => e !== cop);
          else {
            const cr = game.cars.find((c) => c.role === 'cruiser');
            if (cr) game.cars = game.cars.filter((c) => c !== cr);
          }
        }
      } else {
        pol.coolT = 0;
      }
    },
  };
  return pol;
}
