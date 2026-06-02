/**
 * NOVA DRIFT — input.js  v1.2
 * Three control modes:
 *   'joystick' — virtual joystick fixed at screen centre
 *   'drag'     — drag from touch origin (relative, like v1.1)
 *   'follow'   — ship flies toward finger position directly
 *
 * Desktop: WASD / Arrow Keys always active.
 */

'use strict';

const Input = {
  keys:        {},
  moveX:       0,
  moveY:       0,
  bombPressed: false,

  // Current mode — persisted in localStorage
  mode: 'drag',   // 'joystick' | 'drag' | 'follow'

  // Internal touch state
  _touchId:     null,
  _touchStartX: 0,
  _touchStartY: 0,
  _touchCurX:   0,
  _touchCurY:   0,
  _touchActive: false,

  // Joystick mode — fixed centre position
  _joyBaseX: 0,
  _joyBaseY: 0,

  // Follow mode — current finger world position (px)
  fingerX: null,
  fingerY: null,
  followActive: false,

  // Visual hint state
  _hintTimer:  0,
  _hintHidden: false,

  // Bomb button rect (set by game renderer)
  _bombBtnRect: null,

  // Drag indicator (read by game.js for visual)
  dragIndicator: { active: false, sx: 0, sy: 0, ex: 0, ey: 0 },

  // ── Init ─────────────────────────────────────────────
  init() {
    // Load saved mode
    const saved = Utils.storage.get('novadrift_ctrlmode', 'drag');
    this.setMode(saved);

    // Keyboard
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); this.bombPressed = true; }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // Touch
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._isBombTouch(t.clientX, t.clientY)) {
          this.bombPressed = true;
          continue;
        }
        if (this._touchId === null) {
          this._touchId     = t.identifier;
          this._touchStartX = t.clientX;
          this._touchStartY = t.clientY;
          this._touchCurX   = t.clientX;
          this._touchCurY   = t.clientY;
          this._touchActive = true;

          if (this.mode === 'joystick') {
            // Joystick base snaps to touch-start position
            this._joyBaseX = t.clientX;
            this._joyBaseY = t.clientY;
          }

          if (this.mode === 'follow') {
            this.fingerX     = t.clientX;
            this.fingerY     = t.clientY;
            this.followActive = true;
          }

          // Drag indicator
          this.dragIndicator.active = true;
          this.dragIndicator.sx = t.clientX;
          this.dragIndicator.sy = t.clientY;
          this.dragIndicator.ex = t.clientX;
          this.dragIndicator.ey = t.clientY;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._touchId) continue;
        this._touchCurX = t.clientX;
        this._touchCurY = t.clientY;
        this.dragIndicator.ex = t.clientX;
        this.dragIndicator.ey = t.clientY;

        if (this.mode === 'drag' || this.mode === 'joystick') {
          const baseX = this.mode === 'joystick' ? this._joyBaseX : this._touchStartX;
          const baseY = this.mode === 'joystick' ? this._joyBaseY : this._touchStartY;
          const dx    = t.clientX - baseX;
          const dy    = t.clientY - baseY;
          const dist  = Math.hypot(dx, dy);
          const dead  = 8;
          const full  = 55;
          if (dist < dead) {
            this.moveX = 0; this.moveY = 0;
          } else {
            const ratio = Math.min((dist - dead) / (full - dead), 1);
            this.moveX = (dx / dist) * ratio;
            this.moveY = (dy / dist) * ratio;
          }
        } else if (this.mode === 'follow') {
          this.fingerX = t.clientX;
          this.fingerY = t.clientY;
          // moveX/Y computed each frame relative to player position in update()
        }
      }
    }, { passive: false });

    const endTouch = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) {
          this._touchId     = null;
          this._touchActive = false;
          this.moveX        = 0;
          this.moveY        = 0;
          this.followActive  = false;
          this.fingerX      = null;
          this.fingerY      = null;
          this.dragIndicator.active = false;
        }
      }
    };
    canvas.addEventListener('touchend',    endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  },

  /** Set control mode and persist */
  setMode(mode) {
    this.mode = mode;
    Utils.storage.set('novadrift_ctrlmode', mode);
    // Reset hint each mode change
    this._hintTimer  = 0;
    this._hintHidden = false;
  },

  /** Called each frame. playerX/Y needed for follow mode. */
  update(playerX, playerY) {
    // Keyboard (always active, overrides touch on desktop)
    if (!this._touchActive) {
      let mx = 0, my = 0;
      if (this.keys['ArrowLeft']  || this.keys['KeyA']) mx -= 1;
      if (this.keys['ArrowRight'] || this.keys['KeyD']) mx += 1;
      if (this.keys['ArrowUp']    || this.keys['KeyW']) my -= 1;
      if (this.keys['ArrowDown']  || this.keys['KeyS']) my += 1;
      if (mx !== 0 && my !== 0) { mx *= 0.7071; my *= 0.7071; }
      this.moveX = mx;
      this.moveY = my;
    }

    // Follow mode: compute direction from player to finger
    if (this.mode === 'follow' && this.followActive &&
        this.fingerX !== null && playerX !== undefined) {
      const dx   = this.fingerX - playerX;
      const dy   = this.fingerY - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        this.moveX = 0; this.moveY = 0; // dead zone around finger
      } else {
        const speed = Math.min(dist / 80, 1);
        this.moveX = (dx / dist) * speed;
        this.moveY = (dy / dist) * speed;
      }
    }
  },

  _isBombTouch(cx, cy) {
    if (!this._bombBtnRect) return false;
    const { x, y, r } = this._bombBtnRect;
    return Math.hypot(cx - x, cy - y) < r;
  },

  setBombBtnRect(x, y, r) { this._bombBtnRect = { x, y, r }; },
  clearBomb() { this.bombPressed = false; },
};
