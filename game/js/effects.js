// effects.js — particles, tracers, floaters, skids, shake (fresh build)
// CRITICAL: helpers are bound onto the returned fx object itself, so
// game.effects.blood / sparks / skid / tracer / floater / muzzle all exist.
export function createEffects() {
  const fx = { parts: [], tracers: [], floaters: [], skids: [], shake: 0 };
  fx.burst = (x, y, n, color) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
      fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, c: color || '#f1c40f', r: 2 + Math.random() * 3 });
    }
  };
  fx.sparks = (x, y, n) => fx.burst(x, y, n, '#ffd34d');
  fx.smoke = (x, y, n) => {
    for (let i = 0; i < n; i++) {
      fx.parts.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, life: 1 + Math.random(), max: 2, c: '#888', r: 5 + Math.random() * 5 });
    }
  };
  fx.blood = (x, y, n) => fx.burst(x, y, n, '#c0392b');
  fx.tracer = (x1, y1, x2, y2) => { fx.tracers.push({ x1, y1, x2, y2, life: 0.09 }); };
  fx.floater = (x, y, text, color) => { fx.floaters.push({ x, y, text, color: color || '#fff', life: 1.4 }); };
  fx.skid = (x, y, angle) => { fx.skids.push({ x, y, angle, life: 2.5 }); if (fx.skids.length > 120) fx.skids.shift(); };
  fx.muzzle = (x, y) => { fx.burst(x, y, 3, '#ffe9a8'); };
  fx.addShake = (amt) => { fx.shake = Math.min(14, fx.shake + amt); };
  fx.update = (dt) => {
    for (const p of fx.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; p.life -= dt; }
    fx.parts = fx.parts.filter((p) => p.life > 0);
    for (const t of fx.tracers) t.life -= dt;
    fx.tracers = fx.tracers.filter((t) => t.life > 0);
    for (const f of fx.floaters) { f.y -= 34 * dt; f.life -= dt; }
    fx.floaters = fx.floaters.filter((f) => f.life > 0);
    for (const s of fx.skids) s.life -= dt;
    fx.skids = fx.skids.filter((s) => s.life > 0);
    fx.shake = Math.max(0, fx.shake - dt * 30);
  };
  fx.draw = (ctx) => {
    for (const s of fx.skids) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, s.life * 0.3);
      ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      ctx.fillStyle = '#222';
      ctx.fillRect(-8, -2, 16, 4);
      ctx.restore();
    }
    for (const p of fx.parts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (const t of fx.tracers) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, t.life / 0.09);
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
      ctx.restore();
    }
    for (const f of fx.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  };
  return fx;
}
export function updateEffects(fx, dt) { if (fx && fx.update) fx.update(dt); }
export function drawEffects(ctx, fx) { if (fx && fx.draw) fx.draw(ctx); }
