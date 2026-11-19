// hud.js — DOM HUD + round minimap (fresh build)
import { zoneAt } from './city.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    showHud(on) {
      const h = el('hud');
      if (h) h.style.display = on ? 'block' : 'none';
    },
    banner(title, sub, color) {
      const b = el('banner');
      if (!b) return;
      el('banner-title').textContent = title;
      el('banner-sub').textContent = sub || '';
      b.style.borderColor = color || '#f1c40f';
      b.style.color = color || '#f1c40f';
      b.classList.add('show');
      clearTimeout(hud._bt);
      hud._bt = setTimeout(() => b.classList.remove('show'), 2600);
    },
    setHint(text) {
      const h = el('hint');
      if (h) h.textContent = text || '';
    },
    setObjective(title, text) {
      const t = el('objective-title'), x = el('objective-text');
      if (t) t.textContent = title || '';
      if (x) x.textContent = text || '';
    },
    update(game, dt) {
      const hp = el('health-fill'), ht = el('health-text');
      if (hp) hp.style.width = Math.max(0, game.health) + '%';
      if (ht) ht.textContent = Math.ceil(game.health);
      const cash = el('cash');
      if (cash) cash.textContent = '$' + game.cash;
      const stars = el('stars');
      if (stars) stars.textContent = '★'.repeat(game.wanted) + '☆'.repeat(5 - game.wanted);
      const zone = el('zone');
      if (zone) zone.textContent = zoneAt(game.player.x, game.player.y);
      const spd = el('speed'), sm = el('speedometer'), ch = el('car-health');
      if (game.player.car) {
        const kmh = Math.round(Math.hypot(game.player.car.vx, game.player.car.vy) * 0.72);
        if (spd) spd.textContent = kmh + ' km/h';
        if (sm) sm.style.display = 'block';
        if (ch) ch.textContent = 'CAR ' + Math.ceil(game.player.car.hp) + '%';
      } else {
        if (sm) sm.style.display = 'none';
      }
      hud.drawMinimap(game);
    },
    drawMinimap(game) {
      const cv = el('minimap');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      const S = cv.width, scale = S / 3600;
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#1d3a24';
      ctx.fillRect(0, 0, S, S);
      // sea + beach
      ctx.fillStyle = '#2e6f9e';
      ctx.fillRect(3450 * scale, 0, S, S);
      ctx.fillStyle = '#d9c27a';
      ctx.fillRect(3100 * scale, 0, (3450 - 3100) * scale, S);
      // roads
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      for (let k = 0; k < 12; k++) {
        const r = (150 + 300 * k) * scale;
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r, S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(S, r); ctx.stroke();
      }
      const dot = (x, y, c, r) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x * scale, y * scale, r, 0, Math.PI * 2); ctx.fill();
      };
      // mission marker
      if (game.objective && game.objective.marker) {
        const pulse = 3 + Math.sin(game.time * 5) * 1.5;
        dot(game.objective.marker.cx, game.objective.marker.cy, '#f1c40f', pulse + 2);
      }
      for (const e of game.enemies) dot(e.x, e.y, e.type === 'king' ? '#ff4444' : '#4488ff', 2.5);
      for (const c of game.cars) if (c.role === 'cruiser') dot(c.x, c.y, '#4488ff', 2.5);
      dot(game.player.x, game.player.y, '#ffffff', 3.5);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.stroke();
    },
  };
  return hud;
}
