/**
 * NOVA DRIFT — entities.js
 * Player, Bullet, Enemy, Asteroid, Gem classes
 */

'use strict';

/* =============================================
   BULLET
   ============================================= */
class Bullet {
  constructor(x, y, vx, vy, damage = 10, color = '#00f0ff', size = 4, isPlayer = true) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.damage = damage;
    this.color = color;
    this.size = size;
    this.isPlayer = isPlayer;
    this.dead = false;
    this.trail = [];
  }

  update(dt, W, H) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) {
      this.dead = true;
    }
  }

  draw(ctx) {
    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = (i / this.trail.length) * 0.5;
      const sz    = this.size * (i / this.trail.length) * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, sz, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Main bullet
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    // Core white
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  get radius() { return this.size; }
}

/* =============================================
   PLAYER
   ============================================= */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2; // facing up
    this.speed = 220;
    this.radius = 16;
    this.hp = 3;
    this.maxHp = 3;
    this.dead = false;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.shieldHp = 0;
    this.maxShieldHp = 100;
    this.rapidFireTimer = 0;
    this.bombCount = 3;
    this.fireRate = 0.22; // seconds between shots
    this.fireTimer = 0;
    this.moveX = 0; // -1..1 from input
    this.moveY = 0;
    this.thrusterPhase = 0;
    this.blinkTimer = 0;
    this.bullets = [];
    this.kills = 0;
    this.score = 0;
  }

  get hasShield() { return this.shieldHp > 0; }
  get rapidFire()  { return this.rapidFireTimer > 0; }

  activate(invincibleDuration = 2) {
    this.invincible = true;
    this.invincibleTimer = invincibleDuration;
    this.blinkTimer = 0;
  }

  update(dt, W, H) {
    // Move
    const spd = this.speed;
    this.vx = this.moveX * spd;
    this.vy = this.moveY * spd;
    this.x = Utils.clamp(this.x + this.vx * dt, this.radius, W - this.radius);
    this.y = Utils.clamp(this.y + this.vy * dt, this.radius, H - this.radius);

    if (this.moveX !== 0 || this.moveY !== 0) {
      this.angle = Math.atan2(this.moveY, this.moveX);
    }

    // Thruster effect
    this.thrusterPhase += dt * 8;

    // Invincibility
    if (this.invincible) {
      this.invincibleTimer -= dt;
      this.blinkTimer += dt;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.blinkTimer = 0;
      }
    }

    // Timers
    this.fireTimer -= dt;
    if (this.rapidFireTimer > 0) this.rapidFireTimer -= dt;

    // Auto fire
    const rate = this.rapidFire ? this.fireRate * 0.35 : this.fireRate;
    if (this.fireTimer <= 0) {
      this.shoot();
      this.fireTimer = rate;
    }

    // Particle thruster
    if ((this.moveX !== 0 || this.moveY !== 0)) {
      const rearAngle = this.angle + Math.PI;
      PS.thruster(
        this.x + Math.cos(rearAngle) * 16,
        this.y + Math.sin(rearAngle) * 16,
        rearAngle, this.rapidFire ? 1.6 : 1
      );
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].update(dt, W, H);
      if (this.bullets[i].dead) this.bullets.splice(i, 1);
    }
  }

  shoot() {
    const speed  = 560;
    const spread = this.rapidFire ? 0.08 : 0;
    const angles = this.rapidFire
      ? [this.angle - spread, this.angle, this.angle + spread]
      : [this.angle];

    for (const a of angles) {
      this.bullets.push(new Bullet(
        this.x + Math.cos(a) * 22,
        this.y + Math.sin(a) * 22,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        this.rapidFire ? 8 : 10,
        this.rapidFire ? '#ffe066' : '#00f0ff',
        this.rapidFire ? 3.5 : 4,
        true
      ));
    }
  }

  takeDamage(amount = 1) {
    if (this.invincible) return false;
    if (this.hasShield) {
      this.shieldHp -= amount * 30;
      if (this.shieldHp < 0) this.shieldHp = 0;
      return false;
    }
    this.hp -= amount;
    this.activate(2);
    PS.playerHit(this.x, this.y);
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }

  draw(ctx) {
    // Blink when invincible
    if (this.invincible && Math.sin(this.blinkTimer * 18) < 0) return;

    const { x, y, angle } = this;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);

    // Shield effect
    if (this.hasShield) {
      const shieldAlpha = 0.15 + 0.1 * Math.sin(Date.now() / 200);
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#a259ff';
      ctx.strokeStyle = `rgba(162,89,255,${0.5 + 0.3 * Math.sin(Date.now()/300)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(162,89,255,${shieldAlpha})`;
      ctx.fill();
      ctx.restore();
    }

    // Engine glow
    const thrustAlpha = (this.moveX !== 0 || this.moveY !== 0) ? 0.5 : 0.2;
    const g = ctx.createRadialGradient(0, 12, 0, 0, 12, 22);
    g.addColorStop(0, `rgba(0,240,255,${thrustAlpha})`);
    g.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 12, 22, 0, Math.PI * 2);
    ctx.fill();

    // Ship body — futuristic fighter
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00f0ff';

    // Main hull
    ctx.fillStyle = '#c8e8ff';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(10, 4);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 6);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-10, 4);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00f0ff';
    ctx.beginPath();
    ctx.ellipse(0, -8, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#6ab0d4';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#4488aa';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.lineTo(-20, 14);
    ctx.lineTo(-14, 10);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(10, 4);
    ctx.lineTo(20, 14);
    ctx.lineTo(14, 10);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fill();

    // Engine nozzles
    const thrustFlicker = 6 + 4 * Math.sin(this.thrusterPhase);
    ctx.fillStyle = `rgba(0,240,255,${0.4 + 0.3 * Math.sin(this.thrusterPhase)})`;
    ctx.shadowBlur = thrustFlicker;
    ctx.shadowColor = '#00f0ff';
    ctx.beginPath();
    ctx.ellipse(-5, 10, 3, 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, 10, 3, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Bullets
    for (const b of this.bullets) b.draw(ctx);
  }
}

