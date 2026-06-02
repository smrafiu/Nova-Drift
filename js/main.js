/**
 * NOVA DRIFT — main.js  v1.2
 * Entry point: screen transitions, button events, settings panel
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ── Init ─────────────────────────────────────────────
  Game.init();
  UI.initMenuStars();
  UI.refreshMenuStats();
  UI.showScreen('screen-menu');

  // ── Menu buttons ─────────────────────────────────────
  document.getElementById('btn-play').addEventListener('click', () => {
    Audio.resume();
    UI.showScreen('screen-game');
    Game.start();
  });

  document.getElementById('btn-how').addEventListener('click', () => {
    UI.showScreen('screen-how');
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    UI.showScreen('screen-menu');
  });

  // ── Pause ─────────────────────────────────────────────
  document.getElementById('btn-pause').addEventListener('click', () => {
    closeSettings();      // close settings if open
    Game.pause();
    UI.showScreen('screen-pause');
    document.getElementById('screen-game').style.display = 'flex';
  });

  document.getElementById('btn-resume').addEventListener('click', () => {
    UI.hideById('screen-pause');
    document.getElementById('screen-pause').classList.remove('active');
    Game.resume();
  });

  document.getElementById('btn-quit').addEventListener('click', () => {
    Game.stop();
    closeSettings();
    UI.hideById('screen-pause');
    UI.hideById('screen-game');
    UI.refreshMenuStats();
    UI.showScreen('screen-menu');
  });

  // ── Game Over buttons ─────────────────────────────────
  document.getElementById('btn-retry').addEventListener('click', () => {
    Audio.resume();
    UI.hideById('screen-gameover');
    UI.showScreen('screen-game');
    Game.start();
  });

  document.getElementById('btn-menu').addEventListener('click', () => {
    Game.stop();
    UI.hideById('screen-gameover');
    UI.hideById('screen-game');
    UI.refreshMenuStats();
    UI.showScreen('screen-menu');
    UI.initMenuStars();
  });

  // ── Settings Panel ────────────────────────────────────
  const settingsPanel = document.getElementById('settings-panel');

  function openSettings() {
    Game.pause();
    // Sync radio to current mode
    const current = Input.mode || 'drag';
    const radio = settingsPanel.querySelector(`input[value="${current}"]`);
    if (radio) radio.checked = true;
    settingsPanel.style.display = 'flex';
    // Keep game canvas visible underneath
    document.getElementById('screen-game').style.display = 'flex';
  }

  function closeSettings() {
    if (!settingsPanel) return;
    settingsPanel.style.display = 'none';
    if (document.getElementById('screen-game').classList.contains('active')) {
      Game.resume();
    }
  }

  document.getElementById('btn-settings').addEventListener('click', () => {
    if (settingsPanel.style.display === 'none' || settingsPanel.style.display === '') {
      openSettings();
    } else {
      closeSettings();
    }
  });

  document.getElementById('btn-settings-close').addEventListener('click', closeSettings);

  // Mode radio change
  settingsPanel.querySelectorAll('input[name="control-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        Input.setMode(radio.value);
        // Brief visual feedback — highlight selected card
        settingsPanel.querySelectorAll('.mode-card').forEach(c => c.style.transition = 'all 0.2s');
      }
    });
  });

  // ── Keyboard shortcuts ────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      // Settings open? close it
      if (settingsPanel && settingsPanel.style.display === 'flex') {
        closeSettings(); return;
      }
      const pauseScreen = document.getElementById('screen-pause');
      const isPaused    = pauseScreen.classList.contains('active');
      if (isPaused) {
        UI.hideById('screen-pause');
        Game.resume();
      } else {
        const gameScreen = document.getElementById('screen-game');
        if (gameScreen.classList.contains('active')) {
          Game.pause();
          UI.showScreen('screen-pause');
          gameScreen.style.display = 'flex';
        }
      }
    }
  });

  // ── Prevent context menu / scroll bounce ──────────────
  window.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('touchmove', e => {
    if (e.target.closest('#game-canvas')) e.preventDefault();
  }, { passive: false });

});
