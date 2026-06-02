/**
 * NOVA DRIFT — game.js
 * Core game loop, wave system, collision detection, rendering
 */

'use strict';

const Game = (() => {

  // ── Canvas ──────────────────────────────────────────
  let canvas, ctx, W, H;

  // ── State ───────────────────────────────────────────
  let player, enemies, asteroids, gems, powerups;
  let wave, score, kills;
  let state; // 'playing' | 'waveTransition' | 'paused' | 'dead'
  let waveTimer;
  let bgStars = [];
  let nebulaClouds = [];
  let lastTime = 0;
  let animId = null;
  let shakeTimer = 0, shakeMag = 0;
  let flashTimer = 0, flashColor = 'rgba(255,60,172,0)';

  // ── Wave config ──────────────────────────────────────
  function waveConfig(w) {
    const isBoss = w % 5 === 0;
    return {
      isBoss,
      scouts:    isBoss ? 0 : Math.min(2 + w,   10),
      drones:    isBoss ? 0 : Math.min(Math.floor(w / 2), 6),
      tanks:     isBoss ? 0 : Math.min(Math.floor((w - 2) / 3), 4),
      asteroids: isBoss ? 2 : Math.min(2 + Math.floor(w / 2), 8),
      boss:      isBoss,
      powerupChance: 0.35 + w * 0.02,
    };
  }

  // ── Spawn helpers ────────────────────────────────────
  function spawnEnemy(type, wave) {
    const edge = Utils.randInt(0, 3);
    let x, y;
    const pad = 60;
    if      (edge === 0) { x = Utils.rand(pad, W - pad); y = -pad; }
    else if (edge === 1) { x = W + pad;                  y = Utils.rand(pad, H - pad); }
    else if (edge === 2) { x = Utils.rand(pad, W - pad); y = H + pad; }
    else                 { x = -pad;                     y = Utils.rand(pad, H - pad); }

    if (type === 'scout')  return new Scout(x, y, wave);
    if (type === 'drone')  return new Drone(x, y, wave);
    if (type === 'tank')   return new Tank(x, y, wave);
    if (type === 'boss')   return new Boss(W / 2, -80, wave);
    return null;
  }

  function spawnAsteroid(waveN) {
    const sizes = ['large', 'medium', 'small'];
    const size  = sizes[Math.min(Math.floor(Math.random() * 2), 2)];
    const edge  = Utils.randInt(0, 3);
    let x, y;
    if      (edge === 0) { x = Utils.rand(0, W); y = -50; }
    else if (edge === 1) { x = W + 50;           y = Utils.rand(0, H); }
    else if (edge === 2) { x = Utils.rand(0, W); y = H + 50; }
    else                 { x = -50;              y = Utils.rand(0, H); }

    const speed = Utils.rand(40, 80 + waveN * 4);
    const angle = Math.atan2(H / 2 - y, W / 2 - x) + Utils.rand(-0.5, 0.5);
    return new Asteroid(x, y, size,
      Math.cos(angle) * speed, Math.sin(angle) * speed, waveN
    );
  }

  function spawnPowerup(x, y) {
    powerups.push(new PowerUp(x, y, PowerUp.randomType()));
  }

  // ── Background generation ────────────────────────────
  function genBgStars() {
    bgStars = [];
    for (let i = 0; i < 180; i++) {
      bgStars.push({
        x: Utils.rand(0, W), y: Utils.rand(0, H),
        r: Utils.rand(0.3, 1.8),
        alpha: Utils.rand(0.2, 0.9),
        twinkleSpeed: Utils.rand(0.5, 2),
        twinkleOffset: Utils.rand(0, Math.PI * 2),
      });
    }
  }

  function genNebulaClouds() {
    nebulaClouds = [];
    for (let i = 0; i < 5; i++) {
      nebulaClouds.push({
        x: Utils.rand(0, W), y: Utils.rand(0, H),
        rx: Utils.rand(80, 200), ry: Utils.rand(60, 140),
        hue: Utils.pick([220, 270, 300, 190]),
        alpha: Utils.rand(0.04, 0.10),
        drift: Utils.rand(-5, 5),
      });
    }
  }

  // ── Launch a wave ────────────────────────────────────
  function startWave(w) {
    const cfg = waveConfig(w);
    for (let i = 0; i < cfg.scouts;    i++) enemies.push(spawnEnemy('scout',  w));
    for (let i = 0; i < cfg.drones;    i++) enemies.push(spawnEnemy('drone',  w));
    for (let i = 0; i < cfg.tanks;     i++) enemies.push(spawnEnemy('tank',   w));
    for (let i = 0; i < cfg.asteroids; i++) asteroids.push(spawnAsteroid(w));
    if (cfg.boss) enemies.push(spawnEnemy('boss', w));
    state = 'playing';
  }

  // ── Screen shake ─────────────────────────────────────
  function shake(mag, dur) {
    shakeMag = Math.max(shakeMag, mag);
    shakeTimer = Math.max(shakeTimer, dur);
  }

  // ── Flash overlay ────────────────────────────────────
  function flash(color, dur) {
    flashColor = color;
    flashTimer = dur;
  }

  // ── Score pop UI ─────────────────────────────────────
  function scorePop(x, y, text) {
    const el = document.createElement('div');
    el.className = 'score-pop';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ── Nova Bomb ────────────────────────────────────────
  function triggerNovaBomb() {
    if (player.bombCount <= 0) return;
    player.bombCount--;
    Audio.novaBomb();
    shake(14, 0.5);
    flash('rgba(255,60,172,0.25)', 0.3);

    const radius = Math.min(W, H) * 0.6;
    PS.novaBomb(player.x, player.y, radius);

    // Kill enemies within radius
    [...enemies].forEach(e => {
      if (Utils.dist(player.x, player.y, e.x, e.y) < radius) {
        const died = e.takeDamage(9999);
        if (died) {
          score += e.scoreValue;
          kills++;
          player.score = score;
          if (Math.random() < 0.6) gems.push(new Gem(e.x, e.y, e.scoreValue / 2));
          if (Math.random() < 0.18) spawnPowerup(e.x, e.y);
        }
      }
    });
    // Destroy asteroids
    [...asteroids].forEach(a => {
      if (Utils.dist(player.x, player.y, a.x, a.y) < radius) {
        a.dead = true;
        score += a.scoreValue;
        const frags = a.split();
        asteroids.push(...frags);
      }
    });

    UI.updateScore(score);
  }

  // ── Collision detection ──────────────────────────────
  function checkCollisions() {
    // Player bullets vs enemies
    for (let bi = player.bullets.length - 1; bi >= 0; bi--) {
      const b = player.bullets[bi];
      for (const e of enemies) {
        if (e.dead) continue;
        if (Utils.circleCollide(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          const killed = e.takeDamage(b.damage);
          b.dead = true;
          if (killed) {
            score += e.scoreValue;
            kills++;
            player.score = score;
            Audio.enemyDie();
            if (e.type === 'boss') { shake(18, 0.8); flash('rgba(255,60,172,0.3)', 0.4); Audio.bigExplosion(); }
            else shake(5, 0.2);
            scorePop(e.x, e.y - 20, `+${e.scoreValue}`);
            if (Math.random() < 0.65) gems.push(new Gem(e.x, e.y, Math.floor(e.scoreValue / 3)));
            if (Math.random() < 0.15) spawnPowerup(e.x, e.y);
            UI.updateScore(score);
          }
          break;
        }
      }
    }

    // Player bullets vs asteroids
    for (let bi = player.bullets.length - 1; bi >= 0; bi--) {
      const b = player.bullets[bi];
      if (b.dead) continue;
      for (let ai = asteroids.length - 1; ai >= 0; ai--) {
        const a = asteroids[ai];
        if (a.dead) continue;
        if (Utils.circleCollide(b.x, b.y, b.radius, a.x, a.y, a.radius)) {
          b.dead = true;
          const killed = a.takeDamage(b.damage);
          if (killed) {
            score += a.scoreValue;
            PS.enemyDeath(a.x, a.y, '#8899aa');
            shake(4, 0.2);
            Audio.enemyDie();
            scorePop(a.x, a.y - 20, `+${a.scoreValue}`);
            const frags = a.split();
            asteroids.push(...frags);
            if (Math.random() < 0.2) spawnPowerup(a.x, a.y);
            UI.updateScore(score);
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    for (const e of enemies) {
      for (const b of e.bullets) {
        if (b.dead) continue;
        if (Utils.circleCollide(b.x, b.y, b.radius, player.x, player.y, player.radius)) {
          b.dead = true;
          const died = player.takeDamage(1);
          if (!died) { Audio.playerHit(); shake(8, 0.3); flash('rgba(255,60,172,0.2)', 0.2); UI.updateLives(player.hp); }
          else { handlePlayerDeath(); return; }
        }
      }
    }

    // Enemies vs player (body collision)
    for (const e of enemies) {
      if (e.dead) continue;
      if (Utils.circleCollide(e.x, e.y, e.radius * 0.75, player.x, player.y, player.radius * 0.75)) {
        const died = player.takeDamage(1);
        e.hp -= 20;
        if (e.hp <= 0) { e.dead = true; PS.enemyDeath(e.x, e.y, e.color); }
        if (!died) { Audio.playerHit(); shake(10, 0.4); flash('rgba(255,60,172,0.25)', 0.25); UI.updateLives(player.hp); }
        else { handlePlayerDeath(); return; }
      }
    }

    // Asteroids vs player
    for (const a of asteroids) {
      if (a.dead) continue;
      if (Utils.circleCollide(a.x, a.y, a.radius * 0.8, player.x, player.y, player.radius * 0.8)) {
        a.dead = true;
        PS.enemyDeath(a.x, a.y, '#8899aa');
        const died = player.takeDamage(1);
        if (!died) { Audio.playerHit(); shake(10, 0.3); UI.updateLives(player.hp); }
        else { handlePlayerDeath(); return; }
      }
    }

    // Gems vs player
    for (const g of gems) {
      if (g.dead) continue;
      if (Utils.circleCollide(g.x, g.y, g.radius + 8, player.x, player.y, player.radius)) {
        score += g.value;
        player.score = score;
        g.dead = true;
        Audio.collectGem();
        UI.updateScore(score);
        scorePop(g.x, g.y - 15, `+${g.value}`);
      }
    }

    // Power-ups vs player
    for (const pu of powerups) {
      if (pu.dead) continue;
      if (Utils.circleCollide(pu.x, pu.y, pu.radius + 10, player.x, player.y, player.radius)) {
        pu.apply(player);
        Audio.collectPowerup();
        UI.updateShield(player.shieldHp, player.maxShieldHp);
        UI.updateLives(player.hp);
        UI.showPowerupToast(pu.label);
      }
    }
  }

  // ── Player death ─────────────────────────────────────
  function handlePlayerDeath() {
    Audio.gameOver();
    shake(20, 1);
    flash('rgba(255,60,172,0.5)', 0.5);
    state = 'dead';
    setTimeout(() => {
      UI.showGameOver(score, wave, kills);
    }, 800);
  }

  // ── Wave clear check ─────────────────────────────────
  function checkWaveClear() {
    const allDead = enemies.every(e => e.dead) && asteroids.every(a => a.dead);
    if (!allDead || state !== 'playing') return;

    const bonus = 200 + wave * 100;
    score += bonus;
    player.score = score;
    kills += enemies.filter(e => e.dead).length;
    UI.updateScore(score);
    Audio.waveClear();

    state = 'waveTransition';
    UI.showWaveClear(wave, bonus, wave + 1, () => {
      wave++;
      enemies   = [];
      asteroids = [];
      gems      = [];
      powerups  = [];
      UI.updateWave(wave);
      startWave(wave);
    });
  }

  // ── Draw background ──────────────────────────────────
  function drawBg(t) {
    // Deep space gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   '#060614');
    grad.addColorStop(0.5, '#050510');
    grad.addColorStop(1,   '#080818');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Nebula clouds
    for (const n of nebulaClouds) {
      n.x += n.drift * 0.01;
      if (n.x > W + n.rx) n.x = -n.rx;
      ctx.save();
      const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rx);
      ng.addColorStop(0, `hsla(${n.hue},80%,55%,${n.alpha})`);
      ng.addColorStop(1, 'transparent');
      ctx.fillStyle = ng;
      ctx.scale(1, n.ry / n.rx);
      ctx.beginPath();
      ctx.arc(n.x, n.y * (n.rx / n.ry), n.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Stars
    for (const s of bgStars) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
      ctx.save();
      ctx.globalAlpha = s.alpha * tw;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Grid lines (HUD aesthetic) ───────────────────────
  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,0.03)';
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Main game loop ───────────────────────────────────
  function loop(timestamp) {
    animId = requestAnimationFrame(loop);
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    const t = timestamp / 1000;

    // Canvas size
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;

    // Screen shake transform
    let sx = 0, sy = 0;
    if (shakeTimer > 0) {
      shakeTimer -= dt;
      sx = (Math.random() - 0.5) * shakeMag * 2;
      sy = (Math.random() - 0.5) * shakeMag * 2;
      shakeMag = Utils.lerp(shakeMag, 0, 8 * dt);
    }

    ctx.save();
    ctx.translate(sx, sy);

    // Draw background
    drawBg(t);
    drawGrid();

    if (state === 'playing') {
      // Input
      Input.update(player.x, player.y);
      player.moveX = Input.moveX;
      player.moveY = Input.moveY;
      if (Input.bombPressed) { triggerNovaBomb(); Input.clearBomb(); }

      // Update entities
      player.update(dt, W, H);
      for (const e of enemies)   e.update(dt, player.x, player.y, W, H);
      for (const a of asteroids) a.update(dt, W, H);
      for (const g of gems)      g.update(dt, W, H);
      for (const p of powerups)  p.update(dt, W, H);
      PS.update(dt);

      // Collisions
      checkCollisions();

      // Remove dead
      enemies   = enemies.filter(e => !e.dead);
      asteroids = asteroids.filter(a => !a.dead);
      gems      = gems.filter(g => !g.dead);
      powerups  = powerups.filter(p => !p.dead);

      // Shield bar update
      UI.updateShield(player.shieldHp, player.maxShieldHp);

      // Check wave clear
      checkWaveClear();
    }

    // Draw particles (behind entities)
    PS.draw(ctx);

    // Draw entities
    for (const a of asteroids) a.draw(ctx);
    for (const e of enemies)   e.draw(ctx);
    for (const g of gems)      g.draw(ctx);
    for (const p of powerups)  p.draw(ctx);
    player.draw(ctx);

    // Flash overlay
    if (flashTimer > 0) {
      flashTimer -= dt;
      const alpha = (flashTimer / 0.4) * 0.4;
      ctx.fillStyle = flashColor.replace(/[\d.]+\)$/, `${Math.max(0, alpha)})`);
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }

    ctx.restore();

    // ── Mobile UI drawn on top of canvas (outside shake transform) ──
    const isMobile = window.innerWidth < 700 ||
      /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobile && (state === 'playing' || state === 'paused')) {
      drawMobileUI(t);
    }
  }

  // ── Canvas-drawn mobile UI ────────────────────────────
  function drawMobileUI(t) {
    const mode = Input.mode;
    const di   = Input.dragIndicator;

    // ── MODE: JOYSTICK — fixed base at touch-start, stick follows finger ──
    if (mode === 'joystick' && di.active) {
      const bx = Input._joyBaseX, by = Input._joyBaseY;
      const dx = di.ex - bx, dy = di.ey - by;
      const dist = Math.hypot(dx, dy);
      const maxR = 55;
      const clampedX = bx + (dist > maxR ? (dx/dist)*maxR : dx);
      const clampedY = by + (dist > maxR ? (dy/dist)*maxR : dy);

      ctx.save();
      // Outer ring
      ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(0,240,255,0.3)';
      ctx.strokeStyle = 'rgba(0,240,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(bx, by, maxR, 0, Math.PI*2); ctx.stroke();
      // Inner base
      ctx.strokeStyle = 'rgba(0,240,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI*2); ctx.stroke();
      // Fill outer
      ctx.fillStyle = 'rgba(0,240,255,0.04)';
      ctx.beginPath(); ctx.arc(bx, by, maxR, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // Stick knob
      const knobG = ctx.createRadialGradient(clampedX-4, clampedY-4, 0, clampedX, clampedY, 22);
      knobG.addColorStop(0, 'rgba(0,240,255,0.9)');
      knobG.addColorStop(1, 'rgba(0,200,230,0.5)');
      ctx.fillStyle = knobG;
      ctx.shadowBlur = 16; ctx.shadowColor = '#00f0ff';
      ctx.beginPath(); ctx.arc(clampedX, clampedY, 22, 0, Math.PI*2); ctx.fill();
      // Stick highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(clampedX-6, clampedY-6, 8, 0, Math.PI*2); ctx.fill();
      // Cross reticle on base
      ctx.strokeStyle = 'rgba(0,240,255,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx-14, by); ctx.lineTo(bx+14, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by-14); ctx.lineTo(bx, by+14); ctx.stroke();
      ctx.restore();
    }

    // ── MODE: DRAG — drag-origin indicator with direction arrow ──
    else if (mode === 'drag' && di.active) {
      const dx = di.ex - di.sx, dy = di.ey - di.sy;
      const dist = Math.hypot(dx, dy);
      ctx.save();
      // Dashed origin ring
      ctx.strokeStyle = 'rgba(0,240,255,0.35)';
      ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(di.sx, di.sy, 36, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      if (dist > 8) {
        // Line to finger
        ctx.strokeStyle = 'rgba(0,240,255,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(di.sx, di.sy); ctx.lineTo(di.ex, di.ey); ctx.stroke();
        // Arrow tip
        const angle = Math.atan2(dy, dx);
        const tipX = di.sx + (dx/dist)*Math.min(dist, 60);
        const tipY = di.sy + (dy/dist)*Math.min(dist, 60);
        ctx.fillStyle = 'rgba(0,240,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(tipX+Math.cos(angle)*11, tipY+Math.sin(angle)*11);
        ctx.lineTo(tipX+Math.cos(angle+2.4)*7, tipY+Math.sin(angle+2.4)*7);
        ctx.lineTo(tipX+Math.cos(angle-2.4)*7, tipY+Math.sin(angle-2.4)*7);
        ctx.closePath(); ctx.fill();
      }
      // Origin dot
      ctx.fillStyle = 'rgba(0,240,255,0.55)'; ctx.shadowBlur = 10; ctx.shadowColor = '#00f0ff';
      ctx.beginPath(); ctx.arc(di.sx, di.sy, 6, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // ── MODE: FOLLOW — crosshair at finger position ──
    else if (mode === 'follow' && Input.followActive && Input.fingerX !== null) {
      const fx = Input.fingerX, fy = Input.fingerY;
      const pulse = 0.7 + 0.3 * Math.sin(t * 6);
      ctx.save();
      ctx.shadowBlur = 14 * pulse; ctx.shadowColor = '#a259ff';
      ctx.strokeStyle = `rgba(162,89,255,${0.6 * pulse})`; ctx.lineWidth = 1.5;
      // Outer ring
      ctx.beginPath(); ctx.arc(fx, fy, 22, 0, Math.PI*2); ctx.stroke();
      // Cross
      ctx.beginPath(); ctx.moveTo(fx-30, fy); ctx.lineTo(fx-14, fy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx+14, fy); ctx.lineTo(fx+30, fy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy-30); ctx.lineTo(fx, fy-14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy+14); ctx.lineTo(fx, fy+30); ctx.stroke();
      // Corner brackets
      const cb = 10;
      [[fx-22,fy-22,cb,0,0,cb],[fx+22,fy-22,-cb,0,0,cb],
       [fx-22,fy+22,cb,0,0,-cb],[fx+22,fy+22,-cb,0,0,-cb]].forEach(([x,y,dx1,dy1,dx2,dy2]) => {
        ctx.beginPath(); ctx.moveTo(x+dx1,y+dy1); ctx.lineTo(x,y); ctx.lineTo(x+dx2,y+dy2); ctx.stroke();
      });
      // Centre dot
      ctx.fillStyle = `rgba(162,89,255,${0.8 * pulse})`; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // ── Nova Bomb button — themed redesign ──────────────
    const bx = W - 54;
    const by = H - 58;
    const br = 30;

    Input.setBombBtnRect(bx, by, br + 12);

    const hasBombs  = player && player.bombCount > 0;
    const bombPulse = 0.82 + 0.18 * Math.sin(t * 2.8);
    const bombAlpha = hasBombs ? 1 : 0.38;

    ctx.save();
    ctx.globalAlpha = bombAlpha;

    // ── Outermost spinning orbit ring ──
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(t * 0.9);
    ctx.strokeStyle = hasBombs
      ? `rgba(255,60,172,${0.5 * bombPulse})`
      : 'rgba(120,40,80,0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 6]);
    ctx.shadowBlur  = hasBombs ? 10 * bombPulse : 0;
    ctx.shadowColor = '#ff3cac';
    ctx.beginPath();
    ctx.arc(0, 0, br + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── Second pulsing ring ──
    ctx.save();
    ctx.translate(bx, by);
    ctx.strokeStyle = hasBombs
      ? `rgba(162,89,255,${0.6 * bombPulse})`
      : 'rgba(80,40,100,0.3)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur  = hasBombs ? 14 * bombPulse : 0;
    ctx.shadowColor = '#a259ff';
    ctx.beginPath();
    ctx.arc(0, 0, br + 3 * bombPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ── Background disc with radial gradient ──
    ctx.save();
    ctx.translate(bx, by);
    const bgGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
    bgGrad.addColorStop(0, hasBombs ? 'rgba(60,10,40,0.95)' : 'rgba(20,10,20,0.9)');
    bgGrad.addColorStop(1, 'rgba(5,5,16,0.95)');
    ctx.fillStyle = bgGrad;
    ctx.shadowBlur  = hasBombs ? 20 * bombPulse : 0;
    ctx.shadowColor = '#ff3cac';
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.fill();
    // Border
    ctx.strokeStyle = hasBombs ? `rgba(255,60,172,${0.7 * bombPulse})` : 'rgba(120,40,80,0.4)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // ── Nova shockwave icon (expanding rings + centre core) ──
    ctx.save();
    ctx.translate(bx, by);
    // Three concentric arcs = shockwave effect
    if (hasBombs) {
      for (let i = 0; i < 3; i++) {
        const ir  = 7 + i * 5 + Math.sin(t * 3 + i) * 1.5;
        const ial = (1 - i / 3) * 0.5 * bombPulse;
        ctx.strokeStyle = `rgba(255,60,172,${ial})`;
        ctx.lineWidth = 2 - i * 0.4;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = '#ff3cac';
        ctx.beginPath();
        ctx.arc(0, 0, ir, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Four diagonal thrust lines (cross flare)
    ctx.shadowBlur  = hasBombs ? 10 : 0;
    ctx.shadowColor = '#ff3cac';
    const flareColor = hasBombs ? `rgba(255,60,172,${0.75 * bombPulse})` : 'rgba(160,60,100,0.3)';
    ctx.strokeStyle = flareColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    const flareLen = 9 + 2 * bombPulse;
    [[0,-1],[0,1],[-1,0],[1,0],[0.7,-0.7],[0.7,0.7],[-0.7,0.7],[-0.7,-0.7]].forEach(([fx,fy]) => {
      const inner = 5, outer = inner + flareLen * (Math.abs(fx + fy) > 0.8 ? 0.55 : 1);
      ctx.beginPath();
      ctx.moveTo(fx * inner, fy * inner);
      ctx.lineTo(fx * outer, fy * outer);
      ctx.stroke();
    });

    // Centre energy core
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.4, hasBombs ? '#ff3cac' : 'rgba(200,80,140,0.5)');
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.shadowBlur  = hasBombs ? 16 * bombPulse : 0;
    ctx.shadowColor = '#ff3cac';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── NOVA label below button ──
    ctx.save();
    ctx.font = `bold 8px 'Orbitron', sans-serif`;
    ctx.fillStyle = hasBombs
      ? `rgba(255,60,172,${0.85 * bombPulse})`
      : 'rgba(180,80,120,0.35)';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.shadowBlur    = hasBombs ? 8 : 0;
    ctx.shadowColor   = '#ff3cac';
    ctx.fillText('NOVA', bx, by + br + 11);
    ctx.restore();

    // ── Charge count pips (dots above label) ──
    if (player && player.bombCount > 0) {
      const pip    = player.bombCount;
      const pipR   = 3.2;
      const pipGap = 8;
      const pipY   = by + br + 22;
      const pipStartX = bx - ((pip - 1) * pipGap) / 2;
      for (let i = 0; i < pip; i++) {
        const pg = ctx.createRadialGradient(
          pipStartX + i * pipGap, pipY, 0,
          pipStartX + i * pipGap, pipY, pipR
        );
        pg.addColorStop(0, '#ffffff');
        pg.addColorStop(1, '#ff3cac');
        ctx.fillStyle  = pg;
        ctx.shadowBlur = 8; ctx.shadowColor = '#ff3cac';
        ctx.beginPath();
        ctx.arc(pipStartX + i * pipGap, pipY, pipR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    // ── Touch hint (first 3 seconds of game) ──
    if (!Input._touchActive && !Input._hintHidden) {
      if (!Input._hintTimer) Input._hintTimer = 0;
      Input._hintTimer += 1 / 60;
      if (Input._hintTimer < 3) {
        const alpha = Input._hintTimer < 2 ? 1 : 1 - (Input._hintTimer - 2);
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        ctx.font = `10px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#00f0ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const hints = {
          joystick: 'TOUCH SCREEN TO PLACE JOYSTICK',
          drag:     'DRAG ANYWHERE TO MOVE',
          follow:   'TOUCH SCREEN — SHIP FOLLOWS FINGER',
        };
        ctx.fillText(hints[Input.mode] || 'DRAG ANYWHERE TO MOVE', W / 2, H - 120);
        ctx.restore();
      } else {
        Input._hintHidden = true;
      }
    }
  }

  // ── Public API ───────────────────────────────────────
  return {

    init() {
      canvas = document.getElementById('game-canvas');
      ctx    = canvas.getContext('2d');
      Input.init();
    },

    start() {
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      PS.clear();

      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;

      wave     = 1;
      score    = 0;
      kills    = 0;
      enemies  = [];
      asteroids= [];
      gems     = [];
      powerups = [];
      state    = 'playing';

      player = new Player(W / 2, H / 2);

      // Reset touch hint
      Input._hintTimer  = 0;
      Input._hintHidden = false;

      genBgStars();
      genNebulaClouds();
      startWave(wave);

      UI.updateScore(0);
      UI.updateWave(1);
      UI.updateLives(player.hp);
      UI.updateShield(0, 100);

      lastTime = performance.now();
      loop(lastTime);
    },

    pause() {
      state = 'paused';
    },

    resume() {
      state = 'playing';
      lastTime = performance.now();
    },

    stop() {
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      state = 'idle';
    },

    getScore: () => score,
    getWave:  () => wave,
    getKills: () => kills,
  };

})();