/* =============================================
   ENEMY BASE
   ============================================= */
class Enemy {
  constructor(x, y, hp, speed, score, radius, color, type) {
    this.x = x; this.y = y;
    this.hp = hp; this.maxHp = hp;
    this.speed = speed;
    this.scoreValue = score;
    this.radius = radius;
    this.color = color;
    this.type = type;
    this.dead = false;
    this.angle = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.bullets = [];
    this.fireTimer = Utils.rand(1, 3);
    this.fireRate = Utils.rand(1.5, 3);
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dead = true;
      PS.enemyDeath(this.x, this.y, this.color);
      return true;
    }
    return false;
  }

  updateBullets(dt, W, H) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].update(dt, W, H);
      if (this.bullets[i].dead) this.bullets.splice(i, 1);
    }
  }

  shootAt(px, py, speed = 200, dmg = 1) {
    const a = Math.atan2(py - this.y, px - this.x);
    this.bullets.push(new Bullet(
      this.x, this.y,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
      dmg, this.color, 4, false
    ));
  }

  drawHpBar(ctx) {
    if (this.hp === this.maxHp) return;
    const bw = this.radius * 2.2, bh = 4;
    const bx = this.x - bw / 2, by = this.y - this.radius - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = this.hp / this.maxHp > 0.5 ? '#39ff14' : '#ff4444';
    ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), bh);
  }
}

/* -- Scout: fast zigzag -- */
class Scout extends Enemy {
  constructor(x, y, wave) {
    super(x, y, 15 + wave * 3, 90 + wave * 5, 80, 12, '#ff6030', 'scout');
    this.zigTimer = 0;
    this.zigDir = 1;
    this.fireRate = 2.5;
  }

  update(dt, px, py, W, H) {
    this.phase += dt * 2;
    this.zigTimer += dt;
    if (this.zigTimer > 0.8) { this.zigDir *= -1; this.zigTimer = 0; }

    const toX = px - this.x, toY = py - this.y;
    const len = Math.hypot(toX, toY) || 1;
    const perpX = -toY / len, perpY = toX / len;

    this.x += (toX / len * this.speed + perpX * this.speed * 0.5 * this.zigDir) * dt;
    this.y += (toY / len * this.speed + perpY * this.speed * 0.5 * this.zigDir) * dt;

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.shootAt(px, py, 220);
      this.fireTimer = this.fireRate;
    }
    this.updateBullets(dt, W, H);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.y - (this.y - 1), 0) + this.phase * 0.5);

    ctx.shadowBlur = 14;
    ctx.shadowColor = this.color;

    // Triangle ship
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, 10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff9966';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    this.drawHpBar(ctx);
    ctx.restore();
    for (const b of this.bullets) b.draw(ctx);
  }
}

/* -- Drone: orbiting shooter -- */
class Drone extends Enemy {
  constructor(x, y, wave) {
    super(x, y, 30 + wave * 5, 55 + wave * 3, 150, 15, '#a259ff', 'drone');
    this.orbitAngle = Utils.rand(0, Math.PI * 2);
    this.orbitRadius = Utils.rand(120, 200);
    this.orbitSpeed = Utils.rand(1.2, 2.0) * (Math.random() < 0.5 ? 1 : -1);
    this.fireRate = 1.8;
    this.targetX = x; this.targetY = y;
  }

