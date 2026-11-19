// vehicles.js — car models, arcade driving, traffic, parked cars (fresh build)
import { clamp, angleDiff, dist } from './util.js';
import { ROADS, nearestRoadPoint } from './city.js';

export const MODELS = {
  sedan: { w: 48, h: 22, accel: 320, max: 350, colors: ['#c0392b', '#2980b9', '#7f8c8d', '#16a085'] },
  sports: { w: 50, h: 21, accel: 460, max: 540, colors: ['#e74c3c', '#f1c40f', '#8e44ad'] },
  taxi: { w: 48, h: 22, accel: 320, max: 340, colors: ['#f39c12'] },
  van: { w: 54, h: 24, accel: 240, max: 280, colors: ['#ecf0f1', '#95a5a6'] },
  pickup: { w: 52, h: 23, accel: 300, max: 330, colors: ['#27ae60', '#d35400'] },
  cruiser: { w: 50, h: 22, accel: 420, max: 470, colors: ['#1a1a2e'] },
};

export function createCar(x, y, angle, model, role, color) {
  const m = MODELS[model] || MODELS.sedan;
  return {
    x, y, angle, vx: 0, vy: 0, model, role, hp: 100, wrecked: false,
    color: color || m.colors[Math.floor(Math.random() * m.colors.length)],
    axis: Math.random() < 0.5 ? 'h' : 'v', dir: Math.random() < 0.5 ? 1 : -1,
    stuckT: 0, lastX: x, lastY: y, reverseT: 0,
  };
}

export function driveCar(game, car, input, dt) {
  if (car.wrecked) return;
  const m = MODELS[car.model];
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  fwd += (input.throttle || 0) * m.accel * dt;
  // drag: coasts down fast with no throttle, mild rolling drag otherwise
  fwd *= Math.exp(-dt * (input.throttle ? 0.12 : 0.9));
  const maxF = m.max, maxR = 130;
  fwd = clamp(fwd, -maxR, maxF);
  const steer = (input.steer || 0);
  const spd = Math.abs(fwd);
  if (spd > 5) {
    car.angle += steer * 2.3 * dt * (fwd < 0 ? -1 : 1) * clamp(spd / 180, 0.25, 1);
  }
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  // decompose velocity: forward + lateral; lateral decays (grip), less with handbrake
  const lat = -car.vx * nfy + car.vy * nfx;
  const latDecay = Math.exp(-dt * (input.handbrake ? 1.6 : 9));
  const newLat = lat * latDecay;
  car.vx = nfx * fwd - nfy * newLat;
  car.vy = nfy * fwd + nfx * newLat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const p = game.city ? null : null;
  if (game.collideCircle) {
    const r = game.collideCircle(game.city, car.x, car.y, 20);
    if (r.hit) {
      const impact = Math.hypot(car.vx, car.vy);
      if (impact > 260) {
        damageCar(game, car, (impact - 260) / 14);
        if (game.effects) game.effects.sparks(car.x, car.y, 8);
      }
      car.x = r.x; car.y = r.y;
      car.vx *= 0.4; car.vy *= 0.4;
    }
  }
}

export function damageCar(game, car, amt) {
  if (car.wrecked) return;
  car.hp -= amt;
  if (car.hp <= 0) {
    car.hp = 0; car.wrecked = true; car.vx = 0; car.vy = 0;
    if (game.effects) game.effects.smoke(car.x, car.y, 10);
  }
}

export function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 44 && d > 0.01) {
        const nx = dx / d, ny = dy / d;
        const overlap = (44 - d) / 2;
        const aParked = a.role === 'parked', bParked = b.role === 'parked';
        if (!aParked) { a.x -= nx * overlap; a.y -= ny * overlap; }
        if (!bParked) { b.x += nx * overlap; b.y += ny * overlap; }
        const rel = Math.abs((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
        if (rel > 140) {
          if (!aParked) damageCar(game, a, rel / 22);
          if (!bParked) damageCar(game, b, rel / 22);
          if (game.effects) game.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
          if (game.sfx) game.sfx('crash');
        }
        // simple velocity exchange along normal
        const avn = a.vx * nx + a.vy * ny, bvn = b.vx * nx + b.vy * ny;
        if (!aParked) { a.vx += (bvn - avn) * 0.5 * nx; a.vy += (bvn - avn) * 0.5 * ny; }
        if (!bParked) { b.vx += (avn - bvn) * 0.5 * nx; b.vy += (avn - bvn) * 0.5 * ny; }
      }
    }
  }
}

