// Intro sequence — Borant Corporation ident, then the collapse, then hand off to GameScene
var IntroScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'IntroScene' }); },

  create: function () {
    var W = this.cameras.main.width;
    var H = this.cameras.main.height;
    var scene = this;

    this.cameras.main.setBackgroundColor('#000000');
    this._started = false;

    // ── Phase 1: Borant Corporation ident ────────────────────────────────────
    var borantLogo = this.add.text(W / 2, H / 2 - 18, 'BORANT CORPORATION', {
      fontFamily: 'monospace', fontSize: '22px', color: '#aaaacc', align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    var borantSub = this.add.text(W / 2, H / 2 + 14, 'PRESENTS', {
      fontFamily: 'monospace', fontSize: '13px', color: '#555577', align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    var borantTag = this.add.text(W / 2, H / 2 + 38, '"ENTERTAINMENT THROUGH SURVIVAL"', {
      fontFamily: 'monospace', fontSize: '10px', color: '#333355', align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    // Fade in logo
    this.tweens.add({ targets: borantLogo, alpha: 1, duration: 700, ease: 'Sine.easeIn' });
    this.time.delayedCall(400, function () {
      scene.tweens.add({ targets: borantSub, alpha: 1, duration: 500 });
    });
    this.time.delayedCall(700, function () {
      scene.tweens.add({ targets: borantTag, alpha: 0.7, duration: 500 });
    });

    // Fade out logo, then show main sequence
    this.time.delayedCall(2200, function () {
      scene.tweens.add({
        targets: [borantLogo, borantSub, borantTag],
        alpha: 0, duration: 500,
        onComplete: function () { scene._showMainSequence(W, H); }
      });
    });

    // Scanline overlay
    var gr = this.add.graphics().setDepth(100);
    for (var y = 0; y < H; y += 4) {
      gr.fillStyle(0x000000, 0.15);
      gr.fillRect(0, y, W, 1);
    }
  },

  _showMainSequence: function (W, H) {
    var scene = this;
    this.cameras.main.setBackgroundColor('#0a0812');

    var lines = [
      { text: 'DUNGEON CRAWLER CARL',
        size: 38, color: '#ffdd57', y: H * 0.17, delay: 0 },
      { text: '─────────────────────────────────────────',
        size: 14, color: '#333355', y: H * 0.27, delay: 300 },
      { text: 'The surface has collapsed.',
        size: 18, color: '#ccbbff', y: H * 0.36, delay: 700 },
      { text: 'Forty-seven billion humans have been deposited\ninto the World Dungeon.',
        size: 15, color: '#9999bb', y: H * 0.46, delay: 1400 },
      { text: 'You are Carl.  Your cat is Donut.\nShe is not pleased.',
        size: 15, color: '#9999bb', y: H * 0.58, delay: 2400 },
      { text: 'BORANT CORPORATION THANKS YOU FOR YOUR PARTICIPATION.',
        size: 11, color: '#443355', y: H * 0.70, delay: 3400 },
      { text: '[ PRESS ANY KEY TO BEGIN ]',
        size: 15, color: '#ffdd57', y: H * 0.82, delay: 4200 },
    ];

    lines.forEach(function (l) {
      var txt = scene.add.text(W / 2, l.y, l.text, {
        fontFamily: 'monospace',
        fontSize: l.size + 'px',
        color: l.color,
        align: 'center',
        lineSpacing: 6,
      }).setOrigin(0.5).setAlpha(0);

      scene.time.delayedCall(l.delay, function () {
        scene.tweens.add({ targets: txt, alpha: 1, duration: 600, ease: 'Sine.easeIn' });
      });
    });

    this.time.delayedCall(4200, function () {
      if (scene._started) return;
      scene.input.keyboard.once('keydown', function () { scene._startGame(); });
      scene.input.on('pointerdown', function () { scene._startGame(); });
    });
  },

  _startGame: function () {
    if (this._started) return;
    this._started = true;
    var scene = this;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, function () {
      scene.scene.start('GameScene', { floor: 1 });
      scene.scene.launch('UIScene');
    });
  },
});
