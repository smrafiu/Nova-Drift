/**
 * NOVA DRIFT — audio.js
 * Procedural sound effects via Web Audio API (no external files needed)
 */

'use strict';

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;

  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.35;
        masterGain.connect(ctx.destination);
      } catch (e) { enabled = false; }
    }
    return ctx;
  }

  function resumeCtx() {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume();
  }

  /** Generic tone burst */
  function tone(freq, type, duration, gainVal, fadeOut = true) {
    if (!enabled) return;
    const c = getCtx();
    if (!c) return;
    resumeCtx();

    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(gainVal, c.currentTime);
    if (fadeOut) gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  }

  /** Noise burst (explosion) */
  function noise(duration, gainVal = 0.4, freq = 200) {
    if (!enabled) return;
    const c = getCtx();
    if (!c) return;
    resumeCtx();

    const bufSize = c.sampleRate * duration;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(gainVal, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(c.currentTime);
  }

  return {
    shoot() {
      tone(880, 'square', 0.08, 0.15);
      tone(660, 'sawtooth', 0.06, 0.1);
    },
    enemyDie() {
      noise(0.25, 0.35, 300);
      tone(120, 'sawtooth', 0.2, 0.2);
    },
    bigExplosion() {
      noise(0.5, 0.5, 150);
      tone(60, 'sawtooth', 0.4, 0.25);
    },
    playerHit() {
      noise(0.2, 0.4, 500);
      tone(200, 'square', 0.15, 0.3);
    },
    collectGem() {
      tone(1200, 'sine', 0.1, 0.18);
      tone(1600, 'sine', 0.08, 0.12);
    },
    collectPowerup() {
      [600, 800, 1000, 1200].forEach((f, i) => {
        const c = getCtx();
        if (!c) return;
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(masterGain);
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.18, c.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.07 + 0.12);
        osc.start(c.currentTime + i * 0.07);
        osc.stop(c.currentTime + i * 0.07 + 0.12);
      });
    },
    waveClear() {
      [400, 600, 800, 1200].forEach((f, i) => {
        const c = getCtx();
        if (!c) return;
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(masterGain);
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.22, c.currentTime + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.09 + 0.18);
        osc.start(c.currentTime + i * 0.09);
        osc.stop(c.currentTime + i * 0.09 + 0.25);
      });
    },
    novaBomb() {
      noise(0.8, 0.6, 100);
      tone(80, 'sawtooth', 0.6, 0.3);
      tone(160, 'square', 0.4, 0.2);
    },
    gameOver() {
      [400, 300, 200, 100].forEach((f, i) => {
        const c = getCtx();
        if (!c) return;
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(masterGain);
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.25, c.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.18 + 0.3);
        osc.start(c.currentTime + i * 0.18);
        osc.stop(c.currentTime + i * 0.18 + 0.35);
      });
    },
    resume: resumeCtx
  };
})();
