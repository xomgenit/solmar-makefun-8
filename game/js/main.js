// main.js — orchestration: states, player control, menus, save, debug hooks (fresh build)
import { buildCity, zoneAt, collideCircle, nearestRoadPoint, WORLD } from './city.js';
import { createCar, driveCar, updateTraffic, spawnTrafficCar, spawnParkedCar, collideCars, MODELS } from './vehicles.js';
import { createPed, updatePeds } from './people.js';
import { spawnEnemy, shoot, updateEnemies, hasLineOfSight } from './combat.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { hasSave, saveGame, loadSave, clearSave } from './save.js';
import { createInput } from './input.js';
import { ensureAudio, sfx, updateEngine, updateSiren, stopAllLoops } from './audio.js';
import { createEffects } from './effects.js';
import { drawWorld } from './render.js';
import { clamp, dist } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed') ? parseInt(params.get('seed'), 10) : null;
const autostart = params.get('autostart') === '1';

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas);
const hud = createHud();

function buildGame(seed) {
  const city = buildCity(seed);
  const game = {
    seed, city, state: 'title', time: 0,
    cash: 200, health: 100, wanted: 0,
    player: { x: 600, y: 420, angle: -Math.PI / 2, aim: -Math.PI / 2, car: null, fireCd: 0 },
    cars: [], peds: [], enemies: [],
    objective: { text: '', marker: null },
    stats: { kills: 0, stolen: 0 },
    camera: { x: 600, y: 420 },
    lastHurt: -99, collideCircle,
  };
  game.effects = createEffects();
  game.sfx = (n) => { if (sfx[n]) sfx[n](); };
  game.police = createPolice(game);
  game.missions = createMissions(game);
  game.hud = hud;
  game.input = input;
  game.saveGame = () => saveGame(game);
  game.events = {
    wasted() {
      if (game.state !== 'playing') return;
      game.state = 'wasted';
      sfx.wasted();
      document.getElementById('wasted-screen').style.display = 'flex';
      document.getElementById('wasted-text').textContent = 'Danny is down. Hospital bill: $100.';
      stopAllLoops();
    },
    busted() {
      if (game.state !== 'playing') return;
      game.state = 'busted';
      sfx.wasted();
      document.getElementById('busted-screen').style.display = 'flex';
      stopAllLoops();
    },
  };
  // red sports car in the eastbound lane by the hideout
  game.cars.push(spawnParkedCar(game, 560, 472, 0, 'sports', '#e74c3c'));
  for (let i = 0; i < 14; i++) game.cars.push(spawnTrafficCar(game));
  for (let i = 0; i < 6; i++) {
    const spot = nearestRoadPoint(city, 400 + Math.random() * 2800, 400 + Math.random() * 2800);
    game.cars.push(spawnParkedCar(game, spot.x, spot.y, Math.random() * Math.PI * 2,
      ['sedan', 'pickup', 'van'][Math.floor(Math.random() * 3)]));
  }
  for (let i = 0; i < 24; i++) {
    const spot = nearestRoadPoint(city, 300 + Math.random() * 3000, 300 + Math.random() * 3000);
    game.peds.push(createPed(game, spot.x, spot.y));
  }
  game.missions.start('free-roam');
  return game;
}

let game = buildGame(seedParam || 7);
game.state = 'title';

function showScreen(id) {
  for (const s of ['title-screen', 'pause-menu', 'wasted-screen', 'busted-screen']) {
    document.getElementById(s).style.display = s === id ? 'flex' : 'none';
  }
  hud.showHud(id === null);
}

function startNewGame(seed) {
  game = buildGame(seed);
  game.state = 'playing';
  showScreen(null);
  ensureAudio();
  refreshDebugHooks();
}

function continueGame() {
  const sv = loadSave();
  if (!sv) return;
  game = buildGame(sv.seed);
  game.cash = sv.cash;
  game.health = sv.health;
  game.player.x = sv.x; game.player.y = sv.y; game.player.angle = sv.angle;
  if (sv.missions) game.missions.restore(sv.missions);
  if (sv.inCar && sv.carModel) {
    const car = createCar(sv.x, sv.y, sv.angle, sv.carModel, 'player', sv.carColor);
    car.hp = sv.carHp || 100;
    game.cars.push(car);
    game.player.car = car;
  }
  game.stats = sv.stats || game.stats;
  game.state = 'playing';
  showScreen(null);
  ensureAudio();
  refreshDebugHooks();
}

