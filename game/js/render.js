// render.js — canvas world renderer (fresh build)
import { drawCar } from './vehicles.js';
import { drawEnemy } from './combat.js';
import { ROADS, PIER, zoneAt } from './city.js';

export function drawWorld(game, ctx, cam, vw, vh) {
  ctx.fillStyle = '#2d5a2d';
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  const shx = (Math.random() - 0.5) * game.effects.shake;
  const shy = (Math.random() - 0.5) * game.effects.shake;
  ctx.translate(-cam.x + vw / 2 + shx, -cam.y + vh / 2 + shy);
  const city = game.city;
  const view = { x0: cam.x - vw / 2 - 60, y0: cam.y - vh / 2 - 60, x1: cam.x + vw / 2 + 60, y1: cam.y + vh / 2 + 60 };
  // ground: grass, sand strip, sea
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(3100, view.y0, 350, view.y1 - view.y0);
  ctx.fillStyle = '#2e6f9e';
  ctx.fillRect(3450, view.y0, 200, view.y1 - view.y0);
  // roads
  ctx.fillStyle = '#3a3a3f';
  for (const r of ROADS) {
    ctx.fillRect(r - 45, view.y0, 90, view.y1 - view.y0);
    ctx.fillRect(view.x0, r - 45, view.x1 - view.x0, 90);
  }
  // center dashes
  ctx.strokeStyle = '#d8c25a';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const r of ROADS) {
    ctx.beginPath(); ctx.moveTo(r, view.y0); ctx.lineTo(r, view.y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(view.x0, r); ctx.lineTo(view.x1, r); ctx.stroke();
  }
  ctx.setLineDash([]);
  // crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of ROADS) for (const ry of ROADS) {
    if (rx < view.x0 - 60 || rx > view.x1 + 60 || ry < view.y0 - 60 || ry > view.y1 + 60) continue;
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(rx - 40 + i * 16, ry - 52, 8, 14);
      ctx.fillRect(rx - 40 + i * 16, ry + 38, 8, 14);
    }
  }
  // pier deck
  ctx.fillStyle = '#8a6d4b';
  ctx.fillRect(PIER.x, PIER.y, PIER.w, PIER.h);
  ctx.strokeStyle = '#6b543a';
  ctx.lineWidth = 2;
  for (let x = PIER.x; x <= PIER.x + PIER.w; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, PIER.y); ctx.lineTo(x, PIER.y + PIER.h); ctx.stroke();
  }
  // buildings
  for (const b of city.buildings) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // landmark buildings + labels
  for (const b of city.blocking) {
    ctx.fillStyle = b.lm === 'bank' ? '#c9a227' : b.lm === 'hospital' ? '#e8e8e8' : '#7a6a55';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // palms
  for (const palm of city.palms) {
    if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(palm.x - 2, palm.y - 2, 4, 6);
    ctx.fillStyle = '#2e8b57';
    ctx.beginPath(); ctx.arc(palm.x, palm.y - 4, 9, 0, Math.PI * 2); ctx.fill();
  }
  // zone + landmark labels
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const lm of Object.values(city.landmarkById)) {
    if (lm.cx < view.x0 || lm.cx > view.x1 || lm.cy < view.y0 || lm.cy > view.y1) continue;
    ctx.fillText(lm.name, lm.cx, lm.cy - 62);
  }
  // mission beacon
  if (game.objective && game.objective.marker) {
    const m = game.objective.marker;
    const pulse = 26 + Math.sin(game.time * 4) * 6;
    ctx.strokeStyle = 'rgba(241,196,15,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.cx, m.cy, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(m.cx, m.cy, 6, 0, Math.PI * 2); ctx.fill();
  }
  // cars, peds, enemies, player
  for (const car of game.cars) drawCar(ctx, car, game.time);
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 5, ped.y + Math.sin(ped.angle) * 5, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const e of game.enemies) drawEnemy(ctx, e, game.time);
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(6, -2, 14, 4); // gun
  ctx.restore();
  // effects on top
  game.effects.draw(ctx);
  ctx.restore();
}
