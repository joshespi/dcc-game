// Carl — the player character
var Carl = (function () {
  var SPEED       = 130;
  var ATTACK_CD   = 350;   // ms between melee swings
  var ATTACK_DUR  = 180;   // ms the hitbox is active
  var IFRAMES     = 700;   // ms of invincibility after hit
  var HEAL_KEY_CD = 8000;  // ms between E-key potion use

  function Carl(scene, x, y, status) {
    this.scene   = scene;
    this.status  = status;
    this.facing  = 'down';

    this.sprite = scene.physics.add.sprite(x, y, 'carl_down');
    this.sprite.setDepth(10);
    // Collision body is tight around Carl's feet/legs — not the full 48×48 sprite
    // This keeps wall collision natural for a top-down view
    this.sprite.body.setSize(20, 20);
    this.sprite.body.setOffset(14, 26);

    this._attackTimer  = 0;
    this._iframeTimer  = 0;
    this._healTimer    = 0;
    this._attackActive = false;
    this._lastTex      = '';
    this._attackType   = 'punch'; // alternates punch / kick
    this._swingBox     = null;
    this._onHit        = null; // callback(damage, source)
    this._onAttack     = null; // callback(hitbox, damage)
    this._onHeal       = null; // callback()

    // Input
    this.keys = scene.input.keyboard.addKeys({
      up:     Phaser.Input.Keyboard.KeyCodes.W,
      down:   Phaser.Input.Keyboard.KeyCodes.S,
      left:   Phaser.Input.Keyboard.KeyCodes.A,
      right:  Phaser.Input.Keyboard.KeyCodes.D,
      attack: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });
    // arrow keys also work
    this.cursors = scene.input.keyboard.createCursorKeys();

    // Slash effect sprite (single frame, fades out)
    this.slashSprite = scene.add.sprite(x, y, 'slash');
    this.slashSprite.setDepth(11);
    this.slashSprite.setVisible(false);
    this.slashSprite.setAlpha(0);
  }

  Carl.prototype.onHit    = function (fn) { this._onHit    = fn; };
  Carl.prototype.onAttack = function (fn) { this._onAttack = fn; };
  Carl.prototype.onHeal   = function (fn) { this._onHeal   = fn; };

  Carl.prototype.getSprite = function () { return this.sprite; };

  Carl.prototype.update = function (delta) {
    var now = Date.now();
    var sp  = this.sprite;
    var keys = this.keys, cur = this.cursors;

    // ── Movement ──────────────────────────────────────────────────────────
    var vx = 0, vy = 0;
    var spd = SPEED + this.status.effectiveDex(now) * 1.5;
    if (this.status.hasDebuff(DEBUFF_SEPTIC, now)) spd *= 0.72;
    if (this.status._swiftnessUntil && now < this.status._swiftnessUntil) spd *= 2.0;

    if (keys.left.isDown  || cur.left.isDown)  { vx = -spd; this.facing = 'left'; }
    if (keys.right.isDown || cur.right.isDown) { vx =  spd; this.facing = 'right'; }
    if (keys.up.isDown    || cur.up.isDown)    { vy = -spd; this.facing = 'up'; }
    if (keys.down.isDown  || cur.down.isDown)  { vy =  spd; this.facing = 'down'; }

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    sp.setVelocity(vx, vy);

    var inIframe = now - this._iframeTimer < IFRAMES;
    if (inIframe || this._wasIframe || this.facing !== this._lastFacing) {
      var flashOn = inIframe && Math.floor(now / 80) % 2 === 0;
      var tex     = (flashOn ? 'carl_hit_' : 'carl_') + this.facing;
      if (tex !== this._lastTex) { this._lastTex = tex; sp.setTexture(tex); }
      this._wasIframe   = inIframe;
      this._lastFacing  = this.facing;
    }

    // ── Melee attack ──────────────────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(keys.attack) && now - this._attackTimer > ATTACK_CD) {
      this._startAttack(now);
    }

    // Expire active attack
    if (this._attackActive && now - this._attackTimer > ATTACK_DUR) {
      this._attackActive = false;
      if (this.slashSprite) this.slashSprite.setAlpha(0).setVisible(false);
    }

    // Potion use is handled by GameScene (E key has priority: stairs > loot > potion)
  };

  Carl.prototype._startAttack = function (now) {
    this._attackTimer  = now;
    this._attackActive = true;
    // Alternate punch → kick → punch ...
    this._attackType = (this._attackType === 'punch') ? 'kick' : 'punch';

    // Kick has a wider hitbox and slightly longer reach; punch is faster-feeling
    var isPunch = this._attackType === 'punch';
    var ox = 0, oy = 0, reach = isPunch ? 28 : 34;
    if (this.facing === 'right') ox =  reach;
    if (this.facing === 'left')  ox = -reach;
    if (this.facing === 'down')  oy =  reach;
    if (this.facing === 'up')    oy = -reach;

    var sx = this.sprite.x + ox;
    var sy = this.sprite.y + oy;

    this.slashSprite.setPosition(sx, sy);
    this.slashSprite.setVisible(true).setAlpha(0.9);
    this.scene.tweens.add({
      targets: this.slashSprite,
      alpha: 0,
      duration: ATTACK_DUR,
      ease: 'Linear',
    });

    // Hitbox is centered on Carl's body with a bias toward the facing direction.
    // Kept separate from sx/sy (the slash visual) so enemies directly on top of Carl
    // are always within range — they're the danger zone, not an edge case.
    var hw = isPunch ? 48 : 54, hh = isPunch ? 48 : 54;
    var hbias = isPunch ? 12 : 14;
    var hx = this.sprite.x + (this.facing === 'right' ? hbias : this.facing === 'left' ? -hbias : 0);
    var hy = this.sprite.y + (this.facing === 'down'  ? hbias : this.facing === 'up'   ? -hbias : 0);
    this._swingBox = new Phaser.Geom.Rectangle(hx - hw / 2, hy - hh / 2, hw, hh);

    // Kick does 1.3x damage; punch is 1x but faster (same ATTACK_CD for now)
    var dmg = Math.floor(this.status.getMeleeDamage() * (isPunch ? 1.0 : 1.3));
    // LUCK: each point = 2% crit chance, crit doubles damage
    var critChance = this.status.stats.luck * 0.02;
    var isCrit = Math.random() < critChance;
    if (isCrit) dmg = dmg * 2;
    if (this._onAttack) this._onAttack(this._swingBox, dmg, this._attackType, isCrit);

    _playSound(this.scene, 'swing');
  };

  Carl.prototype.receiveHit = function (damage, sourceName) {
    var now = Date.now();
    if (now - this._iframeTimer < IFRAMES) return 0; // invincible

    // LUCK: 1% per point; DEX buff adds 2% dodge; Dodge skill: 2% per level
    var dodgeChance = this.status.stats.luck * 0.01 + (this.status.skills ? this.status.skills.dodge * 0.02 : 0) + (this.status._dexBuffUntil && Date.now() < this.status._dexBuffUntil ? 0.02 : 0);
    if (Math.random() < dodgeChance) {
      this._iframeTimer = now; // consume iframe so dodge can't rapid-fire
      if (this._onDodge) this._onDodge();
      return -1; // sentinel: dodged
    }

    this._iframeTimer = now;
    var actual = this.status.takeDamage(damage);
    if (this._onHit) this._onHit(actual, sourceName);
    _playSound(this.scene, 'hurt');
    return actual;
  };

  Carl.prototype.x = function () { return this.sprite.x; };
  Carl.prototype.y = function () { return this.sprite.y; };
  Carl.prototype.isAttackActive = function () { return this._attackActive; };
  Carl.prototype.getSwingBox = function () { return this._swingBox; };

  Carl.prototype.destroy = function () {
    this.sprite.destroy();
    this.slashSprite.destroy();
  };

  function _playSound(scene, type) {
    var ctx = GameAudio.getCtx();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      var now = ctx.currentTime;
      if (type === 'swing') {
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now); osc.stop(now + 0.13);
      } else if (type === 'hurt') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.22);
      }
    } catch (e) {}
  }

  Carl.playSound = _playSound;

  return Carl;
})();
