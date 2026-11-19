// audio.js — WebAudio-synthesised sound, no assets (fresh build)
let ctx = null;
let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;

export function ensureAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) { /* ignore */ }
}

export const sfx = {
  shoot() { tone(900, 0.08, 'square', 0.06, 200); },
  crash() { tone(120, 0.2, 'sawtooth', 0.1, 50); },
  blip() { tone(660, 0.07, 'sine', 0.06); },
  cash() { tone(880, 0.09, 'sine', 0.08); setTimeout(() => tone(1320, 0.12, 'sine', 0.08), 90); },
  horn() { tone(330, 0.25, 'square', 0.05, 330); },
  wasted() { tone(220, 0.6, 'sawtooth', 0.1, 55); },
  click() { tone(500, 0.05, 'sine', 0.05); },
  heal() { tone(520, 0.15, 'sine', 0.06, 780); },
};

export function updateEngine(driving, speed01) {
  if (!ctx) return;
  try {
    if (driving && !engineOsc) {
      engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth'; engineGain.gain.value = 0.02;
      engineOsc.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
    }
    if (engineOsc) {
      engineOsc.frequency.setValueAtTime(60 + speed01 * 140, ctx.currentTime);
      engineGain.gain.setValueAtTime(driving ? 0.02 + speed01 * 0.03 : 0, ctx.currentTime);
    }
  } catch (e) { /* ignore */ }
}

export function updateSiren(active) {
  if (!ctx) return;
  try {
    if (active && !sirenOsc) {
      sirenOsc = ctx.createOscillator(); sirenGain = ctx.createGain();
      sirenOsc.type = 'sine'; sirenGain.gain.value = 0.015;
      sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
      sirenOsc.start();
    }
    if (sirenOsc) {
      sirenOsc.frequency.setValueAtTime(active ? 700 + Math.sin(performance.now() / 300) * 250 : 700, ctx.currentTime);
      sirenGain.gain.setValueAtTime(active ? 0.015 : 0, ctx.currentTime);
    }
  } catch (e) { /* ignore */ }
}

export function stopAllLoops() {
  try {
    if (engineOsc) { engineOsc.stop(); engineOsc = null; }
    if (sirenOsc) { sirenOsc.stop(); sirenOsc = null; }
  } catch (e) { /* ignore */ }
}
