function _fmtMMSS(totalSecs) {
  var m = Math.floor(totalSecs / 60);
  var s = totalSecs % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Crafting recipes — materials consumed, output added to inventory
// Each ingredient: { name: string, count: number }
var CRAFT_RECIPES = [
  {
    name: 'Crude Bandage',
    ingredients: [{ name: 'Rat Skin', count: 2 }],
    output: { type: 'potion', name: 'Crude Bandage', healAmount: 25 },
    desc: 'Heals 25 HP',
  },
  {
    name: 'Shiv',
    ingredients: [{ name: 'Goblin Tooth', count: 3 }],
    output: { type: 'weapon', name: 'Shiv', damage: 4 },
    desc: '+4 damage weapon',
  },
  {
    name: 'Crude Armor Patch',
    ingredients: [{ name: 'Rot Sticker Carapace', count: 1 }, { name: 'Goblin Ear', count: 1 }],
    output: { type: 'armor', name: 'Crude Armor Patch', defense: 2 },
    desc: '+2 defense armor',
  },
  {
    name: 'Smoke Bomb',
    ingredients: [{ name: 'Fairy Dust', count: 2 }],
    output: { type: 'consumable', name: 'Smoke Bomb', effect: 'stun', duration: 2000, radius: 80 },
    desc: 'Stuns nearby enemies 2s',
  },
  {
    name: 'Distraction Lure',
    ingredients: [{ name: 'Fairy Wing', count: 2 }, { name: 'Rat Tail', count: 1 }],
    output: { type: 'consumable', name: 'Distraction Lure', effect: 'lure', duration: 3000, radius: 120 },
    desc: 'Pulls enemy aggro 3s',
  },
];

// HUD overlay — runs parallel to GameScene, reads from registry
var UIScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () {
    Phaser.Scene.call(this, { key: 'UIScene' });
    this._sysMessages  = [];
    this._chatMessages = [];
    this._sysTimer  = 0;
    this._chatTimer = 0;
    this._invOpen    = false;
    this._invDirty   = true;
    this._shopOpen   = false;
    this._skillsOpen = false;
    this._potionCount = 0;
    this._gameScene = null;
    this._hudUnlocked = false;
    this._debuffStr     = null;
    this._achievementQueue = [];
  },

  create: function () {
    var W = this.cameras.main.width;
    var H = this.cameras.main.height;
    this.W = W; this.H = H;
    this._achievementQueue = []; // drop any badge left mid-flight by a prior floor

    // ── Hurt vignette — full-screen red flash on damage ───────────────────────
    this._hurtVignette = this.add.rectangle(0, 0, W, H, 0xcc0000, 0)
      .setOrigin(0, 0).setDepth(190).setScrollFactor(0);

    // ── HUD panel backgrounds — subtle dark overlay so text reads over any tile ─
    // Right panel height matches MM_Y(48) + MM_SIZE(96) + 26 for views label below minimap
    this._hudBgLeft  = this.add.rectangle(4, 4, 208, 102, 0x000000, 0.52).setOrigin(0, 0).setDepth(198);
    this._hudBgRight = this.add.rectangle(W - 218, 4, 214, 170, 0x000000, 0.52).setOrigin(0, 0).setDepth(198);

    // ── HP bar ───────────────────────────────────────────────────────────────
    this._hpBg = this.add.rectangle(14, 14, 180, 14, 0x220000).setOrigin(0, 0).setDepth(200);
    this._hpFill = this.add.rectangle(14, 14, 180, 14, 0xcc2222).setOrigin(0, 0).setDepth(201);
    this._hpBorder = this.add.rectangle(14, 14, 180, 14, 0x880000)
      .setOrigin(0, 0).setDepth(202).setFillStyle(0, 0).setStrokeStyle(1, 0xaa3333);
    this._hpLabel = this.add.text(17, 15, 'HP', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffaaaa'
    }).setDepth(203).setOrigin(0, 0);
    this._hpText = this.add.text(194, 15, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff8888'
    }).setDepth(203).setOrigin(1, 0);

    // ── MP bar ────────────────────────────────────────────────────────────────
    this._mpBg   = this.add.rectangle(14, 30, 180, 8, 0x001122).setOrigin(0, 0).setDepth(200);
    this._mpFill = this.add.rectangle(14, 30, 0,   8, 0x2255cc).setOrigin(0, 0).setDepth(201);
    this._mpBorder = this.add.rectangle(14, 30, 180, 8, 0x113366)
      .setOrigin(0, 0).setDepth(202).setFillStyle(0, 0).setStrokeStyle(1, 0x3366aa);
    this._mpLabel = this.add.text(17, 31, 'MP', {
      fontFamily: 'monospace', fontSize: '11px', color: '#aaccff'
    }).setDepth(203).setOrigin(0, 0);
    this._mpText = this.add.text(194, 31, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#88aaff'
    }).setDepth(203).setOrigin(1, 0);

    // ── XP bar ───────────────────────────────────────────────────────────────
    this._xpBg   = this.add.rectangle(14, 42, 180, 8, 0x111100).setOrigin(0, 0).setDepth(200);
    this._xpFill = this.add.rectangle(14, 42, 0,   8, 0xccaa00).setOrigin(0, 0).setDepth(201);
    this._xpBorder = this.add.rectangle(14, 42, 180, 8, 0x665500)
      .setOrigin(0, 0).setDepth(202).setFillStyle(0, 0).setStrokeStyle(1, 0x887730);

    // ── Level / Floor ─────────────────────────────────────────────────────────
    this._levelText = this.add.text(14, 54, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffdd57'
    }).setDepth(203).setOrigin(0, 0);

    // Unspent stat points indicator — pulses when points available
    this._statPtsText = this.add.text(14, 68, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#88ffcc'
    }).setDepth(203).setOrigin(0, 0);
    this._statPtsTween = null;

    // Active debuff icons — shown below stat points
    this._debuffText = this.add.text(14, 82, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#55ff55',
      stroke: '#001100', strokeThickness: 3
    }).setDepth(203).setOrigin(0, 0);
    this._debuffPulseTween = null;

    // Right-aligned, leaving room for minimap (96px wide + 10px margin)
    var MM_RIGHT_EDGE = W - 96 - 10 - 6;
    this._floorText = this.add.text(MM_RIGHT_EDGE, 14, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#aabbff', align: 'right'
    }).setDepth(203).setOrigin(1, 0);

    this._killText = this.add.text(MM_RIGHT_EDGE, 28, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#997799', align: 'right'
    }).setDepth(203).setOrigin(1, 0);

    this._stairsText = this.add.text(MM_RIGHT_EDGE, 42, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#44ffaa', align: 'right'
    }).setDepth(203).setOrigin(1, 0);

    this._savedText = this.add.text(MM_RIGHT_EDGE, 56, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#446644', align: 'right'
    }).setDepth(203).setOrigin(1, 0).setAlpha(0);

    // Safe room closure countdown — appears when closure is within 5 min
    this._closureText = this.add.text(MM_RIGHT_EDGE, 56, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#cc6622', align: 'right'
    }).setDepth(203).setOrigin(1, 0).setAlpha(0);

    // ── Minimap ───────────────────────────────────────────────────────────────
    var MM_SIZE   = 96;   // pixel size of the minimap square
    var MM_RADIUS = 12;   // tile radius around player shown in HUD minimap
    var MM_X = W - MM_SIZE - 10;
    var MM_Y = 48;
    this._mmX = MM_X; this._mmY = MM_Y; this._mmSize = MM_SIZE;
    this._mmRadius = MM_RADIUS;

    // Dark backing — stored for HUD lock/unlock visibility
    this._mmBg1 = this.add.rectangle(MM_X, MM_Y, MM_SIZE, MM_SIZE, 0x000000, 0.7)
      .setOrigin(0, 0).setDepth(205);
    this._mmBg2 = this.add.rectangle(MM_X, MM_Y, MM_SIZE, MM_SIZE, 0x334466)
      .setOrigin(0, 0).setDepth(206).setFillStyle(0, 0).setStrokeStyle(1, 0x334466);

    // Canvas texture — redrawn each time player moves a tile
    this._mmCanvas = document.createElement('canvas');
    this._mmCanvas.width  = MM_SIZE;
    this._mmCanvas.height = MM_SIZE;
    // Textures are game-global and survive UIScene's stop on floor transition;
    // addCanvas returns null on a duplicate key, so drop the stale one first.
    if (this.textures.exists('minimap_bg')) this.textures.remove('minimap_bg');
    this._mmTex = this.textures.addCanvas('minimap_bg', this._mmCanvas);
    this._mmImage = this.add.image(MM_X, MM_Y, 'minimap_bg').setOrigin(0, 0).setDepth(207);
    this._mmDungeonKey = null;
    this._mmCarlTx = -1; this._mmCarlTy = -1;

    // Carl dot always at canvas center. Stairs/boss positioned relative to player.
    var mmCx = MM_X + MM_SIZE / 2, mmCy = MM_Y + MM_SIZE / 2;
    this._mmCarl   = this.add.rectangle(mmCx, mmCy, 3, 3, 0xffdd44).setDepth(209).setOrigin(0.5);
    this._mmStairs = this.add.rectangle(0, 0, 3, 3, 0x44ff88).setDepth(208).setOrigin(0.5).setVisible(false);
    this._mmBoss   = this.add.rectangle(0, 0, 4, 4, 0xff3322).setDepth(208).setOrigin(0.5).setVisible(false);

    // ── Full-map overlay (M key) ──────────────────────────────────────────────
    var FMW = Math.min(W - 40, 480), FMH = Math.min(H - 40, 480);
    var FMX = Math.floor((W - FMW) / 2), FMY = Math.floor((H - FMH) / 2);
    this._fmOpen   = false;
    this._fmCanvas = document.createElement('canvas');
    this._fmCanvas.width  = FMW;
    this._fmCanvas.height = FMH;
    if (this.textures.exists('fullmap_bg')) this.textures.remove('fullmap_bg');
    this._fmTex    = this.textures.addCanvas('fullmap_bg', this._fmCanvas);
    this._fmBg     = this.add.rectangle(FMX, FMY, FMW, FMH, 0x000000, 0.88).setOrigin(0, 0).setDepth(300).setVisible(false);
    this._fmImage  = this.add.image(FMX, FMY, 'fullmap_bg').setOrigin(0, 0).setDepth(301).setVisible(false);
    this._fmBorder = this.add.rectangle(FMX, FMY, FMW, FMH, 0x334466).setOrigin(0, 0).setDepth(302).setFillStyle(0, 0).setStrokeStyle(1, 0x334466).setVisible(false);
    this._fmLabel  = this.add.text(FMX + FMW / 2, FMY + 6, '[M] CLOSE MAP', {
      fontFamily: 'monospace', fontSize: '9px', color: '#556677'
    }).setDepth(303).setOrigin(0.5, 0).setVisible(false);
    this._fmCarl   = this.add.rectangle(0, 0, 4, 4, 0xffdd44).setDepth(304).setOrigin(0.5).setVisible(false);
    this._fmStairs = this.add.rectangle(0, 0, 4, 4, 0x44ff88).setDepth(304).setOrigin(0.5).setVisible(false);
    this._fmBoss2  = this.add.rectangle(0, 0, 5, 5, 0xff3322).setDepth(304).setOrigin(0.5).setVisible(false);
    this._fmX = FMX; this._fmY = FMY; this._fmW = FMW; this._fmH = FMH;
    this._fmDirty  = true;

    // ── Social metrics — below minimap ───────────────────────────────────────
    this._viewsText = this.add.text(W - 10, MM_Y + MM_SIZE + 6, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#888888', align: 'right'
    }).setDepth(203).setOrigin(1, 0).setAlpha(0);

    // ── Action buttons — ATTACK (SPACE) and POTION (E) ───────────────────────
    var ABW = 64, ABH = 46, ABY = H - 54, ABG = 4;
    var ABX1 = 14, ABX2 = ABX1 + ABW + ABG, ABX3 = ABX2 + ABW + ABG, ABX4 = ABX3 + ABW + ABG;

    // SPACE / ATTACK
    this._atkBg     = this.add.rectangle(ABX1, ABY, ABW, ABH, 0x130608, 0.93).setOrigin(0, 0).setDepth(200);
    this._atkAccent = this.add.rectangle(ABX1, ABY + 4, 3, ABH - 8, 0xcc3311).setOrigin(0, 0).setDepth(201);
    this._atkBorder = this.add.rectangle(ABX1, ABY, ABW, ABH, 0)
      .setOrigin(0, 0).setDepth(202).setFillStyle(0, 0).setStrokeStyle(1.5, 0x773322);
    this._atkLabel  = this.add.text(ABX1 + ABW / 2 + 2, ABY + ABH / 2 - 5, 'ATTACK', {
      fontFamily: 'monospace', fontSize: '12px', color: '#dd5533',
    }).setOrigin(0.5).setDepth(203);
    this._atkKey    = this.add.text(ABX1 + ABW - 5, ABY + ABH - 5, 'SPACE', {
      fontFamily: 'monospace', fontSize: '8px', color: '#664433',
    }).setOrigin(1, 1).setDepth(203);

    // E / POTION
    this._potBg     = this.add.rectangle(ABX2, ABY, ABW, ABH, 0x040f07, 0.93).setOrigin(0, 0).setDepth(200);
    this._potAccent = this.add.rectangle(ABX2, ABY + 4, 3, ABH - 8, 0x2a9950).setOrigin(0, 0).setDepth(201);
    this._potBorder = this.add.rectangle(ABX2, ABY, ABW, ABH, 0)
      .setOrigin(0, 0).setDepth(202).setFillStyle(0, 0).setStrokeStyle(1.5, 0x225533);
    this._potLabel  = this.add.text(ABX2 + ABW / 2 + 2, ABY + ABH / 2 - 5, 'POTION', {
      fontFamily: 'monospace', fontSize: '12px', color: '#44bb66',
    }).setOrigin(0.5).setDepth(203);
    this._potCount  = this.add.text(ABX2 + ABW - 5, ABY + 5, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ffdd55',
    }).setOrigin(1, 0).setDepth(203);
    this._potKey    = this.add.text(ABX2 + ABW - 5, ABY + ABH - 5, 'E', {
      fontFamily: 'monospace', fontSize: '8px', color: '#335544',
    }).setOrigin(1, 1).setDepth(203);

    // Q / MISSILE (Donut spell — cooldown fill animates from bottom up)
    this._spellBg    = this.add.rectangle(ABX3, ABY, ABW, ABH, 0x0d0618, 0.93).setOrigin(0, 0).setDepth(200);
    this._spellFill  = this.add.rectangle(ABX3, ABY, ABW, ABH, 0x4422aa).setOrigin(0, 0).setDepth(201);
    this._spellAccent= this.add.rectangle(ABX3, ABY + 4, 3, ABH - 8, 0x8855dd).setOrigin(0, 0).setDepth(201);
    this._spellBorder= this.add.rectangle(ABX3, ABY, ABW, ABH, 0)
      .setOrigin(0, 0).setDepth(202).setFillStyle(0, 0).setStrokeStyle(1.5, 0x553377);
    this._spellLabel = this.add.text(ABX3 + ABW / 2 + 2, ABY + ABH / 2 - 5, 'MISSILE', {
      fontFamily: 'monospace', fontSize: '12px', color: '#9966cc',
    }).setOrigin(0.5).setDepth(203);
    this._spellKey   = this.add.text(ABX3 + ABW - 5, ABY + ABH - 5, 'Q', {
      fontFamily: 'monospace', fontSize: '8px', color: '#553366',
    }).setOrigin(1, 1).setDepth(203);

    // R / SURGE (Donut heal — cooldown fill animates from bottom up)
    this._surgeBg    = this.add.rectangle(ABX4, ABY, ABW, ABH, 0x041309, 0.93).setOrigin(0, 0).setDepth(200);
    this._surgeFill  = this.add.rectangle(ABX4, ABY, ABW, ABH, 0x228844).setOrigin(0, 0).setDepth(201);
    this._surgeAccent= this.add.rectangle(ABX4, ABY + 4, 3, ABH - 8, 0x44cc77).setOrigin(0, 0).setDepth(201);
    this._surgeBorder= this.add.rectangle(ABX4, ABY, ABW, ABH, 0)
      .setOrigin(0, 0).setDepth(202).setFillStyle(0, 0).setStrokeStyle(1.5, 0x224433);
    this._surgeLabel = this.add.text(ABX4 + ABW / 2 + 2, ABY + ABH / 2 - 5, 'SURGE', {
      fontFamily: 'monospace', fontSize: '12px', color: '#44aa66',
    }).setOrigin(0.5).setDepth(203);
    this._surgeKey   = this.add.text(ABX4 + ABW - 5, ABY + ABH - 5, 'R', {
      fontFamily: 'monospace', fontSize: '8px', color: '#224433',
    }).setOrigin(1, 1).setDepth(203);

    this._spellWasReady = null;
    this._surgeWasReady = null;
    this._ABY = ABY; this._ABW = ABW; this._ABH = ABH;


    // ── Message feeds (two bottom strips) ─────────────────────────────────────
    // Text is inset right of the action buttons (left edge ~282px) so long
    // messages never draw over them; the translucent bars still span full width.
    var MSG_LEFT = ABX4 + ABW + 10;
    var MSG_CX   = (MSG_LEFT + W - 10) / 2;
    var MSG_W    = W - MSG_LEFT - 10;
    // Top strip: SYSTEM announcements (Borant Corp / achievements) — yellow/gold
    this._sysBg = this.add.rectangle(0, H - 48, W, 24, 0x14110a, 0.78)
      .setOrigin(0, 0).setDepth(199);
    this._sysText = this.add.text(MSG_CX, H - 36, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffcc55',
      align: 'center', wordWrap: { width: MSG_W }
    }).setDepth(204).setOrigin(0.5);
    // Bottom strip: CHARACTER chat + game feedback — cyan
    this._chatBg = this.add.rectangle(0, H - 24, W, 24, 0x0a1014, 0.78)
      .setOrigin(0, 0).setDepth(199);
    this._chatText = this.add.text(MSG_CX, H - 12, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#aaddff',
      align: 'center', wordWrap: { width: MSG_W }
    }).setDepth(204).setOrigin(0.5);

    // ── Hotlist bar — hidden for now, rework later ────────────────────────────
    this._hotlistSlots = [];

    // Persistent mini controls line — sits above the action buttons + message strips
    this._hint = this.add.text(W / 2, H - 64,
      'WASD move   SPACE attack   E potion   Q missile   R surge   I inventory   K skills',
      { fontFamily: 'monospace', fontSize: '10px', color: '#998aaa' }
    ).setDepth(203).setOrigin(0.5);
    // Fade to dim after 14s — stays legible
    this.time.delayedCall(14000, function () {
      this.tweens.add({ targets: this._hint, alpha: 0.25, duration: 3000 });
    }, [], this);

    // ── Inventory panel (hidden by default) ──────────────────────────────────
    this._buildInventoryPanel();

    // ── Safe room name banner (center top, fades in/out on room enter/exit) ────
    this._srBanner = this.add.text(W / 2, 80, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffdd88',
      stroke: '#000000', strokeThickness: 4,
      shadow: { blur: 12, color: '#cc8833', fill: true },
    }).setDepth(220).setOrigin(0.5).setAlpha(0);
    this._srSubBanner = this.add.text(W / 2, 100, 'SAFE ZONE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#886633',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(220).setOrigin(0.5).setAlpha(0);
    this._srBannerRoom = null; // tracks which room banner is showing

    // ── TV panel (shown on first visit, dismissed by any key) ─────────────────
    this._tvPanel = this.add.container(0, -Math.round(H * 0.28)).setDepth(350).setVisible(false);
    var tvBg     = this.add.rectangle(W / 2, H / 2, 560, 220, 0x080614, 0.97).setOrigin(0.5);
    var tvBorder = this.add.rectangle(W / 2, H / 2, 560, 220, 0x997733)
      .setOrigin(0.5).setFillStyle(0, 0).setStrokeStyle(2, 0xffdd77);
    this._tvRoomName = this.add.text(W / 2, H / 2 - 72, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffdd88',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    var tvScreenLabel = this.add.text(W / 2, H / 2 - 42, '[ TV SCREEN 1 / 3 ]', {
      fontFamily: 'monospace', fontSize: '9px', color: '#554422',
    }).setOrigin(0.5);
    this._tvMsg = this.add.text(W / 2, H / 2 - 6, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ddccaa',
      wordWrap: { width: 500 }, align: 'center',
    }).setOrigin(0.5);
    var tvScreen2Label = this.add.text(W / 2, H / 2 + 48, '[ TV SCREEN 2 / 3 ]  CRAWLER COUNT', {
      fontFamily: 'monospace', fontSize: '9px', color: '#554422',
    }).setOrigin(0.5);
    this._tvCountdown = this.add.text(W / 2, H / 2 + 62, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#aabb99',
    }).setOrigin(0.5);
    var tvDismiss = this.add.text(W / 2, H / 2 + 90, 'PRESS ANY KEY TO DISMISS', {
      fontFamily: 'monospace', fontSize: '9px', color: '#443322',
    }).setOrigin(0.5);
    this._tvPanel.add([tvBg, tvBorder, this._tvRoomName, tvScreenLabel,
                       this._tvMsg, tvScreen2Label, this._tvCountdown, tvDismiss]);
    this._tvOpen = false;

    // ── I key toggles inventory ───────────────────────────────────────────────
    var scene = this;
    this.input.keyboard.on('keydown-I', function () {
      if (scene._tvOpen) { scene._dismissTV(); return; }
      if (!scene._hudUnlocked) return;
      if (scene._skillsOpen) scene._closeSkillsPanel();
      scene._toggleInventory();
    });

    this.input.keyboard.on('keydown-K', function () {
      if (scene._tvOpen) { scene._dismissTV(); return; }
      if (!scene._hudUnlocked) return;
      if (scene._skillsOpen) { scene._closeSkillsPanel(); return; }
      if (scene._invOpen) scene._toggleInventory();
      if (scene._shopOpen) scene.registry.set('shopOpen', false);
      scene._openSkillsPanel();
    });

    // ── 1-0 keys: dual-purpose ────────────────────────────────────────────────
    // Inventory open  → spend stat points (1-6 only, in safe room)
    // Inventory closed → use hotlist slot (1-9 = slots 0-8, 0 = slot 9)
    var statNames = ['str','con','dex','int','cha','luck'];
    var allSlotKeys = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','ZERO'];
    allSlotKeys.forEach(function (key, i) {
      scene.input.keyboard.on('keydown-' + key, function () {
        var status = scene.registry.get('status');
        if (!status || !scene._hudUnlocked) return;

        if (scene._invOpen) {
          // Stat spend: only keys 1-6, only in safe room on floor 3+
          if (i >= 6) return;
          var inSafeRoom = scene._gameScene && scene._gameScene.isInSafeRoom ? scene._gameScene.isInSafeRoom() : false;
          if (!inSafeRoom || status.statPoints <= 0 || status.floor < 3) return;
          var spent = status.spendStatPoint(statNames[i]);
          if (spent) scene._invDirty = true;
        } else {
          // Hotlist use: slot index i (ZERO maps to slot 9)
          var slotIdx = (key === 'ZERO') ? 9 : i;
          var result = status.hotlistUse(slotIdx);
          if (result.used) {
            var gs = scene._gameScene;
            if (gs && result.healed > 0) {
              gs._floatText(gs.carl.x(), gs.carl.y() - 20, '+' + result.healed + ' HP', '#88ff88');
              gs.messages.push(MessageSystem.potion(result.healed));
            }
            if (gs && result.mpRestored > 0) {
              gs._floatText(gs.carl.x(), gs.carl.y() - 20, '+' + result.mpRestored + ' MP', '#88aaff');
              gs.messages.push('"Oh, that\'s for me? How thoughtful." — DONUT');
            }
          }
        }
      });
    });

    // ── Arrow keys: scroll inventory list ────────────────────────────────────
    this.input.keyboard.on('keydown-UP', function () {
      if (!scene._invOpen) return;
      scene._invScroll = Math.max(0, scene._invScroll - 1);
      scene._invDirty = true;
    });
    this.input.keyboard.on('keydown-DOWN', function () {
      if (!scene._invOpen) return;
      var maxScroll = Math.max(0, (scene._invRows ? scene._invRows.length : 0) - scene._invVisRows);
      scene._invScroll = Math.min(maxScroll, scene._invScroll + 1);
      scene._invDirty = true;
    });

    // ── H key: re-assign all potions to hotlist when inventory open ──────────
    this.input.keyboard.on('keydown-H', function () {
      if (!scene._invOpen) return;
      var status = scene.registry.get('status');
      if (!status) return;
      // Clear existing consumable slots, reassign from inventory
      for (var ci = 0; ci < status.hotlist.length; ci++) {
        var hitem = status.hotlist[ci];
        if (hitem && (hitem.type === 'potion' || hitem.type === 'mana_potion')) {
          status.hotlist[ci] = null;
        }
      }
      for (var ii = 0; ii < status.inventory.length; ii++) {
        var itype = status.inventory[ii].type;
        if (itype === 'potion' || itype === 'mana_potion') status._autoHotlist(status.inventory[ii]);
      }
      scene._invDirty = true;
    });

    // ── C key: craft selected recipe when inventory open ──────────────────────
    this.input.keyboard.on('keydown-C', function () {
      if (!scene._invOpen) return;
      var rows = scene._invRows;
      if (!rows || scene._invSelIdx < 0) return;
      var row = rows[scene._invSelIdx];
      if (row && row.recipeIdx != null && row.action) row.action();
    });

    // ── Shop keys (when shop panel is open) ──────────────────────────────────
    this._shopCursor = 0;
    this._shopPanel  = null;

    this.input.keyboard.on('keydown-UP', function () {
      if (!scene._shopOpen) return;
      var shopData = scene.registry.get('shopData');
      if (!shopData) return;
      scene._shopCursor = Math.max(0, scene._shopCursor - 1);
      scene._refreshShopPanel(shopData);
    });
    this.input.keyboard.on('keydown-DOWN', function () {
      if (!scene._shopOpen) return;
      var shopData = scene.registry.get('shopData');
      if (!shopData) return;
      scene._shopCursor = Math.min(shopData.stock.length - 1, scene._shopCursor + 1);
      scene._refreshShopPanel(shopData);
    });
    this.input.keyboard.on('keydown-E', function () {
      if (!scene._shopOpen) return;
      var shopData = scene.registry.get('shopData');
      if (!shopData) return;
      var item = shopData.stock[scene._shopCursor];
      if (item && (item.type === 'sell_junk' || shopData.gold >= item.cost)) {
        scene.registry.set('shopBuyIdx', scene._shopCursor);
      }
    });
    this.input.keyboard.on('keydown-ESC', function () {
      if (scene._fmOpen) { scene.toggleFullMap(); return; }
      if (scene._shopOpen) scene.registry.set('shopOpen', false);
      if (scene._skillsOpen) scene._closeSkillsPanel();
    });

    this.input.keyboard.on('keydown-M', function () {
      if (scene._hudUnlocked) scene.toggleFullMap();
    });

    // Watch shopData registry for open/update/close.
    // Clear prior listeners — UIScene relaunches on every game restart, and
    // registry events live on the global emitter (no per-scene auto-cleanup).
    // Without this, listeners stack and any state change recurses through them.
    this.registry.events.removeAllListeners('changedata-shopOpen');
    this.registry.events.removeAllListeners('changedata-shopData');
    this.registry.events.on('changedata-shopOpen', function (parent, val) {
      if (val) {
        var sd = scene.registry.get('shopData');
        if (sd) scene._openShopPanel(sd);
      } else {
        scene._closeShopPanel();
      }
    });
    this.registry.events.on('changedata-shopData', function (parent, val) {
      if (scene._shopOpen && val) scene._refreshShopPanel(val);
    });

    // Any key dismisses TV panel
    this.input.keyboard.on('keydown', function () {
      if (scene._tvOpen) scene._dismissTV();
    });

    // Cache GameScene reference — valid for lifetime of this UIScene instance
    this._gameScene = this.scene.get('GameScene');

    // ── HUD lock — hidden until tutorial complete ─────────────────────────────
    var status0 = this.registry.get('status');
    var alreadyDone = status0 && status0.tutorialComplete;
    this._hudUnlocked = !!alreadyDone;
    this._setLockedHUDVisible(this._hudUnlocked);

    // ── Subscribe to message feed ─────────────────────────────────────────────
    this._msgObj = null;
    var msgPoll = this.time.addEvent({ delay: 80, callback: function () {
      var msgs = scene.registry.get('messages');
      if (!msgs) return;
      scene._msgObj = msgs;
      var m;
      while ((m = msgs.pop())) scene._routeMessage(m);
      msgs.onMessage(function (msg) { scene._routeMessage(msg); });
      msgPoll.remove();
    }, loop: true });
  },

  _routeMessage: function (msg) {
    var t = msg.type;
    if (t === 'achievement') {
      this._sysMessages.push(msg);
      this._showAchievementBadge(msg.text);
    } else if (t === 'system') {
      this._sysMessages.push(msg);
    } else {
      // character + feedback go to chat strip
      this._chatMessages.push(msg);
    }
  },

  _showAchievementBadge: function (text) {
    this._achievementQueue.push(text);
    if (this._achievementQueue.length === 1) this._flushAchievementQueue();
  },

  _flushAchievementQueue: function () {
    if (!this._achievementQueue.length) return;
    var text = this._achievementQueue[0];
    var scene = this;
    var W = this.W, H = this.H;

    var label = text.replace(/^ACHIEVEMENT[: ]*UNLOCKED?[: ]*/i, '')
                    .replace(/^ACHIEVEMENT[: ]*/i, '');
    var firstDot = label.indexOf('.');
    var title = firstDot > 0 ? label.substring(0, firstDot) : label;
    title = title.replace(/^"|"$/g, '').trim();
    if (title.length > 50) title = title.substring(0, 47) + '...';

    // Sit near the top so the badge clears the centered inventory/skills panels
    // and the intro dialogue box; depth above both panels (inv 300, skills 310).
    var cy = Math.round(H * 0.13);
    var bg = this.add.rectangle(W / 2, cy, 340, 54, 0x111108, 0.92)
      .setStrokeStyle(2, 0xffdd44, 0.95).setDepth(320).setAlpha(0);
    var header = this.add.text(W / 2, cy - 14, 'ACHIEVEMENT UNLOCKED', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffaa22',
    }).setOrigin(0.5).setDepth(321).setAlpha(0);
    var titleText = this.add.text(W / 2, cy + 8, title, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 2, align: 'center',
      wordWrap: { width: 320 }
    }).setOrigin(0.5).setDepth(321).setAlpha(0);

    var all = [bg, header, titleText];
    this.tweens.add({
      targets: all, alpha: 1, duration: 250, ease: 'Cubic.Out',
    });
    this.time.delayedCall(2400, function () {
      bg.scene.tweens.add({
        targets: all, alpha: 0, duration: 400,
        onComplete: function () {
          all.forEach(function (o) { o.destroy(); });
          scene._achievementQueue.shift();
          scene._flushAchievementQueue();
        }
      });
    });
  },

  // ── Inventory panel construction ─────────────────────────────────────────

  _buildInventoryPanel: function () {
    var scene = this;
    var W = this.W, H = this.H;

    // Panel geometry
    var pw = 680, ph = 460;
    var px = Math.floor((W - pw) / 2);
    var py = Math.floor((H - ph) / 2);
    this._invPx = px; this._invPy = py;
    this._invPw = pw; this._invPh = ph;

    // Column split: left 220px stats, right rest = item list
    var STAT_W  = 220;
    var LIST_X  = px + STAT_W + 1;       // item list left edge (world coords)
    var LIST_W  = pw - STAT_W - 1;       // item list width
    var TAB_H   = 26;                    // tab bar height
    var HDR_H   = 36;                    // header (title) height
    var FOOT_H  = 22;                    // footer hint height
    var ROW_H   = 22;                    // each item row height
    var LIST_Y0 = py + HDR_H + TAB_H;   // item list top (world coords, after tabs)
    var LIST_YB = py + ph - FOOT_H;     // item list bottom
    var VISIBLE_ROWS = Math.floor((LIST_YB - LIST_Y0) / ROW_H);

    this._invListX  = LIST_X;
    this._invListY0 = LIST_Y0;
    this._invListYB = LIST_YB;
    this._invRowH   = ROW_H;
    this._invVisRows = VISIBLE_ROWS;
    this._invScroll  = 0;
    this._invTab     = 'ALL';     // ALL | GEAR | CONSUMABLES | CRAFTING
    this._invRows    = [];        // [{item, label, color, dim, action}] rebuilt each refresh
    this._invSelIdx  = -1;        // selected row index (for stat compare)

    var DEPTH = 300;
    this._invPanel = this.add.container(0, 0).setDepth(DEPTH).setVisible(false);

    // Background + border
    var bg     = this.add.rectangle(px, py, pw, ph, 0x060414, 0.97).setOrigin(0, 0);
    var border = this.add.rectangle(px, py, pw, ph, 0x6644cc)
      .setOrigin(0, 0).setFillStyle(0, 0).setStrokeStyle(2, 0x9966ff);
    var title  = this.add.text(px + pw / 2, py + 10, '[ CRAWLER INVENTORY ]', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffdd57'
    }).setOrigin(0.5, 0);

    // Vertical divider between stats and list
    var divider = this.add.rectangle(LIST_X, py + HDR_H, 1, ph - HDR_H - FOOT_H, 0x332244).setOrigin(0, 0);

    var foot = this.add.text(px + pw / 2, py + ph - 6, '[I] close   [↑↓] scroll   click/[C] craft   click to equip/use', {
      fontFamily: 'monospace', fontSize: '9px', color: '#443355'
    }).setOrigin(0.5, 1);

    this._invPanel.add([bg, border, title, divider, foot]);

    // Stats text (left column) — rebuilt each refresh
    this._invStatsText = this.add.text(px + 10, py + HDR_H + 6, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ccbbff', lineSpacing: 2,
    }).setOrigin(0, 0);
    this._invPanel.add(this._invStatsText);

    // ── Tab bar ───────────────────────────────────────────────────────────────
    var TABS = ['ALL', 'GEAR', 'CONSUMABLES', 'CRAFTING'];
    var tabW  = Math.floor(LIST_W / TABS.length);
    this._invTabBgs   = [];
    this._invTabTexts = [];

    for (var ti = 0; ti < TABS.length; ti++) {
      (function (tabName, idx) {
        var tx = LIST_X + idx * tabW;
        var ty = py + HDR_H;
        var tbg = scene.add.rectangle(tx, ty, tabW - 2, TAB_H, 0x110022, 0.9).setOrigin(0, 0);
        var ttxt = scene.add.text(tx + tabW / 2, ty + TAB_H / 2, tabName, {
          fontFamily: 'monospace', fontSize: '10px', color: '#776699'
        }).setOrigin(0.5);
        tbg.setInteractive().on('pointerdown', function () {
          scene._invTab = tabName;
          scene._invScroll = 0;
          scene._invSelIdx = -1;
          scene._invDirty = true;
        });
        tbg.on('pointerover',  function () { if (scene._invTab !== tabName) tbg.setFillStyle(0x221133, 0.9); });
        tbg.on('pointerout',   function () { if (scene._invTab !== tabName) tbg.setFillStyle(0x110022, 0.9); });
        scene._invTabBgs.push(tbg);
        scene._invTabTexts.push(ttxt);
        scene._invPanel.add([tbg, ttxt]);
      })(TABS[ti], ti);
    }

    // Tab separator line
    var tabLine = this.add.rectangle(LIST_X, py + HDR_H + TAB_H, LIST_W, 1, 0x443366).setOrigin(0, 0);
    this._invPanel.add(tabLine);

    // ── Scroll indicators ─────────────────────────────────────────────────────
    this._invScrollUp   = this.add.text(LIST_X + LIST_W - 8, LIST_Y0 + 2, '▲', {
      fontFamily: 'monospace', fontSize: '10px', color: '#6655aa'
    }).setOrigin(1, 0).setAlpha(0);
    this._invScrollDown = this.add.text(LIST_X + LIST_W - 8, LIST_YB - 2, '▼', {
      fontFamily: 'monospace', fontSize: '10px', color: '#6655aa'
    }).setOrigin(1, 1).setAlpha(0);
    this._invPanel.add([this._invScrollUp, this._invScrollDown]);

    // ── Row hit zones (reused, repositioned each refresh) ─────────────────────
    // Pre-allocate VISIBLE_ROWS invisible rectangles for click detection
    this._invHitZones = [];
    this._invRowBgs   = [];
    this._invRowTexts = [];
    this._invRowStats = [];

    for (var ri = 0; ri < VISIBLE_ROWS; ri++) {
      (function (rowIdx) {
        var ry = LIST_Y0 + rowIdx * ROW_H;

        var rbg = scene.add.rectangle(LIST_X + 2, ry, LIST_W - 4, ROW_H - 1, 0x000000, 0)
          .setOrigin(0, 0);

        var rtxt = scene.add.text(LIST_X + 10, ry + ROW_H / 2, '', {
          fontFamily: 'monospace', fontSize: '11px', color: '#ddccff'
        }).setOrigin(0, 0.5);

        var rstat = scene.add.text(LIST_X + LIST_W - 10, ry + ROW_H / 2, '', {
          fontFamily: 'monospace', fontSize: '11px', color: '#999'
        }).setOrigin(1, 0.5);

        var zone = scene.add.rectangle(LIST_X + 2, ry, LIST_W - 4, ROW_H - 1, 0xffffff, 0)
          .setOrigin(0, 0).setInteractive();

        zone.on('pointerover', function () {
          var rows = scene._invRows;
          var absIdx = rowIdx + scene._invScroll;
          if (absIdx < rows.length && !rows[absIdx].dim) {
            rbg.setFillStyle(0x221133, 0.8).setAlpha(1);
          }
        });
        zone.on('pointerout', function () {
          var rows = scene._invRows;
          var absIdx = rowIdx + scene._invScroll;
          if (absIdx < rows.length) {
            scene._tintRow(rowIdx, absIdx);
          }
        });
        zone.on('pointerdown', function () {
          var rows = scene._invRows;
          var absIdx = rowIdx + scene._invScroll;
          if (absIdx >= rows.length) return;
          var row = rows[absIdx];
          if (row.action) {
            row.action();
            scene._invDirty = true;
          } else {
            scene._invSelIdx = (scene._invSelIdx === absIdx) ? -1 : absIdx;
            scene._invDirty = true;
          }
        });

        scene._invRowBgs.push(rbg);
        scene._invRowTexts.push(rtxt);
        scene._invRowStats.push(rstat);
        scene._invHitZones.push(zone);
        scene._invPanel.add([rbg, rtxt, rstat, zone]);
      })(ri);
    }

    // Stat compare tooltip — shown below selected row
    this._invCompare = this.add.text(LIST_X + LIST_W / 2, LIST_YB - 4, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffcc66', align: 'center'
    }).setOrigin(0.5, 1).setAlpha(0);
    this._invPanel.add(this._invCompare);

    // Scroll wheel support
    this.input.on('wheel', function (ptr, objs, dx, dy) {
      if (!scene._invOpen) return;
      scene._invScroll += (dy > 0 ? 1 : -1);
      scene._invDirty = true;
    });
  },

  // Tint a visible row slot to its natural background based on content
  _tintRow: function (rowSlot, absIdx) {
    var rows = this._invRows;
    var rbg  = this._invRowBgs[rowSlot];
    if (absIdx >= rows.length) { rbg.setAlpha(0); return; }
    var row = rows[absIdx];
    if (absIdx === this._invSelIdx) {
      rbg.setFillStyle(0x332255, 1).setAlpha(1);
    } else if (row.isSectionHeader) {
      rbg.setFillStyle(0x110a22, 1).setAlpha(1);
    } else if (row.dim) {
      rbg.setFillStyle(0x000000, 0).setAlpha(0);
    } else {
      rbg.setFillStyle(0x0d0822, 0.6).setAlpha(1);
    }
  },

  // ── Shop panel ────────────────────────────────────────────────────────────

  _openShopPanel: function (shopData) {
    this._shopOpen = true;
    this._shopCursor = 0;
    if (this._invOpen) this._toggleInventory();
    if (this._shopPanel) this._shopPanel.destroy();

    var W = this.W, H = this.H;
    var PW = 340, PH = 220;
    var px = Math.floor((W - PW) / 2);
    var py = Math.floor((H - PH) / 2);
    this._shopPx = px; this._shopPy = py; this._shopPW = PW; this._shopPH = PH;

    this._shopPanel = this.add.container(0, 0).setDepth(90);
    // Static elements built once
    this._shopPanel.add([
      this.add.rectangle(px, py, PW, PH, 0x08060e, 0.95).setOrigin(0, 0),
      this.add.rectangle(px, py, PW, PH, 0x334466).setOrigin(0, 0).setFillStyle(0, 0).setStrokeStyle(1, 0x4466aa),
      this.add.text(px + PW / 2, py + 10, 'TALLY\'S SHOP', { fontFamily: 'monospace', fontSize: '13px', color: '#aaddff' }).setOrigin(0.5, 0),
      this.add.text(px + PW / 2, py + PH - 14, 'UP/DOWN select   E buy   ESC close', { fontFamily: 'monospace', fontSize: '8px', color: '#445566' }).setOrigin(0.5, 1),
    ]);
    // Gold text stored for updates
    this._shopGoldTxt = this.add.text(px + PW - 10, py + 10, shopData.gold + 'g', { fontFamily: 'monospace', fontSize: '11px', color: '#ffdd57' }).setOrigin(1, 0);
    this._shopPanel.add(this._shopGoldTxt);
    // Row container rebuilt on cursor/gold changes
    this._shopRowsContainer = this.add.container(0, 0);
    this._shopPanel.add(this._shopRowsContainer);
    this._rebuildShopRows(shopData);
  },

  _closeShopPanel: function () {
    if (!this._shopOpen) return;
    this._shopOpen = false;
    if (this._shopPanel) { this._shopPanel.destroy(); this._shopPanel = null; }
    this._shopGoldTxt = null; this._shopRowsContainer = null;
  },

  _openSkillsPanel: function () {
    var status = this.registry.get('status');
    if (!status) return;
    this._skillsOpen = true;

    var W = this.W, H = this.H;
    var PW = 280, PH = 230;
    var px = Math.floor((W - PW) / 2), py = Math.floor((H - PH) / 2);

    if (this._skillsPanel) this._skillsPanel.destroy();
    this._skillsPanel = this.add.container(0, 0).setDepth(310);

    this._skillsPanel.add([
      this.add.rectangle(px, py, PW, PH, 0x050813, 0.97).setOrigin(0, 0),
      this.add.rectangle(px, py, PW, PH, 0x2244aa).setOrigin(0, 0).setFillStyle(0, 0).setStrokeStyle(1, 0x4466cc),
      this.add.text(px + PW / 2, py + 10, '[ SKILLS ]', {
        fontFamily: 'monospace', fontSize: '13px', color: '#aaddff'
      }).setOrigin(0.5, 0),
      this.add.text(px + PW - 8, py + 10, 'K — CLOSE', {
        fontFamily: 'monospace', fontSize: '8px', color: '#334466'
      }).setOrigin(1, 0),
    ]);

    var SKILL_DEFS = [
      { key: 'unarmed',   effect: function(lvl){ return '+' + lvl + ' dmg unarmed'; } },
      { key: 'melee',     effect: function(lvl){ return '+' + lvl + ' dmg w/ weapon'; } },
      { key: 'endurance', effect: function(lvl){ return '+' + (lvl * 3) + ' max HP'; } },
      { key: 'dodge',     effect: function(lvl){ return (lvl * 2) + '% dodge chance'; } },
    ];

    var BAR_W = 100, BAR_H = 6, ROW_H = 46;
    var rowX = px + 12, rowY0 = py + 34;

    for (var i = 0; i < SKILL_DEFS.length; i++) {
      var sd = SKILL_DEFS[i];
      var lvl = status.skills[sd.key];
      var xpPct = status.skillXpPercent(sd.key);
      var ry = rowY0 + i * ROW_H;

      this._skillsPanel.add(this.add.text(rowX, ry, CrawlerStatus.SKILL_LABELS[sd.key], {
        fontFamily: 'monospace', fontSize: '10px', color: '#aabbdd'
      }).setOrigin(0, 0));
      this._skillsPanel.add(this.add.text(px + PW - 12, ry, 'LVL ' + lvl + ' / 15', {
        fontFamily: 'monospace', fontSize: '10px', color: '#ffdd88'
      }).setOrigin(1, 0));

      // XP bar
      var barY = ry + 14;
      this._skillsPanel.add(this.add.rectangle(rowX, barY, BAR_W, BAR_H, 0x112233).setOrigin(0, 0));
      if (xpPct > 0) {
        this._skillsPanel.add(this.add.rectangle(rowX, barY, Math.max(2, Math.floor(BAR_W * xpPct)), BAR_H, 0x4488cc).setOrigin(0, 0));
      }

      // Effect description
      this._skillsPanel.add(this.add.text(rowX, ry + 24, sd.effect(lvl), {
        fontFamily: 'monospace', fontSize: '9px', color: '#556677'
      }).setOrigin(0, 0));
    }
  },

  _closeSkillsPanel: function () {
    this._skillsOpen = false;
    if (this._skillsPanel) { this._skillsPanel.destroy(); this._skillsPanel = null; }
  },

  _refreshShopPanel: function (shopData) {
    if (!this._shopPanel) return;
    if (this._shopGoldTxt) this._shopGoldTxt.setText(shopData.gold + 'g');
    this._rebuildShopRows(shopData);
  },

  _rebuildShopRows: function (shopData) {
    if (!this._shopRowsContainer) return;
    this._shopRowsContainer.removeAll(true);

    var px = this._shopPx, py = this._shopPy, PW = this._shopPW;
    var stock = shopData.stock;
    var ROW_H = 30, LIST_Y = py + 34;

    for (var si = 0; si < stock.length; si++) {
      var item = stock[si];
      var ry = LIST_Y + si * ROW_H;
      var isSelected = (si === this._shopCursor);
      var canAfford = item.type === 'sell_junk' || (shopData.gold >= item.cost);

      if (isSelected) {
        this._shopRowsContainer.add(
          this.add.rectangle(px + 6, ry, PW - 12, ROW_H - 2, 0x1a2a4a, 0.9).setOrigin(0, 0));
      }

      var isSellJunk = item.type === 'sell_junk';
      var suffix = '';
      if (item.damage)          suffix = '  [dmg ' + item.damage + ']';
      else if (item.defense)    suffix = '  [def ' + item.defense + ']';
      else if (item.healAmount) suffix = '  [+' + item.healAmount + ' hp]';
      else if (item.mpAmount)   suffix = '  [+' + item.mpAmount + ' mp]';

      var nameColor = isSellJunk ? '#cc8833' : (canAfford ? '#ccddee' : '#665566');
      var priceLabel = isSellJunk ? 'SELL' : (item.cost + 'g');
      var priceColor = isSellJunk ? '#cc8833' : (canAfford ? '#ffdd57' : '#886644');

      this._shopRowsContainer.add([
        this.add.text(px + 10, ry + ROW_H / 2, isSelected ? '▶' : ' ',
          { fontFamily: 'monospace', fontSize: '10px', color: '#88bbff' }).setOrigin(0, 0.5),
        this.add.text(px + 22, ry + ROW_H / 2, item.name + suffix,
          { fontFamily: 'monospace', fontSize: '10px', color: nameColor }).setOrigin(0, 0.5),
        this.add.text(px + PW - 14, ry + ROW_H / 2, priceLabel,
          { fontFamily: 'monospace', fontSize: '10px', color: priceColor }).setOrigin(1, 0.5),
      ]);
    }
  },

  _toggleInventory: function () {
    this._invOpen = !this._invOpen;
    this._invPanel.setVisible(this._invOpen);
    if (this._invOpen) this._invScroll = 0;
    this._invDirty = true;
  },

  markInventoryDirty: function () { this._invDirty = true; },

  _doCraft: function (recipeIdx) {
    var recipe = CRAFT_RECIPES[recipeIdx];
    if (!recipe) return;
    var status = this.registry.get('status');
    if (!status) return;
    var gs = this._gameScene;
    var inSafeRoom = gs && gs.isInSafeRoom ? gs.isInSafeRoom() : false;
    if (!inSafeRoom) return;

    // Verify mats still present (race between click and state)
    for (var i = 0; i < recipe.ingredients.length; i++) {
      var ing = recipe.ingredients[i];
      if (status.countCraftingMat(ing.name) < ing.count) {
        if (gs) gs.messages.push('NOT ENOUGH ' + ing.name.toUpperCase() + '.');
        return;
      }
    }

    // Consume mats
    for (var j = 0; j < recipe.ingredients.length; j++) {
      status.consumeCraftingMats(recipe.ingredients[j].name, recipe.ingredients[j].count);
    }

    // Add output
    status.addItem(Object.assign({}, recipe.output));

    if (gs) {
      gs.messages.push('CRAFTED: ' + recipe.output.name.toUpperCase() + '. ' + recipe.desc.toUpperCase() + '.');
      gs._floatText(gs.carl.x(), gs.carl.y() - 28, recipe.output.name, '#ffcc66');
    }
    if (typeof _playCraft === 'function') _playCraft();
    if (gs && Math.random() < 0.35) gs.messages.push(MessageSystem.donutReaction('craft'));
    this._invDirty = true;
  },

  _refreshInventory: function () {
    var scene  = this;
    var status = this.registry.get('status');
    if (!status) return;

    var inSafeRoom = this._gameScene && this._gameScene.isInSafeRoom ? this._gameScene.isInSafeRoom() : false;
    var canSpend   = status.statPoints > 0 && inSafeRoom && status.floor >= 3;
    var st         = status.statPoints;

    // ── Left column: crawler stats ────────────────────────────────────────────
    var pts = status.statPoints;
    var statLines = [
      '─ CRAWLER ─',
      '',
      'NAME   ' + status.crawlerName,
      '       #' + status.crawlerNumber,
      'CLASS  ' + (status.classChosen
        ? CrawlerStatus.RACES[status.race].name + ' ' + CrawlerStatus.CLASSES[status.className].name
        : '— (Floor 3)'),
      'LEVEL  ' + status.level,
      'FLOOR  ' + status.floor,
      'KILLS  ' + status.kills,
      '',
      pts > 0
        ? '─ ATTRS [' + pts + 'pt' + (pts > 1 ? 's' : '') + '] ─'
        : '─ ATTRIBUTES ─',
      '',
    ];
    var STAT_DEFS = [
      ['[1] STR', status.stats.str, 'melee dmg'],
      ['[2] CON', status.stats.con, 'HP/regen'],
      ['[3] DEX', status.stats.dex, 'speed'],
      ['[4] INT', status.stats.int, 'MP/spells'],
      ['[5] CHA', status.stats.cha, 'Donut bond'],
      ['[6] LCK', status.stats.luck, ''],
    ];
    STAT_DEFS.forEach(function (s) {
      statLines.push(s[0] + ' ' + _pad(s[1], 2) + (canSpend ? ' [+]' : '   ') + '  ' + s[2]);
    });
    statLines.push('');
    statLines.push('─ HP / MP / XP ─');
    statLines.push('HP  ' + status.hp + '/' + status.maxHp);
    statLines.push('MP  ' + status.mp + '/' + status.maxMp);
    statLines.push('XP  ' + status.xp + '/' + status.xpToNext);
    statLines.push('');
    statLines.push('─ DONUT ─');
    statLines.push('CLASS  Child Actor');
    statLines.push('SPELL  Magic Missile [Q]');
    statLines.push('PASS   Healing Purr');
    if (!canSpend && pts > 0) {
      statLines.push('');
      statLines.push('⚠ ' + pts + ' pt' + (pts > 1 ? 's' : '') + ' banked');
      statLines.push('  (floor 3 + safe room)');
    }
    this._invStatsText.setText(statLines.join('\n'));

    // ── Build row list for active tab ─────────────────────────────────────────
    var weapon  = status.equippedWeapon;
    var armor   = status.equippedArmor;
    var tab     = this._invTab;
    var rows    = [];

    var addHeader = function (label) {
      rows.push({ label: label, color: '#554477', isSectionHeader: true, statStr: '' });
    };

    // Deduplicate crafting by name for display
    var craftMap = {};
    status.inventory.forEach(function (item) {
      if (item.type === 'crafting') {
        craftMap[item.name] = (craftMap[item.name] || { item: item, count: 0 });
        craftMap[item.name].count++;
      }
    });

    // --- GEAR section ---
    if (tab === 'ALL' || tab === 'GEAR') {
      addHeader('── EQUIPPED ──');

      // Weapon row
      var wLabel = weapon ? weapon.name : 'fists  (unarmed)';
      var wStat  = weapon ? '+' + weapon.damage + ' dmg' : '';
      rows.push({ label: '⚔  ' + wLabel, color: weapon ? '#ffcc66' : '#554433',
        statStr: wStat, equipped: true, item: weapon, isSectionHeader: false });

      // Armor row
      var aLabel = armor ? armor.name : 'tank top  (none)';
      var aStat  = armor ? '+' + armor.defense + ' def' : '';
      rows.push({ label: '🛡  ' + aLabel, color: armor ? '#88ccff' : '#334455',
        statStr: aStat, equipped: true, item: armor, isSectionHeader: false });

      // Unequipped weapons + armors
      var unequipped = status.inventory.filter(function (i) {
        return (i.type === 'weapon' || i.type === 'armor') && i !== weapon && i !== armor;
      });

      if (unequipped.length > 0) {
        addHeader('── BAG: GEAR ──');
        unequipped.forEach(function (item) {
          var isWep = item.type === 'weapon';
          var stat  = isWep ? '+' + item.damage + ' dmg' : '+' + item.defense + ' def';
          // Compare vs equipped
          var compareStr = '';
          var dim = false;
          if (isWep && weapon) {
            var delta = item.damage - weapon.damage;
            compareStr = (delta >= 0 ? '+' : '') + delta + ' vs equip';
            if (delta < 0) dim = true;
          } else if (!isWep && armor) {
            var deltaA = item.defense - armor.defense;
            compareStr = (deltaA >= 0 ? '+' : '') + deltaA + ' vs equip';
            if (deltaA < 0) dim = true;
          }
          var col = isWep ? (dim ? '#886633' : '#ffcc66') : (dim ? '#336688' : '#88ccff');
          rows.push({
            label: (isWep ? '⚔  ' : '🛡  ') + item.name,
            color: col, statStr: stat, dim: dim,
            compareStr: compareStr, item: item,
            isSectionHeader: false,
            action: function () {
              if (isWep) {
                status.equippedWeapon = item;
              } else {
                status.equippedArmor = item;
              }
              scene._invSelIdx = -1;
              var gs = scene._gameScene;
              if (gs) gs.messages.push('EQUIPPED: ' + item.name.toUpperCase() + '  ' + stat);
            }
          });
        });
      }
    }

    // --- CONSUMABLES section ---
    if (tab === 'ALL' || tab === 'CONSUMABLES') {
      var consumables = status.inventory.filter(function (i) {
        return i.type === 'potion' || i.type === 'mana_potion' || i.type === 'consumable';
      });
      if (tab === 'ALL') addHeader('── CONSUMABLES ──');
      if (consumables.length === 0) {
        rows.push({ label: '  (no consumables)', color: '#443355', statStr: '', isSectionHeader: false });
      } else {
        // Group by type+name with count
        var consumeMap = {};
        consumables.forEach(function (c) {
          var key = c.type + ':' + c.name;
          if (!consumeMap[key]) consumeMap[key] = { item: c, count: 0 };
          consumeMap[key].count++;
        });
        Object.keys(consumeMap).forEach(function (key) {
          var entry = consumeMap[key];
          var item  = entry.item;
          var isMp  = item.type === 'mana_potion';
          var isScroll = item.type === 'consumable';
          var color = isMp ? '#88aaff' : isScroll ? '#ffcc88' : '#ff9988';
          var icon  = isMp ? '🔵' : isScroll ? '📜' : '⚗';
          var hint  = isMp ? '[1-0] use' : isScroll ? item.desc || '[1-0] use' : '[E] use';
          rows.push({
            label: icon + '  ' + item.name + (entry.count > 1 ? '  ×' + entry.count : ''),
            color: color, statStr: hint, isSectionHeader: false,
            action: function () {
              var idx = status.inventory.indexOf(entry.item);
              if (idx === -1) return;
              var usedItem = status.inventory.splice(idx, 1)[0];
              var gs = scene._gameScene;
              if (usedItem.type === 'mana_potion') {
                var mpAmt = usedItem.mpAmount != null ? usedItem.mpAmount : 30;
                status.regenMp(mpAmt);
                if (gs) {
                  gs._floatText(gs.carl.x(), gs.carl.y() - 20, '+' + mpAmt + ' MP', '#88aaff');
                  gs.messages.push('"Oh, that\'s for me? How thoughtful." — DONUT');
                }
              } else {
                var healAmt = usedItem.healAmount != null ? usedItem.healAmount : status._potionHeal();
                var healed  = status.heal(healAmt);
                if (gs) {
                  gs._floatText(gs.carl.x(), gs.carl.y() - 20, '+' + healed + ' HP', '#88ff88');
                  gs.messages.push(MessageSystem.potion(healed));
                }
              }
              // Refresh hotlist pointer if the used item was hotlisted
              for (var hi = 0; hi < status.hotlist.length; hi++) {
                if (status.hotlist[hi] === usedItem) {
                  var nextSame = status._findInInventory(usedItem.type);
                  status.hotlist[hi] = nextSame || null;
                }
              }
            }
          });
        });
      }
    }

    // --- CRAFTING section ---
    if (tab === 'ALL' || tab === 'CRAFTING') {
      var craftKeys = Object.keys(craftMap);

      // Materials
      if (tab === 'ALL') addHeader('── CRAFTING MATERIALS ──');
      if (craftKeys.length === 0) {
        rows.push({ label: '  (no materials)', color: '#443355', statStr: '', isSectionHeader: false });
      } else {
        craftKeys.forEach(function (name) {
          var entry = craftMap[name];
          var qualColor = entry.item.quality === 'uncommon' ? '#aaffcc' : '#88aa88';
          rows.push({
            label: '◈  ' + name + (entry.count > 1 ? '  ×' + entry.count : ''),
            color: qualColor,
            statStr: entry.item.quality || '',
            isSectionHeader: false,
            dim: false,
          });
        });
      }

      // Recipes — always shown; greyed when mats missing or not in safe room
      addHeader('── RECIPES' + (inSafeRoom ? '  [C] craft selected ──' : '  (safe room only) ──'));
      CRAFT_RECIPES.forEach(function (recipe, ri) {
        var canCraft = inSafeRoom && recipe.ingredients.every(function (ing) {
          return (craftMap[ing.name] ? craftMap[ing.name].count : 0) >= ing.count;
        });
        var matStr = recipe.ingredients.map(function (ing) {
          return ing.name + (ing.count > 1 ? ' ×' + ing.count : '');
        }).join(' + ');
        rows.push({
          label: (canCraft ? '⚒  ' : '·  ') + recipe.name,
          color: canCraft ? '#ffcc66' : '#554433',
          statStr: recipe.desc,
          isSectionHeader: false,
          dim: !canCraft,
          recipeIdx: ri,
          action: canCraft ? function (rIdx) {
            return function () { scene._doCraft(rIdx); };
          }(ri) : null,
        });
        rows.push({
          label: '      ' + matStr,
          color: canCraft ? '#886644' : '#443322',
          statStr: '',
          isSectionHeader: false,
          dim: true,
        });
      });
    }

    this._invRows = rows;

    // Clamp scroll
    var maxScroll = Math.max(0, rows.length - this._invVisRows);
    if (this._invScroll < 0) this._invScroll = 0;
    if (this._invScroll > maxScroll) this._invScroll = maxScroll;

    // ── Update tab bar appearance ─────────────────────────────────────────────
    var TABS = ['ALL', 'GEAR', 'CONSUMABLES', 'CRAFTING'];
    for (var ti = 0; ti < TABS.length; ti++) {
      var active = TABS[ti] === this._invTab;
      this._invTabBgs[ti].setFillStyle(active ? 0x331155 : 0x110022, 0.9);
      this._invTabTexts[ti].setColor(active ? '#ddaaff' : '#776699');
    }

    // ── Render visible rows ───────────────────────────────────────────────────
    var selRow = this._invSelIdx >= 0 && this._invSelIdx < rows.length ? rows[this._invSelIdx] : null;

    for (var ri = 0; ri < this._invVisRows; ri++) {
      var absIdx = ri + this._invScroll;
      var rtxt  = this._invRowTexts[ri];
      var rstat = this._invRowStats[ri];
      var rbg   = this._invRowBgs[ri];

      if (absIdx >= rows.length) {
        rtxt.setText(''); rstat.setText(''); rbg.setAlpha(0);
        continue;
      }

      var row = rows[absIdx];
      rtxt.setText(row.label).setColor(row.dim ? _dimColor(row.color) : row.color);
      rstat.setText(row.statStr).setColor(row.dim ? '#555566' : '#aaaaaa');

      if (row.isSectionHeader) {
        rtxt.setColor('#664499');
        rstat.setText('');
      }

      // Equipped marker — override stat text
      if (row.equipped && row.item) {
        rstat.setText('◄ equipped').setColor('#88ff88');
        rbg.setFillStyle(0x0a1a0a, 0.8).setAlpha(1);
      } else {
        this._tintRow(ri, absIdx);
      }
    }

    // ── Scroll indicators ─────────────────────────────────────────────────────
    this._invScrollUp.setAlpha(this._invScroll > 0 ? 1 : 0);
    this._invScrollDown.setAlpha(this._invScroll < maxScroll ? 1 : 0);

    // ── Stat compare tooltip ──────────────────────────────────────────────────
    if (selRow && selRow.compareStr) {
      this._invCompare.setText(selRow.compareStr).setAlpha(1);
    } else {
      this._invCompare.setAlpha(0);
    }

    this._potionCount = status.countPotions();
  },

  // ── update ────────────────────────────────────────────────────────────────

  update: function () {
    var status = this.registry.get('status');
    var gameScene = this._gameScene;
    if (!status) return;

    if (this._invOpen && this._hudUnlocked && this._invDirty) {
      this._refreshInventory();
      // dirty consumed by unified block below (also drives hotlist + potionCount)
    }

    if (status.hp !== this._lastHp || status.maxHp !== this._lastMaxHp) {
      this._lastHp = status.hp; this._lastMaxHp = status.maxHp;
      var hpPct = status.hpPercent();
      this._hpFill.setDisplaySize(Math.max(0, 180 * hpPct), 14);
      var hpColor = hpPct > 0.5 ? 0xcc2222 : hpPct > 0.25 ? 0xff8800 : 0xff4444;
      this._hpFill.setFillStyle(hpColor);
      this._hpText.setText(status.hp + '/' + status.maxHp);
    }

    if (status.mp !== this._lastMp || status.maxMp !== this._lastMaxMp) {
      this._lastMp = status.mp; this._lastMaxMp = status.maxMp;
      this._mpFill.setDisplaySize(Math.max(0, 180 * status.mpPercent()), 8);
      this._mpText.setText(status.mp + '/' + status.maxMp);
    }

    if (status.xp !== this._lastXp || status.xpToNext !== this._lastXpToNext) {
      this._lastXp = status.xp; this._lastXpToNext = status.xpToNext;
      this._xpFill.setDisplaySize(180 * status.xpPercent(), 8);
    }

    if (status.level !== this._lastLevel) {
      this._lastLevel = status.level;
      this._levelText.setText('LVL ' + status.level);
    }
    if (status.floor !== this._lastFloor) {
      this._lastFloor = status.floor;
      this._floorText.setText('F' + status.floor + ': ' + MessageSystem.floorName(status.floor));
    }
    if (status.kills !== this._lastKills) {
      this._lastKills = status.kills;
      this._killText.setText(status.kills + ' kills');
    }

    // ── Saved flash ───────────────────────────────────────────────────────────
    if (this.registry.get('savedFlash')) {
      this.registry.set('savedFlash', false);
      this._savedText.setText('SAVED').setAlpha(1);
      this.tweens.killTweensOf(this._savedText);
      this.tweens.add({ targets: this._savedText, alpha: 0, delay: 1500, duration: 800 });
    }

    // ── Hurt vignette trigger ─────────────────────────────────────────────────
    if (this.registry.get('hurtFlash')) {
      this.registry.set('hurtFlash', false);
      this.tweens.killTweensOf(this._hurtVignette);
      this._hurtVignette.setAlpha(0.38);
      this.tweens.add({ targets: this._hurtVignette, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
    }

    // ── TV panel trigger ──────────────────────────────────────────────────────
    var tvTrigger = this.registry.get('showTV');
    if (tvTrigger) {
      this.registry.set('showTV', null);
      if (!this._tvOpen) this._showTV(tvTrigger);
    }

    // ── HUD unlock (tutorial complete) ───────────────────────────────────────
    if (!this._hudUnlocked && this.registry.get('tutorialComplete')) {
      this.registry.set('tutorialComplete', false);
      this._hudUnlocked = true;
      this._unlockHUD();
    }

    // ── Floor timer / exit status (1s granularity) ───────────────────────────
    if (gameScene && gameScene.getFloorTimerStatus) {
      var stNow = Date.now();
      if (!this._stairsLastCheck || stNow - this._stairsLastCheck >= 1000) {
        this._stairsLastCheck = stNow;
        var ft = gameScene.getFloorTimerStatus();
        var stStr;
        if (ft.unlocked) {
          stStr = 'EXIT OPEN';
          if (this._stairsLastStr !== stStr) {
            this._stairsLastStr = stStr;
            this._stairsText.setText(stStr).setColor('#44ffaa');
            this.tweens.killTweensOf(this._stairsText);
            this.tweens.add({
              targets: this._stairsText, alpha: 0.4, duration: 600,
              yoyo: true, repeat: 5, ease: 'Sine.easeInOut',
              onComplete: function () { this._stairsText && this._stairsText.setAlpha(1); }
            });
          }
        } else {
          stStr = ft.hasBoss ? 'BOSS: ALIVE' : 'EXIT SEALED';
          if (this._stairsLastStr !== stStr) {
            this._stairsLastStr = stStr;
            this._stairsText.setText(stStr).setColor('#cc7722');
          }
        }
      }
    }

    // ── Safe room closure countdown ───────────────────────────────────────────
    if (gameScene && gameScene.getSafeRoomClosureStatus) {
      var scNow = Date.now();
      if (!this._closureLastCheck || scNow - this._closureLastCheck >= 1000) {
        this._closureLastCheck = scNow;
        var sc = gameScene.getSafeRoomClosureStatus();
        if (sc.closed) {
          if (this._closureLastStr !== 'SAFE ROOMS CLOSED') {
            this._closureLastStr = 'SAFE ROOMS CLOSED';
            this._closureText.setText('SAFE ROOMS CLOSED').setColor('#cc2222').setAlpha(1);
          }
        } else if (sc.secsLeft <= 300) {
          // Show only in last 5 min before closure
          var cStr = 'SAFE: ' + _fmtMMSS(sc.secsLeft);
          if (this._closureLastStr !== cStr) {
            this._closureLastStr = cStr;
            var cCol = sc.secsLeft > 120 ? '#cc6622' : '#ff3300';
            this._closureText.setText(cStr).setColor(cCol).setAlpha(1);
          }
        } else {
          if (this._closureText.alpha > 0) this._closureText.setAlpha(0);
        }
      }
    }

    // ── Safe room banner ──────────────────────────────────────────────────────
    var srNow = this.registry.get('currentSafeRoom');
    var srName = srNow ? srNow.name : null;
    if (srName !== this._srBannerRoom) {
      this._srBannerRoom = srName;
      this.tweens.killTweensOf(this._srBanner);
      this.tweens.killTweensOf(this._srSubBanner);
      if (!srName && this._tvOpen) this._dismissTV();
      if (srName) {
        var scene = this;
        this._srBanner.setText(srName).setAlpha(0);
        this._srSubBanner.setAlpha(0);
        this.tweens.add({
          targets: [this._srBanner, this._srSubBanner], alpha: 1, duration: 600,
          onComplete: function () {
            scene.time.delayedCall(2000, function () {
              scene.tweens.add({ targets: [scene._srBanner, scene._srSubBanner], alpha: 0, duration: 800 });
            });
          }
        });
      } else {
        this.tweens.add({ targets: [this._srBanner, this._srSubBanner], alpha: 0, duration: 400 });
      }
    }

    if (status.statPoints !== this._lastStatPts) {
      this._lastStatPts = status.statPoints;
      if (status.statPoints > 0) {
        this._statPtsText.setText(status.statPoints + ' pts [I]');
        if (!this._statPtsTween) {
          this._statPtsTween = this.tweens.add({
            targets: this._statPtsText, alpha: 0.3, duration: 700,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
          });
        }
      } else {
        this._statPtsText.setText('');
        if (this._statPtsTween) { this._statPtsTween.stop(); this._statPtsTween = null; }
        this._statPtsText.setAlpha(1);
      }
    }

    // ── Active debuffs ────────────────────────────────────────────────────────
    var now2 = Date.now();
    var newDebuffStr = '';
    if (status.debuffs && status.debuffs.length > 0) {
      for (var di = 0; di < status.debuffs.length; di++) {
        if (status.debuffs[di].expiresAt > now2) {
          newDebuffStr += (newDebuffStr ? '  ' : '') + '☠ ' + status.debuffs[di].type.toUpperCase();
        }
      }
    }
    if (newDebuffStr !== this._debuffStr) {
      this._debuffStr = newDebuffStr;
      this._debuffText.setText(newDebuffStr);
      if (newDebuffStr && !this._debuffPulseTween) {
        this._debuffPulseTween = this.tweens.add({
          targets: this._debuffText, alpha: 0.3, duration: 600,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      } else if (!newDebuffStr && this._debuffPulseTween) {
        this._debuffPulseTween.stop();
        this._debuffPulseTween = null;
        this._debuffText.setAlpha(1);
      }
    }

    if (this._invDirty) {
      if (!this._invOpen) {
        this._potionCount = status.countPotions();
      }
      var pots = this._potionCount;
      if (pots > 0) {
        this._potCount.setText('×' + pots);
        this._potLabel.setColor('#44bb66');
        this._potBorder.setStrokeStyle(1.5, 0x225533);
        this._potAccent.setAlpha(1);
      } else {
        this._potCount.setText('EMPTY');
        this._potLabel.setColor('#334433');
        this._potBorder.setStrokeStyle(1.5, 0x1a2e1a);
        this._potAccent.setAlpha(0.3);
      }
      this._updateHotlistHUD(status);
      this._invDirty = false;
    }

    // ── Donut cooldown fills ──────────────────────────────────────────────────
    if (gameScene && gameScene.donut) {
      var ABY = this._ABY, ABW = this._ABW, ABH = this._ABH;
      var frac = gameScene.donut.getSpellCooldownFraction();
      var sfillH = Math.floor(ABH * frac);
      this._spellFill.setDisplaySize(ABW, sfillH).setY(ABY + ABH - sfillH);
      var rdy = frac >= 1;
      if (rdy !== this._spellWasReady) {
        this._spellWasReady = rdy;
        this._spellLabel.setColor(rdy ? '#cc99ff' : '#664488');
        this._spellBorder.setStrokeStyle(1.5, rdy ? 0x8855dd : 0x553377);
      }
      var sfrac = gameScene.donut.getSurgeCooldownFraction();
      var surgeFillH = Math.floor(ABH * sfrac);
      this._surgeFill.setDisplaySize(ABW, surgeFillH).setY(ABY + ABH - surgeFillH);
      var srdy = sfrac >= 1;
      if (srdy !== this._surgeWasReady) {
        this._surgeWasReady = srdy;
        this._surgeLabel.setColor(srdy ? '#66ffaa' : '#226644');
        this._surgeBorder.setStrokeStyle(1.5, srdy ? 0x44cc77 : 0x224433);
      }
    }

    // ── Minimap ───────────────────────────────────────────────────────────────
    var dungeon = this.registry.get('dungeon');
    if (dungeon && gameScene && gameScene.carl) {
      var fogDirty = this.registry.get('fogDirty');
      if (dungeon !== this._mmDungeonKey) {
        this._mmDungeonKey = dungeon;
        this._mmCarlTx = -1; this._mmCarlTy = -1;
        this._fmDirty = true;
      }
      if (fogDirty) {
        this.registry.set('fogDirty', false);
        this._fmDirty = true;
      }

      var fog   = this.registry.get('fogGrid');
      var cTx   = Math.floor(gameScene.carl.x() / 32);
      var cTy   = Math.floor(gameScene.carl.y() / 32);
      var moved = (cTx !== this._mmCarlTx || cTy !== this._mmCarlTy);
      if (moved) {
        this._mmCarlTx = cTx; this._mmCarlTy = cTy;
        this._drawMinimapViewport(dungeon, fog, cTx, cTy);
      }

      // Carl dot always at canvas center
      var mmCx = this._mmX + this._mmSize / 2;
      var mmCy = this._mmY + this._mmSize / 2;
      this._mmCarl.setPosition(mmCx, mmCy);

      // Tile-to-pixel scale inside the viewport canvas
      var tileSize = this._mmSize / (this._mmRadius * 2 + 1);

      // Stairs dot — relative to player position
      if (dungeon.stairsTile) {
        var sdx = dungeon.stairsTile.x - cTx;
        var sdy = dungeon.stairsTile.y - cTy;
        var sVisible = Math.abs(sdx) <= this._mmRadius && Math.abs(sdy) <= this._mmRadius;
        this._mmStairs.setVisible(sVisible);
        if (sVisible) {
          this._mmStairs.setPosition(
            mmCx + sdx * tileSize,
            mmCy + sdy * tileSize
          );
        }
      } else {
        this._mmStairs.setVisible(false);
      }

      // Boss dot — relative to player
      var gs = this._gameScene;
      var bossAlive = !!(gs && gs._bossEnemy && !gs._bossEnemy.isDead());
      if (bossAlive && dungeon.bossRoom) {
        var bTx = Math.floor(dungeon.bossRoom.x + dungeon.bossRoom.w / 2);
        var bTy = Math.floor(dungeon.bossRoom.y + dungeon.bossRoom.h / 2);
        var bdx = bTx - cTx, bdy = bTy - cTy;
        var bVisible = Math.abs(bdx) <= this._mmRadius && Math.abs(bdy) <= this._mmRadius;
        this._mmBoss.setVisible(bVisible);
        if (bVisible) this._mmBoss.setPosition(mmCx + bdx * tileSize, mmCy + bdy * tileSize);
      } else {
        this._mmBoss.setVisible(false);
      }

      // ── Full-map overlay update ───────────────────────────────────────────
      if (this._fmOpen) {
        if (this._fmDirty || moved) {
          this._fmDirty = false;
          this._drawFullMap(dungeon, fog);
        }
        // Carl dot on full map
        var fmScale = Math.min(this._fmW / dungeon.mapW, this._fmH / dungeon.mapH);
        var fmOffX  = (this._fmW - dungeon.mapW * fmScale) / 2;
        var fmOffY  = (this._fmH - dungeon.mapH * fmScale) / 2;
        this._fmCarl.setPosition(
          this._fmX + fmOffX + (cTx + 0.5) * fmScale,
          this._fmY + fmOffY + (cTy + 0.5) * fmScale
        );
        if (dungeon.stairsTile) {
          this._fmStairs.setVisible(true).setPosition(
            this._fmX + fmOffX + (dungeon.stairsTile.x + 0.5) * fmScale,
            this._fmY + fmOffY + (dungeon.stairsTile.y + 0.5) * fmScale
          );
        }
        if (bossAlive && dungeon.bossRoom) {
          var fbTx = dungeon.bossRoom.x + dungeon.bossRoom.w / 2;
          var fbTy = dungeon.bossRoom.y + dungeon.bossRoom.h / 2;
          this._fmBoss2.setVisible(true).setPosition(
            this._fmX + fmOffX + fbTx * fmScale,
            this._fmY + fmOffY + fbTy * fmScale
          );
        } else {
          this._fmBoss2.setVisible(false);
        }
      }
    }

    if (status && this._hudUnlocked) {
      if (status.views !== this._lastViews || status.followers !== this._lastFollowers || status.favorites !== this._lastFavorites || status.gold !== this._lastGold) {
        this._lastViews = status.views; this._lastFollowers = status.followers; this._lastFavorites = status.favorites; this._lastGold = status.gold;
        var goldLine = status.gold > 0 ? '\n' + status.gold + 'g' : '';
        var favsLine = (status.floor >= 2 && status.favorites > 0) ? '\n' + _fmtN(status.favorites) + ' favs' : '';
        this._viewsText.setText(
          _fmtN(status.views) + ' views\n' +
          _fmtN(status.followers) + ' followers' + favsLine + goldLine
        );
      }
    }

    // ── Message feeds: system (top) + chat (bottom) ───────────────────────────
    var now = Date.now();
    if (this._sysMessages.length > 0 && now - this._sysTimer > 3200) {
      var sm = this._sysMessages.shift();
      this._sysTimer = now;
      var sColor = sm.type === 'achievement' ? '#ffdd44' : '#ffcc55';
      this._sysText.setText(sm.text).setColor(sColor).setAlpha(1);
      this.tweens.killTweensOf(this._sysText);
      this.tweens.add({ targets: this._sysText, alpha: 0, delay: 2800, duration: 400 });
    }
    if (this._chatMessages.length > 0 && now - this._chatTimer > 2400) {
      var cm = this._chatMessages.shift();
      this._chatTimer = now;
      var cColor = cm.type === 'character' ? '#aaddff' : '#9999bb';
      this._chatText.setText(cm.text).setColor(cColor).setAlpha(1);
      this.tweens.killTweensOf(this._chatText);
      this.tweens.add({ targets: this._chatText, alpha: 0, delay: 2000, duration: 400 });
    }
  },

  // Shared tile→color for both the minimap and the full map. Returns a CSS fill
  // color, or null if the tile should be skipped (unrevealed, or not drawn).
  _mapTileColor: function (dungeon, fog, tx, ty) {
    var tile = dungeon.tiles[ty][tx];
    var fogRevealed = fog && fog[ty * dungeon.mapW + tx];
    var alwaysVisible = tile === DungeonGenerator.SAFE || tile === DungeonGenerator.GUILD;
    if (fog && !fogRevealed && !alwaysVisible) return null;
    if (tile === DungeonGenerator.FLOOR || tile === DungeonGenerator.DOOR || tile === DungeonGenerator.START) return '#334455';
    if (tile === DungeonGenerator.STAIRS) return '#44ffaa';
    if (tile === DungeonGenerator.SAFE)   return fogRevealed ? '#cc8833' : '#aa6622';
    if (tile === DungeonGenerator.GUILD)  return '#6655cc';
    return null;
  },

  _drawMinimapViewport: function (dungeon, fog, cTx, cTy) {
    var ctx  = this._mmCanvas.getContext('2d');
    var size = this._mmSize;
    var R    = this._mmRadius;
    var DIM  = R * 2 + 1;
    var ts   = size / DIM;  // pixels per tile
    var W    = dungeon.mapW, H = dungeon.mapH;

    ctx.clearRect(0, 0, size, size);

    for (var dy = -R; dy <= R; dy++) {
      var ty = cTy + dy;
      if (ty < 0 || ty >= H) continue;
      for (var dx = -R; dx <= R; dx++) {
        var tx = cTx + dx;
        if (tx < 0 || tx >= W) continue;

        var color = this._mapTileColor(dungeon, fog, tx, ty);
        if (!color) continue;

        var px = (dx + R) * ts;
        var py = (dy + R) * ts;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, Math.max(1, ts - 0.5), Math.max(1, ts - 0.5));
      }
    }

    this._mmTex.refresh();
  },

  _drawFullMap: function (dungeon, fog) {
    var ctx = this._fmCanvas.getContext('2d');
    var FW  = this._fmW, FH = this._fmH;
    var MW  = dungeon.mapW, MH = dungeon.mapH;
    var scale  = Math.min(FW / MW, FH / MH);
    var offX   = Math.floor((FW - MW * scale) / 2);
    var offY   = Math.floor((FH - MH * scale) / 2);
    var ts     = Math.max(1, scale);

    ctx.clearRect(0, 0, FW, FH);

    for (var ty = 0; ty < MH; ty++) {
      for (var tx = 0; tx < MW; tx++) {
        var color = this._mapTileColor(dungeon, fog, tx, ty);
        if (!color) continue;

        var px = offX + tx * scale;
        var py = offY + ty * scale;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, ts, ts);
      }
    }

    this._fmTex.refresh();
  },

  toggleFullMap: function () {
    this._fmOpen = !this._fmOpen;
    var vis = this._fmOpen;
    this._fmBg.setVisible(vis);
    this._fmImage.setVisible(vis);
    this._fmBorder.setVisible(vis);
    this._fmLabel.setVisible(vis);
    this._fmCarl.setVisible(vis);
    this._fmStairs.setVisible(vis && !!this.registry.get('dungeon') && !!this.registry.get('dungeon').stairsTile);
    if (vis) { this._fmDirty = true; }
    if (!vis) { this._fmBoss2.setVisible(false); }
  },

  _setLockedHUDVisible: function (visible) {
    var alpha = visible ? 1 : 0;
    // Minimap
    this._mmBg1.setAlpha(alpha);
    this._mmBg2.setAlpha(alpha);
    this._mmImage.setAlpha(alpha);
    this._mmCarl.setAlpha(alpha);
    this._mmStairs.setAlpha(alpha);
    this._mmBoss.setAlpha(alpha);
    // Right-side stats (kills, stairs, stat pts) — keep floor text visible
    this._killText.setAlpha(alpha);
    this._stairsText.setAlpha(alpha);
    this._closureText.setAlpha(alpha);
    this._statPtsText.setAlpha(alpha);
    this._viewsText.setAlpha(alpha);
    this._hudBgRight.setAlpha(visible ? 0.52 : 0);
    // Donut ability buttons (unlocked after tutorial)
    var donutAlpha = alpha;
    [this._spellBg, this._spellFill, this._spellAccent, this._spellBorder, this._spellLabel, this._spellKey,
     this._surgeBg, this._surgeFill, this._surgeAccent, this._surgeBorder, this._surgeLabel, this._surgeKey,
    ].forEach(function (el) { el.setAlpha(donutAlpha); });
  },

  _unlockHUD: function () {
    var scene = this;
    var targets = [
      this._mmBg1, this._mmBg2, this._mmImage, this._mmCarl, this._mmStairs, this._mmBoss,
      this._killText, this._stairsText, this._closureText, this._viewsText,
      this._spellBg, this._spellFill, this._spellAccent, this._spellBorder, this._spellLabel, this._spellKey,
      this._surgeBg, this._surgeFill, this._surgeAccent, this._surgeBorder, this._surgeLabel, this._surgeKey,
    ];
    // Set to 0 first (may already be 0 from _setLockedHUDVisible), then fade in
    targets.forEach(function (t) { t.setAlpha(0); });
    this._hudBgRight.setAlpha(0);
    this.tweens.add({ targets: targets, alpha: 1, duration: 1200, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this._hudBgRight, alpha: 0.52, duration: 1200, ease: 'Sine.easeOut' });
  },

  _showTV: function (roomName) {
    var tvMsg = MessageSystem.safeRoomTV(roomName);
    this._tvRoomName.setText(roomName);
    this._tvMsg.setText(tvMsg);
    // Screen 2: crawler count from registry (status.kills as proxy; real count unavailable)
    var status = this.registry.get('status');
    var countLine = status
      ? 'CRAWLER #' + status.crawlerNumber + '  |  FLOOR ' + status.floor + '  |  ' + status.kills + ' KILLS'
      : '';
    this._tvCountdown.setText(countLine);
    this._tvPanel.setVisible(true);
    this._tvOpen = true;
    // Fade panel in
    this._tvPanel.setAlpha(0);
    this.tweens.add({ targets: this._tvPanel, alpha: 1, duration: 350 });
  },

  _dismissTV: function () {
    var scene = this;
    this._tvOpen = false;
    this.tweens.add({
      targets: this._tvPanel, alpha: 0, duration: 250,
      onComplete: function () { scene._tvPanel.setVisible(false); }
    });
  },

  _updateHotlistHUD: function (status) {
    // Count stackable items by type+name for stack display
    var stackCounts = {};
    for (var pi = 0; pi < status.inventory.length; pi++) {
      var inv = status.inventory[pi];
      if (inv.type === 'potion' || inv.type === 'mana_potion' || inv.type === 'consumable') {
        var key = inv.type + ':' + inv.name;
        stackCounts[key] = (stackCounts[key] || 0) + 1;
      }
    }

    for (var i = 0; i < 10; i++) {
      var slot = this._hotlistSlots[i];
      if (!slot) continue;
      var item = status.hotlist[i];
      if (item) {
        var abbr = _hotlistAbbr(item);
        var isConsumable = item.type === 'consumable';
        var isMp = item.type === 'mana_potion';
        var slotColor = isConsumable ? '#ffcc88' : (isMp ? '#88aaff' : '#ddccff');
        var slotStroke = isConsumable ? 0xcc8833 : (isMp ? 0x3355cc : 0x8866cc);
        var slotBg = isConsumable ? 0x221100 : (isMp ? 0x001133 : 0x220033);
        slot.item.setText(abbr).setColor(slotColor);
        slot.border.setStrokeStyle(1, slotStroke);
        slot.bg.setFillStyle(slotBg, 0.9);
        // Stack count for potions and consumables
        var skey = item.type + ':' + item.name;
        var cnt = stackCounts[skey] || 0;
        slot.count.setText(cnt > 1 ? String(cnt) : '');
      } else {
        slot.item.setText('');
        slot.count.setText('');
        slot.border.setStrokeStyle(1, 0x443366);
        slot.bg.setFillStyle(0x110022, 0.85);
      }
    }
  },
});

function _hotlistAbbr(item) {
  if (!item) return '';
  if (item.type === 'potion')      return 'POT';
  if (item.type === 'mana_potion') return 'MP';
  return item.name.substring(0, 4).toUpperCase();
}

// Left-pad a number to `width` chars
function _pad(n, width) {
  var s = String(n);
  while (s.length < width) s = ' ' + s;
  return s;
}

// Darken a hex color string like '#ffcc66' by ~40% for dimmed rows
function _dimColor(hex) {
  if (!hex || hex.length < 7) return '#444444';
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  r = Math.floor(r * 0.4); g = Math.floor(g * 0.4); b = Math.floor(b * 0.4);
  return '#' + ('0' + r.toString(16)).slice(-2) + ('0' + g.toString(16)).slice(-2) + ('0' + b.toString(16)).slice(-2);
}
