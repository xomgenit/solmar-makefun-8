// missions.js — Vera's 5-job story chain + stash system (retry 8, Builder 2)
// Def shape: { id, title, brief, reward, next, start(game,ms),
//   update(game,ms,dt) -> 'done'|'failed'|undefined, onEnemyDown(game,ms,enemy) }
// Per-mission state lives in ms.current.state (fresh {} per start).
// pierPaid lives in the missions closure, NOT in per-start state.
// Stash + sports-unlock state lives in ms.data (persisted via serialize/restore).
import { dist } from './util.js';
import { saveGame } from './save.js';
import { spawnParkedCar } from './vehicles.js';
import { spawnEnemy } from './combat.js';

export const STASHES = [
  { x: 1050, y: 1500, zone: 'OLD TOWN' }, // (1050,1500) — verified 0px collide push, seed 7
  { x: 2250, y: 900, zone: 'DOWNTOWN' },       // verified 0px collide push, seed 7
  { x: 2850, y: 2100, zone: 'EAST HARBOUR' },   // verified 0px collide push, seed 7
];
const STASH_REWARD = 300;
const GOLD_CAR = { x: 1500, y: 1050, color: '#f1c40f' }; // road south of Vera's Garage, verified 0px push

function mdata(ms) {
  if (!ms.data) ms.data = {};
  if (!Array.isArray(ms.data.stashesTaken)) ms.data.stashesTaken = [];
  if (ms.data.sportsUnlocked === undefined) ms.data.sportsUnlocked = false;
  return ms.data;
}

function checkStashes(game, ms) {
  const d = mdata(ms);
  const p = game.player;
  STASHES.forEach((s, i) => {
    if (d.stashesTaken.includes(i)) return;
    if (dist(p.x, p.y, s.x, s.y) < 60) {
      d.stashesTaken.push(i);
      game.cash += STASH_REWARD;
      if (game.hud) game.hud.banner('HIDDEN STASH', '+$' + STASH_REWARD, '#2ecc71');
      if (game.effects) game.effects.floater(p.x, p.y - 30, '+$' + STASH_REWARD, '#2ecc71');
      if (game.sfx) game.sfx('cash');
      saveGame(game);
    }
  });
}

function ensureSportsCar(game, ms) {
  const d = mdata(ms);
  if (!d.sportsUnlocked) return;
  if (game.cars.some((c) => c.model === 'sports' && c.color === GOLD_CAR.color)) return;
  game.cars.push(spawnParkedCar(game, GOLD_CAR.x, GOLD_CAR.y, 0, 'sports', GOLD_CAR.color));
}

const KING_SPOTS_W1 = [[3350, 1800], [3500, 1800]];
const KING_SPOTS_W2 = [[3400, 1800], [3520, 1800]];

function spawnKings(game, spots) {
  for (const [x, y] of spots) spawnEnemy(game, x, y, 'king');
}

