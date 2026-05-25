// Death screen — shows run stats, prompts restart
// Launched by GameScene._handleDeath with { floor, kills, level, crawlerName, crawlerNumber, killer, xp, xpToNext, stats }
var DeathScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'DeathScene' }); },

  init: function (data) {
    this._floor         = data.floor         || 1;
    this._kills         = data.kills         || 0;
    this._level         = data.level         || 1;
    this._crawlerName   = data.crawlerName   || 'CARL';
    this._crawlerNumber = data.crawlerNumber || 1;
    this._killer        = data.killer        || 'Unknown';
    this._xp            = data.xp            || 0;
    this._xpToNext      = data.xpToNext      || 100;
    this._stats         = data.stats         || { str: 5, con: 5, dex: 5, int: 5, cha: 3, luck: 3 };
    this._views         = data.views         || 0;
    this._followers     = data.followers     || 0;
    this._favorites     = data.favorites     || 0;

    // Best-run tracking
    this._best    = _loadBestRun();
    this._isNew   = _isBetterRun(this._best, this._floor, this._kills, this._level);
    if (this._isNew) _saveBestRun(this._floor, this._kills, this._level, this._crawlerName);
  },

  create: function () {
    var W = this.cameras.main.width;
    var H = this.cameras.main.height;
    var scene = this;

    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(700, 40, 0, 0);

    // ── Scanlines ─────────────────────────────────────────────────────────────
    var gr = this.add.graphics().setDepth(100);
    for (var y = 0; y < H; y += 4) {
      gr.fillStyle(0x000000, 0.18);
      gr.fillRect(0, y, W, 1);
    }

    var toFade = []; // collect alpha=0 objects for staggered reveal

    // ── Header ────────────────────────────────────────────────────────────────
    toFade.push(this.add.text(W / 2, H * 0.06, 'CRAWLER ELIMINATED', {
      fontFamily: 'monospace', fontSize: '30px', color: '#cc2222',
      stroke: '#000000', strokeThickness: 4,
      shadow: { blur: 20, color: '#ff0000', fill: true },
    }).setOrigin(0.5).setAlpha(0).setDepth(10));

    toFade.push(this.add.text(W / 2, H * 0.14, 'BORANT CORPORATION THANKS YOU FOR YOUR PARTICIPATION', {
      fontFamily: 'monospace', fontSize: '10px', color: '#443333',
    }).setOrigin(0.5).setAlpha(0).setDepth(10));

    // ── Dossier card (left) ────────────────────────────────────────────────────
    var cardX = W / 2 - 340, cardY = H * 0.19;
    var cardW = 310, cardH = 262;
    this.add.rectangle(cardX, cardY, cardW, cardH, 0x0a0810, 0.92).setOrigin(0, 0).setDepth(8);
    this.add.rectangle(cardX, cardY, cardW, cardH, 0x882222)
      .setOrigin(0, 0).setDepth(9).setFillStyle(0, 0).setStrokeStyle(1, 0xaa3333);

    var floorName = MessageSystem.floorName(this._floor);
    var dossierLines = [
      'CRAWLER #' + this._crawlerNumber,
      this._crawlerName,
      '',
      'FLOOR:   ' + this._floor + '  ' + floorName,
      'LEVEL:   ' + this._level,
      'KILLS:   ' + this._kills,
      'XP:      ' + this._xp + ' / ' + this._xpToNext,
      '',
      'VIEWS:      ' + _fmtN(this._views),
      'FOLLOWERS:  ' + _fmtN(this._followers),
      'FAVORITES:  ' + _fmtN(this._favorites),
      '',
      'KILLED BY:  ' + this._killer.toUpperCase(),
    ];
    toFade.push(this.add.text(cardX + 16, cardY + 12, dossierLines.join('\n'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#cc9999', lineSpacing: 4,
    }).setOrigin(0, 0).setDepth(10).setAlpha(0));

    // ── Stat block (right of dossier) ──────────────────────────────────────────
    var statX = W / 2 - 16, statY = cardY;
    var statW = 150, statH = cardH;
    this.add.rectangle(statX, statY, statW, statH, 0x080614, 0.92).setOrigin(0, 0).setDepth(8);
    this.add.rectangle(statX, statY, statW, statH, 0x443366)
      .setOrigin(0, 0).setDepth(9).setFillStyle(0, 0).setStrokeStyle(1, 0x6655aa);

    toFade.push(this.add.text(statX + statW / 2, statY + 10, 'ATTRIBUTES', {
      fontFamily: 'monospace', fontSize: '10px', color: '#665588',
    }).setOrigin(0.5, 0).setDepth(10).setAlpha(0));

    var STAT_DEFS = [
      ['STR', this._stats.str, 15, '#ffcc66'],
      ['CON', this._stats.con, 15, '#ff8888'],
      ['DEX', this._stats.dex, 15, '#88ffcc'],
      ['INT', this._stats.int, 15, '#88aaff'],
      ['CHA', this._stats.cha, 10, '#ff88cc'],
      ['LCK', this._stats.luck,10, '#ffdd44'],
    ];
    var BAR_MAX_W = 80, BAR_H = 7, BAR_X = statX + 46, BAR_Y0 = statY + 32;
    STAT_DEFS.forEach(function (sd, i) {
      var by = BAR_Y0 + i * 26;
      // Label
      toFade.push(scene.add.text(statX + 8, by + BAR_H / 2, sd[0], {
        fontFamily: 'monospace', fontSize: '10px', color: '#887799',
      }).setOrigin(0, 0.5).setDepth(10).setAlpha(0));
      // Value
      toFade.push(scene.add.text(BAR_X - 4, by + BAR_H / 2, String(sd[1]), {
        fontFamily: 'monospace', fontSize: '10px', color: '#bbaacc',
      }).setOrigin(1, 0.5).setDepth(10).setAlpha(0));
      // Bar bg
      scene.add.rectangle(BAR_X, by, BAR_MAX_W, BAR_H, 0x221133).setOrigin(0, 0).setDepth(10);
      // Bar fill — width proportional to stat / cap
      var fillW = Math.max(2, Math.floor(BAR_MAX_W * sd[1] / sd[2]));
      var fillBar = scene.add.rectangle(BAR_X, by, fillW, BAR_H, Phaser.Display.Color.HexStringToColor(sd[3]).color)
        .setOrigin(0, 0).setDepth(11).setAlpha(0);
      toFade.push(fillBar);
    });

    // ── Best run panel ─────────────────────────────────────────────────────────
    var bestX = statX + statW + 12, bestY = cardY;
    var bestW = 170, bestH = cardH;
    this.add.rectangle(bestX, bestY, bestW, bestH, 0x050a08, 0.92).setOrigin(0, 0).setDepth(8);
    this.add.rectangle(bestX, bestY, bestW, bestH, 0x224433)
      .setOrigin(0, 0).setDepth(9).setFillStyle(0, 0).setStrokeStyle(1, 0x336655);

    var best = this._best;
    var bestLines;
    if (best) {
      bestLines = [
        '── BEST RUN ──',
        '',
        best.name,
        'Floor  ' + best.floor,
        'Level  ' + best.level,
        'Kills  ' + best.kills,
      ];
    } else {
      bestLines = ['── BEST RUN ──', '', '(none yet)'];
    }
    toFade.push(this.add.text(bestX + 12, bestY + 12, bestLines.join('\n'), {
      fontFamily: 'monospace', fontSize: '11px', color: '#448866', lineSpacing: 5,
    }).setOrigin(0, 0).setDepth(10).setAlpha(0));

    if (this._isNew) {
      toFade.push(this.add.text(bestX + bestW / 2, bestY + bestH - 18, '★ NEW RECORD', {
        fontFamily: 'monospace', fontSize: '12px', color: '#44ffaa',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(10).setAlpha(0));
    }

    // ── Rating ────────────────────────────────────────────────────────────────
    var rating = _getBorantRating(this._floor, this._kills, this._level);
    toFade.push(this.add.text(W / 2, H * 0.60, rating.label, {
      fontFamily: 'monospace', fontSize: '13px', color: rating.color,
    }).setOrigin(0.5).setAlpha(0).setDepth(10));

    toFade.push(this.add.text(W / 2, H * 0.66, rating.flavor, {
      fontFamily: 'monospace', fontSize: '10px', color: '#443344',
      wordWrap: { width: 660 }, align: 'center',
    }).setOrigin(0.5).setAlpha(0).setDepth(10));

    // ── Donut eulogy ──────────────────────────────────────────────────────────
    var eulogy = _donutEulogy(this._kills, this._floor, this._killer);
    toFade.push(this.add.text(W / 2, H * 0.75, '"' + eulogy + '"', {
      fontFamily: 'monospace', fontSize: '11px', color: '#aa88cc',
      wordWrap: { width: 620 }, align: 'center',
      fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0).setDepth(10));
    toFade.push(this.add.text(W / 2, H * 0.80, '— DONUT', {
      fontFamily: 'monospace', fontSize: '9px', color: '#664477',
    }).setOrigin(0.5).setAlpha(0).setDepth(10));

    // ── Restart prompt ────────────────────────────────────────────────────────
    var restartText = this.add.text(W / 2, H * 0.90, '[ PRESS ANY KEY TO CRAWL AGAIN ]', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffdd57',
    }).setOrigin(0.5).setAlpha(0).setDepth(10);
    toFade.push(restartText);

    // ── Staggered fade-in ─────────────────────────────────────────────────────
    toFade.forEach(function (t, i) {
      scene.time.delayedCall(i * 120 + 300, function () {
        scene.tweens.add({ targets: t, alpha: 1, duration: 400 });
      });
    });

    // Pulse restart prompt + enable input after delay
    var inputDelay = toFade.length * 120 + 600;
    this.time.delayedCall(inputDelay, function () {
      scene.tweens.add({
        targets: restartText, alpha: 0.3, duration: 800,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      scene.input.keyboard.once('keydown', function () { scene._restart(); });
      scene.input.once('pointerdown', function () { scene._restart(); });
    });
  },

  _restart: function () {
    var scene = this;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(520, function () {
      scene.scene.start('IntroScene');
    });
  },
});

// ── Best run persistence ───────────────────────────────────────────────────────

function _loadBestRun() {
  try {
    var raw = localStorage.getItem('dcc_best_run');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function _saveBestRun(floor, kills, level, name) {
  try {
    localStorage.setItem('dcc_best_run', JSON.stringify({ floor: floor, kills: kills, level: level, name: name }));
  } catch (e) {}
}

function _isBetterRun(best, floor, kills, level) {
  if (!best) return true;
  var score    = floor * 100 + kills * 3 + level * 20;
  var bestScore = best.floor * 100 + best.kills * 3 + best.level * 20;
  return score > bestScore;
}

// ── Donut eulogy ──────────────────────────────────────────────────────────────

function _donutEulogy(kills, floor, killer) {
  if (killer === 'Rot Sticker') return 'I told him not to get close to the glowing ones. He did not listen. He never listened.';
  if (killer === 'Fairy')       return 'A fairy. He was killed by a fairy. I don\'t know how to feel about that.';
  if (floor === 1 && kills === 0) return 'He didn\'t kill a single thing. I watched the whole time. I was supportive. It didn\'t help.';
  if (kills >= 20) return 'He was actually pretty good for a while there. Then he wasn\'t. I miss him already.';
  if (kills >= 10) return 'Double digits. That\'s more than most. I chose well. He just... also died.';
  if (floor >= 2)  return 'We made it to floor ' + floor + '. Most crawlers don\'t. I\'m choosing to see that as a win.';
  return 'He died on floor one. I have been on floor one my entire life. We had so much in common.';
}

// ── Borant rating ─────────────────────────────────────────────────────────────

function _getBorantRating(floor, kills, level) {
  var score = floor * 100 + kills * 3 + level * 20;
  if (score > 600) return {
    label: 'BORANT RATING: COMMERCIALLY VIABLE',
    color: '#44ffaa',
    flavor: 'YOUR PERFORMANCE EXCEEDED PROJECTIONS. MODEST REFUND ISSUED TO NEXT OF KIN.',
  };
  if (score > 300) return {
    label: 'BORANT RATING: ACCEPTABLE',
    color: '#ffdd57',
    flavor: 'ADEQUATE ENTERTAINMENT VALUE. BORANT NOTES YOUR EFFORT WITH MILD APPROVAL.',
  };
  if (score > 120) return {
    label: 'BORANT RATING: BELOW AVERAGE',
    color: '#ff8844',
    flavor: 'VIEWERSHIP WAS DISAPPOINTED. DONUT HAS FILED A FORMAL COMPLAINT.',
  };
  return {
    label: 'BORANT RATING: COMMERCIALLY UNVIABLE',
    color: '#cc2222',
    flavor: 'YOUR DEATH GENERATED NEGLIGIBLE AD REVENUE. DONUT IS EATING YOUR STUFF.',
  };
}
