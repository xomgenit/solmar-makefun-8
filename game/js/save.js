// save.js — localStorage save (fresh build)
export const SAVE_KEY = 'solmar-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function saveGame(game) {
  try {
    const data = {
      seed: game.seed,
      cash: game.cash,
      health: game.health,
      x: game.player.x, y: game.player.y, angle: game.player.angle,
      inCar: !!game.player.car,
      carModel: game.player.car ? game.player.car.model : null,
      carColor: game.player.car ? game.player.car.color : null,
      carHp: game.player.car ? game.player.car.hp : 100,
      missions: game.missions ? game.missions.serialize() : null,
      stats: game.stats || {},
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable — ignore */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
