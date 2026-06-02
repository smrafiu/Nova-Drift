/**
 * NOVA DRIFT — powerups.js  v1.3
 * All icons drawn with Canvas 2D paths — zero emoji
 */

'use strict';

class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type  = type;
    this.radius = 14;
    this.dead   = false;
    this.phase  = Math.random() * Math.PI * 2;
    this.life   = 10;
    this.vx     = Utils.rand(-30, 30);
    this.vy     = Utils.rand(-30, 30);

    const cfg   = PowerUp.CONFIG[type];
    this.color  = cfg.color;
    this.label  = cfg.label;
  }

  static CONFIG = {
    shield:    { color: '#a259ff', label: 'SHIELD'     },
    rapidfire: { color: '#ffe066', label: 'RAPID FIRE' },
    bomb:      { color: '#ff3cac', label: 'NOVA BOMB'  },
    heal:      { color: '#39ff14', label: 'REPAIR'     },
  };

  static randomType() {
    const types   = ['shield', 'rapidfire', 'bomb', 'heal'];
    const weights = [0.3, 0.3, 0.2, 0.2];
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < types.length; i++) {
      acc += weights[i];
      if (r < acc) return types[i];
    }
    return 'shield';
  }

  update(dt, W, H) {
    this.phase += dt * 2.5;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Utils.clamp(this.x, 20, W - 20);
    this.y = Utils.clamp(this.y, 20, H - 20);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  apply(player) {
    switch (this.type) {
      case 'shield':    player.shieldHp = player.maxShieldHp; break;
      case 'rapidfire': player.rapidFireTimer = 7; break;
      case 'bomb':      player.bombCount = Math.min(player.bombCount + 1, 5); break;
      case 'heal':      player.hp = Math.min(player.hp + 1, player.maxHp); break;
    }
    PS.collectSparkle(this.x, this.y, this.color);
    this.dead = true;
  }

  // ── Canvas icon drawers (no emoji) ────────────────────

  _drawShield(ctx, s) {
    // Pentagon shield outline
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.85, -s * 0.3);
    ctx.lineTo(s * 0.6,  s * 0.85);
    ctx.lineTo(-s * 0.6, s * 0.85);
    ctx.lineTo(-s * 0.85, -s * 0.3);
    ctx.closePath();
    ctx.globalAlpha *= 0.25;
    ctx.fill();
    ctx.globalAlpha /= 0.25;
    ctx.stroke();
    // Inner cross bar
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, 0.2);
    ctx.lineTo(s * 0.35, 0.2);
    ctx.stroke();
  }

  _drawRapidfire(ctx, s) {
    // Lightning bolt
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(s * 0.2,  -s);
    ctx.lineTo(-s * 0.3,  s * 0.05);
    ctx.lineTo(s * 0.1,   s * 0.05);
    ctx.lineTo(-s * 0.2,  s);
    ctx.lineTo(s * 0.35,  -s * 0.08);
    ctx.lineTo(-s * 0.05, -s * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  _drawBomb(ctx, s) {
    // Nova: 6-pointed starburst
    const pts = 6;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s : s * 0.44;
      i === 0
        ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    // Bright centre
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawHeal(ctx, s) {
    // Plus / cross for repair
    const t = s * 0.32, h = s * 0.88;
    ctx.fillStyle = this.color;
    // Vertical bar
    ctx.beginPath();
    ctx.roundRect(-t, -h, t * 2, h * 2, 2);
    ctx.fill();
    // Horizontal bar
    ctx.beginPath();
    ctx.roundRect(-h, -t, h * 2, t * 2, 2);
    ctx.fill();
  }

  draw(ctx) {
    const bob   = Math.sin(this.phase) * 4;
    const pulse = 0.75 + 0.25 * Math.sin(this.phase * 1.5);
    const alpha = this.life < 3 ? this.life / 3 : 1;
    const s     = this.radius * 0.58; // icon scale

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y + bob);

    // Outer glow ring
    ctx.shadowBlur  = 22 * pulse;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 4 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Dark background circle
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(5,5,16,0.88)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle color tint
    ctx.fillStyle   = this.color;
    ctx.globalAlpha = alpha * 0.15;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;

    // Canvas-drawn icon (no emoji)
    ctx.shadowBlur  = 10;
    ctx.shadowColor = this.color;
    switch (this.type) {
      case 'shield':    this._drawShield(ctx, s);    break;
      case 'rapidfire': this._drawRapidfire(ctx, s); break;
      case 'bomb':      this._drawBomb(ctx, s);      break;
      case 'heal':      this._drawHeal(ctx, s);      break;
    }
    ctx.shadowBlur = 0;

    // Rotating outer tick marks
    ctx.save();
    ctx.rotate(this.phase * 0.6);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = alpha * 0.4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (this.radius + 5), Math.sin(a) * (this.radius + 5));
      ctx.lineTo(Math.cos(a) * (this.radius + 9), Math.sin(a) * (this.radius + 9));
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }
}
