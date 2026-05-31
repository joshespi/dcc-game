// Floor 3 induction — the "production trailer" between Floor 2 and Floor 3.
// Crawler picks a race, then a class; both apply stat deltas + grant distribution
// points (spent later in a safe room). Runs once; status.classChosen gates re-entry.
var ClassSelectScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'ClassSelectScene' }); },

  init: function (data) {
    this._floor = (data && data.floor) || 3;
    this._race  = null;
    this._class = null;
  },

  create: function () {
    this.W = this.cameras.main.width;
    this.H = this.cameras.main.height;
    this.cameras.main.setBackgroundColor('#0a0814');
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this._title = this.add.text(this.W / 2, 36, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffcc55',
      stroke: '#000000', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5, 0).setDepth(3);
    this._sub = this.add.text(this.W / 2, 64, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#9a8aba', align: 'center',
    }).setOrigin(0.5, 0).setDepth(3);

    // All per-step rows live here so a step swap is one removeAll(true).
    this._rows = this.add.container(0, 0).setDepth(2);
    this._showRaceStep();
  },

  _fmtDeltas: function (stats) {
    return Object.keys(stats).map(function (k) {
      var v = stats[k];
      return k.toUpperCase() + ' ' + (v > 0 ? '+' : '') + v;
    }).join('   ');
  },

  _clearRows: function () {
    this._rows.removeAll(true);
  },

  // One clickable option card. Returns nothing; tracks objects for teardown.
  _row: function (y, title, sub, recommended, onPick) {
    var W = this.W, rw = Math.min(560, W - 60), rx = W / 2, rh = 52;
    var bg = this.add.rectangle(rx, y, rw, rh, 0x1a1426, 0.94)
      .setOrigin(0.5).setStrokeStyle(1.5, recommended ? 0x77cc55 : 0x4a3a6a)
      .setDepth(2).setInteractive({ useHandCursor: true });
    var t = this.add.text(rx - rw / 2 + 16, y - rh / 2 + 9,
      title + (recommended ? '   ★ RECOMMENDED' : ''), {
      fontFamily: 'monospace', fontSize: '14px',
      color: recommended ? '#aaffaa' : '#ddccff',
    }).setOrigin(0, 0).setDepth(3);
    var s = this.add.text(rx - rw / 2 + 16, y - rh / 2 + 30, sub, {
      fontFamily: 'monospace', fontSize: '10px', color: '#8a7aaa',
    }).setOrigin(0, 0).setDepth(3);
    bg.on('pointerover', function () { bg.setFillStyle(0x2a2440, 0.98); });
    bg.on('pointerout',  function () { bg.setFillStyle(0x1a1426, 0.94); });
    bg.on('pointerdown', onPick);
    this._rows.add([bg, t, s]);
  },

  _showRaceStep: function () {
    this._clearRows();
    this._title.setText('FLOOR 3 INDUCTION');
    this._sub.setText('"WELCOME TO THE PRODUCTION TRAILER. CHOOSE YOUR RACE." — LEXIS');
    var scene = this;
    var keys = Object.keys(CrawlerStatus.RACES);
    var y0 = 110, gap = 60;
    keys.forEach(function (key, i) {
      var r = CrawlerStatus.RACES[key];
      scene._row(y0 + i * gap, r.name, r.desc + '   [ ' + scene._fmtDeltas(r.stats) + ' ]',
        false, function () { scene._race = key; scene._showClassStep(); });
    });
  },

  _showClassStep: function () {
    this._clearRows();
    this._title.setText('CHOOSE YOUR CLASS');
    this._sub.setText('RACE: ' + CrawlerStatus.RACES[this._race].name +
      '   ·   "TAKE THE AI SUGGESTION SERIOUSLY." — MORDECAI');
    var scene = this;
    var keys = Object.keys(CrawlerStatus.CLASSES);
    var y0 = 110, gap = 56;
    keys.forEach(function (key, i) {
      var c = CrawlerStatus.CLASSES[key];
      scene._row(y0 + i * gap, c.name,
        c.desc + '   [ ' + scene._fmtDeltas(c.stats) + '   +' + (c.statPoints || 0) + ' PTS ]',
        !!c.recommended, function () { scene._class = key; scene._showConfirmStep(); });
    });
  },

  _showConfirmStep: function () {
    this._clearRows();
    var race = CrawlerStatus.RACES[this._race];
    var cls  = CrawlerStatus.CLASSES[this._class];
    this._title.setText('CONFIRM BUILD');
    this._sub.setText(race.name + '   ·   ' + cls.name);

    var scene = this;
    var summary = this.add.text(this.W / 2, 150,
      race.name + ' ' + cls.name + '\n\n' +
      'RACE BONUS   ' + this._fmtDeltas(race.stats) + '\n' +
      'CLASS BONUS  ' + this._fmtDeltas(cls.stats) + '\n\n' +
      '+' + (cls.statPoints || 0) + ' STAT POINTS to spend in a safe room (press I).', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ddccff',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0).setDepth(3);
    this._rows.add(summary);

    this._row(this.H - 120, 'DESCEND TO FLOOR 3', 'lock in this build and continue',
      true, function () { scene._confirm(); });
    this._row(this.H - 58, 'BACK', 're-pick race and class', false,
      function () { scene._race = null; scene._class = null; scene._showRaceStep(); });
  },

  _confirm: function () {
    if (this._confirmed) return;
    this._confirmed = true;
    var scene = this;
    var status = this.registry.get('status');
    status.applyRaceClass(this._race, this._class);
    // GameScene.init persists on entry — no save here.
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(560, function () { scene.scene.start('GameScene', { floor: scene._floor }); });
  },

  // Headless entry point for the playtest harness.
  selectAndDescend: function (raceKey, classKey) {
    this._race = raceKey; this._class = classKey;
    this._confirm();
  },
});
