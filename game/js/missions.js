// missions.js — mission registry + hook for Builder 2 (fresh build)
// Def shape: { id, title, brief, reward, next, start(game,ms),
//   update(game,ms,dt) -> 'done'|'failed'|undefined, onEnemyDown(game,ms,enemy) }
// Per-mission state lives in ms.current.state (fresh {} per start).
// pierPaid lives in the missions closure, NOT in per-start state.
import { dist } from './util.js';
import { saveGame } from './save.js';

export const MISSION_DEFS = {
  'free-roam': {
    id: 'free-roam', title: 'FREE ROAM', brief: 'Explore Solmar Bay. Visit the Pier for a bonus.',
    reward: 0, next: null,
    start(game, ms) { ms.setObjective('Visit the Pier', game.city.landmarkById.pier); },
    update(game, ms, dt) {
      const pier = game.city.landmarkById.pier;
      const p = game.player;
      if (!ms.pierPaid && dist(p.x, p.y, pier.cx, pier.cy) < 130) {
        ms.pierPaid = true;
        game.cash += 50;
        if (game.hud) game.hud.banner('PIER BONUS', '+$50', '#f1c40f');
        if (game.effects) game.effects.floater(p.x, p.y - 30, '+$50', '#f1c40f');
        if (game.sfx) game.sfx('cash');
        saveGame(game);
      }
      return undefined;
    },
  },
};

export function createMissions(game) {
  const ms = {
    current: null, currentId: null, pierPaid: false, data: {},
    get completed() { return ms._completed; },
    _completed: [],
    start(id) {
      const def = MISSION_DEFS[id];
      if (!def) return;
      ms.current = { id, def, state: {} };
      ms.currentId = id;
      if (game.hud) game.hud.banner(def.title, def.brief, '#f1c40f');
      if (def.start) def.start(game, ms);
    },
    completeCurrent() {
      const cur = ms.current;
      if (!cur) return;
      const def = cur.def;
      // clear state FIRST, then pay — so a reward can never pay twice
      ms.current = null;
      ms.currentId = null;
      if (!ms._completed.includes(def.id)) ms._completed.push(def.id);
      if (def.reward) {
        game.cash += def.reward;
        if (game.effects) game.effects.floater(game.player.x, game.player.y - 30, '+$' + def.reward, '#2ecc71');
        if (game.sfx) game.sfx('cash');
      }
      if (game.hud) game.hud.banner('MISSION COMPLETE', def.title + (def.reward ? '  +$' + def.reward : ''), '#2ecc71');
      saveGame(game);
      if (def.next) ms.start(def.next);
      else ms.start('free-roam');
    },
    failCurrent(reason) {
      const cur = ms.current;
      if (!cur) return;
      ms.current = null; ms.currentId = null;
      if (game.hud) game.hud.banner('MISSION FAILED', reason || cur.def.title, '#e74c3c');
      ms.start(cur.id); // restart in place, chain intact
    },
    restartCurrent() {
      const id = ms.currentId;
      if (!id) return;
      ms.current = null; ms.currentId = null;
      ms.start(id);
    },
    setObjective(text, marker) {
      game.objective = { text, marker: marker || null };
      if (game.hud) game.hud.setObjective(game.missions.current ? game.missions.current.def.title : 'FREE ROAM', text);
    },
    onEnemyDown(enemy) {
      if (ms.current && ms.current.def.onEnemyDown) ms.current.def.onEnemyDown(game, ms, enemy);
    },
    update(dt) {
      if (!ms.current) return;
      const r = ms.current.def.update ? ms.current.def.update(game, ms, dt) : undefined;
      if (r === 'done') ms.completeCurrent();
      else if (r === 'failed') ms.failCurrent();
    },
    list() { return Object.values(MISSION_DEFS).map((d) => ({ id: d.id, title: d.title, reward: d.reward })); },
    isComplete(id) { return ms._completed.includes(id); },
    reset() {
      ms.current = null; ms.currentId = null; ms.pierPaid = false; ms.data = {}; ms._completed = [];
    },
    serialize() {
      return { completed: [...ms._completed], currentId: ms.currentId, pierPaid: ms.pierPaid, data: ms.data };
    },
    restore(data) {
      if (!data) return;
      ms._completed = data.completed || [];
      ms.pierPaid = !!data.pierPaid;
      ms.data = data.data || {};
      if (data.currentId && MISSION_DEFS[data.currentId]) {
        ms.current = { id: data.currentId, def: MISSION_DEFS[data.currentId], state: {} };
        ms.currentId = data.currentId;
        const def = MISSION_DEFS[data.currentId];
        if (def.start) def.start(game, ms);
      }
    },
  };
  return ms;
}
