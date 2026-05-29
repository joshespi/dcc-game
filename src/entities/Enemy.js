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
    this._aggroR2    = this.aggroRange * this.aggroRange;
    this._aggroHoldR2 = (this.aggroRange * 2.5) * (this.aggroRange * 2.5);
    this._attackR2   = this.attackRange * this.attackRange;
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

  Enemy.prototype._revealHpBar = function () {
    if (this._everHit) return;
    this._everHit = true;
    this._hpBarBg.setVisible(true);
    this._hpBarFill.setVisible(true);
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
    var d2   = dx * dx + dy * dy;

    if (d2 < this._aggroR2 && !this._aggroed) {
      this._tryAggro();
    }

    if (this._aggroed && d2 < this._aggroHoldR2) {
      var dist = Math.sqrt(d2) || 1;
      var spd = (this._aggroBurstUntil && now < this._aggroBurstUntil)
        ? this.speed * 1.3
        : this.speed;
      this.sprite.setVelocity((dx / dist) * spd, (dy / dist) * spd);

      if (d2 < this._attackR2 && now - this._attackTimer > this.attackCd) {
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
    this._revealHpBar();
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
    trog_basher: {
      name: 'Trog Basher', texture: 'trog_basher', hp: 42, damage: 10,
      speed: 55, xp: 22,
      aggroRange: 170, attackRange: 34, attackCd: 1300,
      bodyW: 22, bodyH: 22,
    },
    trog_virtuoso: {
      name: 'Trog Virtuoso', texture: 'trog_virtuoso', hp: 18, damage: 6,
      speed: 65, xp: 18,
      aggroRange: 210, attackRange: 70, attackCd: 1600,
      bodyW: 16, bodyH: 18,
      // tongue inflicts guaranteed poison
      onHitEffect: function (status) {
        status.applyDebuff(DEBUFF_POISON, 7000, 2, 1400);
        return DEBUFF_POISON;
      },
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

  DEFS.scatterer = {
    name: 'Scatterer', texture: 'scatterer', hp: 10, damage: 6,
    speed: 155, xp: 7,
    aggroRange: 140, attackRange: 22, attackCd: 750,
    bodyW: 14, bodyH: 10,
  };

  DEFS.bad_llama = {
    name: 'Bad Llama', texture: 'bad_llama', hp: 58, damage: 14,
    speed: 42, xp: 30,
    aggroRange: 200, attackRange: 175, attackCd: 2200,
    isMelee: false, missileSpeed: 155,
    bodyW: 24, bodyH: 18,
  };

  DEFS.scat_thug = {
    name: 'Scat Thug', texture: 'scat_thug', hp: 28, damage: 9,
    speed: 72, xp: 18,
    aggroRange: 190, attackRange: 36, attackCd: 1200,
    bodyW: 16, bodyH: 18,
  };

  // ── Fairy overrides melee attack with ranged ───────────────────────────

  function FairyEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.fairy);
    this._missileGroup = null;
  }
  FairyEnemy.prototype = Object.create(Enemy.prototype);
  FairyEnemy.prototype.constructor = FairyEnemy;

  FairyEnemy.prototype.setMissileGroup = function (g) { this._missileGroup = g; };

  function _fireEnemyMissile(enemy, carlX, carlY, opts) {
    if (!enemy._missileGroup) return null;
    var m = enemy._missileGroup.get(enemy.sprite.x, enemy.sprite.y, 'magic_missile');
    if (!m) return null;
    m.setActive(true).setVisible(true).setDepth(12);
    m.setTint(opts.tint);
    m.body.reset(enemy.sprite.x, enemy.sprite.y);
    m.damage             = enemy.damage;
    m.isEnemyProjectile  = true;
    m.sourceName         = opts.sourceName;
    m.applyDebuff        = opts.applyDebuff || null;
    m.setCircle(7);
    var dx = carlX - enemy.sprite.x, dy = carlY - enemy.sprite.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var spd = enemy.missileSpeed;
    m.setVelocity((dx / d) * spd, (dy / d) * spd);
    enemy.scene.time.delayedCall(opts.lifetimeMs, function () {
      if (m.active) m.setActive(false).setVisible(false).destroy();
    });
    return m;
  }

  FairyEnemy.prototype._doAttack = function (carlX, carlY) {
    if (_fireEnemyMissile(this, carlX, carlY, {
      tint: 0xff88ff, sourceName: 'Fairy', lifetimeMs: 1600,
    })) _playHitSound(0.08);
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
    if (dx * dx + dy * dy < this._aggroR2 && !this._aggroed) this._tryAggro();
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
    var d2   = dx * dx + dy * dy;

    var wasAggroed = this._aggroed;
    if (d2 < this._aggroR2 && !this._aggroed) this._tryAggro();

    if (!wasAggroed && this._aggroed) this._startCharge();

    if (this._charging) {
      if (now < this._chargeUntil) {
        if (d2 > 1) {
          var dist = Math.sqrt(d2);
          this.sprite.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
        }
        return;
      }
      this._charging  = false;
      this.speed      = this._baseSpeed;
      this.sprite.clearTint();
      this._chargeCooldown = now + this._chargeCdMs;
    }

    var rechargeR2 = (this.aggroRange * 1.5) * (this.aggroRange * 1.5);
    if (this._aggroed && !this._charging && now >= this._chargeCooldown && d2 < rechargeR2) {
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
      this._revealHpBar();
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
    var d2 = dx * dx + dy * dy;

    if (d2 < this._aggroR2 && !this._aggroed) this._tryAggro();

    if (this._aggroed && d2 < this._aggroHoldR2) {
      if (this._chittering) { this._chittering.stop(); this._chittering = null; }
      var dist = Math.sqrt(d2) || 1;
      this.sprite.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
      if (d2 < this._attackR2) {
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

  // ── Trog Virtuoso — tongue lash, guaranteed poison, retreats after strike ──

  function TrogVirtuosoEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.trog_virtuoso);
    this._retreating   = false;
    this._retreatUntil = 0;
    this._retreatVx    = 0;
    this._retreatVy    = 0;
  }
  TrogVirtuosoEnemy.prototype = Object.create(Enemy.prototype);
  TrogVirtuosoEnemy.prototype.constructor = TrogVirtuosoEnemy;

  TrogVirtuosoEnemy.prototype._doAttack = function (carlX, carlY) {
    var scene = this.scene;
    var bx = this.sprite.x, by = this.sprite.y;

    // Draw a tongue line toward Carl then fade
    var g = scene.add.graphics().setDepth(18);
    g.lineStyle(2, 0xdd2266, 1);
    g.beginPath(); g.moveTo(bx, by); g.lineTo(carlX, carlY); g.strokePath();
    // Fork at the tip
    var dx = carlX - bx, dy = carlY - by, d = Math.sqrt(dx*dx+dy*dy)||1;
    var px = carlX - (dx/d)*6, py = carlY - (dy/d)*6;
    var nx = -(dy/d)*5, ny = (dx/d)*5;
    g.lineStyle(1, 0xdd2266, 1);
    g.beginPath(); g.moveTo(px, py); g.lineTo(carlX+nx, carlY+ny); g.strokePath();
    g.beginPath(); g.moveTo(px, py); g.lineTo(carlX-nx, carlY-ny); g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: function () { g.destroy(); } });

    // Retreat away from Carl after striking
    var rd = Math.sqrt(dx*dx+dy*dy)||1;
    this._retreatVx    = -(dx/rd) * this.speed * 1.4;
    this._retreatVy    = -(dy/rd) * this.speed * 1.4;
    this._retreating   = true;
    this._retreatUntil = Date.now() + 700;

    _playHitSound(0.06);
  };

  TrogVirtuosoEnemy.prototype.update = function (carlX, carlY, delta, missileGroup) {
    if (this._dead || !this.sprite.active) return;
    var now = Date.now();
    if (this._stunUntil && now < this._stunUntil) { this.sprite.setVelocity(0, 0); return; }
    if (this._everHit) this._updateHpBar();

    var dx = carlX - this.sprite.x, dy = carlY - this.sprite.y;
    var d2 = dx * dx + dy * dy;
    if (d2 < this._aggroR2 && !this._aggroed) this._tryAggro();

    if (this._retreating) {
      if (now < this._retreatUntil) {
        this.sprite.setVelocity(this._retreatVx, this._retreatVy);
        return;
      }
      this._retreating = false;
    }

    if (this._aggroed && d2 < this._aggroHoldR2) {
      var minTongueR2 = (this.attackRange * 0.6) * (this.attackRange * 0.6);
      if (d2 > minTongueR2) {
        var dist = Math.sqrt(d2) || 1;
        this.sprite.setVelocity((dx/dist) * this.speed, (dy/dist) * this.speed);
      } else {
        this.sprite.setVelocity(0, 0);
      }
      if (d2 < this._attackR2 && now - this._attackTimer > this.attackCd) {
        this._attackTimer = now;
        this._doAttack(carlX, carlY);
      }
    } else {
      if (now - this._wanderTimer > 2000) {
        this._wanderTimer = now;
        var angle = Math.random() * Math.PI * 2;
        this.sprite.setVelocity(Math.cos(angle)*this.speed*0.25, Math.sin(angle)*this.speed*0.25);
      }
    }
  };

  // ── Scatterer — cockroach swarm; aggro cascades to nearby siblings ────────

  var _scattererAll = [];

  function ScattererEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.scatterer);
    _scattererAll.push(this);
    var me = this;
    this.onDeath(function () {
      var i = _scattererAll.indexOf(me);
      if (i !== -1) _scattererAll.splice(i, 1);
    });
  }
  ScattererEnemy.prototype = Object.create(Enemy.prototype);
  ScattererEnemy.prototype.constructor = ScattererEnemy;

  function _resetScattererSwarm() { _scattererAll.length = 0; }

  ScattererEnemy.prototype._tryAggro = function () {
    Enemy.prototype._tryAggro.call(this);
    var RANGE = 90;
    var sx = this.sprite.x, sy = this.sprite.y;
    var now = Date.now();
    var me = this;
    // Prune stale refs, then cascade aggro to nearby idle siblings
    for (var i = _scattererAll.length - 1; i >= 0; i--) {
      var s = _scattererAll[i];
      if (s._dead || !s.sprite || !s.sprite.active) { _scattererAll.splice(i, 1); continue; }
      if (s === me || s._aggroed) continue;
      var dx = s.sprite.x - sx, dy = s.sprite.y - sy;
      if (dx * dx + dy * dy < RANGE * RANGE) {
        s._aggroed = true;
        s._aggroBurstUntil = now + 400;
        s._flashTint(0xff8800, 200);
      }
    }
  };

  // ── Bad Llama — ranged lava-ball, inflicts Septic on hit ─────────────────

  function BadLlamaEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.bad_llama);
    this._missileGroup = null;
  }
  BadLlamaEnemy.prototype = Object.create(Enemy.prototype);
  BadLlamaEnemy.prototype.constructor = BadLlamaEnemy;

  BadLlamaEnemy.prototype.setMissileGroup = function (g) { this._missileGroup = g; };

  BadLlamaEnemy.prototype._doAttack = function (carlX, carlY) {
    if (_fireEnemyMissile(this, carlX, carlY, {
      tint: 0xff4400, sourceName: 'Bad Llama', lifetimeMs: 1800, applyDebuff: DEBUFF_SEPTIC,
    })) _playHitSound(0.07);
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
    var d2 = dx * dx + dy * dy;

    if (d2 < this._aggroR2 && !this._aggroed) this._tryAggro();

    if (this._aggroed && now > this._barkCd) {
      this._barkCd = now + 6000 + Math.random() * 4000;
      var bark = DINGO_BARKS[Math.floor(Math.random() * DINGO_BARKS.length)];
      var txt = this.scene.add.text(this.sprite.x, this.sprite.y - 18, '🐕', { fontSize: '10px' });
      txt.setDepth(20).setOrigin(0.5);
      this.scene.tweens.add({ targets: txt, alpha: 0, y: txt.y - 8, duration: 800,
        onComplete: function () { txt.destroy(); } });
      if (this._onBark) this._onBark(bark);
    }

    var chargeR2 = (this.aggroRange * 1.4) * (this.aggroRange * 1.4);
    if (this._aggroed && !this._charging && now >= this._chargeCd && d2 < chargeR2) {
      this._charging    = true;
      this._chargeUntil = now + 700;
      this.speed        = this._baseSpeed * 2.8;
      this.sprite.setTint(0xff6600);
    }

    if (this._charging) {
      if (now < this._chargeUntil) {
        if (d2 > 1) {
          var dist = Math.sqrt(d2);
          this.sprite.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
        }
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

  var GRUB_PUPA_AFTER = 2;    // corpses eaten before entering pupa
  var GRUB_PUPA_MS   = 60000; // 60s pupa countdown (compressed from lore's 10 hours)

  function BrindleGrubEnemy(scene, x, y) {
    Enemy.call(this, scene, x, y, DEFS.brindle_grub);
    this.isMelee = false;
    this._targetCorpse  = null;
    this._corpsesEaten  = 0;
    this._inPupa        = false;
    this._pupaStartedAt = 0;
    this._onSpawnVespa  = null; // callback(x, y) set by GameScene
  }
  BrindleGrubEnemy.prototype = Object.create(Enemy.prototype);
  BrindleGrubEnemy.prototype.constructor = BrindleGrubEnemy;

  BrindleGrubEnemy.prototype.setPupaCallback = function (fn) { this._onSpawnVespa = fn; };

  BrindleGrubEnemy.prototype._enterPupa = function () {
    if (this._inPupa) return;
    this._inPupa = true;
    this._pupaStartedAt = Date.now();
    this.sprite.setVelocity(0, 0);
    // Pupa visual: pulse red/yellow, grow slightly
    var spr = this.sprite;
    this.scene.tweens.add({
      targets: spr, scaleX: 1.6, scaleY: 1.4,
      duration: 800, ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: spr, alpha: 0.6, duration: 500,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  };

  BrindleGrubEnemy.prototype.update = function (carlX, carlY, delta, missileGroup, corpses) {
    if (this._dead || !this.sprite.active) return;

    var now = Date.now();

    // Pupa stage — immobile, countdown, then hatch
    if (this._inPupa) {
      this.sprite.setVelocity(0, 0);
      var secsLeft = Math.ceil((this._pupaStartedAt + GRUB_PUPA_MS - now) / 1000);
      var flash = now % 600 < 250;
      this.sprite.setTint(flash ? 0xff4400 : 0xffcc00);
      if (now >= this._pupaStartedAt + GRUB_PUPA_MS) {
        // Hatch — 50% chance per lore (post-patch)
        if (Math.random() < 0.5 && this._onSpawnVespa) {
          this._onSpawnVespa(this.sprite.x, this.sprite.y);
        }
        this._die();
      }
      return;
    }

    var nearest = this._cachedTarget;
    var nearDist2 = Infinity;
    var cachedValid = nearest && nearest.sprite && nearest.sprite.active && !nearest._consumed;
    if (cachedValid) {
      var cdx = nearest.sprite.x - this.sprite.x;
      var cdy = nearest.sprite.y - this.sprite.y;
      nearDist2 = cdx * cdx + cdy * cdy;
    } else {
      this._cachedTarget = null;
      nearest = null;
    }

    if (!nearest || now - (this._retargetAt || 0) > 800) {
      this._retargetAt = now;
      if (corpses) {
        for (var i = 0; i < corpses.length; i++) {
          var corp = corpses[i];
          if (!corp.sprite || !corp.sprite.active || corp._consumed) continue;
          var dx = corp.sprite.x - this.sprite.x;
          var dy = corp.sprite.y - this.sprite.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < nearDist2) { nearDist2 = d2; nearest = corp; }
        }
      }
      this._cachedTarget = nearest;
    }

    if (nearest && nearDist2 < 400) {
      if (!nearest._consumed) {
        if (this._eatingCorpse !== nearest) {
          if (this._eatingCorpse) this._eatingCorpse._grubsEating = Math.max(0, (this._eatingCorpse._grubsEating || 0) - 1);
          this._eatingCorpse = nearest;
          nearest._grubsEating = (nearest._grubsEating || 0) + 1;
        }
        if (nearest._grubsEating >= 2) {
          nearest._consumed = true;
          // Credit all eating grubs — any grub touching this corpse gets a meal
          // (tracked via _grubsEating being set on the corpse)
          this._corpsesEaten++;
          if (nearest.sprite) { nearest.sprite.destroy(); nearest.sprite = null; }
          if (corpses) {
            for (var ci = corpses.length - 1; ci >= 0; ci--) {
              if (corpses[ci] === nearest) { corpses.splice(ci, 1); break; }
            }
          }
          if (this._corpsesEaten >= GRUB_PUPA_AFTER) this._enterPupa();
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

  // ── Mind Horror (Floor 2) — floating brain jellyfish, psionic proximity attack ──
  // Lore: moves slowly, psionic attack is mental (not physical), Donut unaffected.
  // Physically very weak — bounces/splatters when punched. Do NOT enter their neighborhood.

  DEFS.mind_horror = {
    name: 'Mind Horror', texture: 'mind_horror', hp: 8, damage: 0,
    speed: 28, xp: 20,
    aggroRange: 200, attackRange: 140, attackCd: 2500,
    isMelee: false, missileSpeed: 0, // psionic attack handled in update override
    bodyW: 16, bodyH: 14,
  };

  function MindHorrorEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.mind_horror);
    this.isMelee = false;
    this._psionicCd = 0;
    this._psionicCdMs = 2500;
    this._onPsionic = null; // callback(dmg) → set by GameScene
    // Float gently up and down
    scene.tweens.add({
      targets: this.sprite, y: this.sprite.y - 6,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }
  MindHorrorEnemy.prototype = Object.create(Enemy.prototype);
  MindHorrorEnemy.prototype.constructor = MindHorrorEnemy;

  MindHorrorEnemy.prototype.setPsionicCallback = function (fn) { this._onPsionic = fn; };

  MindHorrorEnemy.prototype._doAttack = function (carlX, carlY) {
    if (this._onPsionic) this._onPsionic(this.damage || 6);
    // Visual burst from caster
    var g = this.scene.add.graphics().setDepth(18);
    g.fillStyle(0xcc44aa, 0.4);
    g.fillCircle(this.sprite.x, this.sprite.y, 50);
    this.scene.tweens.add({
      targets: g, alpha: 0, scaleX: 2.2, scaleY: 2.2, duration: 600,
      onComplete: function () { g.destroy(); }
    });
    _playHitSound(0.04);
  };

  // ── Clurichaun Rev-Up Consultant (Floor 2) — ranged slingshot, inflicts The Taint ──
  // Lore: small troll-like, oversized head, hook nose, ruddy cheeks, green overalls, pilgrim shoes.
  // Sneezes lime-green oily residue (The Taint) that blocks all healing for 5 minutes.

  DEFS.clurichaun = {
    name: 'Clurichaun', texture: 'clurichaun', hp: 18, damage: 5,
    speed: 60, xp: 20,
    aggroRange: 240, attackRange: 180, attackCd: 2000,
    isMelee: false, missileSpeed: 150,
    bodyW: 16, bodyH: 18,
  };

  function ClurichaunnEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.clurichaun);
    this._missileGroup = null;
  }
  ClurichaunnEnemy.prototype = Object.create(Enemy.prototype);
  ClurichaunnEnemy.prototype.constructor = ClurichaunnEnemy;

  ClurichaunnEnemy.prototype.setMissileGroup = function (g) { this._missileGroup = g; };

  ClurichaunnEnemy.prototype._doAttack = function (carlX, carlY) {
    var m = _fireEnemyMissile(this, carlX, carlY, {
      tint: 0x44dd22, sourceName: 'Clurichaun', lifetimeMs: 1400, applyDebuff: DEBUFF_TAINT,
    });
    if (m) {
      // Override damage on missile — Taint is the real threat, not the hit
      m.damage = Math.max(1, this.damage);
      _playHitSound(0.06);
    }
  };

  // ── Brindled Vespa (Floor 2) — hatched from Brindle Grub pupa, spits acid ──
  // Lore: giant hornet body, pair of grasping arms with clawed fingers, top face still looks like a brindle grub.

  DEFS.brindled_vespa = {
    name: 'Brindled Vespa', texture: 'brindled_vespa', hp: 24, damage: 8,
    speed: 100, xp: 18,
    aggroRange: 200, attackRange: 160, attackCd: 1800,
    isMelee: false, missileSpeed: 180,
    bodyW: 18, bodyH: 16,
  };

  function BrindledVespaEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.brindled_vespa);
    this._missileGroup = null;
  }
  BrindledVespaEnemy.prototype = Object.create(Enemy.prototype);
  BrindledVespaEnemy.prototype.constructor = BrindledVespaEnemy;

  BrindledVespaEnemy.prototype.setMissileGroup = function (g) { this._missileGroup = g; };

  BrindledVespaEnemy.prototype._doAttack = function (carlX, carlY) {
    if (_fireEnemyMissile(this, carlX, carlY, {
      tint: 0xffee44, sourceName: 'Brindled Vespa', lifetimeMs: 1500, applyDebuff: DEBUFF_SEPTIC,
    })) _playHitSound(0.07);
  };

  // ── Kobold Rider (Floor 2) — armored chihuahua, lance charges on dingoes ──
  // Lore: size of a chihuahua standing upright, chainmail of beer-can tabs, tiny spiked cap, lance.

  DEFS.kobold_rider = {
    name: 'Kobold Rider', texture: 'kobold_rider', hp: 22, damage: 11,
    speed: 95, xp: 22,
    aggroRange: 200, attackRange: 30, attackCd: 1000,
    bodyW: 16, bodyH: 18,
  };

  function KoboldRiderEnemy(scene, x, y, scaledDef) {
    Enemy.call(this, scene, x, y, scaledDef || DEFS.kobold_rider);
    this._charging     = false;
    this._chargeUntil  = 0;
    this._chargeCd     = 0;
    this._chargeCdMs   = 3500;
    this._baseSpeed    = this.speed;
  }
  KoboldRiderEnemy.prototype = Object.create(Enemy.prototype);
  KoboldRiderEnemy.prototype.constructor = KoboldRiderEnemy;

  KoboldRiderEnemy.prototype.update = function (carlX, carlY, delta, missileGroup) {
    if (this._dead || !this.sprite.active) return;
    var now = Date.now();
    if (this._stunUntil && now < this._stunUntil) { this.sprite.setVelocity(0, 0); return; }
    if (this._everHit) this._updateHpBar();

    var dx = carlX - this.sprite.x, dy = carlY - this.sprite.y;
    var d2 = dx * dx + dy * dy;

    if (d2 < this._aggroR2 && !this._aggroed) this._tryAggro();

    var chargeR2 = (this.aggroRange * 1.3) * (this.aggroRange * 1.3);
    if (this._aggroed && !this._charging && now >= this._chargeCd && d2 < chargeR2) {
      this._charging    = true;
      this._chargeUntil = now + 650;
      this.speed        = this._baseSpeed * 2.6;
      this.sprite.setTint(0xffcc00);
    }

    if (this._charging) {
      if (now < this._chargeUntil) {
        if (d2 > 1) {
          var dist = Math.sqrt(d2);
          this.sprite.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
        }
        return;
      }
      this._charging  = false;
      this.speed      = this._baseSpeed;
      this.sprite.clearTint();
      this._chargeCd  = now + this._chargeCdMs;
    }

    Enemy.prototype.update.call(this, carlX, carlY, delta, missileGroup);
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

    if (type === 'trog_pygmy')    return new Enemy(scene, x, y, scaledDef);
    if (type === 'trog_basher')   return new Enemy(scene, x, y, scaledDef);
    if (type === 'trog_virtuoso') return new TrogVirtuosoEnemy(scene, x, y, scaledDef);
    if (type === 'fairy')        return new FairyEnemy(scene, x, y, scaledDef);
    if (type === 'rot_sticker')  return new RotStickerEnemy(scene, x, y, scaledDef);
    if (type === 'goblin')       return new GoblinEnemy(scene, x, y, scaledDef);
    if (type === 'crack_camel')  return new CrackCamelEnemy(scene, x, y, scaledDef);
    if (type === 'skeleton')     return new SkeletonEnemy(scene, x, y, scaledDef);
    if (type === 'brindle_grub')   return new BrindleGrubEnemy(scene, x, y);
    if (type === 'danger_dingo')   return new DangerDingoEnemy(scene, x, y, scaledDef);
    if (type === 'scatterer')      return new ScattererEnemy(scene, x, y, scaledDef);
    if (type === 'bad_llama')      return new BadLlamaEnemy(scene, x, y, scaledDef);
    if (type === 'scat_thug')      return new Enemy(scene, x, y, scaledDef);
    if (type === 'clurichaun')     return new ClurichaunnEnemy(scene, x, y, scaledDef);
    if (type === 'brindled_vespa') return new BrindledVespaEnemy(scene, x, y, scaledDef);
    if (type === 'kobold_rider')   return new KoboldRiderEnemy(scene, x, y, scaledDef);
    if (type === 'mind_horror')    return new MindHorrorEnemy(scene, x, y, scaledDef);
    return new Enemy(scene, x, y, scaledDef);
  }

  // Neighborhood boss — buffed placeholder until The Hoarder gets own sprite
  function createBoss(scene, x, y, floorNum) {
    var scale = 1 + (floorNum - 1) * 0.3;
    var bossDef = {
      name: 'The Hoarder',
      texture: 'hoarder',
      hp:     Math.round(420 * scale),
      damage: Math.round(24  * scale),
      speed:  62,
      xp:     Math.round(240 * scale),
      aggroRange:  320,
      attackRange: 42,
      attackCd:    900,
      bodyW: 32, bodyH: 32,
    };
    var boss = new Enemy(scene, x, y, bossDef);
    boss.sprite.setScale(1.0).setDepth(9);
    boss.sprite.body.setSize(32, 32);
    boss.sprite.body.setOffset(8, 12);
    boss.isBoss      = true;
    boss._noWander   = true;
    boss._phase      = 1;
    boss._slamCd     = 0;
    boss._slamCdMs   = 3200;
    return boss;
  }

  // Types available per floor
  function typesForFloor(floorNum) {
    if (floorNum === 1) return ['rat', 'goblin', 'fairy', 'crack_camel', 'rot_sticker', 'trog_pygmy', 'trog_basher', 'trog_virtuoso', 'scatterer', 'scatterer', 'bad_llama', 'scat_thug'];
    // Floor 2: skeletons + dingoes + clurichauns + kobold riders + mind horrors + vespas (from pupa)
    if (floorNum === 2) return ['skeleton', 'skeleton', 'goblin', 'rat', 'fairy', 'danger_dingo', 'brindle_grub', 'clurichaun', 'kobold_rider', 'kobold_rider', 'mind_horror'];
    return ['skeleton', 'goblin', 'crack_camel', 'fairy', 'rat'];
  }

  function _playHitSound(vol) {
    var ctx = GameAudio.getCtx();
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
    var ctx = GameAudio.getCtx();
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
    var ctx = GameAudio.getCtx();
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
    ScattererEnemy: ScattererEnemy,
    BadLlamaEnemy: BadLlamaEnemy,
    ClurichaunnEnemy: ClurichaunnEnemy,
    BrindledVespaEnemy: BrindledVespaEnemy,
    KoboldRiderEnemy: KoboldRiderEnemy,
    MindHorrorEnemy: MindHorrorEnemy,
    resetSwarms: _resetScattererSwarm,
  };
})();
