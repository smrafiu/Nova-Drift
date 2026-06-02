/**
 * NOVA DRIFT — particles.js
 * Particle system for explosions, thruster, trails, pickups
 */

'use strict';

class Particle {
  constructor(x, y, vx, vy, size, color, life, gravity = 0, glow = false) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = size;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.gravity = gravity;
    this.glow = glow;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const alpha = Utils.clamp(this.life / this.maxLife, 0, 1);
    const sz = this.size * alpha;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (this.glow) {
      ctx.shadowBlur = sz * 4;
      ctx.shadowColor = this.color;
    }
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class TrailParticle extends Particle {
  constructor(x, y, color) {
    super(x, y,
      Utils.rand(-15, 15), Utils.rand(-15, 15),
      Utils.rand(1, 3), color,
      Utils.rand(0.2, 0.5), 0, true
    );
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  clear() { this.particles = []; }

  add(p) { this.particles.push(p); }

  /** Explosion burst */
  explode(x, y, count, colors, sizeRange = [2, 6], speedRange = [40, 180]) {
    for (let i = 0; i < count; i++) {
      const angle = Utils.rand(0, Math.PI * 2);
      const speed = Utils.rand(...speedRange);
      const size  = Utils.rand(...sizeRange);
      const color = Utils.pick(colors);
      const life  = Utils.rand(0.4, 1.1);
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        size, color, life, 20, true
      ));
    }
  }

  /** Enemy death (orange/red sparks) */
  enemyDeath(x, y, color = '#ff6030') {
    this.explode(x, y, 22,
      [color, '#ffaa44', '#ff3300', '#ffdd88'],
      [2, 5], [60, 220]
    );
    // Shockwave ring particles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * 120,
        Math.sin(angle) * 120,
        3, '#ffaa44', 0.35, 0, true
      ));
    }
  }

  /** Player hit flash */
  playerHit(x, y) {
    this.explode(x, y, 16,
      ['#ff3cac', '#ffffff', '#ff88cc'],
      [1.5, 4], [50, 160]
    );
  }

  /** Thruster / engine trail */
  thruster(x, y, angle, intensity = 1) {
    const count = Math.round(Utils.rand(2, 5) * intensity);
    for (let i = 0; i < count; i++) {
      const spread = Utils.rand(-0.4, 0.4);
      const speed  = Utils.rand(60, 140) * intensity;
      this.particles.push(new Particle(
        x + Utils.rand(-3, 3),
        y + Utils.rand(-3, 3),
        Math.cos(angle + spread) * speed,
        Math.sin(angle + spread) * speed,
        Utils.rand(1.5, 3.5),
        Utils.pick(['#00f0ff', '#a259ff', '#ffffff', '#44aaff']),
        Utils.rand(0.12, 0.35),
        0, true
      ));
    }
  }

  /** Pickup / gem collect sparkle */
  collectSparkle(x, y, color = '#00f0ff') {
    this.explode(x, y, 14,
      [color, '#ffffff', '#aaffff'],
      [1.5, 3], [40, 140]
    );
  }

  /** Nova bomb shockwave */
  novaBomb(x, y, radius) {
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const r = Utils.rand(radius * 0.3, radius);
      this.particles.push(new Particle(
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r,
        Math.cos(angle) * Utils.rand(20, 80),
        Math.sin(angle) * Utils.rand(20, 80),
        Utils.rand(2, 5),
        Utils.pick(['#ff3cac', '#a259ff', '#ffffff', '#00f0ff']),
        Utils.rand(0.4, 1.0),
        0, true
      ));
    }
  }

  /** Star / warp speed lines (menu) */
  warpLine(canvasW, canvasH) {
    const x = Utils.rand(0, canvasW);
    const y = Utils.rand(0, canvasH);
    const speed = Utils.rand(100, 400);
    this.particles.push(new Particle(
      x, y, speed, 0,
      Utils.rand(0.5, 2),
      `rgba(255,255,255,${Utils.rand(0.2, 0.7)})`,
      Utils.rand(0.3, 0.8)
    ));
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].dead) this.particles.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.particles) p.draw(ctx);
  }
}

// Global particle system
const PS = new ParticleSystem();
