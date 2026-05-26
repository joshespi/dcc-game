// Enemy base class + all enemy types
// Floor 1: Rat, Goblin, Fairy, CrackCamel
// Floor 2+: Skeleton + all floor-1 types with stat scaling
var EnemyFactory = (function () {

  // ── Base Enemy ─────────────────────────────────────────────────────────

  function Enemy(scene, x, y, def) {
    this.scene    = scene;
    this.typeName = def.name;
    this.maxHp    = def.hp;
    this.hp       = def.hp;
    this.damage   = def.damage;
    this.speed    = def.speed;
    this.xpValue  = def.xp;
    this.aggroRange  = def.aggroRange  || 180;
    this.attackRange = def.attackRange || 28;
    this.attackCd    = def.attackCd    || 1000;
    this.isMelee     = def.isMelee !== false;
    this.missileSpeed = def.missileSpeed || 0;
    // Optional: called with (carlStatus) when this enemy lands a melee hit
    this.onHitEffect  = def.onHitEffect  || null;

    this.bodyW = def.bodyW || 20;
    this.bodyH = def.bodyH || 20;
    this.sprite = scene.physics.add.sprite(x, y, def.texture);
    this.sprite.setDepth(9);
    this.sprite.body.setSize(this.bodyW, this.bodyH);
    this.sprite.body.setOffset(
      (32 - this.bodyW) / 2,
      (32 - this.bodyH) / 2
    );
    this.sprite._enemyRef = this; // back-reference for collision callbacks

    this._attackTimer    = 0;
    this._aggroed        = false;
    this._aggroBurstUntil = 0;
    this._onDeath        = null;
    this._dead           = false;
    this._wanderTimer    = 0;
    this._wanderVx       = 0;
    this._wanderVy       = 0;
    this._everHit        = false;
    this._hpPctLast      = -1;

    // HP bar — hidden until first hit
    var BAR_W = 28, BAR_H = 4;
    this._hpBarBg   = scene.add.rectangle(x, y - 18, BAR_W, BAR_H, 0x330000).setDepth(11).setVisible(false);
    this._hpBarFill = scene.add.rectangle(x, y - 18, BAR_W, BAR_H, 0xcc2222).setDepth(12).setVisible(false).setOrigin(0, 0.5);
  }

  Enemy.prototype.onDeath = function (fn) { this._onDeath = fn; };

  Enemy.prototype._flashTint = function (color, ms) {
    var spr = this.sprite;
    spr.setTint(color);
    this.scene.time.delayedCall(ms, function () { if (spr && spr.active) spr.clearTint(); });
  };

  Enemy.prototype._tryAggro = function () {
    if (this._aggroed) return;
    this._aggroed = true;
    this._flashTint(0xff8800, 200);
    this._aggroBurstUntil = Date.now() + 400;
  };

  Enemy.prototype.update = function (carlX, carlY, delta, missileGroup) {
    if (this._dead || !this.sprite.active) return;
    if (this._everHit) this._updateHpBar();

    var now  = Date.now();
    if (this._stunUntil && now < this._stunUntil) {
      this.sprite.setVelocity(0, 0);
      return;
    }
    // Lure overrides Carl's position as the chase target
    var targetX = (this._lureUntil && now < this._lureUntil) ? this._lureX : carlX;
    var targetY = (this._lureUntil && now < this._lureUntil) ? this._lureY : carlY;

    var dx   = targetX - this.sprite.x;
    var dy   = targetY - this.sprite.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < this.aggroRange && !this._aggroed) {
      this._tryAggro();
    }

    if (this._aggroed && dist < this.aggroRange * 2.5) {
      // Chase
      var spd = (this._aggroBurstUntil && now < this._aggroBurstUntil)
        ? this.speed * 1.3
        : this.speed;
      this.sprite.setVelocity((dx / dist) * spd, (dy / dist) * spd);

      // Attack
      if (dist < this.attackRange && now - this._attackTimer > this.attackCd) {
        this._attackTimer = now;
        this._doAttack(carlX, carlY, missileGroup);
      }
    } else {
      if (this._noWander) {
        this.sprite.setVelocity(0, 0);
      } else {
        if (now - this._wanderTimer > 1800) {
          this._wanderTimer = now;
          var angle = Math.random() * Math.PI * 2;
          this._wanderVx = Math.cos(angle) * (this.speed * 0.3);
          this._wanderVy = Math.sin(angle) * (this.speed * 0.3);
          if (Math.random() < 0.3) { this._wanderVx = 0; this._wanderVy = 0; }
        }
        this.sprite.setVelocity(this._wanderVx, this._wanderVy);
      }
    }
  };

  Enemy.prototype._doAttack = function (carlX, carlY, missileGroup) {
    // Ranged enemies override this
    _playHitSound();
  };

  Enemy.prototype.takeDamage = function (amount) {
    if (this._dead) return;
    this.hp -= amount;

    this._flashTint(0xffffff, 100);

    // Reveal HP bar on first hit
    if (!this._everHit) {
      this._everHit = true;
      this._hpBarBg.setVisible(true);
      this._hpBarFill.setVisible(true);
    }
    this._updateHpBar();

    if (this.hp <= 0) this._die();
  };

  Enemy.prototype._updateHpBar = function () {
    var BAR_W = 28;
    var pct = Math.max(0, this.hp / this.maxHp);
    var sx = this.sprite.x, sy = this.sprite.y - 18;
    this._hpBarBg.setPosition(sx, sy);
    this._hpBarFill.setPosition(sx - BAR_W / 2, sy);
    if (pct !== this._hpPctLast) {
      this._hpBarFill.setDisplaySize(Math.max(1, BAR_W * pct), 4);
      var color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xccaa00 : 0xcc2222;
      this._hpBarFill.setFillStyle(color);
      this._hpPctLast = pct;
    }
  };

  Enemy.prototype._die = function () {
    if (this._dead) return;
    this._dead = true;
    _playDeathSound();
    this._hpBarBg.destroy();
    this._hpBarFill.destroy();
    // Fade out
    var spr = this.sprite;
    var scene = this.scene;
    scene.tweens.add({
      targets: spr,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: function () {
        spr.setActive(false).setVisible(false);
        spr.body.setVelocity(0, 0);
      }
    });
    if (this._onDeath) this._onDeath(this);
  };

  Enemy.prototype.isDead = function () { return this._dead; };

  Enemy.prototype.overlapsRect = function (rect) {
    if (this._dead) return false;
    var hw = this.bodyW / 2, hh = this.bodyH / 2;
    var ex = this.sprite.x, ey = this.sprite.y;
    return ex + hw > rect.x && ex - hw < rect.x + rect.width &&
           ey + hh > rect.y && ey - hh < rect.y + rect.height;
  };

  Enemy.prototype.getAttackHitRect = function () {
    // Returns a rect centred on this enemy for melee reach
    return new Phaser.Geom.Rectangle(
      this.sprite.x - this.attackRange / 2,
      this.sprite.y - this.attackRange / 2,
      this.attackRange, this.attackRange
    );
  };

  Enemy.prototype.canMeleeHit = function (carlX, carlY) {
    if (this._dead) return false;
    var dx = carlX - this.sprite.x;
    var dy = carlY - this.sprite.y;
    var threshold = this.attackRange + 8;
    return dx * dx + dy * dy < threshold * threshold;
  };

  // ── Enemy definitions ──────────────────────────────────────────────────

  var DEFS = {
    rat: {
      name: 'Rat', texture: 'rat', hp: 12, damage: 4,
      speed: 90, xp: 8,
      aggroRange: 160, attackRange: 22, attackCd: 900,
      bodyW: 14, bodyH: 14,
      // 30% chance to inflict Poison on hit (lore-accurate)
      onHitEffect: function (status) {
        if (Math.random() < 0.30) {
          status.applyDebuff(DEBUFF_POISON, 8000, 2, 1500);
          return DEBUFF_POISON;
        }
        return null;
      },
    },
    goblin: {
      name: 'Goblin', texture: 'goblin', hp: 22, damage: 7,
      speed: 70, xp: 15,
      aggroRange: 200, attackRange: 28, attackCd: 1100,
      // 15% chance to steal and drink Carl's potion on hit
      onHitEffect: function (status) {
        if (Math.random() < 0.15 && status.hasPotions()) {
          status.usePotion();
          return 'steal';
        }
        return null;
      },
    },
    fairy: {
      name: 'Fairy', texture: 'fairy', hp: 10, damage: 6,
      speed: 110, xp: 12,
      aggroRange: 220, attackRange: 200, attackCd: 1800,
      isMelee: false, missileSpeed: 180,
      bodyW: 14, bodyH: 14,
    },
    crack_camel: {
      name: 'Crack Camel', texture: 'crack_camel', hp: 45, damage: 12,
      speed: 50, xp: 25,
      aggroRange: 160, attackRange: 35, attackCd: 1400,
    },
    skeleton: {
      name: 'Skeleton', texture: 'skeleton', hp: 35, damage: 10,
      speed: 60, xp: 20,
      aggroRange: 200, attackRange: 32, attackCd: 1200,
    },
    rot_sticker: {
      name: 'Rot Sticker', texture: 'rot_sticker', hp: 8, damage: 14,
      speed: 55, xp: 10,
      aggroRange: 200, attackRange: 24,
      bodyW: 16, bodyH: 12,
    },
    trog_pygmy: {
      name: 'Trog Pygmy', texture: 'trog_pygmy', hp: 15, damage: 5,
      speed: 130, xp: 12,
      aggroRange: 190, attackRange: 26, attackCd: 1000,
      bodyW: 16, bodyH: 18,
      // venomous bite — 35% poison on hit
      onHitEffect: function (status) {
        if (Math.random() < 0.35) {
          status.applyDebuff(DEBUFF_POISON, 6000, 2, 1500);
          return DEBUFF_POISON;
        }
        return null;
      },
    },
  };

  // ── Fairy overrides melee attack with ranged ───────────────────────────

  function FairyEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.fairy);
    this._missileGroup = null;
  }
  FairyEnemy.prototype = Object.create(Enemy.prototype);
  FairyEnemy.prototype.constructor = FairyEnemy;

  FairyEnemy.prototype.setMissileGroup = function (g) { this._missileGroup = g; };

  FairyEnemy.prototype._doAttack = function (carlX, carlY) {
    if (!this._missileGroup) return;
    var m = this._missileGroup.get(this.sprite.x, this.sprite.y, 'magic_missile');
    if (!m) return;
    m.setActive(true).setVisible(true).setDepth(12);
    m.setTint(0xff88ff); // pink tint to distinguish from Donut missiles
    m.body.reset(this.sprite.x, this.sprite.y);
    m.damage = this.damage;
    m.isEnemyProjectile = true;
    m.setCircle(7);
    var dx = carlX - this.sprite.x;
    var dy = carlY - this.sprite.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var spd = this.missileSpeed;
    m.setVelocity((dx / d) * spd, (dy / d) * spd);
    var scene = this.scene;
    scene.time.delayedCall(1600, function () {
      if (m.active) m.setActive(false).setVisible(false).destroy();
    });
    _playHitSound(0.08);
  };

  // ── Goblin — retreats after landing a hit ─────────────────────────────

  function GoblinEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.goblin);
    this._retreating   = false;
    this._retreatUntil = 0;
    this._retreatVx    = 0;
    this._retreatVy    = 0;
  }
  GoblinEnemy.prototype = Object.create(Enemy.prototype);
  GoblinEnemy.prototype.constructor = GoblinEnemy;

  GoblinEnemy.prototype._doAttack = function (carlX, carlY) {
    _playHitSound();
    // Kick off retreat: flee directly away from Carl for 600ms
    var dx = this.sprite.x - carlX;
    var dy = this.sprite.y - carlY;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var spd = this.speed * 1.6;
    this._retreatVx    = (dx / d) * spd;
    this._retreatVy    = (dy / d) * spd;
    this._retreating   = true;
    this._retreatUntil = Date.now() + 600;
  };

  GoblinEnemy.prototype.update = function (carlX, carlY, delta, missileGroup) {
    if (this._dead || !this.sprite.active) return;
    var now = Date.now();
    if (this._stunUntil && now < this._stunUntil) { this.sprite.setVelocity(0, 0); return; }
    if (this._everHit) this._updateHpBar();

    var dx = carlX - this.sprite.x, dy = carlY - this.sprite.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this.aggroRange && !this._aggroed) this._tryAggro();
    if (this._retreating) {
      if (now < this._retreatUntil) {
        this.sprite.setVelocity(this._retreatVx, this._retreatVy);
        return;
      }
      this._retreating = false;
    }
    // Default Enemy behavior
    Enemy.prototype.update.call(this, carlX, carlY, delta, missileGroup);
  };

  // ── CrackCamel — charges when aggro triggers ──────────────────────────

  function CrackCamelEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.crack_camel);
    this._charging      = false;
    this._chargeUntil   = 0;
    this._chargeCooldown = 0;
    this._chargeCdMs    = 5000;
    this._baseSpeed     = this.speed;
  }
  CrackCamelEnemy.prototype = Object.create(Enemy.prototype);
  CrackCamelEnemy.prototype.constructor = CrackCamelEnemy;

  CrackCamelEnemy.prototype.update = function (carlX, carlY, delta, missileGroup) {
    if (this._dead || !this.sprite.active) return;
    var now  = Date.now();
    if (this._stunUntil && now < this._stunUntil) { this.sprite.setVelocity(0, 0); return; }
    if (this._everHit) this._updateHpBar();

    var dx   = carlX - this.sprite.x;
    var dy   = carlY - this.sprite.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Trigger charge when first aggroed and cooldown expired
    var wasAggroed = this._aggroed;
    if (dist < this.aggroRange && !this._aggroed) this._tryAggro();

    if (!wasAggroed && this._aggroed) {
      // Just aggroed — start charge
      this._startCharge();
    }

    if (this._charging) {
      if (now < this._chargeUntil) {
        // Charge at full bore toward Carl
        if (dist > 1) {
          this.sprite.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
        }
        // Melee handled by GameScene overlap — nothing extra here
        return;
      }
      // Charge ended
      this._charging  = false;
      this.speed      = this._baseSpeed;
      this.sprite.clearTint();
      this._chargeCooldown = now + this._chargeCdMs;
    }

    // Re-charge every 5s while aggroed
    if (this._aggroed && !this._charging && now >= this._chargeCooldown && dist < this.aggroRange * 1.5) {
      this._startCharge();
    }

    Enemy.prototype.update.call(this, carlX, carlY, delta, missileGroup);
  };

  CrackCamelEnemy.prototype._startCharge = function () {
    this._charging    = true;
    this._chargeUntil = Date.now() + 800;
    this.speed        = this._baseSpeed * 2.5;
    this.sprite.setTint(0xff4400);
    _playHitSound(0.05);
  };

  // ── Skeleton — 25% chance to block incoming hits ──────────────────────

  function SkeletonEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.skeleton);
    this._blockChance = 0.25;
  }
  SkeletonEnemy.prototype = Object.create(Enemy.prototype);
  SkeletonEnemy.prototype.constructor = SkeletonEnemy;

  SkeletonEnemy.prototype.takeDamage = function (amount) {
    if (this._dead) return;
    if (Math.random() < this._blockChance) {
      amount = 1;
      this._flashTint(0x4488ff, 100);
      if (!this._everHit) {
        this._everHit = true;
        this._hpBarBg.setVisible(true);
        this._hpBarFill.setVisible(true);
      }
      this.hp -= amount;
      this._updateHpBar();
      _playClank(this.scene);
      var txt = this.scene.add.text(this.sprite.x, this.sprite.y - 22, 'BLOCK!',
        { fontSize: '11px', fill: '#88ccff', stroke: '#000022', strokeThickness: 3 });
      txt.setDepth(20).setOrigin(0.5);
      this.scene.tweens.add({ targets: txt, alpha: 0, y: txt.y - 14, duration: 700,
        onComplete: function () { txt.destroy(); } });
      if (this.hp <= 0) this._die();
      return;
    }
    Enemy.prototype.takeDamage.call(this, amount);
  };

  // ── Rot Sticker — wall-clinging suicide bomber ────────────────────────

  function RotStickerEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.rot_sticker);
    this._attached    = false;  // latched onto Carl
    this._fuseTimer   = 0;      // timestamp when fuse started
    this._fuseDuration = 3000;  // 3s to explode after attaching
    this._exploded    = false;
    this._onKnockdown = null;   // callback(carlX, carlY) set by GameScene
    this._chittering  = null;   // repeating tween for idle shake
    this._fuseTick    = 0;      // frame counter for countdown text pacing
    this._startChitter();
  }
  RotStickerEnemy.prototype = Object.create(Enemy.prototype);
  RotStickerEnemy.prototype.constructor = RotStickerEnemy;

  RotStickerEnemy.prototype._startChitter = function () {
    if (this._dead || !this.sprite.active) return;
    var spr = this.sprite;
    // Tint-pulse instead of position tween — avoids fighting the physics body
    this._chittering = this.scene.tweens.add({
      targets: spr,
      alpha: 0.7,
      duration: 120, yoyo: true, repeat: -1, ease: 'Linear',
    });
  };

  RotStickerEnemy.prototype.update = function (carlX, carlY, delta) {
    if (this._dead || !this.sprite.active) return;
    var now = Date.now();
    if (this._stunUntil && now < this._stunUntil) { this.sprite.setVelocity(0, 0); return; }
    if (this._everHit) this._updateHpBar();

    if (this._attached) {
      // Ride Carl's position
      this.sprite.body.setVelocity(0, 0);
      var secsLeft = Math.ceil((this._fuseTimer + this._fuseDuration - now) / 1000);
      if (secsLeft > 0) {
        // Flash red as fuse counts down
        var flash = now % 500 < 200;
        this.sprite.setTint(flash ? 0xff2200 : 0xffffff);
        // Emit one countdown label per second (frame counter, not wall-clock modulo)
        this._fuseTick++;
        if (this._fuseTick % 60 === 1) {
          var txt = this.scene.add.text(this.sprite.x, this.sprite.y - 18,
            secsLeft + '!', { fontFamily: 'monospace', fontSize: '11px',
            color: '#ff4400', stroke: '#000', strokeThickness: 2 })
            .setDepth(55).setOrigin(0.5, 1);
          this.scene.tweens.add({ targets: txt, alpha: 0, y: txt.y - 10,
            duration: 900, onComplete: function () { txt.destroy(); } });
        }
      }
      if (now >= this._fuseTimer + this._fuseDuration) {
        this._explode(carlX, carlY);
      }
      return;
    }

    var dx = carlX - this.sprite.x;
    var dy = carlY - this.sprite.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < this.aggroRange && !this._aggroed) this._tryAggro();

    if (this._aggroed && dist < this.aggroRange * 2.5) {
      if (this._chittering) { this._chittering.stop(); this._chittering = null; }
      this.sprite.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
      // Attach when close
      if (dist < this.attackRange) {
        this._attached = true;
        this._fuseTimer = now;
        this.sprite.setVelocity(0, 0);
        _playHitSound(0.07);
      }
    } else {
      this.sprite.setVelocity(0, 0);
    }
  };

  RotStickerEnemy.prototype._explode = function (carlX, carlY) {
    if (this._exploded || this._dead) return;
    this._exploded = true;
    if (this._chittering) { this._chittering.stop(); this._chittering = null; }
    var scene = this.scene;
    var bx = this.sprite.x, by = this.sprite.y;

    // Visual blast
    var g = scene.add.graphics().setDepth(20);
    g.fillStyle(0xff4400, 0.7);
    g.fillCircle(bx, by, 40);
    scene.tweens.add({ targets: g, alpha: 0, scaleX: 2.2, scaleY: 2.2,
      duration: 400, onComplete: function () { g.destroy(); } });

    // Camera shake
    scene.cameras.main.shake(300, 0.016);

    // Damage + knockdown via callback
    if (this._onKnockdown) this._onKnockdown(this.damage);

    _playDeathSound();
    this._die();
  };

  RotStickerEnemy.prototype._doAttack = function () { /* explodes instead */ };

  RotStickerEnemy.prototype.setKnockdownCallback = function (fn) {
    this._onKnockdown = fn;
  };

  // ── Danger Dingo (Floor 2) — mastiff, charges, corpse paint, barks ──────

  DEFS.danger_dingo = {
    name: 'Danger Dingo', texture: 'danger_dingo', hp: 38, damage: 13,
    speed: 90, xp: 25,
    aggroRange: 220, attackRange: 28, attackCd: 900,
    bodyW: 24, bodyH: 16,
    onHitEffect: null,
  };

  function DangerDingoEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.danger_dingo);
    this._charging     = false;
    this._chargeUntil  = 0;
    this._chargeCd     = 0;
    this._chargeCdMs   = 4000;
    this._baseSpeed    = this.speed;
    this._barkCd       = 0;
  }
  DangerDingoEnemy.prototype = Object.create(Enemy.prototype);
  DangerDingoEnemy.prototype.constructor = DangerDingoEnemy;

  var DINGO_BARKS = [
    '"CRIKEY! YOU CALL THAT A PUNCH?!" — DANGER DINGO',
    '"THAT\'S NOT A KNIFE. THAT\'S NOT A KNIFE EITHER." — DANGER DINGO',
    '"COME ON, MATE. I\'VE HAD WORSE FROM A TAIPAN." — DANGER DINGO',
    '"BEWDY BOTTLER! HAVE A CRACK AT ME!" — DANGER DINGO',
    '"YOU\'RE IN STRIFE NOW, SUNSHINE." — DANGER DINGO',
  ];

  DangerDingoEnemy.prototype.update = function (carlX, carlY, delta, missileGroup) {
    if (this._dead || !this.sprite.active) return;
    var now = Date.now();
    if (this._stunUntil && now < this._stunUntil) { this.sprite.setVelocity(0, 0); return; }
    if (this._everHit) this._updateHpBar();

    var dx = carlX - this.sprite.x, dy = carlY - this.sprite.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.aggroRange && !this._aggroed) this._tryAggro();

    // Bark when first aggroed, then occasionally
    if (this._aggroed && now > this._barkCd) {
      this._barkCd = now + 6000 + Math.random() * 4000;
      var bark = DINGO_BARKS[Math.floor(Math.random() * DINGO_BARKS.length)];
      var txt = this.scene.add.text(this.sprite.x, this.sprite.y - 18, '🐕', { fontSize: '10px' });
      txt.setDepth(20).setOrigin(0.5);
      this.scene.tweens.add({ targets: txt, alpha: 0, y: txt.y - 8, duration: 800,
        onComplete: function () { txt.destroy(); } });
      if (this._onBark) this._onBark(bark);
    }

    // Charge attack every 4s
    if (this._aggroed && !this._charging && now >= this._chargeCd && dist < this.aggroRange * 1.4) {
      this._charging    = true;
      this._chargeUntil = now + 700;
      this.speed        = this._baseSpeed * 2.8;
      this.sprite.setTint(0xff6600);
    }

    if (this._charging) {
      if (now < this._chargeUntil) {
        if (dist > 1) this.sprite.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
        return;
      }
      this._charging  = false;
      this.speed      = this._baseSpeed;
      this.sprite.clearTint();
      this._chargeCd  = now + this._chargeCdMs;
    }

    Enemy.prototype.update.call(this, carlX, carlY, delta, missileGroup);
  };

  DangerDingoEnemy.prototype.onBark = function (fn) { this._onBark = fn; };

  // ── Brindle Grub (Floor 2) — harmless worm, eats corpses ─────────────────

  DEFS.brindle_grub = {
    name: 'Brindle Grub', texture: 'brindle_grub', hp: 4, damage: 0,
    speed: 35, xp: 0,
    aggroRange: 9999, attackRange: 0, attackCd: 99999,
    bodyW: 20, bodyH: 12,
  };

  function BrindleGrubEnemy(scene, x, y) {
    Enemy.call(this, scene, x, y, DEFS.brindle_grub);
    this.isMelee = false;
    this._targetCorpse = null;
  }
  BrindleGrubEnemy.prototype = Object.create(Enemy.prototype);
  BrindleGrubEnemy.prototype.constructor = BrindleGrubEnemy;

  BrindleGrubEnemy.prototype.update = function (carlX, carlY, delta, missileGroup, corpses) {
    if (this._dead || !this.sprite.active) return;

    var nearest = null, nearDist2 = Infinity;
    if (corpses) {
      for (var i = 0; i < corpses.length; i++) {
        var corp = corpses[i];
        if (!corp.sprite || !corp.sprite.active) continue;
        var dx = corp.sprite.x - this.sprite.x;
        var dy = corp.sprite.y - this.sprite.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < nearDist2) { nearDist2 = d2; nearest = corp; }
      }
    }

    if (nearest && nearDist2 < 400) {
      if (!nearest._consumed) {
        if (this._eatingCorpse !== nearest) {
          if (this._eatingCorpse) this._eatingCorpse._grubsEating = Math.max(0, (this._eatingCorpse._grubsEating || 0) - 1);
          this._eatingCorpse = nearest;
          nearest._grubsEating = (nearest._grubsEating || 0) + 1;
        }
        if (nearest._grubsEating >= 2) {
          nearest._consumed = true; // prevent double-destroy in same frame
          if (nearest.sprite) { nearest.sprite.destroy(); nearest.sprite = null; }
          if (corpses) {
            for (var ci = corpses.length - 1; ci >= 0; ci--) {
              if (corpses[ci] === nearest) { corpses.splice(ci, 1); break; }
            }
          }
        }
      }
      this.sprite.setVelocity(0, 0);
    } else {
      if (this._eatingCorpse) {
        this._eatingCorpse._grubsEating = Math.max(0, (this._eatingCorpse._grubsEating || 0) - 1);
        this._eatingCorpse = null;
      }
      if (nearest) {
        var tx = nearest.sprite.x - this.sprite.x;
        var ty = nearest.sprite.y - this.sprite.y;
        var td = Math.sqrt(tx * tx + ty * ty) || 1;
        this.sprite.setVelocity((tx / td) * this.speed, (ty / td) * this.speed);
      } else {
        // No corpse — drift toward Carl at half speed
        var cx = carlX - this.sprite.x, cy = carlY - this.sprite.y;
        var cd = Math.sqrt(cx * cx + cy * cy) || 1;
        this.sprite.setVelocity((cx / cd) * this.speed * 0.5, (cy / cd) * this.speed * 0.5);
      }
    }
  };

  // ── Factory ────────────────────────────────────────────────────────────

  function create(scene, type, x, y, floorNum) {
    var def = DEFS[type];
    if (!def) def = DEFS.rat;

    // Scale stats for deeper floors
    var scale = 1 + (floorNum - 1) * 0.25;
    var scaledDef = Object.assign({}, def, {
      hp:     Math.round(def.hp     * scale),
      damage: Math.round(def.damage * scale),
      xp:     Math.round(def.xp    * scale),
    });

    if (type === 'trog_pygmy')   return new Enemy(scene, x, y, scaledDef);
    if (type === 'fairy')        return new FairyEnemy(scene, x, y, scaledDef);
    if (type === 'rot_sticker')  return new RotStickerEnemy(scene, x, y, scaledDef);
    if (type === 'goblin')       return new GoblinEnemy(scene, x, y, scaledDef);
    if (type === 'crack_camel')  return new CrackCamelEnemy(scene, x, y, scaledDef);
    if (type === 'skeleton')     return new SkeletonEnemy(scene, x, y, scaledDef);
    if (type === 'brindle_grub') return new BrindleGrubEnemy(scene, x, y);
    if (type === 'danger_dingo') return new DangerDingoEnemy(scene, x, y, scaledDef);
    return new Enemy(scene, x, y, scaledDef);
  }

  // Neighborhood boss — buffed placeholder until The Hoarder gets own sprite
  function createBoss(scene, x, y, floorNum) {
    var scale = 1 + (floorNum - 1) * 0.3;
    var bossDef = {
      name: 'The Hoarder',
      texture: 'hoarder',
      hp:     Math.round(220 * scale),
      damage: Math.round(18  * scale),
      speed:  52,
      xp:     Math.round(180 * scale),
      aggroRange:  300,
      attackRange: 42,
      attackCd:    1100,
      bodyW: 32, bodyH: 32,
    };
    var boss = new Enemy(scene, x, y, bossDef);
    boss.sprite.setScale(1.0).setDepth(9);
    boss.sprite.body.setSize(32, 32);
    boss.sprite.body.setOffset(8, 12);
    boss.isBoss      = true;
    boss._noWander   = true;  // stands still until aggroed
    boss._phase      = 1;
    boss._slamCd     = 0;    // ms timestamp when next slam is ready
    boss._slamCdMs   = 4500; // slam every 4.5s
    return boss;
  }

  // Types available per floor
  function typesForFloor(floorNum) {
    if (floorNum === 1) return ['rat', 'goblin', 'fairy', 'crack_camel', 'rot_sticker', 'trog_pygmy', 'trog_pygmy'];
    // Floor 2: skeletons introduced, crack camels gone
    if (floorNum === 2) return ['skeleton', 'goblin', 'rat', 'fairy', 'skeleton', 'danger_dingo', 'brindle_grub']; // skeleton/danger_dingo weighted
    return ['skeleton', 'goblin', 'crack_camel', 'fairy', 'rat'];
  }

  // ── Sounds ────────────────────────────────────────────────────────────

  var _audioCtx = null;
  function _getCtx() {
    if (!_audioCtx) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) {}
    }
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  }

  function _playHitSound(vol) {
    var ctx = _getCtx();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      var t = ctx.currentTime;
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      gain.gain.setValueAtTime(vol || 0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.start(t); osc.stop(t + 0.15);
    } catch (e) {}
  }

  function _playClank(scene) {
    var ctx = _getCtx();
    if (!ctx) return;
    try {
      var buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
      }
      var src = ctx.createBufferSource();
      var gain = ctx.createGain();
      src.buffer = buf;
      src.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      src.start(ctx.currentTime);
    } catch (e) {}
  }

  function _playDeathSound() {
    var ctx = _getCtx();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      var t = ctx.currentTime;
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.3);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.33);
    } catch (e) {}
  }

  return {
    create: create,
    createBoss: createBoss,
    typesForFloor: typesForFloor,
    FairyEnemy: FairyEnemy,
    RotStickerEnemy: RotStickerEnemy,
    GoblinEnemy: GoblinEnemy,
    CrackCamelEnemy: CrackCamelEnemy,
    SkeletonEnemy: SkeletonEnemy,
    BrindleGrubEnemy: BrindleGrubEnemy,
    DangerDingoEnemy: DangerDingoEnemy,
  };
})();