export const MISSION_DEFS = {
  'first-wheels': {
    id: 'first-wheels', title: 'FIRST WHEELS', brief: 'Steal a car and drive it to Vera\'s Garage.',
    reward: 250, next: 'the-pickup',
    start(game, ms) { ms.setObjective('Steal a car, drive to Vera\'s Garage', game.city.landmarkById.garage); },
    update(game, ms, dt) {
      checkStashes(game, ms);
      const g = game.city.landmarkById.garage;
      if (game.player.car && dist(game.player.x, game.player.y, g.cx, g.cy) < 200) return 'done';
      return undefined;
    },
  },
  'the-pickup': {
    id: 'the-pickup', title: 'THE PICKUP', brief: 'Pick up the package at East Harbour Docks, deliver it to Vera\'s Diner.',
    reward: 400, next: 'hot-delivery',
    start(game, ms) { ms.setObjective('Pick up the package at East Harbour Docks', game.city.landmarkById.docks); },
    update(game, ms, dt) {
      checkStashes(game, ms);
      const st = ms.current.state;
      const p = game.player;
      if (!st.picked) {
        const d = game.city.landmarkById.docks;
        if (dist(p.x, p.y, d.cx, d.cy) < 120) {
          st.picked = true;
          if (game.hud) game.hud.banner('PACKAGE SECURED', 'Deliver it to Vera\'s Diner', '#f1c40f');
          ms.setObjective('Deliver the package to Vera\'s Diner', game.city.landmarkById.diner);
        }
      } else {
        const din = game.city.landmarkById.diner;
        if (dist(p.x, p.y, din.cx, din.cy) < 200) return 'done';
      }
      return undefined;
    },
  },
  'hot-delivery': {
    id: 'hot-delivery', title: 'HOT DELIVERY', brief: 'Timed run: deliver to the Docks in 90 seconds.',
    reward: 600, next: 'payback-pier',
    start(game, ms) {
      ms.current.state.t = 90;
      ms.setObjective('Deliver to the Docks — 90s left', game.city.landmarkById.docks);
    },
    update(game, ms, dt) {
      checkStashes(game, ms);
      const st = ms.current.state;
      st.t -= dt;
      const d = game.city.landmarkById.docks;
      const left = Math.max(0, Math.ceil(st.t));
      ms.setObjective('Deliver to the Docks — ' + left + 's left', d);
      if (dist(game.player.x, game.player.y, d.cx, d.cy) < 120) {
        mdata(ms).sportsUnlocked = true; // gold sports car unlocks on M3 completion
        return 'done';
      }
      if (st.t <= 0) return 'failed'; // timeout: restart in place, $0 paid
      return undefined;
    },
  },
  'payback-pier': {
    id: 'payback-pier', title: 'PAYBACK AT THE PIER', brief: 'Eliminate the Harbor Kings on the pier (4).',
    reward: 800, next: 'solmar-score',
    start(game, ms) {
      ensureSportsCar(game, ms);
      game.enemies = game.enemies.filter((e) => e.type !== 'king'); // never duplicate kings on restart
      const st = ms.current.state;
      st.wave = 1; st.kills = 0;
      spawnKings(game, KING_SPOTS_W1);
      ms.setObjective('Eliminate the Harbor Kings (4 left)', game.city.landmarkById.pier);
    },
    update(game, ms, dt) {
      checkStashes(game, ms);
      const st = ms.current.state;
      const aliveKings = game.enemies.filter((e) => e.type === 'king').length;
      // anti-stall: wasted/busted clears enemies — respawn the current wave
      if (aliveKings === 0 && st.kills < 4) {
        const spots = st.wave === 2 ? KING_SPOTS_W2 : KING_SPOTS_W1;
        spawnKings(game, spots.slice(0, Math.min(2, 4 - st.kills)));
      }
      const left = 4 - st.kills;
      ms.setObjective('Eliminate the Harbor Kings (' + left + ' left)', game.city.landmarkById.pier);
      if (st.kills >= 4) return 'done';
      return undefined;
    },
    onEnemyDown(game, ms, enemy) {
      if (enemy.type !== 'king') return;
      const st = ms.current.state;
      st.kills = (st.kills || 0) + 1;
      // wave-2 detection reads state.wave, NOT the live king count:
      // one burst can kill a freshly spawned wave-2 king too.
      if (st.kills === 2 && st.wave === 1) {
        st.wave = 2;
        spawnKings(game, KING_SPOTS_W2);
        if (game.hud) game.hud.banner('REINFORCEMENTS', 'More Kings on the pier!', '#e74c3c');
      }
    },
  },
  'solmar-score': {
    id: 'solmar-score', title: 'THE SOLMAR SCORE', brief: 'Crack the vault at Solmar National Bank, then lose the heat.',
    reward: 1500, next: null,
    start(game, ms) {
      ensureSportsCar(game, ms);
      const st = ms.current.state;
      st.phase = 'channel'; st.prog = 0;
      ms.setObjective('Crack the vault — stay close to the bank', game.city.landmarkById.bank);
    },
    update(game, ms, dt) {
      checkStashes(game, ms);
      const st = ms.current.state;
      const bank = game.city.landmarkById.bank;
      if (st.phase === 'channel') {
        if (dist(game.player.x, game.player.y, bank.cx, bank.cy) < 200) {
          st.prog += dt / 5;
          const pct = Math.min(100, Math.floor(st.prog * 100));
          ms.setObjective('Crack the vault — stay close to the bank (' + pct + '%)', bank);
          if (st.prog >= 1) {
            st.phase = 'escape';
            if (game.police) game.police.addWanted(2); // vault alarm: +2 stars
            if (game.hud) game.hud.banner('ALARM!', 'Lose the heat to finish the Score', '#e74c3c');
            ms.setObjective('Escape — lose the heat', null);
          }
        } else {
          st.prog = 0; // stepping away resets the channel
          ms.setObjective('Crack the vault — stay close to the bank (0%)', bank);
        }
      } else {
        if (game.wanted === 0) return 'done';
      }
      return undefined;
    },
  },
  'free-roam': {
    id: 'free-roam', title: 'FREE ROAM', brief: 'Explore Solmar Bay. Visit the Pier for a bonus.',
    reward: 0, next: null,
    start(game, ms) { ensureSportsCar(game, ms); ms.setObjective('Visit the Pier', game.city.landmarkById.pier); },
    update(game, ms, dt) {
      checkStashes(game, ms);
      ensureSportsCar(game, ms);
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
    stashList() {
      const d = mdata(ms);
      return STASHES.map((s, i) => ({ ...s, taken: d.stashesTaken.includes(i) }));
    },
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
