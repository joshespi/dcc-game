// Donut — Carl's princess cat companion
// Follows Carl, casts spells, passive healing purr
var Donut = (function () {
  var FOLLOW_DIST  = 40;   // try to stay this far behind Carl
  var FOLLOW_SPEED = 160;
  var SPELL_CD     = 2200; // ms between Magic Missiles
  var PASSIVE_TICK = 3000; // ms between passive heals (if Carl hasn't taken damage)
  var MP_REGEN_TICK = 30000; // MP regen every 30s — INT 3 ≈ 2/min (lore: 1/hr, game = 120x compressed)
  var MISSILE_SPD  = 260;

  function Donut(scene, x, y, status) {
    this.scene  = scene;
    this.status = status;

    this.sprite = scene.physics.add.sprite(x, y, 'donut');
    this.sprite.setDepth(9);
    this.sprite.body.setSize(22, 22);
    this.sprite.body.setOffset(13, 18);

    this.glow = scene.add.image(x, y, 'donut_glow');
    this.glow.setDepth(8);
    this.glow.setAlpha(0);

    this._spellTimer   = 0;
    this._surgeTimer   = 0;
    this._passiveTimer = 0;
    this._mpRegenTimer = 0;
    this._onSpell      = null; // callback(spellName)
    this._onHeal       = null; // callback(amount)
    this._tooFarSince  = 0;    // timestamp when she first exceeded rescue threshold

    // Missiles are a physics group owned by GameScene — reference set after construction
    this.missiles = null;
  }

  Donut.prototype.onSpell = function (fn) { this._onSpell = fn; };
  Donut.prototype.onHeal  = function (fn) { this._onHeal  = fn; };

  Donut.prototype.setMissileGroup = function (group) { this.missiles = group; };

  var MISSILE_MP_COST = 4;
  var SURGE_CD        = 8000;
  var SURGE_MP_COST   = 2;  // lore: Heal spell costs 2 MP

  Donut.prototype.activateSpell = function (carlX, carlY, facing) {
    var now = Date.now();
    if (now - this._spellTimer < SPELL_CD) return false;
    if (!this.status.spendMp(MISSILE_MP_COST)) return 'no_mp';
    this._spellTimer = now;

    this._castMagicMissile(carlX, carlY, facing);
    if (this._onSpell) this._onSpell('magic_missile');

    // Glow burst
    this.glow.setAlpha(1);
    this.scene.tweens.add({
      targets: this.glow, alpha: 0, duration: 500, ease: 'Quad.easeOut'
    });

    _playNote(this.scene, 'cast');
    return true;
  };

  Donut.prototype.getSpellCooldownFraction = function () {
    var elapsed = Date.now() - this._spellTimer;
    return Math.min(1, elapsed / SPELL_CD);
  };

  Donut.prototype.getSurgeCooldownFraction = function () {
    return Math.min(1, (Date.now() - this._surgeTimer) / SURGE_CD);
  };

  Donut.prototype.activateHealSurge = function () {
    var now = Date.now();
    if (now - this._surgeTimer < SURGE_CD) return false;
    if (!this.status.spendMp(SURGE_MP_COST)) return 'no_mp';
    this._surgeTimer = now;

    var healAmt = Math.floor(this.status.maxHp * 0.20);  // lore: heals ~20% max HP
    var healed = this.status.heal(healAmt);
    if (this._onHeal) this._onHeal(healed);
    if (this._onSpell) this._onSpell('heal_surge');

    // Glow burst — pink/gold
    this.glow.setTint(0xffaaff);
    this.glow.setAlpha(1);
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 800, ease: 'Quad.easeOut' });

    _playNote(this.scene, 'surge');
    return healed;
  };

  Donut.prototype._castMagicMissile = function (fromX, fromY, facing) {
    if (!this.missiles) return;

    var m = this.missiles.get(this.sprite.x, this.sprite.y, 'magic_missile');
    if (!m) return;
    m.setActive(true).setVisible(true).setDepth(12);
    m.body.reset(this.sprite.x, this.sprite.y);
    m.damage = this.status.getSpellPower();
    m.setCircle(7);

    var vx = 0, vy = 0;
    if (facing === 'right') vx =  MISSILE_SPD;
    if (facing === 'left')  vx = -MISSILE_SPD;
    if (facing === 'down')  vy =  MISSILE_SPD;
    if (facing === 'up')    vy = -MISSILE_SPD;

    m.setVelocity(vx, vy);

    // Auto-destroy after 1.2 seconds
    this.scene.time.delayedCall(1200, function () {
      if (m.active) m.setActive(false).setVisible(false).destroy();
    });
  };

  Donut.prototype.update = function (carlX, carlY, carlFacing, delta) {
    var now = Date.now();

    // ── Follow Carl ────────────────────────────────────────────────────────
    var dx = carlX - this.sprite.x;
    var dy = carlY - this.sprite.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Rescue teleport — if stuck too far from Carl for >2s, warp behind him
    if (dist > 260) {
      if (!this._tooFarSince) this._tooFarSince = now;
      if (now - this._tooFarSince > 2000) {
        var angle0 = Math.atan2(dy, dx);
        this.sprite.body.reset(
          carlX - Math.cos(angle0) * FOLLOW_DIST,
          carlY - Math.sin(angle0) * FOLLOW_DIST
        );
        this._tooFarSince = 0;
      }
    } else {
      this._tooFarSince = 0;
    }

    if (dist > FOLLOW_DIST + 10) {
      // Move toward Carl's back
      var angle = Math.atan2(dy, dx);
      var tx = carlX - Math.cos(angle) * FOLLOW_DIST;
      var ty = carlY - Math.sin(angle) * FOLLOW_DIST;
      var ddx = tx - this.sprite.x;
      var ddy = ty - this.sprite.y;
      var dd  = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      var spd = Math.min(FOLLOW_SPEED, dd * 6); // ease in
      this.sprite.setVelocity((ddx / dd) * spd, (ddy / dd) * spd);
    } else {
      this.sprite.setVelocity(0, 0);
    }

    // Keep glow centered
    this.glow.setPosition(this.sprite.x, this.sprite.y);

    // ── Passive healing purr — only when Carl hasn't taken damage recently ────
    // CHA speeds up tick interval (min 1.5s at CHA 10) and increases heal amount
    var passiveTick = Math.max(1500, PASSIVE_TICK - this.status.stats.cha * 150);
    if (now - this._passiveTimer > passiveTick) {
      this._passiveTimer = now;
      if (now - this.status._lastDamageTime > 4000 && this.status.hp < this.status.maxHp) {
        var healAmt = 1 + Math.floor(this.status.stats.int / 6) + Math.floor(this.status.stats.cha / 3);
        var healed = this.status.heal(healAmt);
        if (healed > 0 && this._onHeal) this._onHeal(healed);
      }
    }

    // ── MP regen — INT 3 = ~2 MP/min (120x lore compression: lore = 1/hr)
    if (now - this._mpRegenTimer > MP_REGEN_TICK) {
      this._mpRegenTimer = now;
      if (this.status.mp < this.status.maxMp) {
        var regenAmt = Math.max(1, Math.round(this.status.stats.int * 0.6));
        this.status.regenMp(regenAmt);
      }
    }
  };

  Donut.prototype.x = function () { return this.sprite.x; };
  Donut.prototype.y = function () { return this.sprite.y; };
  Donut.prototype.getSprite = function () { return this.sprite; };

  Donut.prototype.destroy = function () {
    this.sprite.destroy();
    this.glow.destroy();
  };

  function _playNote(scene, type) {
    var ctx = GameAudio.getCtx();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      var t = ctx.currentTime;
      if (type === 'cast') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t); osc.stop(t + 0.26);
      } else if (type === 'surge') {
        // Warm chord — root + fifth + octave sweep
        var freqs = [330, 495, 660];
        for (var fi = 0; fi < freqs.length; fi++) {
          (function (f) {
            var o2 = ctx.createOscillator(), g2 = ctx.createGain();
            o2.connect(g2); g2.connect(ctx.destination);
            o2.type = 'sine';
            o2.frequency.setValueAtTime(f, t);
            o2.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.5);
            g2.gain.setValueAtTime(0.10, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
            o2.start(t); o2.stop(t + 0.56);
          })(freqs[fi]);
        }
      }
    } catch (e) {}
  }

  return Donut;
})();
