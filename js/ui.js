/**
 * NOVA DRIFT — ui.js
 * Screen management, HUD updates, toasts, wave-clear countdown
 * v1.1 — SVG lives, no emoji, Game Over slide-in animation
 */

'use strict';

const UI = (() => {

  const $ = id => document.getElementById(id);

  // ── Show / hide screens ──────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = '';
    });
    const el = $(id);
    if (el) {
      el.classList.add('active');
      el.style.display = 'flex';
    }
  }

  function hideById(id) {
    const el = $(id);
    if (el) { el.style.display = 'none'; el.classList.remove('active'); }
  }

  // ── Menu star background ─────────────────────────────
  function initMenuStars() {
    const container = $('menu-stars');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 120; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const size  = Math.random() * 2.5 + 0.5;
      const alpha = Math.random() * 0.7 + 0.2;
      const dur   = (Math.random() * 3 + 2).toFixed(1);
      star.style.cssText = `
        left:${Math.random()*100}%;top:${Math.random()*100}%;
        width:${size}px;height:${size}px;
        --o:${alpha};--d:${dur}s;
        animation-delay:${(Math.random()*dur).toFixed(1)}s;
      `;
      container.appendChild(star);
    }
  }

  // ── Power-up toast (SVG bolt icon, no emoji) ─────────
  let toastTimeout = null;
  function showPowerupToast(label) {
    let el = $('powerup-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'powerup-toast';
      el.style.cssText = `
        position:fixed;top:80px;left:50%;transform:translateX(-50%) translateY(-6px);
        background:rgba(5,5,16,0.92);
        border:1px solid rgba(0,240,255,0.4);
        border-radius:24px;
        font-family:'Orbitron',sans-serif;
        font-size:11px;letter-spacing:4px;
        color:#00f0ff;
        padding:8px 20px;
        z-index:200;
        text-shadow:0 0 12px rgba(0,240,255,0.8);
        box-shadow:0 0 20px rgba(0,240,255,0.2);
        transition:opacity 0.35s,transform 0.35s;
        pointer-events:none;
        display:flex;align-items:center;gap:8px;
      `;
      document.body.appendChild(el);
    }
    // SVG bolt icon
    el.innerHTML = `
      <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
        <polygon points="7,0 3,8 6,8 5,16 9,8 6,8" fill="#00f0ff"/>
      </svg>
      ${label}
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(-6px)';
    }, 2200);
  }

  // ── Lives — SVG ship icons (no emoji) ────────────────
  function _shipSVG(active) {
    const color  = active  ? '#00f0ff' : 'rgba(0,240,255,0.2)';
    const shadow = active  ? 'filter:drop-shadow(0 0 5px #00f0ff)' : '';
    return `
      <svg width="18" height="22" viewBox="0 0 18 22" fill="none"
           style="${shadow}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="9,1 13,14 9,12 5,14" fill="${color}"/>
        <polygon points="5,14 1,20 9,17 17,20 13,14 9,12" fill="${active ? '#6ab0d4' : 'rgba(106,176,212,0.2)'}"/>
        <ellipse cx="9" cy="7" rx="2.5" ry="4" fill="${active ? 'rgba(0,240,255,0.7)' : 'rgba(0,240,255,0.1)'}"/>
      </svg>`;
  }

  function updateLives(hp) {
    const row = $('lives-row');
    if (!row) return;
    row.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const wrap = document.createElement('span');
      wrap.className = 'life-icon' + (i >= hp ? ' lost' : '');
      wrap.innerHTML = _shipSVG(i < hp);
      row.appendChild(wrap);
    }
  }

  // ── Shield bar ───────────────────────────────────────
  function updateShield(hp, max) {
    const wrap = $('shield-bar-wrap');
    const bar  = $('shield-bar');
    if (!wrap || !bar) return;
    if (hp > 0) {
      wrap.classList.add('visible');
      bar.style.width = (hp / max * 100) + '%';
    } else {
      wrap.classList.remove('visible');
    }
  }

  // ── Score ────────────────────────────────────────────
  function updateScore(val) {
    const el = $('hud-score');
    if (!el) return;
    el.textContent = Utils.formatNum(val);
    el.style.transform = 'scale(1.18)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 100);
  }

  function updateWave(val) {
    const el = $('hud-wave');
    if (el) el.textContent = val;
  }

  // ── Wave Clear ───────────────────────────────────────
  let waveCountdownInterval = null;

  function showWaveClear(completedWave, bonus, nextWave, onDone) {
    const el = $('screen-wave');
    if (!el) { onDone(); return; }

    $('wc-num').textContent   = completedWave;
    $('wc-bonus').textContent = `+${Utils.formatNum(bonus)} BONUS`;
    $('wc-next').textContent  = nextWave;

    el.style.display = 'flex';
    el.classList.add('active');

    let countdown = 3;
    $('wc-countdown').textContent = countdown;

    if (waveCountdownInterval) clearInterval(waveCountdownInterval);
    waveCountdownInterval = setInterval(() => {
      countdown--;
      const cdEl = $('wc-countdown');
      if (cdEl) cdEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(waveCountdownInterval);
        el.style.display = 'none';
        el.classList.remove('active');
        onDone();
      }
    }, 1000);
  }

  // ── Game Over — animated slide-in ────────────────────
  function showGameOver(score, wave, kills) {
    const best     = Utils.storage.get('novadrift_best', 0);
    const bestWave = Utils.storage.get('novadrift_bestwave', 0);
    const isNewBest = score > best;

    if (isNewBest) Utils.storage.set('novadrift_best', score);
    if (wave > bestWave) Utils.storage.set('novadrift_bestwave', wave);

    $('go-score').textContent = Utils.formatNum(score);
    $('go-wave').textContent  = wave;
    $('go-kills').textContent = kills;
    $('go-best').textContent  = Utils.formatNum(Math.max(score, best));

    const newBestEl = $('go-new-best');
    if (newBestEl) newBestEl.style.display = isNewBest ? 'flex' : 'none';

    const screen = $('screen-gameover');
    const box    = $('go-box');

    if (!screen || !box) return;

    // Reset animation state
    box.classList.remove('go-animate-in');
    screen.style.display = 'flex';
    screen.classList.add('active');

    // Force reflow then trigger animation
    void box.offsetWidth;
    box.classList.add('go-animate-in');
  }

  // ── Menu stats ───────────────────────────────────────
  function refreshMenuStats() {
    const best = Utils.storage.get('novadrift_best', 0);
    const wave = Utils.storage.get('novadrift_bestwave', 0);
    const mb = $('menu-best'), mw = $('menu-wave');
    if (mb) mb.textContent = Utils.formatNum(best);
    if (mw) mw.textContent = wave;
  }

  // ── Mobile controls visibility (no HTML joystick now) ──
  function updateMobileControls() {
    // Controls are drawn on canvas — nothing to show/hide in HTML
  }

  return {
    initMenuStars,
    showScreen,
    hideById,
    showPowerupToast,
    updateLives,
    updateShield,
    updateScore,
    updateWave,
    showWaveClear,
    showGameOver,
    refreshMenuStats,
    updateMobileControls,
  };

})();
