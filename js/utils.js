/**
 * NOVA DRIFT — utils.js
 * Shared utility functions
 */

'use strict';

const Utils = {

  /** Random float between min and max */
  rand: (min, max) => Math.random() * (max - min) + min,

  /** Random int between min and max (inclusive) */
  randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

  /** Clamp value between lo and hi */
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),

  /** Linear interpolation */
  lerp: (a, b, t) => a + (b - a) * t,

  /** Distance between two points */
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),

  /** Normalize angle to 0..2PI */
  normalizeAngle: a => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),

  /** Pick a random element from array */
  pick: arr => arr[Math.floor(Math.random() * arr.length)],

  /** Check circle-circle collision */
  circleCollide: (ax, ay, ar, bx, by, br) =>
    Utils.dist(ax, ay, bx, by) < ar + br,

  /** Format number with commas */
  formatNum: n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),

  /** Ease out cubic */
  easeOut: t => 1 - Math.pow(1 - t, 3),

  /** Ease in-out */
  easeInOut: t => t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2,

  /** Deep clone simple object */
  clone: obj => JSON.parse(JSON.stringify(obj)),

  /** HSL color string */
  hsl: (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`,

  /** Hex to rgba */
  hexToRgba: (hex, a = 1) => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  },

  /** Create a glow gradient for canvas */
  glowGradient: (ctx, x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace(')', ',0.8)').replace('rgb','rgba'));
    g.addColorStop(1, color.replace(')', ',0)').replace('rgb','rgba'));
    return g;
  },

  /** localStorage helpers */
  storage: {
    get: (key, def = null) => {
      try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
      catch { return def; }
    },
    set: (key, val) => {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
    }
  }
};