function refreshDebugHooks() {
  window.__solmar = {
    game,
    teleport(x, y) { game.player.x = x; game.player.y = y; if (game.player.car) { game.player.car.x = x; game.player.car.y = y; game.player.car.vx = 0; game.player.car.vy = 0; } game.camera.x = x; game.camera.y = y; },
    setWanted(n) { game.police.setWanted(n); },
    giveCash(n) { game.cash += n; },
    zone() { return zoneAt(game.player.x, game.player.y); },
    los(x1, y1, x2, y2) { return hasLineOfSight(game, x1, y1, x2, y2); },
  };
}
refreshDebugHooks();

document.getElementById('new-game').addEventListener('click', () => {
  sfx.click();
  startNewGame(seedParam || Math.floor(Math.random() * 100000));
});
document.getElementById('continue-game').addEventListener('click', () => { sfx.click(); continueGame(); });
document.getElementById('how-to').addEventListener('click', () => {
  const h = document.getElementById('howto-text');
  h.style.display = h.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('resume-game').addEventListener('click', () => {
  game.state = 'playing'; showScreen(null); sfx.click();
});
document.getElementById('save-game').addEventListener('click', () => {
  saveGame(game); sfx.cash();
  document.getElementById('pause-stats').textContent = 'Saved. Cash $' + game.cash + ' — seed ' + game.seed;
});
document.getElementById('restart-mission').addEventListener('click', () => {
  game.missions.restartCurrent(); game.state = 'playing'; showScreen(null);
});
document.getElementById('quit-title').addEventListener('click', () => {
  game.state = 'title'; showScreen('title-screen');
  document.getElementById('continue-game').style.display = hasSave() ? 'block' : 'none';
});
document.getElementById('respawn-btn').addEventListener('click', () => {
  game.cash = Math.max(0, game.cash - 100);
  game.health = 100; game.wanted = 0;
  game.player.x = 1800; game.player.y = 2400; game.player.car = null;
  game.enemies = game.enemies.filter((e) => e.type === 'king');
  game.state = 'playing'; showScreen(null);
  saveGame(game);
});
document.getElementById('bail-btn').addEventListener('click', () => {
  game.cash = Math.max(0, game.cash - 150);
  game.health = 100; game.wanted = 0;
  game.player.x = 2400; game.player.y = 300; game.player.car = null;
  game.enemies = [];
  game.state = 'playing'; showScreen(null);
  saveGame(game);
});
document.getElementById('continue-game').style.display = hasSave() ? 'block' : 'none';
showScreen('title-screen');

function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of game.cars) {
    if (c.wrecked) continue;
    const d = dist(game.player.x, game.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function update(dt) {
  const p = game.player;
  game.time += dt;
  // aim from mouse
  const wx = game.camera.x - canvas.width / 2 + input.mouse.x;
  const wy = game.camera.y - canvas.height / 2 + input.mouse.y;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  // pause
  if (input.wasPressed('Escape')) {
    game.state = 'paused';
    document.getElementById('pause-stats').textContent =
      'Cash $' + game.cash + ' — seed ' + game.seed + ' — missions done: ' + game.missions.completed.length;
    showScreen('pause-menu');
    input.postUpdate();
    return;
  }
  if (p.car) {
    const car = p.car;
    const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 0.7 : 0);
    const steer = (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
    driveCar(game, car, { throttle, steer, handbrake: input.down('Space') }, dt);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (input.down('Space') && Math.hypot(car.vx, car.vy) > 150 && Math.random() < dt * 8) {
      game.effects.skid(car.x, car.y, car.angle);
    }
    if (car.wrecked) {
      p.car = null;
      game.effects.addShake(6);
    }
    updateEngine(true, Math.min(1, Math.hypot(car.vx, car.vy) / 500));
  } else {
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const sp = sprint ? 260 : 170;
    let mx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    let my = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.x += (mx / len) * sp * dt;
      p.y += (my / len) * sp * dt;
      p.angle = Math.atan2(my, mx);
    }
    const r = collideCircle(game.city, p.x, p.y, 12);
    p.x = r.x; p.y = r.y;
    updateEngine(false, 0);
    // shooting on foot
    p.fireCd -= dt;
    if (input.mouse.down && p.fireCd <= 0) {
      p.fireCd = 0.18;
      shoot(game, p.x, p.y, p.aim, { fromPlayer: true });
      sfx.shoot();
      game.effects.addShake(1);
    }
  }
  // E: steal / exit / spa / hospital
  if (input.wasPressed('KeyE')) {
    const spa = game.city.landmarkById.spa, hosp = game.city.landmarkById.hospital;
    if (!p.car && game.wanted > 0 && dist(p.x, p.y, spa.cx, spa.cy) < 150 && game.cash >= 150) {
      game.cash -= 150; game.police.clearWanted();
      if (p.car) p.car.hp = 100;
      hud.banner('RESPRAY', 'Wanted cleared — $150', '#2ecc71');
      sfx.cash(); saveGame(game);
    } else if (!p.car && game.health < 100 && dist(p.x, p.y, hosp.cx, hosp.cy) < 150 && game.cash >= 100) {
      game.cash -= 100; game.health = 100;
      hud.banner('TREATED', 'Health restored — $100', '#2ecc71');
      sfx.heal(); saveGame(game);
    } else if (p.car) {
      // exit the car
      const car = p.car;
      p.car = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      const r = collideCircle(game.city, p.x, p.y, 12);
      p.x = r.x; p.y = r.y;
    } else {
      const car = nearestCar(85);
      if (car) {
        car.role = 'player';
        p.car = car;
        game.stats.stolen++;
        hud.setHint('');
        sfx.horn();
        // seen theft raises heat
        const seen = game.enemies.some((e) => dist(e.x, e.y, p.x, p.y) < 500) ||
          game.peds.some((pd) => dist(pd.x, pd.y, p.x, p.y) < 260);
        if (seen && car.role !== 'player') game.police.addWanted(1);
        else if (seen) game.police.addWanted(1);
        hud.banner('CAR STOLEN', MODELS[car.model] ? car.model.toUpperCase() : 'CAR', '#e74c3c');
      }
    }
  }
  // health regen after 8s calm
  if (game.time - game.lastHurt > 8 && game.health < 100) {
    game.health = Math.min(100, game.health + 3 * dt);
  }
  // contextual hint
  let hint = '';
  if (!p.car) {
    const car = nearestCar(85);
    if (car) hint = 'E — Steal car';
    else if (game.wanted > 0 && dist(p.x, p.y, game.city.landmarkById.spa.cx, game.city.landmarkById.spa.cy) < 150) hint = 'E — Respray $150 (clear wanted)';
    else if (game.health < 100 && dist(p.x, p.y, game.city.landmarkById.hospital.cx, game.city.landmarkById.hospital.cy) < 150) hint = 'E — Heal $100';
  } else {
    hint = 'E — Exit car · Space — Handbrake';
  }
  hud.setHint(hint);
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updateEnemies(game, dt);
  game.police.update(dt);
  collideCars(game);
  game.missions.update(dt);
  game.effects.update(dt);
  updateSiren(game.wanted > 0);
  // camera follows player
  game.camera.x += (p.x - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (p.y - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = clamp(game.camera.x, canvas.width / 2 - 200, WORLD - canvas.width / 2 + 200);
  game.camera.y = clamp(game.camera.y, canvas.height / 2 - 200, WORLD - canvas.height / 2 + 200);
  hud.update(game, dt);
  input.postUpdate();
}

let last = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = clamp((t - last) / 1000, 0, 0.05);
  last = t;
  if (game.state === 'playing') {
    update(dt);
  } else if (game.state === 'title') {
    // attract-mode pan over the city
    game.time += dt;
    game.camera.x = 1800 + Math.cos(game.time * 0.05) * 1200;
    game.camera.y = 1800 + Math.sin(game.time * 0.04) * 1000;
    game.effects.update(dt);
    input.postUpdate();
  }
  drawWorld(game, ctx, game.camera, canvas.width, canvas.height);
}
requestAnimationFrame(frame);

if (autostart) startNewGame(seedParam || 7);