export function spawnTrafficCar(game) {
  const p = game.player;
  const modelNames = ['sedan', 'taxi', 'van', 'pickup', 'sedan'];
  const model = modelNames[Math.floor(Math.random() * modelNames.length)];
  const axis = Math.random() < 0.5 ? 'h' : 'v';
  const road = ROADS[Math.floor(Math.random() * ROADS.length)];
  const dir = Math.random() < 0.5 ? 1 : -1;
  const lane = 22;
  let x, y, angle;
  if (axis === 'h') {
    x = clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 400), 100, 3400);
    y = road + (dir === 1 ? lane : -lane);
    angle = dir === 1 ? 0 : Math.PI;
  } else {
    y = clamp(p.y + (Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 400), 100, 3400);
    x = road + (dir === 1 ? -lane : lane);
    angle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  }
  const car = createCar(x, y, angle, model, 'traffic');
  car.axis = axis; car.dir = dir;
  return car;
}

export function spawnParkedCar(game, x, y, angle, model, color) {
  const car = createCar(x, y, angle, model, 'parked', color);
  return car;
}

export function updateTraffic(game, dt) {
  const p = game.player;
  for (const car of game.cars) {
    if (car.role !== 'traffic') continue;
    if (car.wrecked) continue;
    // recycle far cars near the player
    if (dist(car.x, car.y, p.x, p.y) > 1700) {
      const nc = spawnTrafficCar(game);
      car.x = nc.x; car.y = nc.y; car.angle = nc.angle; car.axis = nc.axis; car.dir = nc.dir;
      car.model = nc.model; car.color = nc.color; car.hp = 100; car.vx = 0; car.vy = 0;
      continue;
    }
    // obstacle ahead?
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    let blocked = false;
    for (const o of game.cars) {
      if (o === car || o.wrecked) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 95 && side < 30) { blocked = true; break; }
    }
    const targetSpeed = blocked ? 0 : 120;
    const cur = Math.hypot(car.vx, car.vy);
    const throttle = cur < targetSpeed ? 0.7 : 0;
    // turn at intersections sometimes
    const nearX = ROADS.some((r) => Math.abs(car.x - r) < 26);
    const nearY = ROADS.some((r) => Math.abs(car.y - r) < 26);
    if (nearX && nearY && Math.random() < dt * 0.5) {
      if (car.axis === 'h') {
        car.axis = 'v'; car.dir = Math.random() < 0.5 ? 1 : -1;
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        car.y = ROADS.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
      } else {
        car.axis = 'h'; car.dir = Math.random() < 0.5 ? 1 : -1;
        car.angle = car.dir === 1 ? 0 : Math.PI;
        car.x = ROADS.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      }
      car.vx = 0; car.vy = 0;
    }
    driveCar(game, car, { throttle, steer: 0, handbrake: false }, dt);
    // keep traffic on its lane: nudge back toward road line
    if (car.axis === 'h') {
      const road = ROADS.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
      const wantY = road + (car.dir === 1 ? 22 : -22);
      car.y += (wantY - car.y) * Math.min(1, dt * 1.5);
    } else {
      const road = ROADS.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      const wantX = road + (car.dir === 1 ? -22 : 22);
      car.x += (wantX - car.x) * Math.min(1, dt * 1.5);
    }
  }
}

export function drawCar(ctx, car, time) {
  const m = MODELS[car.model];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // wheels
  ctx.fillStyle = '#111';
  const w = m.w, h = m.h;
  ctx.fillRect(-w / 2 + 4, -h / 2 - 3, 12, 5);
  ctx.fillRect(w / 2 - 16, -h / 2 - 3, 12, 5);
  ctx.fillRect(-w / 2 + 4, h / 2 - 2, 12, 5);
  ctx.fillRect(w / 2 - 16, h / 2 - 2, 12, 5);
  // body
  ctx.fillStyle = car.wrecked ? '#333' : car.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  ctx.fill();
  if (car.model === 'cruiser') {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-6, -h / 2, 12, h);
    // light bar flashing
    const on = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2222' : '#2266ff';
    ctx.fillRect(-4, -h / 2 - 2, 8, 5);
    ctx.fillStyle = on ? '#2266ff' : '#ff2222';
    ctx.fillRect(-4, h / 2 - 3, 8, 5);
  }
  // windshield + roof
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(w / 2 - 16, -h / 2 + 4, 8, h - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-4, -h / 2 + 4, 12, h - 8);
  if (car.model === 'sports') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-w / 2 - 2, -h / 2 + 2, 4, h - 4);
  }
  // headlights
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 4);
  ctx.fillRect(w / 2 - 2, h / 2 - 7, 3, 4);
  ctx.restore();
  if (car.wrecked) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(car.x, car.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