  update(dt, px, py, W, H) {
    this.orbitAngle += this.orbitSpeed * dt;
    this.targetX = Utils.lerp(this.targetX, px, 0.6 * dt);
    this.targetY = Utils.lerp(this.targetY, py, 0.6 * dt);
    this.x = this.targetX + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = this.targetY + Math.sin(this.orbitAngle) * this.orbitRadius;
    this.x = Utils.clamp(this.x, this.radius, W - this.radius);
    this.y = Utils.clamp(this.y, this.radius, H - this.radius);

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.shootAt(px, py, 200, 1);
      this.fireTimer = this.fireRate;
    }
    this.updateBullets(dt, W, H);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.orbitAngle);

    ctx.shadowBlur = 18;
    ctx.shadowColor = this.color;

    // Hexagon drone
    ctx.fillStyle = this.color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      i === 0 ? ctx.moveTo(Math.cos(a)*14, Math.sin(a)*14)
              : ctx.lineTo(Math.cos(a)*14, Math.sin(a)*14);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#d4aaff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    this.drawHpBar(ctx);
    ctx.restore();
    for (const b of this.bullets) b.draw(ctx);
  }
}

/* -- Tank: heavy slow bullet sponge -- */
class Tank extends Enemy {
  constructor(x, y, wave) {
    super(x, y, 80 + wave * 12, 30 + wave * 2, 300, 22, '#ff3030', 'tank');
    this.fireRate = 1.0;
    this.fireSpread = 5;
  }

  update(dt, px, py, W, H) {
    const a = Math.atan2(py - this.y, px - this.x);
    this.x += Math.cos(a) * this.speed * dt;
    this.y += Math.sin(a) * this.speed * dt;
    this.angle = a;

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      for (let i = -2; i <= 2; i++) {
        this.shootAt(
          px + Math.cos(a + Math.PI/2) * i * 30,
          py + Math.sin(a + Math.PI/2) * i * 30,
          170, 1
        );
      }
      this.fireTimer = this.fireRate;
    }
    this.updateBullets(dt, W, H);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);

    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color;

    // Body
    ctx.fillStyle = '#cc2020';
    ctx.fillRect(-16, -16, 32, 28);
    // Turret
    ctx.fillStyle = '#ff5555';
    ctx.beginPath();
    ctx.arc(0, -4, 10, 0, Math.PI * 2);
    ctx.fill();
    // Barrel
    ctx.fillStyle = '#ffaaaa';
    ctx.fillRect(-2.5, -22, 5, 14);
    // Armor plates
    ctx.fillStyle = '#991515';
    ctx.fillRect(-16, -16, 7, 10);
    ctx.fillRect(9, -16, 7, 10);

    this.drawHpBar(ctx);
    ctx.restore();
    for (const b of this.bullets) b.draw(ctx);
  }
}

/* -- Boss: appears every 5 waves -- */
class Boss extends Enemy {
  constructor(x, y, wave) {
    super(x, y, 400 + wave * 60, 28, 800 + wave * 100, 38, '#ff3cac', 'boss');
    this.phase = 0;
    this.firePhase = 0;
    this.fireRate = 0.5;
    this.rotSpeed = 0.8;
    this.targetX = x; this.targetY = y;
    this.movePhase = 0;
  }

