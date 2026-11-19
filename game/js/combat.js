// combat.js — hitscan shooting + generic enemies (fresh build)
import { dist, segmentHitsRects } from './util.js';

export function hasLineOfSight(game, x1, y1, x2, y2) {
  return !segmentHitsRects(x1, y1, x2, y2, game.city.allBlockers);
}

export function spawnEnemy(game, x, y, type) {
  const e = {
    x, y, type, hp: type === 'king' ? 30 : 25,
    angle: 0, shootCd: 0.5 + Math.random(), bustT: 0, dead: false,
  };
  game.enemies.push(e);
  return e;
}

export function killEnemy(game, enemy) {
  enemy.dead = true;
  if (game.effects) game.effects.blood(enemy.x, enemy.y, 12);
  if (enemy.type === 'king' && game.missions) game.missions.onEnemyDown(enemy);
  if (enemy.type === 'cop' && game.police) game.police.addWanted(1);
  game.stats.kills = (game.stats.kills || 0) + 1;
  game.enemies = game.enemies.filter((e) => e !== enemy);
}

export function hurtPlayer(game, amt) {
  if (game.state !== 'playing') return;
  game.health -= amt;
  game.lastHurt = game.time;
  if (game.effects) game.effects.blood(game.player.x, game.player.y, 5);
  if (game.health <= 0) {
    game.health = 0;
    if (game.events.wasted) game.events.wasted();
  }
}

// Hitscan shot from (x,y) along angle. fromPlayer: hits enemies; else hits the player.
export function shoot(game, x, y, angle, opts = {}) {
  const fromPlayer = !!opts.fromPlayer;
  const range = 460;
  const ex = x + Math.cos(angle) * range, ey = y + Math.sin(angle) * range;
  let hitX = ex, hitY = ey, hitT = range, hitTarget = null;
  const candidates = fromPlayer ? game.enemies : [game.player];
  for (const c of candidates) {
    if (c.dead) continue;
    const dx = c.x - x, dy = c.y - y;
    const t = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (t < 0 || t > range) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp > 26) continue;
    if (t < hitT) {
      // blocked by a building before reaching the target?
      if (!hasLineOfSight(game, x, y, c.x, c.y)) continue;
      hitT = t; hitTarget = c;
      hitX = c.x; hitY = c.y;
    }
  }
  // wall hit: shorten the tracer at the first building
  if (!hitTarget) {
    // march along the ray in steps to find the wall
    for (let t = 20; t <= range; t += 20) {
      const px = x + Math.cos(angle) * t, py = y + Math.sin(angle) * t;
      let blocked = false;
      for (const b of game.city.allBlockers) {
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { blocked = true; break; }
      }
      if (blocked) { hitX = px; hitY = py; break; }
    }
  }
  if (game.effects) {
    game.effects.tracer(x, y, hitX, hitY);
    game.effects.muzzle(x, y);
  }
  if (hitTarget) {
    if (fromPlayer) {
      hitTarget.hp -= 10;
      if (game.effects) game.effects.blood(hitTarget.x, hitTarget.y, 6);
      if (hitTarget.hp <= 0) killEnemy(game, hitTarget);
    } else {
      hurtPlayer(game, 7);
    }
  }
  return !!hitTarget;
}

export function updateEnemies(game, dt) {
  const p = game.player;
  for (const e of [...game.enemies]) {
    if (e.dead) continue;
    e.shootCd -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    if (e.type === 'king') {
      // kings hold ground and shoot within 380px with line of sight
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d < 380 && e.shootCd <= 0 && hasLineOfSight(game, e.x, e.y, p.x, p.y)) {
        const spread = (Math.random() - 0.5) * 0.55;
        shoot(game, e.x, e.y, e.angle + spread, { fromPlayer: false });
        e.shootCd = 1.1 + Math.random() * 0.5;
      }
    } else {
      // foot cop: chase the player, shoot within 300px with LOS
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (!p.car) {
        const sp = 150;
        e.x += Math.cos(e.angle) * sp * dt;
        e.y += Math.sin(e.angle) * sp * dt;
        if (game.collideCircle) {
          const r = game.collideCircle(game.city, e.x, e.y, 12);
          e.x = r.x; e.y = r.y;
        }
      }
      if (d < 300 && e.shootCd <= 0 && hasLineOfSight(game, e.x, e.y, p.x, p.y)) {
        const spread = (Math.random() - 0.5) * 0.35;
        shoot(game, e.x, e.y, e.angle + spread, { fromPlayer: false });
        e.shootCd = 0.9 + Math.random() * 0.4;
      }
      // bust: on-foot player within 42px for 1.1s
      if (!p.car && d < 42) {
        e.bustT += dt;
        if (e.bustT > 1.1 && game.events.busted) game.events.busted();
      } else {
        e.bustT = 0;
      }
    }
  }
}

export function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.fillStyle = e.type === 'king' ? '#c0392b' : '#2c3e50';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.type === 'king' ? '#7b241c' : '#1a252f';
  ctx.fillRect(4, -3, 14, 6); // gun
  ctx.restore();
  // health bar
  const max = e.type === 'king' ? 30 : 25;
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(e.x - 14, e.y - 22, 28 * Math.max(0, e.hp / max), 4);
}
