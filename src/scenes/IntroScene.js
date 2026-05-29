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

    // Version display
    this.add.text(W - 6, H - 6, 'v' + GAME_VERSION.split('+')[0], {
      fontFamily: 'monospace', fontSize: '9px', color: '#555566', align: 'right'
    }).setOrigin(1, 1).setDepth(101);
  },

  _showMainSequence: function (W, H) {
    var scene = this;
    this.cameras.main.setBackgroundColor('#0a0812');

    var lines = [
      { text: 'DUNGEON CRAWLER CARL',
        size: 38, color: '#ffdd57', y: H * 0.15, delay: 0 },
      { text: '─────────────────────────────────────────',
        size: 14, color: '#333355', y: H * 0.24, delay: 300 },
      { text: 'The surface has collapsed.',
        size: 18, color: '#ccbbff', y: H * 0.32, delay: 700 },
      { text: 'Forty-seven billion humans have been deposited\ninto the World Dungeon.',
        size: 15, color: '#9999bb', y: H * 0.41, delay: 1400 },
      { text: 'You are Carl.  Your cat is Donut.\nShe is not pleased.',
        size: 15, color: '#9999bb', y: H * 0.52, delay: 2400 },
      { text: 'BORANT CORPORATION THANKS YOU FOR YOUR PARTICIPATION.',
        size: 11, color: '#443355', y: H * 0.62, delay: 3400 },
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
      scene._showButtons(W, H);
    });
  },

  _showButtons: function (W, H) {
    var scene = this;
    var saved = SaveSystem.load();

    function makeBtn(label, sub, x, y, w, onClick) {
      var h = 72;
      var bg = scene.add.rectangle(x, y, w, h, 0x111122, 0.85)
        .setStrokeStyle(2, 0xffdd57, 0.7).setInteractive({ useHandCursor: true });
      var t = scene.add.text(x, y - 14, label, {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffdd57',
      }).setOrigin(0.5);
      var s = scene.add.text(x, y + 14, sub || '', {
        fontFamily: 'monospace', fontSize: '10px', color: '#9999bb',
        align: 'center', lineSpacing: 4,
      }).setOrigin(0.5);
      bg.on('pointerover', function () { bg.setFillStyle(0x222244, 0.95); t.setColor('#ffffff'); });
      bg.on('pointerout',  function () { bg.setFillStyle(0x111122, 0.85); t.setColor('#ffdd57'); });
      bg.on('pointerdown', onClick);
      [bg, t, s].forEach(function (o) { o.setAlpha(0); });
      scene.tweens.add({ targets: [bg, t, s], alpha: 1, duration: 500 });
      return { bg: bg, t: t, s: s };
    }

    var btnY = H * 0.80;
    var btnW = 280;
    if (saved) {
      var subLine1 = 'CRAWLER #' + (saved.crawlerNumber || '?') +
        '  |  LVL ' + (saved.level || 1);
      var subLine2 = 'FLOOR ' + (saved.floor || 1) +
        '  |  ' + (saved.kills || 0) + ' KILLS';
      makeBtn('NEW GAME', 'wipe save, start fresh',    W / 2 - btnW / 2 - 16, btnY, btnW, function () { scene._startGame(true); });
      makeBtn('RESUME',   subLine1 + '\n' + subLine2,  W / 2 + btnW / 2 + 16, btnY, btnW, function () { scene._startGame(false); });
    } else {
      makeBtn('NEW GAME', 'press to begin', W / 2, btnY, btnW, function () { scene._startGame(true); });
    }
  },

  _startGame: function (freshStart) {
    if (this._started) return;
    this._started = true;
    var scene = this;
    if (freshStart) SaveSystem.clear();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, function () {
      scene.scene.start('GameScene');
    });
  },
});