  update(dt, px, py, W, H) {
    this.phase += dt;
    this.movePhase += dt * 0.6;
    // Roam pattern
    this.targetX = W / 2 + Math.cos(this.movePhase) * W * 0.3;
    this.targetY = H * 0.25 + Math.abs(Math.sin(this.movePhase * 0.7)) * H * 0.2;
    this.x = Utils.lerp(this.x, this.targetX, 1.5 * dt);
    this.y = Utils.lerp(this.y, this.targetY, 1.5 * dt);

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.firePhase++;
      const pattern = this.firePhase % 3;
      if (pattern === 0) {
        // Spiral
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + this.phase;
          this.bullets.push(new Bullet(
            this.x, this.y,
            Math.cos(a) * 190, Math.sin(a) * 190,
            1, '#ff3cac', 5, false
          ));
        }
      } else if (pattern === 1) {
        // Aimed triple
        const a = Math.atan2(py - this.y, px - this.x);
        for (let off of [-0.2, 0, 0.2]) {
          this.bullets.push(new Bullet(
            this.x, this.y,
            Math.cos(a + off) * 230, Math.sin(a + off) * 230,
            1, '#ff88cc', 5, false
          ));
        }
      } else {
        // Shotgun ring
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          this.bullets.push(new Bullet(
            this.x, this.y,
            Math.cos(a) * 150, Math.sin(a) * 150,
            1, '#cc44ff', 4, false
          ));
        }
      }
      this.fireTimer = this.fireRate;
    }
    this.updateBullets(dt, W, H);
  }

  draw(ctx) {
    const { x, y, phase, hp, maxHp } = this;
    const pulse = 0.8 + 0.2 * Math.sin(phase * 3);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase * 0.4);

    // Aura
    const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    aura.addColorStop(0, `rgba(255,60,172,${0.15 * pulse})`);
    aura.addColorStop(1, 'rgba(255,60,172,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff3cac';
    ctx.strokeStyle = `rgba(255,60,172,${0.6 * pulse})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 34 + i * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Body
    ctx.fillStyle = '#cc1a88';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 34 : 22;
      i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
              : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fill();

    // Core
    ctx.fillStyle = '#ff3cac';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // HP bar (wide, above boss)
    const bw = 100, bh = 7;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - bw/2, y - this.radius - 18, bw, bh);
    const hpRatio = hp / maxHp;
    const hpColor = hpRatio > 0.6 ? '#ff3cac' : hpRatio > 0.3 ? '#ffaa00' : '#ff4444';
    ctx.fillStyle = hpColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = hpColor;
    ctx.fillRect(x - bw/2, y - this.radius - 18, bw * hpRatio, bh);
    // Boss label
    ctx.font = `bold 9px 'Orbitron', sans-serif`;
    ctx.fillStyle = '#ff3cac';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', x, y - this.radius - 22);
    ctx.restore();

    for (const b of this.bullets) b.draw(ctx);
  }
}

/* =============================================
   ASTEROID
   ============================================= */
class Asteroid {
  constructor(x, y, size, vx, vy, wave = 1) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = size; // 'large','medium','small'
    this.radius = size === 'large' ? 28 : size === 'medium' ? 18 : 10;
    this.hp = size === 'large' ? 40 : size === 'medium' ? 20 : 10;
    this.maxHp = this.hp;
    this.scoreValue = size === 'large' ? 100 : size === 'medium' ? 50 : 25;
    this.dead = false;
    this.angle = Utils.rand(0, Math.PI * 2);
    this.rotSpeed = Utils.rand(-1.2, 1.2);
    this.points = this._genPoints();
    this.color = Utils.pick(['#8899aa', '#aabbcc', '#667788', '#99aabb']);
  }

  _genPoints() {
    const pts = [];
    const count = Utils.randInt(7, 11);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = this.radius * Utils.rand(0.7, 1.0);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }

  split() {
    if (this.size === 'small') return [];
    const nextSize = this.size === 'large' ? 'medium' : 'small';
    return [0.6, -0.6].map(angleOff => {
      const angle = Math.atan2(this.vy, this.vx) + angleOff;
      const speed = Utils.rand(60, 110);
      return new Asteroid(this.x, this.y, nextSize,
        Math.cos(angle) * speed, Math.sin(angle) * speed
      );
    });
  }

  update(dt, W, H) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.rotSpeed * dt;
    // Wrap
    if (this.x < -50) this.x = W + 50;
    if (this.x > W+50) this.x = -50;
    if (this.y < -50) this.y = H + 50;
    if (this.y > H+50) this.y = -50;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(136,153,170,0.4)';
    ctx.fillStyle = this.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crater detail
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(this.radius * 0.25, -this.radius * 0.2, this.radius * 0.2, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
}

/* =============================================
   GEM (dropped by enemies)
   ============================================= */
class Gem {
  constructor(x, y, value = 50) {
    this.x = x; this.y = y;
    this.value = value;
    this.radius = 8;
    this.dead = false;
    this.phase = Utils.rand(0, Math.PI * 2);
    this.vx = Utils.rand(-40, 40);
    this.vy = Utils.rand(-40, 40);
    this.life = 12; // seconds before disappear
    this.color = '#00f0ff';
  }

  update(dt, W, H) {
    this.phase += dt * 3;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Utils.clamp(this.x, 10, W - 10);
    this.y = Utils.clamp(this.y, 10, H - 10);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const bob = Math.sin(this.phase) * 3;
    const alpha = this.life < 3 ? this.life / 3 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(this.phase * 0.5);

    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00f0ff';

    // Diamond shape
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
