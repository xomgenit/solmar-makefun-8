// util.js — math + seeded RNG + collision helpers (fresh, authored for SOLMAR)
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function pushCircleOutOfRect(x, y, r, rect) {
  const nx = clamp(x, rect.x, rect.x + rect.w);
  const ny = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nx, dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x, y, hit: false };
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, hit: true };
  }
  const pl = x - rect.x, pr = rect.x + rect.w - x;
  const pt = y - rect.y, pb = rect.y + rect.h - y;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: rect.x - r, y, hit: true };
  if (m === pr) return { x: rect.x + rect.w + r, y, hit: true };
  if (m === pt) return { x, y: rect.y - r, hit: true };
  return { x, y: rect.y + rect.h + r, hit: true };
}
function segmentHitsRect(x1, y1, x2, y2, rc) {
  // slab method
  const dx = x2 - x1, dy = y2 - y1;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rc.x || x1 > rc.x + rc.w) return false;
  } else {
    let t1 = (rc.x - x1) / dx, t2 = (rc.x + rc.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rc.y || y1 > rc.y + rc.h) return false;
  } else {
    let t1 = (rc.y - y1) / dy, t2 = (rc.y + rc.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}
export function segmentHitsRects(x1, y1, x2, y2, rects) {
  for (const rc of rects) if (segmentHitsRect(x1, y1, x2, y2, rc)) return true;
  return false;
}
export const pointInRect = (x, y, rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
