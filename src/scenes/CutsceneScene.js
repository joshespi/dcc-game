// Mordecai cold-open — plays on new game only.
// Delivers narrative intro + full tutorial briefing. Grants items + marks tutorial complete on handoff.
var CutsceneScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'CutsceneScene' }); },

  create: function () {
    var W = this.cameras.main.width;
    var H = this.cameras.main.height;
    var scene = this;

    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(700, 0, 0, 0);

    // Mordecai silhouette — left third of screen, clearly visible as a looming presence
    var npcImg = this.add.image(W * 0.18, H * 0.52, 'guildmaster')
      .setScale(3.4).setAlpha(0).setDepth(1).setTint(0x6644cc);
    this.tweens.add({ targets: npcImg, alpha: 0.72, duration: 1400, delay: 400 });

    // Subtle purple vignette around the silhouette
    var glow = this.add.graphics().setDepth(0).setAlpha(0);
    glow.fillStyle(0x220044, 0.18);
    glow.fillEllipse(W * 0.18, H * 0.52, 200, 280);
    this.tweens.add({ targets: glow, alpha: 1, duration: 1600, delay: 400 });

    var LINES = [
      // Narrative open
      { text: 'THERE YOU ARE.',                                                     delay: 800  },
      { text: 'I AM MORDECAI.\nYOUR GUILD REPRESENTATIVE.\nYOU WILL LISTEN TO ME.', delay: 2600 },
      // Tutorial — HUD
      { text: 'YOUR WETWARE IS NOW ACTIVE.\nHUD SYSTEMS COMING ONLINE.\nTRY NOT TO PANIC.', delay: 6000 },
      { text: 'HP IS RED. MP IS BLUE. XP IS GOLD.\nNONE OF THEM SHOULD REACH ZERO.\nHP IS THE MOST IMPORTANT ONE.', delay: 9400 },
      // Tutorial — controls
      { text: 'WASD TO MOVE. SPACE TO ATTACK.\nQ FIRES DONUT\'S SPELL. E INTERACTS.\nI FOR INVENTORY. K FOR SKILLS.', delay: 12800 },
      // Tutorial — Donut
      { text: 'THAT IS DONUT.\nDUNGEON FAMILIAR. PRINCESS CAT.\nSHE WILL HELP YOU. LISTEN TO HER.', delay: 16200 },
      // Tutorial — items
      { text: 'I AM GIVING YOU SUPPLIES AND A HEAL ABILITY.\nTHIS IS MY JOB.\nDO NOT READ INTO IT.', delay: 19600 },
      // Sendoff
      { text: 'FIND THE STAIRS.\nTRY NOT TO DO ANYTHING THAT REQUIRES MY INTERVENTION.\nGOOD LUCK. I MEAN THAT LITERALLY.', delay: 23000 },
    ];

    var activeText = null;

    LINES.forEach(function (line, idx) {
      scene.time.delayedCall(line.delay, function () {
        if (scene._done) return;

        if (activeText) {
          var _prev = activeText;
          scene.tweens.add({ targets: _prev, alpha: 0, duration: 600,
            onComplete: function () { _prev.destroy(); }
          });
        }

        var txt = scene.add.text(W * 0.36, H * 0.46, line.text, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ccbbff',
          align: 'left',
          lineSpacing: 9,
          stroke: '#000000',
          strokeThickness: 3,
          wordWrap: { width: W * 0.58 },
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(5);

        scene.tweens.add({ targets: txt, alpha: 1, duration: 450 });
        activeText = txt;

        // First line: slight camera shake — wetware activation feel
        if (idx === 0) scene.cameras.main.shake(90, 0.005);
      });
    });

    // Skip hint
    var skipHint = this.add.text(W - 14, H - 12, 'SPACE / click to skip', {
      fontFamily: 'monospace', fontSize: '10px', color: '#443355',
    }).setOrigin(1, 1).setDepth(10).setAlpha(0);
    this.time.delayedCall(1200, function () {
      scene.tweens.add({ targets: skipHint, alpha: 0.7, duration: 800 });
    });

    var TOTAL_MS = 26500;
    this.time.delayedCall(TOTAL_MS, function () { scene._finish(); });

    this.input.keyboard.once('keydown-SPACE', function () { scene._finish(); });
    this.input.on('pointerdown', function () { scene._finish(); });

    this._done = false;
  },

  _finish: function () {
    if (this._done) return;
    this._done = true;
    var scene = this;
    // Signal GameScene to skip tutorial and grant items
    this.registry.set('cutsceneDone', true);
    this.cameras.main.flash(200, 255, 255, 255);
    this.time.delayedCall(200, function () {
      scene.cameras.main.fadeOut(500, 0, 0, 0);
    });
    this.time.delayedCall(720, function () {
      scene.scene.start('GameScene');
    });
  },
});
