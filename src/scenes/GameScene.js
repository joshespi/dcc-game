var BOX_TIERS = {
  bronze:    { order: 0, tint: 0xcc7733, color: '#cc7733' },
  silver:    { order: 1, tint: 0xaacccc, color: '#aacccc' },
  gold:      { order: 2, tint: 0xffdd44, color: '#ffdd44' },
  platinum:  { order: 3, tint: 0xaaddff, color: '#aaddff' },
  legendary: { order: 4, tint: 0xff88ff, color: '#ff88ff' },
  celestial: { order: 5, tint: 0xffffff, color: '#ffffff' },
};
function _tierOrder(t) { return (BOX_TIERS[t] || BOX_TIERS.bronze).order; }
function _tierTint(t)  { return (BOX_TIERS[t] || BOX_TIERS.bronze).tint; }
function _tierColor(t) { return (BOX_TIERS[t] || BOX_TIERS.bronze).color; }

// Per-boss behavior + flavor, keyed by _bossType. slamFn/secondaryFn are GameScene
// method names dispatched dynamically; dropPool/dropMsg/taunt depend on runtime state.
var BOSS_FLAVOR = {
  hoarder: {
    label: 'THE HOARDER',
    slamFn: '_bossGroundSlam', secondaryFn: '_bossVomitScatterers',
    intro: 'BOSS BATTLE! THE DOOR SEALS BEHIND YOU. NEIGHBORHOOD BOSS: THE HOARDER. BORANT CORPORATION THANKS YOU FOR YOUR SACRIFICE.',
    introDelayed: '"I WAS HERE FIRST," IT SCREAMS. "ALL OF THIS IS MINE."',
    phase2: 'THE HOARDER ENTERS A RAGE. "YOU CANNOT HAVE MY THINGS!" IT ACCELERATES.',
    phase2Delayed: '"MY MINIONS! PROTECT THE THINGS!" — THE HOARDER',
    taunt: function (phase) { return MessageSystem.bossHoarderTaunt(phase); },
    dropPool: function (floor) { return [
      { type: 'weapon', name: "The Hoarder's Cleaver", damage: 15 + floor * 2, sprite: 'weapon' },
      { type: 'weapon', name: "The Hoarder's Shank",   damage: 12 + floor * 2, sprite: 'weapon' },
      { type: 'armor',  name: "The Hoarder's Coat",    defense: 8 + floor,     sprite: 'armor'  },
      { type: 'armor',  name: "The Hoarder's Scraps",  defense: 6 + floor,     sprite: 'armor'  },
    ]; },
    dropMsg: function (name) { return 'THE HOARDER\'S COLLECTION SCATTERS. [E] TO CLAIM: ' + name.toUpperCase() + '!'; },
  },
  krakaren: {
    label: 'KRAKAREN CLONE',
    slamFn: '_bossKrakarenSlam', secondaryFn: '_bossKrakarenMist',
    intro: 'BOSS BATTLE! THE DOOR SEALS BEHIND YOU. NEIGHBORHOOD BOSS: KRAKAREN CLONE. BORANT NOTES: THIS IS NOT THE KRAKAREN. THIS IS A KRAKAREN. THERE ARE MORE.',
    introDelayed: 'DOZENS OF MOUTHS SCREAM FROM EVERY TENTACLE. THE SOUND IS SOLID. DONUT COVERS HER EARS.',
    phase2: 'KRAKAREN CLONE SEETHES. ADDITIONAL TENTACLES EMERGE FROM THE FLOOR. MOUTH-COUNT DOUBLES.',
    phase2Delayed: '"MORE. MORE. MORE." — EVERY MOUTH, SIMULTANEOUSLY.',
    taunt: function (phase) { return MessageSystem.bossKrakarenTaunt(phase); },
    dropPool: function (floor) { return [
      { type: 'weapon', name: "Krakaren's Severed Tentacle", damage: 18 + floor * 2, sprite: 'weapon' },
      { type: 'armor',  name: "Krakaren Mouth-Leather Coat", defense: 10 + floor,    sprite: 'armor'  },
      { type: 'armor',  name: "Screaming Carapace",          defense: 8  + floor,    sprite: 'armor'  },
    ]; },
    dropMsg: function (name) { return 'KRAKAREN CLONE DISSOLVES. ITS MOUTHS STILL SCREAM FOR 11 SECONDS AFTERWARD. [E] TO CLAIM: ' + name.toUpperCase() + '!'; },
  },
};
function _bossFlavor(type) { return BOSS_FLAVOR[type] || BOSS_FLAVOR.hoarder; }

var GameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'GameScene' }); },

  // ── init ──────────────────────────────────────────────────────────────────
  init: function (data) {
    // data.floor is set by _descend(); absent on cold start
    var isFloorTransition = data && data.floor;
    this.currentFloor = isFloorTransition ? data.floor : 1;
    this._savedTimerElapsed = 0;
    if (!this.registry.get('status')) {
      var saved = SaveSystem.load();
      var s = saved ? CrawlerStatus.restore(saved) : new CrawlerStatus();
      if (saved && !isFloorTransition) {
        this.currentFloor = saved.floor;
        // Restore how far into the floor timer we already are
        this._savedTimerElapsed = saved.floorTimerElapsed || 0;
      }
      this.registry.set('status', s);
    }
    if (!this.registry.get('messages')) {
      this.registry.set('messages', new MessageSystem());
    }
    this.status   = this.registry.get('status');
    this.messages = this.registry.get('messages');
    this.status.floor = this.currentFloor;
    SaveSystem.save(this.status, this.currentFloor);
    this.registry.set('savedFlash', true);
  },

  // ── create ────────────────────────────────────────────────────────────────
  create: function () {
    var MAP_W = 256, MAP_H = 256;
    this.MAP_W = MAP_W; this.MAP_H = MAP_H;

    // Reset any registry state that may persist across floor transitions
    this.registry.set('shopOpen', false);
    this._nearestLootBox = null;

    // ── Generate dungeon ────────────────────────────────────────────────────
    var gen = new DungeonGenerator(MAP_W, MAP_H);
    var dungeon = gen.generate(this.currentFloor);
    this.dungeonData = dungeon;

    // ── Build tilemap ───────────────────────────────────────────────────────
    // Tile index mapping: 0=floor,1=wall,2=stairs,3=door,4=start
    // Our tileset horizontal strip matches these indices
    this._buildTilemap(dungeon.tiles, MAP_W, MAP_H);

    // ── Floor decorations ────────────────────────────────────────────────────
    this._spawnFloorDecor(dungeon.tiles, MAP_W, MAP_H);
    this._spawnSafeRoomDecor(dungeon.safeRooms);

    // Share dungeon layout with UIScene for minimap
    this.registry.set('dungeon', {
      tiles: dungeon.tiles,
      mapW: MAP_W, mapH: MAP_H,
      stairsTile: dungeon.stairsTile,
      startPos: dungeon.startPos,
      safeRooms: dungeon.safeRooms,
      guildHall: dungeon.guildHall,
      bossRoom:  dungeon.bossRoom,
    });

    this._safeRooms        = dungeon.safeRooms;
    this._visitedSafeRooms = {};   // name → true once entered
    this._currentSafeRoom  = null; // room Carl is currently inside, or null
    this._idleTVTimer      = null; // fires showTV after idle timeout in safe room
    this.registry.set('currentSafeRoom', null);

    // ── Fog of war ─────────────────────────────────────────────────────────────
    // Flat Uint8Array (1 = revealed). Reveal tiles within sight radius each frame.
    this._fogGrid = new Uint8Array(MAP_W * MAP_H);
    this.registry.set('fogGrid', this._fogGrid);

    // ── Guild Hall ────────────────────────────────────────────────────────────
    this._guildHall        = dungeon.guildHall || null;
    this._guildNPC         = null;
    this._inGuildHall      = false;
    this._tutorialRunning  = false;

    // ── Neighborhood boss room ────────────────────────────────────────────────
    this._bossRoom         = dungeon.bossRoom || null;
    this._bossTriggered    = false;
    this._bossLoopEvent    = null;
    this._bossEnemy        = null;

    var npcKey = this.currentFloor >= 2 ? 'bugaboo' : 'guildmaster';
    if (this._guildHall) {
      var ghCX = (this._guildHall.x + Math.floor(this._guildHall.w / 2)) * 32 + 16;
      var ghCY = (this._guildHall.y + Math.floor(this._guildHall.h / 2) - 1) * 32 + 16;
      this._guildNPC = this.add.image(ghCX, ghCY, npcKey).setDepth(8).setScale(1.2);
      this.tweens.add({
        targets: this._guildNPC, alpha: 0.75, duration: 1200,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    // ── Secondary guild halls — Mordecai in safe rooms (~1:10) ────────────────
    this._secondaryGuildHalls = dungeon.secondaryGuildHalls || [];
    this._secondaryGuildNPCs  = [];
    this._inSecondaryGuild    = -1; // index of room Carl is inside, or -1
    for (var sgi = 0; sgi < this._secondaryGuildHalls.length; sgi++) {
      var sgr = this._secondaryGuildHalls[sgi];
      var sgCX = (sgr.x + Math.floor(sgr.w / 2)) * 32 + 16;
      var sgCY = (sgr.y + Math.floor(sgr.h / 2) - 1) * 32 + 16;
      var sgSpr = this.add.image(sgCX, sgCY, npcKey).setDepth(8).setScale(1.0);
      sgSpr.setAlpha(0.85);
      this._secondaryGuildNPCs.push(sgSpr);
    }

    // ── Physics world bounds ────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, MAP_W * 32, MAP_H * 32);

    // ── Spawn Carl ──────────────────────────────────────────────────────────
    this.carl = new Carl(this, dungeon.startPos.x, dungeon.startPos.y, this.status);

    // ── Spawn Donut ─────────────────────────────────────────────────────────
    this.donut = new Donut(this, dungeon.startPos.x - 20, dungeon.startPos.y + 10, this.status);

    // ── Missile group (shared by Donut + Fairies) ───────────────────────────
    this.missiles = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 20,
    });
    this._missileRect = new Phaser.Geom.Rectangle(0, 0, 14, 14);
    this.donut.setMissileGroup(this.missiles);

    // Enemy missile group (fairy projectiles hitting Carl)
    this.enemyMissiles = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 20,
    });

    // ── Spawn enemies ────────────────────────────────────────────────────────
    this.enemies = [];
    this._spawnEnemies(dungeon.rooms, this.currentFloor);

    // ── Neighborhood boss ────────────────────────────────────────────────────
    // Skip spawn if already killed on this floor (save restored mid-floor).
    var bossAlreadyKilled = this.status.bossKilledFloor === this.currentFloor;
    if (this._bossRoom && !bossAlreadyKilled) {
      var br = this._bossRoom;
      var bcx = (br.x + Math.floor(br.w / 2)) * 32 + 16;
      var bcy = (br.y + Math.floor(br.h / 2)) * 32 + 16;
      var bossEnemy = EnemyFactory.createBoss(this, bcx, bcy, this.currentFloor);
      this.physics.add.collider(bossEnemy.sprite, this.wallLayer);
      bossEnemy.onDeath(function (dead) { scene._onBossDeath(dead); });
      bossEnemy._throwCd    = 0;
      bossEnemy._throwCdMs  = 2400;
      bossEnemy.enableBossBar(_bossFlavor(bossEnemy._bossType).label);
      this.enemies.push(bossEnemy);
      this._bossEnemy = bossEnemy;
    } else if (bossAlreadyKilled && this._bossRoom) {
      // Door stays open if boss was already dead at save
      this.wallLayer.putTileAt(DungeonGenerator.FLOOR, this._bossRoom.doorX, this._bossRoom.doorY);
    }

    // ── Loot boxes ──────────────────────────────────────────────────────────
    this.lootBoxes = [];
    this._lootSequenceRunning = false;
    this._spawnLoot(dungeon.rooms);

    // ── Bopca merchant NPCs (one per safe room) ──────────────────────────────
    this._bopcas     = [];
    this._nearBopca  = null;
    for (var bsi = 0; bsi < this._safeRooms.length; bsi++) {
      var bsr = this._safeRooms[bsi];
      var bmx = (bsr.x + 1) * 32 + 16;
      var bmy = (bsr.y + Math.floor(bsr.h / 2)) * 32 + 16;
      var bmspr = this.add.image(bmx, bmy, 'bopca').setDepth(11);
      this.add.text(bmx, bmy - 20, 'TALLY', {
        fontFamily: 'monospace', fontSize: '8px', color: '#aaddff',
      }).setOrigin(0.5, 1).setDepth(12);
      this._bopcas.push({ sprite: bmspr, x: bmx, y: bmy });
    }

    // ── Mailboxes (Floor 2+ safe rooms) ─────────────────────────────────────
    this._mailboxes = [];
    if (this.currentFloor >= 2) {
      for (var mbi = 0; mbi < this._safeRooms.length; mbi++) {
        var mbsr = this._safeRooms[mbi];
        // Place mailbox offset from Bopca — south-east corner of safe room
        var mbx = (mbsr.x + mbsr.w - 2) * 32 + 16;
        var mby = (mbsr.y + mbsr.h - 2) * 32 + 16;
        var mbspr = this.add.image(mbx, mby, 'mailbox').setDepth(11);
        this._mailboxes.push({ sprite: mbspr, x: mbx, y: mby, _opened: false });
      }
    }

    // Proximity prompt — single reusable text shown near nearest interactable
    this._proximityPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffdd88',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(55).setOrigin(0.5, 1).setAlpha(0);
    this._lootPromptPulsing = false;

    this._floatTextPool = [];
    for (var fti = 0; fti < 12; fti++) {
      var ft = this.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(50).setOrigin(0.5).setVisible(false).setActive(false);
      this._floatTextPool.push(ft);
    }

    // ── Achievement flags ────────────────────────────────────────────────────
    this._firstKillDone        = this.status.kills > 0; // don't re-fire on floor change
    this._unarmedKillDone      = this.status.kills > 0; // Bronze Weapon Box — one-time
    this._combatHintShown      = this.status.kills > 0; // one-time on first aggro
    this._higherLevelKillDone  = false; // Bronze Adventurer Box — one-time per floor
    this._knockdownUntil       = 0; // ms timestamp — Carl stunned until then
    this._lastDonutReactTime   = 0;
    this._rageElemental        = null;
    this._rageMobKills         = 0;   // mobs the elemental has slaughtered this floor
    this._rageGravAchievement  = false;
    var curViews = this.status.views, curFollowers = this.status.followers;
    this._viewsMilestones     = [50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000].filter(function (v) { return v > curViews; });
    this._followersMilestones = [1000, 5000, 10000, 50000, 100000].filter(function (v) { return v > curFollowers; });

    // ── Mob corpses ───────────────────────────────────────────────────────────
    this.corpses = [];
    this._nearestCorpse = null;

    // ── Claimed loot boxes (picked up in field, open in safe room) ────────────
    this._claimedBoxes = [];

    // ── Fairy dust clouds ─────────────────────────────────────────────────────
    this._fairyDustClouds = [];

    // ── XP orbs group ───────────────────────────────────────────────────────
    this.xpOrbs = this.physics.add.staticGroup();

    // ── Camera ──────────────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, MAP_W * 32, MAP_H * 32);
    this.cameras.main.startFollow(this.carl.getSprite(), true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor(this.currentFloor >= 2 ? '#c8b898' : '#0a0812');

    // ── Colliders ───────────────────────────────────────────────────────────
    var scene = this;
    this.physics.add.collider(this.carl.getSprite(), this.wallLayer);
    this.physics.add.collider(this.donut.getSprite(), this.wallLayer);

    // Enemy-wall colliders set per enemy in _spawnEnemies

    // Missile hits wall → destroy
    this.physics.add.collider(this.missiles, this.wallLayer, function (missile) {
      if (missile.active) { missile.setActive(false).setVisible(false).destroy(); }
    });
    this.physics.add.collider(this.enemyMissiles, this.wallLayer, function (missile) {
      missile.setActive(false).setVisible(false).destroy();
    });

    // Enemy missile hits Carl — ignored if Carl is in a safe room
    this.physics.add.overlap(this.carl.getSprite(), this.enemyMissiles, function (carlSpr, missile) {
      if (!missile.active) return;
      var debuffType  = missile.applyDebuff || null;
      var sourceName  = missile.sourceName  || 'Fairy';
      missile.setActive(false).setVisible(false).destroy();
      if (scene.isInSafeRoom()) return;
      var dmg = scene.carl.receiveHit(missile.damage || 6, 'projectile');
      if (dmg > 0) {
        scene._lastKiller = sourceName;
        scene._onCarlHurt(dmg, 'projectile');
        if (debuffType === DEBUFF_TAINT) {
          if (!scene.status.hasDebuff(DEBUFF_TAINT)) {
            scene.status.applyDebuff(DEBUFF_TAINT, 300000, 0, 99999);
            scene._floatText(scene.carl.x(), scene.carl.y() - 32, 'THE TAINT!', '#44dd22', 13);
            scene.messages.push('CLURICHAUN\'S SNEEZE COATS YOU IN LIME-GREEN OIL. THE TAINT: ALL HEALING BLOCKED FOR 5 MINUTES. DONUT IS DISGUSTED.');
            scene.time.delayedCall(1200, function () {
              scene.messages.push(MessageSystem.donutReaction('taint_hit'));
            });
          }
        } else if (debuffType) {
          scene.status.applyDebuff(debuffType, 8000, 1, 2000);
        }
      }
    });

    // ── Input: P = urinate (triggers Rage Elemental if outside bathroom) ────────
    this.input.keyboard.on('keydown-P', function () { scene._onUrinate(); });

    // ── Input: Q = Donut spell ───────────────────────────────────────────────
    this.spellKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // ── Interact key: E (stairs, loot) ───────────────────────────────────────
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this._interactCd = 0;


    // ── Carl callbacks ───────────────────────────────────────────────────────
    this.carl.onAttack(function (swingBox, dmg, attackType, isCrit) {
      scene._processMeleeSwing(swingBox, dmg, attackType, isCrit);
    });
    this.carl.onHit(function (dmg, src) {
      scene._onCarlHurt(dmg, src);
      var su = scene.status.addSkillXP('endurance', 3);
      if (su) scene._onSkillUp(su);
    });
    this.carl.onHeal(function (amt) {
      scene._floatText(scene.carl.x(), scene.carl.y() - 20, '+' + amt + ' HP', '#88ff88');
      scene.messages.push(MessageSystem.potion(amt));
    });
    this.carl._onDodge = function () {
      scene._floatText(scene.carl.x(), scene.carl.y() - 28, 'DODGE!', '#ffff44', 13);
      scene.status.addViews(1500);
      _playDodge();
      if (Math.random() < 0.3) scene.messages.push(MessageSystem.donutReaction('dodge'));
      var su = scene.status.addSkillXP('dodge', 4);
      if (su) scene._onSkillUp(su);
    };

    // ── Donut callbacks ──────────────────────────────────────────────────────
    this.donut.onSpell(function (name) {
      var reaction = name === 'heal_surge' ? 'heal_surge' : 'spell_cast';
      if (Math.random() < 0.3) scene.messages.push(MessageSystem.donutReaction(reaction));
    });
    this.donut.onHeal(function (amt) {
      if (amt > 0) scene._floatText(scene.carl.x(), scene.carl.y() - 14, '+' + amt, '#44ff88', 11);
    });

    // ── Q key: Donut magic missile ───────────────────────────────────────────
    this.input.keyboard.on('keydown-Q', function () {
      var result = scene.donut.activateSpell(scene.carl.x(), scene.carl.y(), scene.carl.facing);
      if (result === false) scene.messages.push(MessageSystem.donutCooldown());
      if (result === 'no_mp') scene.messages.push(MessageSystem.donutReaction('no_mp'));
    });

    // ── R key: Donut healing surge ───────────────────────────────────────────
    this.input.keyboard.on('keydown-R', function () {
      var result = scene.donut.activateHealSurge();
      if (result === false) {
        scene.messages.push(MessageSystem.surgeCooldown());
      } else if (result === 'no_mp') {
        scene.messages.push(MessageSystem.donutReaction('no_mp'));
      } else {
        scene._floatText(scene.carl.x(), scene.carl.y() - 24, '+' + result + ' HP SURGE', '#ffaaff', 13);
        scene.messages.push('"FINE. FINE." — DONUT. +' + result + ' HP.');
      }
    });

    // ── T key: use first consumable in hotlist ────────────────────────────────
    this.input.keyboard.on('keydown-T', function () {
      var status = scene.status;
      // Find first consumable slot
      for (var si = 0; si < status.hotlist.length; si++) {
        var hItem = status.hotlist[si];
        if (hItem && hItem.type === 'consumable') {
          var result = status.hotlistUse(si);
          if (result.used && result.consumable) {
            scene._useConsumable(result.consumable);
          }
          return;
        }
      }
      scene.messages.push('NO CONSUMABLES IN HOTLIST.');
    });

    // ── Safe room HP regen ───────────────────────────────────────────────────
    this._safeRegenTimer = 0;
    this._oocRegenTimer  = 0;

    // ── Periodic auto-save (every 30s, includes timer state) ─────────────────
    this._autoSaveTimer = 0;

    // ── Donut exploration reactions ───────────────────────────────────────────
    // Fire when Carl enters a new city block for first time
    this._visitedBlocks  = {};
    this._dunRooms       = dungeon.rooms; // block bounds for lookup

    // ── Donut idle timer — she comments when Carl stands still too long ───────
    this._lastMoveTime = Date.now();
    this._lastIdleReact = 0;
    this._idleReactInterval = 18000; // ms between idle quips

    // ── First-floor intro message ────────────────────────────────────────────
    this.time.delayedCall(300, function () {
      if (scene.currentFloor === 1) {
        scene.messages.push(MessageSystem.newCrawler(scene.status.crawlerNumber, scene.status.crawlerName));
      }
      scene.messages.push(MessageSystem.floorEnter(scene.currentFloor));
      if (scene.currentFloor === 2) {
        scene.time.delayedCall(2500, function () {
          scene.messages.push(MessageSystem.socialAnnouncement());
        });
      }
    });

    // ── Floor timer → stairwell unlock ──────────────────────────────────────
    // Lore: Borant seals stairwells for ~30 dungeon hours after each floor opens.
    // Compressed to 25 real minutes for Floor 1 (target: ~20-30 min playtime).
    // Higher floors may differ — getFloorTimerMs() encapsulates the scaling.
    // Stairs are sealed until the neighborhood boss is dead.
    // Persisted: status.bossKilledFloor === currentFloor means already killed.
    this._stairsUnlocked   = (this.status.bossKilledFloor === this.currentFloor) || !this._bossRoom;
    this._safeRoomsClosed  = false;
    var floorMs  = _getFloorTimerMs(this.currentFloor);
    var elapsed  = Math.min(this._savedTimerElapsed, floorMs);
    var now = Date.now();
    this._floorTimerStart = now - elapsed;
    // Safe rooms still close at 80% total elapsed — applies pressure even after boss dies
    var closureMs     = Math.floor(floorMs * 0.80);
    var closureRemain = Math.max(0, closureMs - elapsed);
    this._safeRoomCloseAt = now + closureRemain;

    if (closureRemain <= 0) {
      this._safeRoomsClosed = true;
    } else {
      this.time.delayedCall(closureRemain, function () {
        scene._safeRoomsClosed = true;
        scene._currentSafeRoom = null;
        scene.registry.set('currentSafeRoom', null);
        scene.messages.push('BORANT CORPORATION: SAFE ZONE PROTOCOLS SUSPENDED. ALL SAFE ROOMS NOW CLOSED. YOU HAVE BEEN WARNED.');
      });
    }

    // ── Speech bubble subscription (idempotent across scene restarts) ─────────
    this._activeBubbles = [];
    this._bubbleBySpeaker = {};
    if (!this.messages._gameSceneSubscribed) {
      this.messages._gameSceneSubscribed = true;
      var sceneRef = this;
      this.messages.onMessage(function (msg) {
        if (msg.type !== 'character') return;
        var parsed = MessageSystem.parseSpeaker(msg.text);
        if (!parsed) return;
        // The scene reference can be stale if registered across restarts; route
        // through the registry to always hit the live GameScene.
        var live = sceneRef.scene && sceneRef.scene.isActive() ? sceneRef : null;
        if (!live) return;
        live._showSpeechBubble(parsed.speaker, parsed.dialogue);
      });
    }

    // ── Dev/test debug hook — only when launched with ?debug=1 ────────────────
    if (typeof window !== 'undefined' && /[?&]debug=1\b/.test(location.search)) {
      var dcc = this;
      window.dccDebug = {
        scene: dcc,
        state: function () {
          return {
            floor: dcc.currentFloor,
            stairsUnlocked: dcc._stairsUnlocked,
            bossAlive: !!(dcc._bossEnemy && !dcc._bossEnemy.isDead()),
            inSafeRoom: dcc.isInSafeRoom(),
            inGuildHall: dcc._inGuildHall,
            hp: dcc.status.hp, maxHp: dcc.status.maxHp,
            mp: dcc.status.mp, maxMp: dcc.status.maxMp,
            level: dcc.status.level, kills: dcc.status.kills,
            inventory: dcc.status.inventory.length,
            claimedBoxes: dcc._claimedBoxes.length,
            carl: { x: dcc.carl.x(), y: dcc.carl.y() },
            mordecai: dcc._guildNPC ? { x: dcc._guildNPC.x, y: dcc._guildNPC.y } : null,
            boss: dcc._bossRoom ? {
              x: (dcc._bossRoom.x + dcc._bossRoom.w / 2) * 32 + 16,
              y: (dcc._bossRoom.y + dcc._bossRoom.h / 2) * 32 + 16,
              alive: !!(dcc._bossEnemy && !dcc._bossEnemy.isDead()),
            } : null,
            stairs: dcc.dungeonData.stairsTile ? {
              x: dcc.dungeonData.stairsTile.x * 32 + 16,
              y: dcc.dungeonData.stairsTile.y * 32 + 16,
            } : null,
            firstSafeRoom: dcc._safeRooms[0] ? {
              x: (dcc._safeRooms[0].x + dcc._safeRooms[0].w / 2) * 32 + 16,
              y: (dcc._safeRooms[0].y + dcc._safeRooms[0].h / 2) * 32 + 16,
              name: dcc._safeRooms[0].name,
            } : null,
          };
        },
        teleport: function (x, y) {
          dcc.carl.getSprite().setPosition(x, y);
          dcc.carl.getSprite().body.reset(x, y);
        },
        teleportTo: function (target) {
          var s = window.dccDebug.state();
          var dest = s[target];
          if (!dest || dest.x == null) return false;
          window.dccDebug.teleport(dest.x, dest.y);
          return true;
        },
        killBoss: function () {
          if (!dcc._bossEnemy || dcc._bossEnemy.isDead()) return false;
          dcc._bossEnemy.takeDamage(999999);
          return true;
        },
        addItem: function (item) { dcc.status.addItem(item); dcc._markInvDirty(); },
        forceTutorialDone: function () { dcc.status.tutorialComplete = true; dcc.registry.set('tutorialComplete', true); },
      };
    }

    // ── Cutscene tutorial handoff — skip tutorial, grant items, unlock HUD ──────
    if (this.registry.get('cutsceneDone')) {
      this.registry.set('cutsceneDone', false);
      this.status.tutorialComplete = true;
      this.status.firstSafeRoomDone = true;
      this.registry.set('tutorialComplete', true);
      var scene = this;
      this.time.delayedCall(400, function () {
        scene._tutorialGiveSpell();
        scene._tutorialGiveItems();
      });
    }

    // ── Fade in ──────────────────────────────────────────────────────────────
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Launch UIScene now that GameScene is fully initialized. On floor transitions
    // _descend stopped it before restart; on cold start it isn't running yet.
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
  },

  _findSpeakerSprite: function (speaker) {
    speaker = speaker.toUpperCase();
    var resolvers = this._speakerResolvers || (this._speakerResolvers = {
      DONUT:         function (s) { return s.donut ? s.donut.getSprite() : null; },
      MORDECAI:      function (s) { return s._guildNPC || null; },
      TALLY:         function (s) {
        if (!s._bopcas || !s._bopcas.length) return null;
        var cx = s.carl.x(), cy = s.carl.y();
        var best = null, bd2 = Infinity;
        for (var i = 0; i < s._bopcas.length; i++) {
          var bp = s._bopcas[i];
          var d2 = (bp.x - cx) * (bp.x - cx) + (bp.y - cy) * (bp.y - cy);
          if (d2 < bd2) { bd2 = d2; best = bp; }
        }
        return best ? best.sprite : null;
      },
    });
    var resolver = resolvers[speaker];
    if (resolver) return resolver(this);
    for (var ei = 0; ei < this.enemies.length; ei++) {
      var e = this.enemies[ei];
      if (!e.isDead() && e.typeName && e.typeName.toUpperCase() === speaker) return e.sprite;
    }
    return null;
  },

  _showSpeechBubble: function (speaker, dialogue) {
    var spr = this._findSpeakerSprite(speaker);
    if (!spr || !spr.active) return;

    var prev = this._bubbleBySpeaker[speaker];
    if (prev) this._removeBubble(prev);

    var bubble = this.add.text(spr.x, spr.y - 32, dialogue, {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.65)', padding: { x: 6, y: 4 },
      align: 'center', wordWrap: { width: 320, useAdvancedWrap: true }
    }).setDepth(60).setOrigin(0.5, 1).setAlpha(0);
    bubble._speaker  = speaker;
    bubble._target   = spr;
    bubble._expireAt = Date.now() + 3200;

    this.tweens.add({ targets: bubble, alpha: 1, duration: 200 });
    this._activeBubbles.push(bubble);
    this._bubbleBySpeaker[speaker] = bubble;
  },

  _removeBubble: function (bubble) {
    if (!bubble || !bubble.active) return;
    if (this._bubbleBySpeaker[bubble._speaker] === bubble) {
      delete this._bubbleBySpeaker[bubble._speaker];
    }
    var idx = this._activeBubbles.indexOf(bubble);
    if (idx !== -1) this._activeBubbles.splice(idx, 1);
    this.tweens.killTweensOf(bubble);
    bubble.destroy();
  },

  _updateBubbles: function (nowMs) {
    var bubbles = this._activeBubbles;
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i];
      var tgt = b._target;
      if (!tgt || !tgt.active || nowMs >= b._expireAt) {
        this._removeBubble(b);
        continue;
      }
      b.x = tgt.x;
      b.y = tgt.y - 32;
    }
  },

  // ── update ────────────────────────────────────────────────────────────────
  update: function (time, delta) {
    if (this.status.isDead()) {
      this._handleDeath();
      return;
    }

    // Knockdown stun or shop open — suppress Carl input
    var nowMs = Date.now();
    if (nowMs < this._knockdownUntil || this.registry.get('shopOpen')) {
      this.carl.getSprite().setVelocity(0, 0);
    } else {
      this.carl.update(delta);
    }
    this.donut.update(this.carl.x(), this.carl.y(), this.carl.facing, delta);

    // ── Donut idle reaction ───────────────────────────────────────────────────
    var carlSpr = this.carl.getSprite();
    if (Math.abs(carlSpr.body.velocity.x) > 5 || Math.abs(carlSpr.body.velocity.y) > 5) {
      this._lastMoveTime = nowMs;
    }
    if (nowMs - this._lastMoveTime > 12000 && nowMs - this._lastIdleReact > this._idleReactInterval) {
      this._lastIdleReact = nowMs;
      this.messages.push(MessageSystem.donutReaction('idle'));
    }

    // ── Periodic auto-save ────────────────────────────────────────────────────
    if (nowMs - this._autoSaveTimer > 30000) {
      this._autoSaveTimer = nowMs;
      var timerElapsed = Math.floor(nowMs - this._floorTimerStart);
      SaveSystem.save(this.status, this.currentFloor, { floorTimerElapsed: timerElapsed });
      this.registry.set('savedFlash', true);
    }

    var ctX = Math.floor(this.carl.x() / 32);
    var ctY = Math.floor(this.carl.y() / 32);
    var _carlInSafe = this.isInSafeRoom();
    this._carlTx = ctX; this._carlTy = ctY; this._carlInSafeCache = _carlInSafe;

    var blockKey = Math.floor(ctX / 10) + '_' + Math.floor(ctY / 10);
    if (!this._visitedBlocks[blockKey]) {
      this._visitedBlocks[blockKey] = true;
      if (Math.random() < 0.20) {
        this.messages.push(MessageSystem.donutReaction('exploration'));
      }
    }

    // ── Debuff ticks ─────────────────────────────────────────────────────────
    // ── Shop buy — UIScene signals purchase via registry ─────────────────────
    var shopBuyIdx = this.registry.get('shopBuyIdx');
    if (shopBuyIdx !== null && shopBuyIdx !== undefined) {
      this.registry.set('shopBuyIdx', null);
      this._handleShopBuy(shopBuyIdx);
    }

    // Track Taint expiry — notify when it wears off. Skip the scan entirely when
    // no debuffs are present and none were last frame (the common case, all floors).
    if (this._taintWasActive || this.status.debuffs.length > 0) {
      var taintNow = this.status.hasDebuff(DEBUFF_TAINT, nowMs);
      if (this._taintWasActive && !taintNow) {
        this._floatText(this.carl.x(), this.carl.y() - 30, 'TAINT CLEARED', '#44ff88', 11);
        this.messages.push('THE TAINT HAS WORN OFF. HEALING RESTORED. DONUT DECLINES TO COMMENT ON THE SMELL.');
      }
      this._taintWasActive = taintNow;
    }

    // Passive follower decay on Floor 2+ — audience loses interest during idle stretches
    if (this.currentFloor >= 2) {
      if (!this._followerDecayTick) this._followerDecayTick = nowMs;
      if (nowMs - this._followerDecayTick > 20000) {
        this._followerDecayTick = nowMs;
        var idleSecs = (nowMs - (this._lastKillTime || nowMs)) / 1000;
        if (idleSecs > 30 && this.status.followers > 100) {
          var lost = Math.ceil(this.status.followers * 0.003);
          this.status.followers = Math.max(100, this.status.followers - lost);
        }
      }
    }

    if (this.status.debuffs && this.status.debuffs.length > 0) {
      var debuffDmg = this.status.tickDebuffs();
      if (debuffDmg > 0) {
        this._floatText(this.carl.x() + 8, this.carl.y() - 18, '-' + debuffDmg + ' poison', '#44cc44', 10);
        if (this.status.isDead()) this._handleDeath();
      }
    }

    // ── Fairy dust cloud — dazes Carl on contact ──────────────────────────────
    for (var di = this._fairyDustClouds.length - 1; di >= 0; di--) {
      var fcloud = this._fairyDustClouds[di];
      if (nowMs > fcloud.expiresAt) { this._fairyDustClouds.splice(di, 1); continue; }
      if (!fcloud.triggered) {
        var fdx = this.carl.x() - fcloud.x, fdy = this.carl.y() - fcloud.y;
        if (fdx * fdx + fdy * fdy < fcloud.r2) {
          fcloud.triggered = true;
          this._knockdownUntil = Math.max(this._knockdownUntil, nowMs + 900);
          this._floatText(this.carl.x(), this.carl.y() - 28, 'DAZED!', '#ff88ff', 12);
          this.messages.push('"HE WALKED INTO THE FAIRY DUST. I AM AT A LOSS." — DONUT');
          this.cameras.main.shake(150, 0.008);
        }
      }
    }

    // ── Safe room HP regen ────────────────────────────────────────────────────
    this._checkSocialMilestones();

    if (nowMs - this._safeRegenTimer > 3000 && _carlInSafe) {
      this._safeRegenTimer = nowMs;
      if (this.status.hp < this.status.maxHp) {
        var regenAmt = 5 + Math.floor(this.status.stats.con / 3);
        var regenActual = this.status.heal(regenAmt);
        if (regenActual > 0) {
          this._floatText(this.carl.x(), this.carl.y() - 14, '+' + regenActual, '#44ffaa', 11);
        }
      }
    }

    if (!_carlInSafe &&
        nowMs - this.status._lastDamageTime > 5000 &&
        nowMs - this._oocRegenTimer > 4000 &&
        this.status.hp < this.status.maxHp) {
      this._oocRegenTimer = nowMs;
      var oocAmt = 1 + Math.floor(this.status.stats.con / 5);
      var oocActual = this.status.heal(oocAmt);
      if (oocActual > 0) {
        this._floatText(this.carl.x(), this.carl.y() - 10, '+' + oocActual, '#336633', 9);
      }
    }

    var scene = this;
    var _eTiles = this.dungeonData.tiles;
    var _carlX = this.carl.x(), _carlY = this.carl.y();
    var _hasGoblinPass = this.status.hasGoblinPass;
    var enArr = this.enemies;
    for (var enI = 0, enN = enArr.length; enI < enN; enI++) {
      var e = enArr[enI];
      if (e.isDead()) continue;
      var etx = Math.floor(e.sprite.x / 32), ety = Math.floor(e.sprite.y / 32);
      var erow = _eTiles[ety];
      var etile = erow ? erow[etx] : null;
      var isRageElemental = e._isRageElemental;
      if (!isRageElemental) {
        if (etile === DungeonGenerator.SAFE || etile === DungeonGenerator.GUILD) {
          e.sprite.setVelocity(0, 0);
          e._aggroed = false;
          continue;
        }
        if (_carlInSafe) e._aggroed = false;
      }
      // Goblin Pass: goblins + fairies non-hostile to pass holders
      if (_hasGoblinPass && e._goblinFaction) e._aggroed = false;

      if (isRageElemental) {
        e.update(_carlX, _carlY, delta, this.enemyMissiles, this.corpses, _carlInSafe);
        // Elemental rampages: kills nearby mobs and counts them toward its quota
        if (!e._exiled && !e._dead) this._rageElementalMobKills(e);
      } else {
        e.update(_carlX, _carlY, delta, this.enemyMissiles, this.corpses);
      }

      if (!this._combatHintShown && e._aggroed) {
        this._combatHintShown = true;
        this._showCombatHint();
      }

      if (e.isMelee && e.canMeleeHit(_carlX, _carlY)) {
        if (nowMs - e._attackTimer > e.attackCd) {
          e._attackTimer = nowMs;
          var emdmg = this.carl.receiveHit(e.damage, e.typeName);
          if (emdmg > 0) {
            this._lastKiller = e.typeName;
            this._staggerCarl(e.sprite.x, e.sprite.y);
            if (e.typeName === 'Crack Camel' && e._charging) {
              this._knockdownUntil = Math.max(this._knockdownUntil, nowMs + 700);
              this._floatText(_carlX, _carlY - 28, 'KNOCKED DOWN!', '#ff8833', 12);
              this.cameras.main.shake(120, 0.01);
            }
            this._onCarlHurt(emdmg, e.typeName);
            if (e.onHitEffect) {
              var effect = e.onHitEffect(this.status);
              if (effect === DEBUFF_POISON) {
                this._floatText(_carlX, _carlY - 30, 'POISONED', '#44cc44', 11);
                this.messages.push('POISON INFLICTED BY ' + e.typeName.toUpperCase() + '. DONUT LOOKS CONCERNED.');
              } else if (effect === 'steal') {
                e._stolenPotion = true;
                this._floatText(e.sprite.x, e.sprite.y - 14, 'STOLEN!', '#ff8833', 12);
                this.messages.push('GOBLIN STOLE A POTION! IT POCKETS THE VIAL AND CACKLES.');
              }
            }
          }
        }
      }

      if (e.isBoss) {
        if (e._phase === 1 && e.hp <= e.maxHp * 0.5) {
          e._phase = 2;
          e.speed = Math.round(e.speed * 1.5);
          e._slamCdMs = 2800;
          e._slamCd = nowMs;
          e.sprite.setTint(0xff3300);
          this.cameras.main.shake(400, 0.014);
          _playPhaseTransition();
          this._floatText(e.sprite.x, e.sprite.y - 24, 'PHASE 2!', '#ff4400', 14);
          var p2flavor = _bossFlavor(e._bossType);
          this.messages.push(p2flavor.phase2);
          this.time.delayedCall(600, function () { scene.messages.push(p2flavor.phase2Delayed); });
          var addTypes = EnemyFactory.typesForFloor(this.currentFloor);
          for (var si = 0; si < 3; si++) {
            var ang = (si / 3) * Math.PI * 2;
            this._spawnSingleEnemy(
              addTypes[Math.floor(Math.random() * addTypes.length)],
              e.sprite.x + Math.cos(ang) * 72,
              e.sprite.y + Math.sin(ang) * 72,
              this.currentFloor
            );
          }
        }
        if (e._aggroed && nowMs >= e._slamCd) {
          e._slamCd = nowMs + e._slamCdMs;
          this[_bossFlavor(e._bossType).slamFn](e);
        }
        if (e._phase === 2 && e._aggroed && nowMs >= e._throwCd) {
          e._throwCd = nowMs + e._throwCdMs;
          this[_bossFlavor(e._bossType).secondaryFn](e);
        }
      }
    }

    var emArr = this.enemyMissiles.getChildren();
    for (var emi = emArr.length - 1; emi >= 0; emi--) {
      var em = emArr[emi];
      if (!em || !em.active) continue;
      var emtx = Math.floor(em.x / 32), emty = Math.floor(em.y / 32);
      var emrow = _eTiles[emty];
      var emtile = emrow ? emrow[emtx] : null;
      if (emtile === DungeonGenerator.SAFE || emtile === DungeonGenerator.GUILD) {
        em.setActive(false).setVisible(false).destroy();
      }
    }

    // ── E key: interact — shop suppresses all other E-key actions ────────────
    if (this.registry.get('shopOpen')) {
      // UIScene owns E while shop is open
    } else if (Phaser.Input.Keyboard.JustDown(this.interactKey) && nowMs - this._interactCd > 600) {
      this._interactCd = nowMs;
      // Priority: stairs > mailbox > merchant > loot box > corpse > potion
      // Merchant beats loot so claimed boxes don't block Tally in the safe room.
      var didStairs = this._checkStairsInteract();
      if (!didStairs) {
        if (this._nearMailbox) {
          this._checkMailboxInteract();
        } else if (this._nearBopca) {
          this._openShop();
        } else {
          var lootOpened = this._checkLootInteract();
          if (!lootOpened) lootOpened = this._checkCorpseInteract();
          if (!lootOpened) {
            if (this.status.hasPotions()) {
              if (this.status.potionOnCooldown()) {
                this.messages.push(MessageSystem.potionCooldown(this.status.potionCooldownRemainSec()));
              } else {
                var healed = this.status.usePotion();
                this._floatText(this.carl.x(), this.carl.y() - 20, '+' + healed + ' HP', '#88ff88');
                this.messages.push(MessageSystem.potion(healed));
              }
            } else {
              this.messages.push(MessageSystem.noHeal());
            }
          }
        }
      }
    }

    var mArr = this.missiles.getChildren();
    var enemiesArr = this.enemies;
    var mr = this._missileRect;
    for (var mi = mArr.length - 1; mi >= 0; mi--) {
      var mm = mArr[mi];
      if (!mm || !mm.active) continue;
      mr.x = mm.x - 7; mr.y = mm.y - 7;
      for (var ei = 0, eN = enemiesArr.length; ei < eN; ei++) {
        var enemy = enemiesArr[ei];
        if (enemy.isDead()) continue;
        if (!enemy.overlapsRect(mr)) continue;
        var dmg = mm.damage || this.status.getSpellPower();
        if (enemy.typeName === 'Trog Pygmy') {
          this._trogPygmyMissileExplode(enemy, dmg);
        } else {
          enemy.takeDamage(dmg);
          this._floatText(enemy.sprite.x + 18, enemy.sprite.y - 28, String(dmg), '#aaddff', 16);
          if (enemy.typeName === 'Rat') this._aggroRatPack(enemy);
        }
        mm.setActive(false).setVisible(false).destroy();
        _playPickup();
        break; // missile consumed, stop scanning enemies
      }
    }

    var orbArr = this.xpOrbs.getChildren();
    var carlX = this.carl.x(), carlY = this.carl.y();
    var orbSpd = 180 * (delta / 1000);
    for (var oi = orbArr.length - 1; oi >= 0; oi--) {
      var orb = orbArr[oi];
      if (!orb || !orb.active) continue;
      var age = nowMs - (orb._spawnTime || nowMs);
      if (age > 12000) {
        orb.setActive(false).setVisible(false).destroy();
        continue;
      }
      if (age > 9000) orb.setAlpha(1 - (age - 9000) / 3000);
      var odx = orb.x - carlX, ody = orb.y - carlY;
      var od2 = odx * odx + ody * ody;
      if (od2 < 8100 && od2 > 4) {
        var odist = Math.sqrt(od2);
        orb.x -= (odx / odist) * orbSpd;
        orb.y -= (ody / odist) * orbSpd;
        orb.refreshBody();
      }
      if (od2 < 784) {
        var xpAmt = orb._xp || 5;
        var lvlUp = this.status.addXP(xpAmt);
        if (lvlUp) {
          for (var lui = 0; lui < lvlUp.length; lui++) this._onLevelUp(lvlUp[lui]);
        }
        orb.setActive(false).setVisible(false).destroy();
        _playPickup();
      }
    }

    this._updateFog(nowMs);
    this._updateProximityPrompt();
    this._updateCorpses();
    if (this._activeBubbles && this._activeBubbles.length) this._updateBubbles(nowMs);
    this._checkSafeRoomEntry();
    this._checkGuildHallEntry();
    this._checkSecondaryGuildEntry();
    this._checkBossRoomEntry();
  },

  shutdown: function () {
    this.tweens.killTweensOf(this._proximityPrompt);
    this._lootPromptPulsing = false;
    if (this._idleTVTimer) { this._idleTVTimer.remove(); this._idleTVTimer = null; }
    if (this._activeBubbles) {
      while (this._activeBubbles.length) this._removeBubble(this._activeBubbles[0]);
    }
    this._bubbleBySpeaker = {};
    if (EnemyFactory.resetSwarms) EnemyFactory.resetSwarms();
  },

  // ── Private helpers ───────────────────────────────────────────────────────

  _buildTilemap: function (tiles, mapW, mapH) {
    // Tile indices: 0=floor, 1=wall, 2=stairs, 3=door, 4=start, 5=safe_room
    // All match tileset strip positions directly
    var tileKey = this.currentFloor >= 2 ? 'tileset_f2' : 'tileset';
    var map = this.make.tilemap({ data: tiles, tileWidth: 32, tileHeight: 32 });
    var tileset = map.addTilesetImage(tileKey, tileKey, 32, 32, 0, 0);
    this.groundLayer = map.createLayer(0, tileset, 0, 0);
    this.groundLayer.setDepth(0);
    this.wallLayer = this.groundLayer;
    // Only walls block movement — all other tile types are walkable
    this.wallLayer.setCollision([1]);
  },

  _spawnFloorDecor: function (tiles, mapW, mapH) {
    var gr = this.add.graphics().setDepth(1); // just above ground layer (0)
    var isF2 = this.currentFloor >= 2;
    // Floor 2: denser cracks/rubble; Floor 1: standard 4%
    var density = isF2 ? 0.10 : 0.04;
    for (var ty = 1; ty < mapH - 1; ty++) {
      for (var tx = 1; tx < mapW - 1; tx++) {
        var t = tiles[ty][tx];
        if (t !== DungeonGenerator.FLOOR && t !== DungeonGenerator.START) continue;
        if (Math.random() > density) continue;
        var wx = tx * 32, wy = ty * 32;
        var type;
        if (isF2) {
          // Floor 2: skew heavily toward cracks (2) and sharp rocks (5), some rubble (3)
          var r = Math.random();
          type = r < 0.40 ? 2 : r < 0.70 ? 5 : r < 0.85 ? 3 : Math.floor(Math.random() * 3);
        } else {
          type = Math.floor(Math.random() * 5);
        }
        _drawDecor(gr, wx, wy, type);
      }
    }
  },

  _spawnSafeRoomDecor: function (safeRooms) {
    var gr = this.add.graphics().setDepth(2);
    for (var i = 0; i < safeRooms.length; i++) {
      var sr   = safeRooms[i];
      var ry   = sr.y * 32;
      var iw   = (sr.w - 2) * 32;   // interior width (excl. walls)
      var ix   = (sr.x + 1) * 32;   // interior left edge

      // Counter — top interior wall, full width
      gr.fillStyle(0x7a5c3a, 1.0);
      gr.fillRect(ix, ry + 36, iw, 10);
      gr.fillStyle(0x9a7c5a, 0.9);
      gr.fillRect(ix, ry + 36, iw, 3);  // highlight edge

      // Water fountain — left interior, mid-height
      var fontY = ry + Math.floor(sr.h / 2) * 32 - 4;
      gr.fillStyle(0x1a7799, 1.0);
      gr.fillRect(ix + 2, fontY, 14, 18);
      gr.fillStyle(0x44bbdd, 0.8);
      gr.fillRect(ix + 4, fontY + 2, 10, 6);

      // 5 cots — bottom interior row, evenly spaced
      var cotY  = ry + (sr.h - 2) * 32 + 6;
      var cotW  = 26, cotH = 14;
      var gap   = Math.floor((iw - 5 * cotW) / 6);
      for (var c = 0; c < 5; c++) {
        var cotX = ix + gap + c * (cotW + gap);
        gr.fillStyle(0x6b5540, 1.0);
        gr.fillRect(cotX, cotY, cotW, cotH);
        gr.fillStyle(0xd8d4c0, 1.0);
        gr.fillRect(cotX + 2, cotY + 2, cotW - 4, cotH - 4);
        gr.fillStyle(0xf0eeee, 1.0);
        gr.fillRect(cotX + 2, cotY + 2, 6, cotH - 4);  // pillow
      }
    }
  },

  _spawnSingleEnemy: function (type, x, y, floorNum) {
    var scene = this;
    var enemy = EnemyFactory.create(this, type, x, y, floorNum);
    this.physics.add.collider(enemy.sprite, this.wallLayer);
    if (enemy.setMissileGroup) enemy.setMissileGroup(this.enemyMissiles);
    if (enemy instanceof EnemyFactory.RotStickerEnemy) {
      enemy.setKnockdownCallback(function (dmg) { scene._applyRotStickerBlast(dmg); });
    }
    if (enemy instanceof EnemyFactory.DangerDingoEnemy) {
      enemy.onBark(function (msg) { scene.messages.push(msg); });
    }
    if (enemy instanceof EnemyFactory.BrindleGrubEnemy) {
      enemy.setPupaCallback(function (px, py) {
        scene.messages.push('A BRINDLE GRUB PUPA HATCHES. A BRINDLED VESPA EMERGES. DONUT SUGGESTS RUNNING.');
        scene._spawnSingleEnemy('brindled_vespa', px, py, scene.currentFloor);
      });
    }
    if (enemy instanceof EnemyFactory.MindHorrorEnemy) {
      enemy.setPsionicCallback(function (dmg) {
        if (scene.isInSafeRoom()) return;
        var actual = scene.carl.receiveHit(dmg, 'Mind Horror');
        if (actual > 0) {
          scene._lastKiller = 'Mind Horror';
          scene._knockdownUntil = Math.max(scene._knockdownUntil, Date.now() + 600);
          scene._floatText(scene.carl.x(), scene.carl.y() - 30, 'HEADACHE!', '#cc44aa', 12);
          scene.messages.push('MIND HORROR PSIONIC PULSE. YOUR HEAD FEELS LIKE IT\'S SPLITTING. DONUT IS UNAFFECTED AND SMUG ABOUT IT.');
          if (Math.random() < 0.5) scene.messages.push(MessageSystem.donutReaction('psionic'));
          scene.cameras.main.shake(200, 0.009);
          scene.registry.set('hurtFlash', true);
        }
      });
    }
    enemy.onDeath(function (dead) { scene._onEnemyDeath(dead); });
    this.enemies.push(enemy);
    return enemy;
  },

  _spawnEnemies: function (rooms, floorNum) {
    var scene = this;
    var types = EnemyFactory.typesForFloor(floorNum);
    var tiles = this.dungeonData.tiles;
    var startX = this.dungeonData.startPos.x / 32;
    var startY = this.dungeonData.startPos.y / 32;

    for (var i = 0; i < rooms.length; i++) {
      var room = rooms[i];
      var blockCX = room.x + room.w / 2;
      var blockCY = room.y + room.h / 2;
      // Clear area around start — no enemies within ~8 tiles
      if (_dist2(blockCX, blockCY, startX, startY) < 400) continue;

      // 30% skip → now 20% skip (80% of rooms get at least one enemy)
      if (Math.random() < 0.2) continue;

      // Larger rooms get 2 enemies, huge rooms get 3
      var area = room.w * room.h;
      var count = area > 200 ? 3 : area > 100 ? 2 : 1;

      for (var ei = 0; ei < count; ei++) {
        // Pick a random floor tile inside the room
        var placed = false;
        for (var attempt = 0; attempt < 12 && !placed; attempt++) {
          var tx = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
          var ty = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
          var tileVal = tiles[ty] && tiles[ty][tx];
          if (tileVal === DungeonGenerator.FLOOR || tileVal === DungeonGenerator.START) {
            var type = types[Math.floor(Math.random() * types.length)];
            scene._spawnSingleEnemy(type, tx * 32 + 16, ty * 32 + 16, floorNum);
            placed = true;
          }
        }
      }
    }
  },

  _spawnLoot: function (rooms) {
    var scene = this;
    var tiles = this.dungeonData.tiles;
    var startX = this.dungeonData.startPos.x / 32;
    var startY = this.dungeonData.startPos.y / 32;
    var safeRooms = this._safeRooms || [];
    var bossRoom  = this._bossRoom;
    var PAD = 2;

    function _inRoom(tx, ty, r, pad) {
      pad = pad || 0;
      return tx >= r.x - pad && tx < r.x + r.w + pad &&
             ty >= r.y - pad && ty < r.y + r.h + pad;
    }
    function _inAnySafe(tx, ty) {
      for (var ai = 0; ai < safeRooms.length; ai++) if (_inRoom(tx, ty, safeRooms[ai], PAD)) return true;
      return false;
    }

    for (var i = 0; i < rooms.length; i++) {
      if (Math.random() > 0.4) continue;
      var room = rooms[i];
      var blockCX = room.x + room.w / 2;
      var blockCY = room.y + room.h / 2;
      if (_dist2(blockCX, blockCY, startX, startY) < 64) continue;
      var cx = Math.floor(blockCX), cy = Math.floor(blockCY);
      outer: for (var rad = 0; rad <= 6; rad++) {
        for (var dy = -rad; dy <= rad; dy++) {
          for (var dx = -rad; dx <= rad; dx++) {
            if (Math.abs(dx) !== rad && Math.abs(dy) !== rad) continue;
            var tx = cx + dx, ty = cy + dy;
            var tileVal = tiles[ty] && tiles[ty][tx];
            if (tileVal !== DungeonGenerator.FLOOR && tileVal !== DungeonGenerator.START) continue;
            if (_inAnySafe(tx, ty)) continue;
            if (bossRoom && _inRoom(tx, ty, bossRoom, PAD)) continue;
            var bx = tx * 32 + 16, by2 = ty * 32 + 16;
            var box = scene.physics.add.staticImage(bx, by2, 'loot_box');
            box.setDepth(5).setTint(0xffdd88);
            box._opened = false;
            box._tier = 'bronze';
            box._contents = scene._lootTableForTier('bronze');
            scene.lootBoxes.push(box);
            break outer;
          }
        }
      }
    }
  },

  // Returns an ARRAY of items for the given tier. Higher tiers = more items, better quality.
  _lootTableForTier: function (tier) {
    var f = this.currentFloor;
    var scene = this;

    function wep(names, dmgBase, dmgRand) {
      return { type: 'weapon', name: names[Math.floor(Math.random() * names.length)], sprite: 'weapon',
               damage: dmgBase + Math.floor(Math.random() * dmgRand) };
    }
    function arm(names, defBase, defRand) {
      return { type: 'armor', name: names[Math.floor(Math.random() * names.length)], sprite: 'armor',
               defense: defBase + Math.floor(Math.random() * defRand) };
    }
    function scroll(name, effect, desc) {
      return { type: 'consumable', name: name, effect: effect, desc: desc, sprite: 'potion' };
    }
    function hp()  { return { type: 'potion',      name: 'Health Potion', sprite: 'potion', healAmount: 40 }; }
    function mp()  { return { type: 'mana_potion',  name: 'Mana Potion',  sprite: 'potion', mpAmount: 30 }; }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    var COMMON_WEPS  = ['Rusty Knife', 'Shiv', 'Broken Bottle', 'Pipe', 'Crowbar'];
    var MID_WEPS     = ['Dungeon Blade', 'Gnawed Club', 'Spiked Bat', 'Goblin Sword', 'Bone Mace'];
    var RARE_WEPS    = ['Enchanted Blade', 'Salvaged Shortsword', "Crawler's Edge", 'Cursed Shank'];
    var EPIC_WEPS    = ['Boss Shard', 'Voidtouched Blade', 'Shadowfang', "Berserker's Axe"];
    var COMMON_ARMS  = ['Torn Shirt', 'Leather Scraps', 'Padded Vest'];
    var MID_ARMS     = ['Riveted Jacket', 'Chain Shirt', 'Goblin Mail'];
    var RARE_ARMS    = ['Dungeon Plate', 'Bone Armor', "Hoarder's Jacket"];
    var EPIC_ARMS    = ['Reinforced Vest', 'Boss Hide Coat', 'Enchanted Trollskin Shirt'];
    var SCROLLS_LOW  = [scroll('Scroll of Mending', 'scroll_mend', 'Instantly restores 60 HP'),
                        scroll('Scroll of Fortune', 'scroll_fortune', 'Grants bonus XP')];
    var SCROLLS_HIGH = [scroll('Scroll of Blight',    'scroll_blight', 'Damages all nearby enemies'),
                        scroll('Scroll of Swiftness', 'scroll_swift',  'Doubles speed for 10s'),
                        scroll('Scroll of Iron Skin', 'scroll_iron',   'Grants +10 defense for 15s')];
    function goblinPass() { return { type: 'consumable', name: 'Goblin Pass Tattoo', effect: 'goblin_pass', desc: 'Goblins and fairies become non-hostile. Permanent.', sprite: 'potion' }; }

    var items = [];
    var r = Math.random();

    if (tier === 'bronze') {
      // 1 item: common gear, potions, occasional crafting mat
      if (r < 0.32) items.push(hp());
      else if (r < 0.55) items.push(wep(COMMON_WEPS, 2 + f, 3));
      else if (r < 0.72) items.push(arm(COMMON_ARMS, 1 + f, 2));
      else if (r < 0.84) items.push(pick(SCROLLS_LOW));
      else items.push(scene._randomCraftingDrop());

    } else if (tier === 'silver') {
      // 1-2 items: mid gear + bonus potion or mat
      if (r < 0.50) items.push(wep(MID_WEPS, 4 + f, 4));
      else if (r < 0.80) items.push(arm(MID_ARMS, 2 + f, 3));
      else items.push(mp());
      if (Math.random() < 0.55) items.push(hp());

    } else if (tier === 'gold') {
      // 2 items: rare gear + scroll/potion; 8% chance Goblin Pass instead
      if (!this.status.hasGoblinPass && Math.random() < 0.08) {
        items.push(goblinPass());
      } else if (r < 0.55) {
        items.push(wep(RARE_WEPS, 6 + f * 2, 4));
      } else {
        items.push(arm(RARE_ARMS, 4 + f, 3));
      }
      items.push(Math.random() < 0.55 ? pick(SCROLLS_HIGH) : mp());

    } else if (tier === 'platinum') {
      // 2-3 items: rare/epic gear + scroll + chance at potion
      if (r < 0.50) items.push(wep(RARE_WEPS.concat(EPIC_WEPS.slice(0, 2)), 8 + f * 2, 5));
      else items.push(arm(RARE_ARMS.concat(EPIC_ARMS.slice(0, 2)), 5 + f, 4));
      items.push(pick(SCROLLS_HIGH));
      if (Math.random() < 0.65) items.push(hp());

    } else if (tier === 'legendary') {
      // 3-4 items: epic gear guaranteed + 2 extras
      if (r < 0.55) items.push(wep(EPIC_WEPS, 10 + f * 2, 6));
      else items.push(arm(EPIC_ARMS, 7 + f, 5));
      items.push(pick(SCROLLS_HIGH));
      items.push(mp());
      if (Math.random() < 0.55) items.push(hp());

    } else if (tier === 'celestial') {
      // 5 items: best-in-tier gear + full loadout
      items.push(wep(EPIC_WEPS, 14 + f * 3, 6));
      items.push(arm(EPIC_ARMS, 9 + f, 5));
      items.push(scroll('Scroll of Blight', 'scroll_blight', 'Damages all nearby enemies'));
      items.push(scroll('Scroll of Iron Skin', 'scroll_iron', 'Grants +10 defense for 15s'));
      items.push(mp());
      items.push(hp());

    } else {
      items.push(hp());
    }

    if (items.length === 0) items.push(hp());
    return items;
  },

  _craftingTables: {
    'Rat':         [{ name: 'Rat Skin', quality: 'common' }, { name: 'Rat Tail', quality: 'common' }],
    'Goblin':      [{ name: 'Goblin Ear', quality: 'common' }, { name: 'Goblin Tooth', quality: 'common' }],
    'Fairy':       [{ name: 'Fairy Wing', quality: 'uncommon' }, { name: 'Fairy Dust', quality: 'uncommon' }],
    'Crack Camel': [{ name: 'Camel Hide', quality: 'uncommon' }, { name: 'Camel Bone', quality: 'common' }],
    'Skeleton':    [{ name: 'Bone Shard', quality: 'common' }, { name: 'Skull Fragment', quality: 'common' }],
    'Rot Sticker': [{ name: 'Rot Sticker Carapace', quality: 'uncommon' }, { name: 'Rot Sticker Hemolymph', quality: 'uncommon' }],
    'Trog Pygmy':    [{ name: 'Trog Scale', quality: 'common' }, { name: 'Trog Venom Sac', quality: 'uncommon' }],
    'Trog Basher':   [{ name: 'Trog Scale', quality: 'common' }, { name: 'Trog Knucklebone', quality: 'common' }],
    'Trog Virtuoso': [{ name: 'Trog Venom Sac', quality: 'uncommon' }, { name: 'Trog Tongue', quality: 'uncommon' }],
    'Scatterer':     [{ name: 'Scatterer Carapace', quality: 'common' }, { name: 'Scatterer Hemolymph', quality: 'uncommon' }],
    'Bad Llama':      [{ name: 'Llama Bile', quality: 'uncommon' }, { name: 'Lava Saliva', quality: 'uncommon' }],
    'Scat Thug':      [{ name: 'Raccoon Pelt', quality: 'common' }, { name: 'Needle Spear', quality: 'common' }],
    'Clurichaun':     [{ name: 'MLM Pamphlet', quality: 'common' }, { name: 'Clay Jug Shard', quality: 'common' }],
    'Brindled Vespa': [{ name: 'Vespa Chitin', quality: 'uncommon' }, { name: 'Vespa Gland', quality: 'uncommon' }],
    'Kobold Rider':   [{ name: 'Beer-Can Chainmail', quality: 'common' }, { name: 'Kobold Lance Tip', quality: 'common' }],
    'Mind Horror':    [{ name: 'Psionic Residue', quality: 'uncommon' }, { name: 'Brain Jelly', quality: 'uncommon' }],
    'Laminak Elite':  [{ name: 'MLM Brochure', quality: 'common' }, { name: 'Leaf Pantsuit Scrap', quality: 'uncommon' }],
  },

  _craftingDropForEnemy: function (typeName) {
    var pool = this._craftingTables[typeName];
    if (!pool) return null;
    var drop = pool[Math.floor(Math.random() * pool.length)];
    return { type: 'crafting', name: drop.name, quality: drop.quality };
  },

  // Floor 2+ gold yield per enemy. base = floor of the random gold roll; bonus =
  // optional guaranteed extra drops (e.g. Laminak's MLM brochures). Unlisted = base 2.
  _enemyGold: {
    'Danger Dingo':  { base: 15 },
    'Laminak Elite': { base: 25, bonus: { type: 'crafting', name: 'MLM Brochure', quality: 'common', count: 5 } },
  },

  _randomCraftingDrop: function () {
    var tables = this._craftingTables;
    var all = [];
    Object.keys(tables).forEach(function (k) {
      tables[k].forEach(function (d) { all.push(d); });
    });
    var drop = all[Math.floor(Math.random() * all.length)];
    return { type: 'crafting', name: drop.name, quality: drop.quality, sprite: 'weapon' };
  },

  _checkLootInteract: function () {
    var scene = this;
    var box = this._nearestLootBox;
    var hasClaimed = this._claimedBoxes.length > 0;

    // Nothing to interact with
    if (!box && !hasClaimed) return false;
    if (box && box._opened) box = null;

    // Instant pickup for mob drops
    if (box && box._isDrop) {
      box._opened = true;
      this._removeFromArray(this.lootBoxes, box);
      var item = box._contents;
      if (item) {
        var er = this.status.addItem(item);
        this._markInvDirty();
        this.messages.push(MessageSystem.loot(item.name));
        var det = this._buildItemDetail(item);
        var eq = (er === 'equipped') ? ' — EQUIPPED' : '';
        this._floatText(box.x, box.y - 20, item.name + (det ? ' (' + det + ')' : '') + eq, '#ffdd57', 11);
        if (box.destroy) box.destroy();
      }
      _playPickup();
      return true;
    }

    // Outside safe room: collect box into inventory, sprite disappears
    if (!this.isInSafeRoom()) {
      if (!box) return false;
      box._claimed = true;
      box._opened  = true;
      this._removeFromArray(this.lootBoxes, box);
      this._claimedBoxes.push({ tier: box._tier || 'bronze', _contents: box._contents });
      this._floatText(box.x, box.y - 18, 'COLLECTED', '#ffdd88', 11);
      this.messages.push('LOOT BOX COLLECTED. ' + this._claimedBoxes.length + ' BOX' +
        (this._claimedBoxes.length > 1 ? 'ES' : '') + ' IN PACK. OPEN IN SAFE ROOM.');
      // Shrink + fade collect animation
      this.tweens.add({ targets: box, alpha: 0, scaleX: 0, scaleY: 0,
        duration: 350, ease: 'Back.easeIn',
        onComplete: function () { if (box.destroy) box.destroy(); }
      });
      _playPickup();
      return true;
    }

    if (this._lootSequenceRunning) return true;

    // Safe room: only open the nearest box (if any) + all claimed pack boxes.
    // Don't sweep the whole map — boxes elsewhere must be picked up first.
    var toOpen = [];
    if (box && !box._opened && !box._isDrop) {
      toOpen.push(box);
    }
    // Claimed boxes: materialize a temporary sprite near Carl so the sequence can animate them
    for (var ci = 0; ci < this._claimedBoxes.length; ci++) {
      var cd = this._claimedBoxes[ci];
      var tx = this.carl.x() + (ci - Math.floor(this._claimedBoxes.length / 2)) * 24;
      var ty = this.carl.y() + 28;
      var ghost = this.add.image(tx, ty, 'loot_box').setDepth(5);
      ghost.setTint(_tierTint(cd.tier));
      ghost._opened   = false;
      ghost._tier     = cd.tier;
      ghost._contents = cd._contents || scene._lootTableForTier(cd.tier);
      toOpen.push(ghost);
    }
    this._claimedBoxes = [];

    if (toOpen.length === 0) return false;

    for (var j = 0; j < toOpen.length; j++) {
      toOpen[j]._opened = true;
      this._removeFromArray(this.lootBoxes, toOpen[j]);
    }

    this._openLootSequence(toOpen);
    return true;
  },

  // Lore-accurate opening sequence: boxes float up, line up by tier, pop one by one
  _openLootSequence: function (boxes) {
    var scene = this;
    var MAX_VISUAL = 8;
    this._lootSequenceRunning = true;

    boxes.sort(function (a, b) {
      return _tierOrder(a._tier) - _tierOrder(b._tier);
    });

    // Overflow (lowest-tier) boxes beyond MAX_VISUAL: apply silently, no animation
    var overflowCount = Math.max(0, boxes.length - MAX_VISUAL);
    for (var s = 0; s < overflowCount; s++) {
      var sb = boxes[s];
      var tier = sb._tier || 'bronze';
      var sContents = _boxContents(sb);
      for (var sc = 0; sc < sContents.length; sc++) {
        var sItem = sContents[sc];
        scene.status.addItem(sItem);
        scene._markInvDirty();
        var sDet = scene._buildItemDetail(sItem);
        scene.messages.push('[' + tier.toUpperCase() + ' BOX] ' + sItem.name + (sDet ? ' — ' + sDet : ''));
      }
      if (sb.destroy) sb.destroy();
    }

    var animated = boxes.slice(overflowCount);

    scene.messages.push('OPENING ' + boxes.length + ' LOOT BOX' + (boxes.length > 1 ? 'ES' : '') + '. BRONZE FIRST. BORANT CORPORATION GIFT DELIVERY SERVICE.');

    if (animated.length === 0) {
      scene._lootSequenceRunning = false;
      return;
    }

    var cx = scene.carl.x();
    var cy = scene.carl.y() - 80;
    var spacing = 36;
    var startX = cx - ((animated.length - 1) * spacing) / 2;

    // Phase 1: float each box to its lineup position (staggered)
    var readyCount = 0;
    for (var i = 0; i < animated.length; i++) {
      (function (box, idx) {
        var targetX = startX + idx * spacing;
        var targetY = cy;
        var duration = 500;
        var delay = idx * 80;

        scene.time.delayedCall(delay, function () {
          scene.tweens.add({
            targets: box,
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Cubic.Out',
            onComplete: function () {
              readyCount++;
              if (readyCount === animated.length) scene._popLootBoxes(animated);
            }
          });
        });
      })(animated[i], i);
    }
  },

  _popLootBoxes: function (boxes) {
    var scene = this;
    var popDelay = 160;
    var poppedCount = 0;

    for (var i = 0; i < boxes.length; i++) {
      (function (box, idx) {
        scene.time.delayedCall(idx * popDelay, function () {
          var tier = box._tier || 'bronze';
          var col = _tierColor(tier);
          var tint = _tierTint(tier);

          // Flash + shake box — scale based on tier
          var rank = _tierOrder(tier);
          var popScale = 1.4 + rank * 0.12;
          scene.tweens.add({
            targets: box,
            scaleX: popScale, scaleY: popScale,
            duration: 80,
            yoyo: true,
            onComplete: function () {
              if (box.setTexture) box.setTexture('loot_box_open');
            }
          });

          // Camera flash for gold+ tiers
          if (rank >= 2) {
            var flashR = rank >= 4 ? 255 : (rank >= 3 ? 200 : 160);
            var flashG = rank >= 4 ? 180 : (rank >= 3 ? 200 : 220);
            var flashB = rank >= 4 ? 50  : (rank >= 3 ? 255 : 80);
            scene.cameras.main.flash(120 + rank * 40, flashR, flashG, flashB);
            if (rank >= 4) scene.cameras.main.shake(80, 0.004);
          }

          // Puff of smoke/sparkle — bigger for higher tiers
          var puffSize = 10 + rank * 6;
          var puffColor = rank >= 4 ? tint : 0xffffff;
          var puffAlpha = rank >= 3 ? 0.8 : 0.6;
          var puff = scene.add.graphics().setDepth(25);
          puff.fillStyle(puffColor, puffAlpha);
          puff.fillCircle(box.x, box.y, puffSize);
          scene.tweens.add({
            targets: puff,
            alpha: 0,
            scaleX: 2.5 + rank * 0.4, scaleY: 2.5 + rank * 0.4,
            duration: 300 + rank * 50,
            onComplete: function () { puff.destroy(); }
          });

          // Items land at box position — _contents is always an array
          var contents = _boxContents(box);
          for (var ci = 0; ci < contents.length; ci++) {
            var item = contents[ci];
            var equipResult = scene.status.addItem(item);
            scene._markInvDirty();
            var detail = scene._buildItemDetail(item);
            var eq = (equipResult === 'equipped') ? ' — EQUIPPED' : '';
            var yOff = -16 - ci * 14;
            scene._floatText(box.x, box.y + yOff,
              '[' + tier.toUpperCase() + '] ' + item.name + (detail ? ' (' + detail + ')' : '') + eq,
              col, 11);
            scene.messages.push('[' + tier.toUpperCase() + ' BOX] ' + item.name + (detail ? ' — ' + detail : '') + eq);
            if (equipResult === 'equipped') {
              scene._floatText(scene.carl.x(), scene.carl.y() - 36, 'EQUIPPED: ' + item.name, '#ffe080', 12);
            }
          }
          _playPickup();

          // Destroy box sprite; reset sequence flag after all boxes done
          scene.time.delayedCall(400, function () {
            if (box.destroy) box.destroy();
            poppedCount++;
            if (poppedCount === boxes.length) {
              scene._lootSequenceRunning = false;
            }
          });
        });
      })(boxes[i], i);
    }
  },

  // Award a loot box as an achievement reward — adds to pack, shows message
  _awardBox: function (tier, achievementMsg) {
    this._claimedBoxes.push({ tier: tier });
    this.messages.push(achievementMsg);
    this._floatText(this.carl.x(), this.carl.y() - 40, 'ACHIEVEMENT!', '#ffdd22', 14);
    this.cameras.main.flash(200, 255, 230, 100);
  },

  _showCombatHint: function () {
    var W = this.cameras.main.width;
    var H = this.cameras.main.height;
    var txt = this.add.text(W / 2, H * 0.42, 'SPACE  attack', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffdd57',
      stroke: '#000000', strokeThickness: 4,
    }).setScrollFactor(0).setDepth(200).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, duration: 250,
      hold: 2200, yoyo: true,
      onComplete: function () { txt.destroy(); }
    });
  },

  _getEnemiesInRadius: function (cx, cy, r) {
    var r2 = r * r;
    return this.enemies.filter(function (e) {
      if (e.isDead()) return false;
      var dx = e.sprite.x - cx, dy = e.sprite.y - cy;
      return dx * dx + dy * dy <= r2;
    });
  },

  _trogPygmyMissileExplode: function (trog, missileDmg) {
    var scene = this;
    var bx = trog.sprite.x, by = trog.sprite.y;
    var RADIUS = 72;

    // Kill the pygmy first
    trog.takeDamage(9999);

    // Green toxic burst
    var g = this.add.graphics().setDepth(20);
    g.fillStyle(0x44dd22, 0.65);
    g.fillCircle(bx, by, RADIUS);
    this.tweens.add({ targets: g, alpha: 0, scaleX: 1.7, scaleY: 1.7,
      duration: 380, onComplete: function () { g.destroy(); } });
    this.cameras.main.shake(180, 0.01);

    // Chain toxic damage to nearby enemies
    var aoeDmg = Math.max(4, Math.floor(missileDmg * 0.55));
    var aoeHit = 0;
    this.enemies.forEach(function (e) {
      if (e.isDead()) return;
      var dx = e.sprite.x - bx, dy = e.sprite.y - by;
      if (dx * dx + dy * dy < RADIUS * RADIUS) {
        e.takeDamage(aoeDmg);
        scene._floatText(e.sprite.x, e.sprite.y - 20, String(aoeDmg), '#55ff22', 13);
        aoeHit++;
      }
    });
    this._floatText(bx, by - 32, 'BOOM!', '#55ff22', 14);
    if (aoeHit > 0) {
      this.messages.push('TROG PYGMY DETONATES ON MAGIC IMPACT! TOXIC BLAST HITS ' + aoeHit + ' TARGET' + (aoeHit > 1 ? 'S' : '') + ' FOR ' + aoeDmg + ' EACH.');
    } else {
      this.messages.push('MAGIC MISSILE DETONATES THE TROG PYGMY. WHAT A MESS.');
    }
  },

  _aggroRatPack: function (hitRat) {
    var R2 = 160 * 160;
    this.enemies.forEach(function (other) {
      if (other === hitRat || other.isDead() || other.typeName !== 'Rat') return;
      var dx = other.sprite.x - hitRat.sprite.x, dy = other.sprite.y - hitRat.sprite.y;
      if (dx * dx + dy * dy < R2) other._tryAggro();
    });
  },

  _processMeleeSwing: function (swingBox, damage, attackType, isCrit) {
    var scene = this;
    this.enemies.forEach(function (enemy) {
      if (enemy.isDead()) return;
      if (enemy.overlapsRect(swingBox)) {
        enemy.takeDamage(damage);
        if (enemy.typeName === 'Rat') scene._aggroRatPack(enemy);
        var asu = scene.status.addSkillXP(scene.status.attackSkillName(), 2);
        if (asu) scene._onSkillUp(asu);
        var kbStr = (attackType === 'kick') ? 200 : 140;
        var kx = enemy.sprite.x - scene.carl.x();
        var ky = enemy.sprite.y - scene.carl.y();
        var kd = Math.sqrt(kx * kx + ky * ky) || 1;
        enemy.sprite.setVelocity((kx / kd) * kbStr, (ky / kd) * kbStr);
        var label = isCrit
          ? 'CRIT! ' + damage
          : (attackType === 'kick') ? 'KICK! ' + damage : 'PUNCH! ' + damage;
        var color = isCrit ? '#ffff44' : '#ffccaa';
        var size  = isCrit ? 19 : 15;
        scene._floatText(enemy.sprite.x + 18, enemy.sprite.y - 28, label, color, size);
        if (isCrit) {
          scene.status.addViews(2500);
          _playCrit();
          if (Math.random() < 0.25) scene.messages.push(MessageSystem.donutReaction('crit'));
        }
      }
    });
  },

  _onEnemyDeath: function (enemy) {
    var scene = this;

    // Brindle Grubs: no XP, no corpse, nearby grubs cannibalize
    if (enemy.typeName === 'Brindle Grub') {
      var CANN_R2 = 80 * 80;
      this.enemies.forEach(function (other) {
        if (other === enemy || other.isDead() || other.typeName !== 'Brindle Grub') return;
        var bx = other.sprite.x - enemy.sprite.x, by = other.sprite.y - enemy.sprite.y;
        if (bx * bx + by * by < CANN_R2) other._tryAggro();
      });
      this._pruneDeadEnemies();
      return;
    }

    this.status.kills++;

    // Skill XP on kill
    var ksu = this.status.addSkillXP(this.status.attackSkillName(), 8);
    if (ksu) this._onSkillUp(ksu);

    // First kill achievement
    if (!this._firstKillDone) {
      this._firstKillDone = true;
      this.messages.push('ACHIEVEMENT UNLOCKED: "YOU\'VE KILLED A MOB!" XP SYSTEM NOW ACTIVE. BORANT CORPORATION APPROVES.');
      this._floatText(this.carl.x(), this.carl.y() - 36, 'ACHIEVEMENT!', '#ffdd22', 14);
    }

    // Unarmed kill: no weapon equipped when enemy dies
    if (!this._unarmedKillDone && !this.status.equippedWeapon) {
      this._unarmedKillDone = true;
      this._awardBox('bronze', 'ACHIEVEMENT: "YOU\'VE KILLED AN ARMED MOB WITH YOUR BARE FUCKING HANDS!" BRONZE WEAPON BOX ADDED TO PACK.');
    }

    // Higher-level kill: enemy xp value significantly above Carl's level
    if (!this._higherLevelKillDone && enemy.xpValue > this.status.level * 14) {
      this._higherLevelKillDone = true;
      this._awardBox('bronze', 'ACHIEVEMENT: "YOU\'VE KILLED A MOB HIGHER LEVEL THAN YOURSELF!" BRONZE ADVENTURER BOX ADDED TO PACK.');
    }

    var lvlUp = this.status.addXP(enemy.xpValue);
    this.status.addViews(Math.floor(enemy.xpValue * 20));
    // Followers grow on kills too — slower rate; Floor 2+ social system active
    if (this.currentFloor >= 2) {
      this.status.addFollowers(Math.floor(enemy.xpValue * 0.4));
      this._lastKillTime = Date.now();
    }

    // Spawn XP orbs
    var numOrbs = Math.ceil(enemy.xpValue / 8);
    for (var i = 0; i < numOrbs; i++) {
      var ox = enemy.sprite.x + (Math.random() - 0.5) * 30;
      var oy = enemy.sprite.y + (Math.random() - 0.5) * 30;
      var orb = scene.xpOrbs.create(ox, oy, 'xp_orb');
      orb._xp = Math.ceil(enemy.xpValue / numOrbs);
      orb._spawnTime = Date.now();
      orb.setDepth(6);
    }

    // Build corpse loot list
    var corpseItems = [];
    if (enemy._stolenPotion) {
      corpseItems.push({ type: 'potion', name: 'Health Potion' });
    } else if (Math.random() < 0.12) {
      corpseItems.push({ type: 'potion', name: 'Health Potion' });
    }
    if (scene.currentFloor === 1 && Math.random() < 0.35) {
      var mat = scene._craftingDropForEnemy(enemy.typeName);
      if (mat) corpseItems.push(mat);
    }
    if (scene.currentFloor >= 2) {
      var goldDef = scene._enemyGold[enemy.typeName] || { base: 2 };
      var goldAmt = goldDef.base + Math.floor(Math.random() * 8) + Math.floor(enemy.xpValue / 5);
      corpseItems.push({ type: 'gold', name: goldAmt + ' Gold Coins', amount: goldAmt });
      if (goldDef.bonus) {
        for (var bi = 0; bi < goldDef.bonus.count; bi++) {
          corpseItems.push({ type: goldDef.bonus.type, name: goldDef.bonus.name, quality: goldDef.bonus.quality });
        }
      }
    }

    // Spawn corpse — dim, dark-red tinted enemy sprite stays 15s
    scene._spawnCorpse(enemy, corpseItems);

    // Fairy leaves a daze cloud on death
    if (enemy.typeName === 'Fairy') {
      scene._spawnFairyDustCloud(enemy.sprite.x, enemy.sprite.y);
    }

    this.messages.push(MessageSystem.kill(enemy.typeName, enemy.xpValue));
    // Donut reacts to kills ~25% of the time
    if (Math.random() < 0.25) this.messages.push(MessageSystem.donutReaction('kill'));
    if (lvlUp) lvlUp.forEach(function (lu) { scene._onLevelUp(lu); });

    // Prune dead entries so the update forEach stays O(live enemies)
    this._pruneDeadEnemies();
  },

  _updateCorpses: function () {
    var cx = this.carl.x(), cy = this.carl.y();
    var CORPSE_R2 = 2304; // 48px
    var nearest = null, nearDist2 = Infinity;
    for (var i = 0; i < this.corpses.length; i++) {
      var c = this.corpses[i];
      if (c._looted || !c.sprite.active) continue;
      var dx = c.sprite.x - cx, dy = c.sprite.y - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 < CORPSE_R2 && d2 < nearDist2) {
        nearDist2 = d2;
        nearest = c;
      }
    }
    this._nearestCorpse = nearest;
  },

  _checkSocialMilestones: function () {
    if (!this._viewsMilestones.length && !this._followersMilestones.length) return;
    var v = this.status.views;
    for (var vi = this._viewsMilestones.length - 1; vi >= 0; vi--) {
      if (v >= this._viewsMilestones[vi]) {
        this.messages.push(MessageSystem.viewsMilestone(this._viewsMilestones[vi]));
        this._viewsMilestones.splice(0, vi + 1);
        break;
      }
    }
    var f = this.status.followers;
    for (var fi = this._followersMilestones.length - 1; fi >= 0; fi--) {
      if (f >= this._followersMilestones[fi]) {
        this.messages.push(MessageSystem.followersMilestone(this._followersMilestones[fi]));
        this._followersMilestones.splice(0, fi + 1);
        break;
      }
    }
  },

  _spawnFairyDustCloud: function (x, y) {
    var scene = this;
    var RADIUS = 38;
    var cloud = { x: x, y: y, r2: RADIUS * RADIUS, expiresAt: Date.now() + 3200, triggered: false };
    this._fairyDustClouds.push(cloud);
    var g = this.add.graphics().setDepth(14);
    g.fillStyle(0xff88ff, 0.30);
    g.fillCircle(x, y, RADIUS);
    this.tweens.add({ targets: g, alpha: 0, scaleX: 1.6, scaleY: 1.6,
      duration: 3200, onComplete: function () { g.destroy(); } });
  },

  _spawnCorpse: function (enemy, items) {
    var scene = this;
    var cx = enemy.sprite.x, cy = enemy.sprite.y;
    var spr = scene.add.image(cx, cy, enemy.sprite.texture.key)
      .setDepth(4).setAlpha(0.55).setTint(0x441111).setAngle(90);
    var corpse = { sprite: spr, typeName: enemy.typeName, items: items, _looted: false };
    scene.corpses.push(corpse);
    // Auto-despawn after 15s — fade then destroy
    scene.time.delayedCall(13000, function () {
      if (!corpse._looted) {
        scene.tweens.add({
          targets: spr, alpha: 0, duration: 2000,
          onComplete: function () {
            spr.destroy();
            scene._removeFromArray(scene.corpses, corpse);
          }
        });
      }
    });
    // Floor 2 waste disposal: Brindle Grubs spawn near corpse after 6s
    if (scene.currentFloor >= 2 && enemy.typeName !== 'Brindle Grub') {
      scene.time.delayedCall(6000, function () {
        if (corpse._looted) return;
        var numGrubs = 1 + Math.floor(Math.random() * 2);
        for (var gi = 0; gi < numGrubs; gi++) {
          var gx = cx + (Math.random() - 0.5) * 60;
          var gy = cy + (Math.random() - 0.5) * 60;
          scene._spawnSingleEnemy('brindle_grub', gx, gy, scene.currentFloor);
        }
        scene._floatText(cx, cy - 14, 'grubs!', '#8a7a4a', 9);
      });
    }

    // Floor 1 waste disposal: rats home in on non-rat corpses after 9s (cap: 10 total rats)
    if (scene.currentFloor === 1 && enemy.typeName !== 'Rat') {
      var numRats = Math.random() < 0.5 ? 2 : 1;
      scene.time.delayedCall(9000, function () {
        if (corpse._looted) return;
        var activeRats = scene.enemies.filter(function (e) { return !e.isDead() && e.typeName === 'Rat'; }).length;
        if (activeRats >= 10) return;
        corpse._looted = true;
        scene.tweens.killTweensOf(spr);
        spr.destroy();
        scene._removeFromArray(scene.corpses, corpse);
        scene._floatText(cx, cy - 14, 'rats', '#885533', 9);
        for (var ri = 0; ri < numRats; ri++) {
          var rx = cx + (Math.random() - 0.5) * 40;
          var ry = cy + (Math.random() - 0.5) * 40;
          scene._spawnSingleEnemy('rat', rx, ry, scene.currentFloor);
        }
      });
    }
  },

  _checkCorpseInteract: function () {
    var corpse = this._nearestCorpse;
    if (!corpse || corpse._looted) return false;
    corpse._looted = true;
    var corpseX = corpse.sprite ? corpse.sprite.x : 0;
    var corpseY = corpse.sprite ? corpse.sprite.y : 0;
    if (corpse.sprite && corpse.sprite.destroy) corpse.sprite.destroy();
    this._removeFromArray(this.corpses, corpse);

    if (corpse.items.length === 0) {
      this.messages.push(corpse.typeName.toUpperCase() + ' CORPSE. NO USEFUL LOOT. DONUT SNIFFS IT.');
      return true;
    }
    for (var i = 0; i < corpse.items.length; i++) {
      var item = corpse.items[i];
      var er = this.status.addItem(item);
      this._markInvDirty();
      var det = this._buildItemDetail(item);
      var eq = (er === 'equipped') ? ' — EQUIPPED' : '';
      this.messages.push('LOOTED: ' + item.name.toUpperCase() + (det ? ' (' + det + ')' : '') + eq);
    }
    this._floatText(corpseX, corpseY - 20,
      corpse.typeName + ' looted', '#88cc88', 11);
    return true;
  },

  _onLevelUp: function (info) {
    this.messages.push(MessageSystem.levelUp(info.level, this.status.statPoints));
    this._floatText(this.carl.x(), this.carl.y() - 30, 'LEVEL UP!', '#ffdd57', 18);
    _playLevelUp();
    this.status.addViews(50000);
    this.status.addFollowers(500);
    var scene = this;
    this.time.delayedCall(1200, function () {
      scene.messages.push(MessageSystem.donutReaction('level_up'));
    });
    if (info.level === 3) {
      this.time.delayedCall(2800, function () {
        scene.messages.push('BORANT CORPORATION: LEVEL 3 MILESTONE. VIEWER RETENTION UP 18%. THE AUDIENCE IS WARMING TO YOU.');
      });
    } else if (info.level === 5) {
      this.time.delayedCall(2800, function () {
        scene.messages.push('BORANT CORPORATION: LEVEL 5 MILESTONE. YOU ARE NOW STATISTICALLY UNLIKELY TO DIE IN THE NEXT FOUR MINUTES. ENJOY IT.');
      });
    } else if (info.level === 10) {
      this.time.delayedCall(2800, function () {
        scene.messages.push('BORANT CORPORATION: LEVEL 10. ANOMALOUS SURVIVAL DETECTED. LEGAL HAS BEEN NOTIFIED.');
      });
    }
  },

  _onSkillUp: function (result) {
    var label = CrawlerStatus.SKILL_LABELS[result.skill] || result.skill.toUpperCase();
    this.messages.push('SKILL UP: ' + label + ' LEVEL ' + result.level + '.');
    this._floatText(this.carl.x(), this.carl.y() - 50, 'SKILL UP!', '#aaddff', 13);
  },

  _onCarlHurt: function (dmg, source) {
    this._floatText(this.carl.x() + 10, this.carl.y() - 20, '-' + dmg, '#ff4444');
    var msg = MessageSystem.carlDamaged(dmg, source);
    if (msg) this.messages.push(msg);

    // Donut reacts to Carl being hurt
    var now = Date.now();
    if (!this._lastDonutReactTime || now - this._lastDonutReactTime > 4000) {
      this._lastDonutReactTime = now;
      var reaction = this.status.hpPercent() < 0.3
        ? MessageSystem.donutReaction('low_hp')
        : MessageSystem.donutReaction('carl_hurt');
      this.messages.push(reaction);
    }

    // Carl sprite white flash
    var carlSpr = this.carl.getSprite();
    carlSpr.setTint(0xffffff);
    this.time.delayedCall(120, function () { if (carlSpr && carlSpr.active) carlSpr.clearTint(); });

    // Red vignette in UIScene + camera shake
    this.registry.set('hurtFlash', true);
    this.cameras.main.shake(120, 0.008);
  },

  // Brief velocity impulse pushing Carl away from (sx, sy) — hit stagger
  _staggerCarl: function (sx, sy) {
    var dx = this.carl.x() - sx;
    var dy = this.carl.y() - sy;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var spr = this.carl.getSprite();
    spr.setVelocity((dx / d) * 220, (dy / d) * 220);
    var scene = this;
    this.time.delayedCall(140, function () {
      // Only zero stagger velocity if Carl hasn't moved under his own input
      // (input re-applies each frame, so this just clears the leftover impulse)
      if (scene._knockdownUntil <= Date.now()) {
        spr.setVelocity(0, 0);
      }
    });
  },

  _floatText: function (x, y, text, color, size) {
    var pool = this._floatTextPool;
    var t = null;
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].active) { t = pool[i]; break; }
    }
    if (!t) {
      t = this.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(50).setOrigin(0.5);
      pool.push(t);
    }
    t.setActive(true).setVisible(true);
    t.setFontSize((size || 13) + 'px');
    t.setColor(color || '#ffffff');
    t.setText(text);
    t.setPosition(x, y);
    t.setAlpha(1);

    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: function () { t.setActive(false).setVisible(false); }
    });
  },

  _useConsumable: function (item) {
    var scene = this;
    var cx = this.carl.x(), cy = this.carl.y();

    _playConsumable(item.effect);
    if (Math.random() < 0.3) this.messages.push(MessageSystem.donutReaction('consumable'));

    if (item.effect === 'stun') {
      var r = item.radius || 80;
      var dur = item.duration || 2000;
      // Visual: expanding grey ring
      var g = this.add.graphics().setDepth(20);
      g.fillStyle(0xaaaaaa, 0.35);
      g.fillCircle(cx, cy, r);
      this.tweens.add({ targets: g, alpha: 0, scaleX: 1.4, scaleY: 1.4,
        duration: 400, onComplete: function () { g.destroy(); } });
      this._floatText(cx, cy - 20, 'SMOKE BOMB!', '#cccccc', 11);
      // Stun enemies in radius
      this._getEnemiesInRadius(cx, cy, r).forEach(function (e) {
        e._stunUntil = Date.now() + dur;
        e._flashTint(0x888888, dur);
      });

    } else if (item.effect === 'lure') {
      var lr = item.radius || 120;
      var ldur = item.duration || 3000;
      // Visual: small pulsing dot at drop point
      var dot = this.add.circle(cx, cy, 6, 0xffaaff, 0.8).setDepth(20);
      this.tweens.add({ targets: dot, alpha: 0, scaleX: 3, scaleY: 3,
        duration: ldur, onComplete: function () { dot.destroy(); } });
      this._floatText(cx, cy - 20, 'LURE!', '#ffaaff', 11);
      // Pull aggro: redirect nearby enemies to lure point for duration
      var lureX = cx, lureY = cy;
      this._getEnemiesInRadius(cx, cy, lr).forEach(function (e) {
        e._lureUntil = Date.now() + ldur;
        e._lureX = lureX;
        e._lureY = lureY;
        e._aggroed = true;
      });
      // Cancel lure after duration
      this.time.delayedCall(ldur, function () {
        scene.enemies.forEach(function (e) {
          if (e._lureUntil && Date.now() >= e._lureUntil) {
            e._lureUntil = 0;
          }
        });
      });

    } else if (item.effect === 'scroll_mend') {
      var healed = this.status.heal(60 + this.status.stats.con * 2);
      this._floatText(cx, cy - 20, 'MENDING! +' + healed + ' HP', '#44ff88', 13);
      this.messages.push('SCROLL OF MENDING CONSUMED. +' + healed + ' HP. THE DUNGEON SMELLS BRIEFLY OF ANTISEPTIC.');
      _playPickup();

    } else if (item.effect === 'scroll_blight') {
      var bR = 130 + this.status.stats.int * 4;
      var bDmg = 20 + Math.floor(this.status.stats.int * 2.5);
      var bFlash = this.add.graphics().setDepth(20);
      bFlash.fillStyle(0x22cc44, 0.4);
      bFlash.fillCircle(cx, cy, bR);
      this.tweens.add({ targets: bFlash, alpha: 0, scaleX: 1.3, scaleY: 1.3,
        duration: 500, onComplete: function () { bFlash.destroy(); } });
      this._floatText(cx, cy - 20, 'BLIGHT!', '#44ff44', 13);
      var bHits = 0;
      this._getEnemiesInRadius(cx, cy, bR).forEach(function (e) {
        e.takeDamage(bDmg);
        scene._floatText(e.sprite.x, e.sprite.y - 14, '-' + bDmg, '#44ff44', 11);
        bHits++;
      });
      this.messages.push('SCROLL OF BLIGHT: ' + bHits + ' ENEMIES STRUCK FOR ' + bDmg + ' DAMAGE. INT FACTOR APPLIED.');
      _playPickup();

    } else if (item.effect === 'scroll_fortune') {
      var xpGain = Math.floor(this.status.xpToNext * 0.3 + this.status.stats.luck * 10);
      var lvlUp2 = this.status.addXP(xpGain);
      this._floatText(cx, cy - 20, 'FORTUNE! +' + xpGain + ' XP', '#ffdd22', 13);
      this.messages.push('SCROLL OF FORTUNE CONSUMED. +' + xpGain + ' XP. THE DUNGEON ACKNOWLEDGES YOUR GREED.');
      if (lvlUp2) { var _s2 = this; lvlUp2.forEach(function (lu) { _s2._onLevelUp(lu); }); }
      _playLevelUp();

    } else if (item.effect === 'scroll_swift') {
      var swiftDur = 10000;
      this.status._swiftnessUntil = Date.now() + swiftDur;
      this._floatText(cx, cy - 20, 'SWIFTNESS!', '#aaffcc', 13);
      this.messages.push('SCROLL OF SWIFTNESS CONSUMED. SPEED DOUBLED FOR 10 SECONDS. TRY TO USE IT WISELY.');
      var scene2 = this;
      this.time.delayedCall(swiftDur, function () {
        scene2.status._swiftnessUntil = 0;
        scene2._floatText(scene2.carl.x(), scene2.carl.y() - 14, 'speed fading', '#668866', 9);
      });

    } else if (item.effect === 'scroll_iron') {
      var ironDur = 15000;
      this.status._ironSkinDefense = 10;
      this._floatText(cx, cy - 20, 'IRON SKIN! +10 DEF', '#88ccff', 13);
      this.messages.push('SCROLL OF IRON SKIN CONSUMED. +10 DEFENSE FOR 15 SECONDS. YOU FEEL HARDER TO KILL. YOU ARE SLIGHTLY HARDER TO KILL.');
      var scene3 = this;
      this.time.delayedCall(ironDur, function () {
        scene3.status._ironSkinDefense = 0;
        scene3._floatText(scene3.carl.x(), scene3.carl.y() - 14, 'iron skin faded', '#448899', 9);
      });

    } else if (item.effect === 'goblin_pass') {
      this.status.hasGoblinPass = true;
      this._floatText(cx, cy - 24, 'GOBLIN PASS!', '#aaddaa', 13);
      this.messages.push('GOBLIN PASS TATTOO APPLIED. GOBLINS AND FAIRIES RECOGNIZE THE MARK. THEY WILL NOT ATTACK YOU. DONUT IS PLEASED.');
      this.time.delayedCall(1200, function () {
        scene.messages.push(MessageSystem.donutReaction('safe_room'));
      });
    }
  },

  _updateFog: function (nowMs) {
    if (this._lastFogUpdate && nowMs - this._lastFogUpdate < 120) return;
    this._lastFogUpdate = nowMs;

    var tx = Math.floor(this.carl.x() / 32);
    var ty = Math.floor(this.carl.y() / 32);
    var SIGHT = 9; // tile radius revealed
    var W = this.MAP_W, H = this.MAP_H;
    var fog = this._fogGrid;
    var changed = false;

    for (var dy = -SIGHT; dy <= SIGHT; dy++) {
      for (var dx = -SIGHT; dx <= SIGHT; dx++) {
        if (dx * dx + dy * dy > SIGHT * SIGHT) continue;
        var nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var idx = ny * W + nx;
        if (!fog[idx]) { fog[idx] = 1; changed = true; }
      }
    }

    if (changed) this.registry.set('fogDirty', true);
  },

  _updateProximityPrompt: function () {
    var cx = this.carl.x(), cy = this.carl.y();
    var INTERACT_R2 = 2304; // 48px radius
    var nearest = null;
    var nearDist2 = Infinity;

    for (var i = 0; i < this.lootBoxes.length; i++) {
      var box = this.lootBoxes[i];
      if (box._opened) continue;
      var dx = box.x - cx, dy = box.y - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 < INTERACT_R2 && d2 < nearDist2) {
        nearDist2 = d2;
        nearest = box;
      }
    }
    this._nearestLootBox = nearest;

    var nearStairs = false;
    var st = this.dungeonData.stairsTile;
    if (st) {
      var sdx = st.x * 32 + 16 - cx, sdy = st.y * 32 + 16 - cy;
      nearStairs = sdx * sdx + sdy * sdy < 2500;
    }

    var BOPCA_R2 = 80 * 80;
    this._nearBopca = null;
    for (var bpi = 0; bpi < this._bopcas.length; bpi++) {
      var bp = this._bopcas[bpi];
      var bpdx = bp.x - cx, bpdy = bp.y - cy;
      if (bpdx * bpdx + bpdy * bpdy < BOPCA_R2) { this._nearBopca = bp; break; }
    }

    this._nearMailbox = null;
    if (this._mailboxes) {
      for (var mxi = 0; mxi < this._mailboxes.length; mxi++) {
        var mb = this._mailboxes[mxi];
        var mbdx = mb.x - cx, mbdy = mb.y - cy;
        if (mbdx * mbdx + mbdy * mbdy < BOPCA_R2) { this._nearMailbox = mb; break; }
      }
    }

    var p = this._proximityPrompt;
    var inSafe = this._carlInSafeCache !== undefined ? this._carlInSafeCache : this.isInSafeRoom();
    var packedCount = this._claimedBoxes.length;
    if (nearest) {
      var label;
      if (nearest._isDrop) {
        label = '[E] pick up';
      } else if (inSafe) {
        var totalBoxes = 1 + packedCount;
        label = totalBoxes > 1 ? '[E] open ' + totalBoxes + ' boxes' : '[E] open box';
      } else {
        label = packedCount > 0
          ? '[E] collect (' + packedCount + ' in pack)'
          : '[E] collect for safe room';
      }
      p.setText(label).setPosition(nearest.x, nearest.y - 28).setAlpha(1);
    } else if (inSafe && packedCount > 0) {
      var packLabel = '[E] open ' + packedCount + ' box' + (packedCount > 1 ? 'es' : '') + ' from pack';
      p.setText(packLabel).setPosition(cx, cy - 36).setAlpha(1);
    } else if (this._nearestCorpse) {
      var corp = this._nearestCorpse;
      var lootCount = corp.items.length;
      var corpLabel = lootCount > 0
        ? '[E] loot ' + corp.typeName + ' (' + lootCount + ' item' + (lootCount > 1 ? 's' : '') + ')'
        : '[E] loot ' + corp.typeName;
      p.setText(corpLabel).setPosition(corp.sprite.x, corp.sprite.y - 28).setAlpha(1);
    } else if (this._nearBopca) {
      p.setText('[E] shop  (' + this.status.gold + 'g)')
        .setPosition(this._nearBopca.x, this._nearBopca.y - 26).setAlpha(1);
    } else if (this._nearMailbox) {
      p.setText('[E] check mail')
        .setPosition(this._nearMailbox.x, this._nearMailbox.y - 28).setAlpha(1);
    } else if (nearStairs) {
      var stLabel = this._stairsUnlocked ? '[E] descend' : '[E] stairs  (sealed)';
      var stX = st.x * 32 + 16, stY = st.y * 32 + 16;
      p.setText(stLabel).setPosition(stX, stY - 28).setAlpha(1);
    } else {
      p.setAlpha(0);
    }

    var isVisible = p.alpha > 0;
    if (isVisible && !this._lootPromptPulsing) {
      this._lootPromptPulsing = true;
      this.tweens.add({
        targets: p, scaleX: 1.1, scaleY: 1.1,
        duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    } else if (!isVisible && this._lootPromptPulsing) {
      this._lootPromptPulsing = false;
      this.tweens.killTweensOf(p);
      p.setScale(1);
    }
  },

  _checkSafeRoomEntry: function () {
    var cx = this.carl.x(), cy = this.carl.y();
    var entered = null;
    for (var i = 0; i < this._safeRooms.length; i++) {
      if (this._isInsideRoom(cx, cy, this._safeRooms[i])) {
        entered = this._safeRooms[i];
        break;
      }
    }

    if (entered === this._currentSafeRoom) return; // no change

    if (this._idleTVTimer) { this._idleTVTimer.remove(); this._idleTVTimer = null; }

    this._currentSafeRoom = entered;
    this.registry.set('currentSafeRoom', entered ? { name: entered.name } : null);
    if (!entered) return; // left a safe room, no message

    var scene = this;
    this._idleTVTimer = this.time.delayedCall(10000, function () {
      scene._idleTVTimer = null;
      if (scene._currentSafeRoom === entered) scene.registry.set('showTV', entered.name);
    });

    var isFirst = !this._visitedSafeRooms[entered.name];
    this._visitedSafeRooms[entered.name] = true;

    this.messages.push(MessageSystem.safeRoomEnter(entered.name, isFirst));

    if (isFirst) {
      // TV panel: show after entry message settles
      this.time.delayedCall(3500, function () {
        if (scene._currentSafeRoom === entered) scene.registry.set('showTV', entered.name);
      });
      // First-ever safe room: Silver Adventurer Box reward → straight to pack
      if (!this.status.firstSafeRoomDone) {
        this.status.firstSafeRoomDone = true;
        this.time.delayedCall(1200, function () {
          scene.messages.push('ACHIEVEMENT: "SANCTUARY." FIRST SAFE ROOM DISCOVERED. SILVER ADVENTURER\'S BOX ADDED TO PACK.');
          scene._claimedBoxes.push({ tier: 'silver', _contents: scene._lootTableForTier('silver') });
        });
      }
      // Experience cookie — XP reward on first visit per safe room (lore: counter cookie, once/day)
      this.time.delayedCall(4500, function () {
        if (scene._currentSafeRoom !== entered) return;
        var cookieXP = 30 + Math.floor(Math.random() * 20);
        var lvlUp = scene.status.addXP(cookieXP);
        scene._floatText(scene.carl.x(), scene.carl.y() - 28, '+' + cookieXP + ' XP (cookie)', '#ffdd88', 11);
        scene.messages.push('THERE IS AN EXPERIENCE COOKIE ON THE COUNTER. CARL EATS IT. IT TASTES TERRIBLE. +' + cookieXP + ' XP.');
        if (lvlUp) lvlUp.forEach(function (lu) { scene._onLevelUp(lu); });
      });
      // Vending machine candy — 50% chance, +1 DEX for 10 min (lore: temporary buff, tastes terrible)
      if (Math.random() < 0.5) {
        this.time.delayedCall(5800, function () {
          if (scene._currentSafeRoom !== entered) return;
          scene.status._dexBuffUntil = Date.now() + 600000;
          scene._floatText(scene.carl.x(), scene.carl.y() - 36, '+1 DEX (10 min)', '#aaffaa', 11);
          scene.messages.push('VENDING MACHINE IN CORNER. ONE WRAPPED CANDY DISPENSES. +1 DEX FOR 10 MINUTES. IT TASTES LIKE CHALK AND REGRET.');
          scene.time.delayedCall(600000, function () {
            scene.status._dexBuffUntil = 0;
            scene._floatText(scene.carl.x(), scene.carl.y() - 24, 'DEX buff expired', '#888888', 10);
          });
        });
      }
      // Donut reacts
      this.time.delayedCall(7000, function () {
        scene.messages.push(MessageSystem.donutReaction('safe_room'));
      });
    }
  },

  _checkStairsInteract: function () {
    var st = this.dungeonData.stairsTile;
    if (!st) return false;
    var stWorldX = st.x * 32 + 16;
    var stWorldY = st.y * 32 + 16;
    var dx = this.carl.x() - stWorldX;
    var dy = this.carl.y() - stWorldY;
    if (dx * dx + dy * dy > 2500) return false; // 50px radius

    if (!this._stairsUnlocked) {
      this.messages.push(MessageSystem.stairsLocked(this.currentFloor));
      return false; // don't swallow E — loot/other interactions still fire
    }
    this._descend();
    return true;
  },

  getFloorTimerStatus: function () {
    return {
      unlocked:  this._stairsUnlocked,
      bossAlive: !!(this._bossEnemy && !this._bossEnemy.isDead()),
      hasBoss:   !!this._bossRoom,
    };
  },

  _checkMailboxInteract: function () {
    var mb = this._nearMailbox;
    if (!mb) return;
    var MAIL_MESSAGES = [
      'MAILBOX: "WHY WOULD SOMEONE SEND YOU MAIL?" — BORANT CORPORATION POSTAL SERVICE.',
      'MAILBOX CHECKED. CONTENTS: NOTHING. THE FLAG WAS DECORATIVE. IT IS ALWAYS DECORATIVE.',
      'MAILBOX: NO MAIL. BORANT CORPORATION HAS READ ALL OF IT. SOME OF IT WAS INTERESTING. THEY WILL NOT SAY WHICH.',
      'MAILBOX: EMPTY. DONUT SAYS SHE WAS EXPECTING A PACKAGE. DONUT DECLINES TO ELABORATE.',
    ];
    var msg = MAIL_MESSAGES[Math.floor(Math.random() * MAIL_MESSAGES.length)];
    this.messages.push(msg);
    _playPickup();
  },

  isInSafeRoom: function () {
    if (this._safeRoomsClosed) return false;
    var tx = Math.floor(this.carl.x() / 32);
    var ty = Math.floor(this.carl.y() / 32);
    var row = this.dungeonData.tiles[ty];
    return row ? row[tx] === DungeonGenerator.SAFE : false;
  },

  _removeFromArray: function (arr, item) {
    var i = arr.indexOf(item);
    if (i !== -1) arr.splice(i, 1);
  },

  _pruneDeadEnemies: function () {
    this.enemies = this.enemies.filter(function (e) { return !e.isDead(); });
  },

  _buildItemDetail: function (item) {
    if (item.type === 'weapon')   return '+' + item.damage + ' dmg';
    if (item.type === 'armor')    return '+' + item.defense + ' def';
    if (item.type === 'potion')   return 'use with [E]';
    if (item.type === 'crafting') return item.quality + ' crafting material';
    if (item.type === 'gold')     return item.amount + ' coins → wallet';
    return '';
  },

  _markInvDirty: function () {
    var ui = this.scene.get('UIScene');
    if (ui && ui.markInventoryDirty) ui.markInventoryDirty();
  },

  getSafeRoomClosureStatus: function () {
    if (this._safeRoomsClosed) return { closed: true, secsLeft: 0 };
    var secsLeft = Math.max(0, Math.ceil((this._safeRoomCloseAt - Date.now()) / 1000));
    return { closed: false, secsLeft: secsLeft };
  },

  _descend: function () {
    var scene = this;
    var nextFloor = this.currentFloor + 1;
    this.currentFloor = nextFloor; // advance now so autosave can't clobber with old floor
    this.status.addViews(300000);
    this.status.addFollowers(3000);
    // Floor 2 entry: Borant activates social features — boost to meaningful numbers
    if (nextFloor === 2) {
      this.status.views     = Math.max(this.status.views,     5000000 + Math.floor(Math.random() * 2000000));
      this.status.followers = Math.max(this.status.followers, 25000   + Math.floor(Math.random() * 10000));
      this.status.favorites = Math.max(this.status.favorites, 4000    + Math.floor(Math.random() * 2000));
    }
    _playDescend();
    this.messages.push(MessageSystem.donutReaction('descend'));
    SaveSystem.save(this.status, nextFloor);

    // Overlay — fixed to camera so it survives the fadeOut
    var cam = this.cameras.main;
    var W = cam.width, H = cam.height;
    var floorName = MessageSystem.floorName(nextFloor);
    var isNamed = floorName !== 'FLOOR ' + nextFloor;
    var label = isNamed ? 'FLOOR ' + nextFloor + '\n' + floorName : 'FLOOR ' + nextFloor;

    var overlay = this.add.text(W / 2, H / 2, label, {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#cc4444',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      shadow: { blur: 18, color: '#ff0000', fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(500).setAlpha(0);

    this.tweens.add({ targets: overlay, alpha: 1, duration: 220, ease: 'Quad.easeIn' });

    cam.fadeOut(700, 0, 0, 0);
    this.time.delayedCall(750, function () {
      scene.scene.stop('UIScene');
      scene.scene.restart({ floor: nextFloor });
    });
  },

  _isInsideRoom: function (cx, cy, room) {
    var left = room.x * 32, top = room.y * 32;
    var right = (room.x + room.w) * 32, bottom = (room.y + room.h) * 32;
    return cx >= left && cx <= right && cy >= top && cy <= bottom;
  },

  _checkBossRoomEntry: function () {
    if (!this._bossRoom || this._bossTriggered) return;
    if (!this._isInsideRoom(this.carl.x(), this.carl.y(), this._bossRoom)) return;

    this._bossTriggered = true;
    // Seal the door behind Carl — wall tile at door position
    this.wallLayer.putTileAt(DungeonGenerator.WALL, this._bossRoom.doorX, this._bossRoom.doorY);
    this.cameras.main.shake(500, 0.018);
    var scene = this;
    var flavor = _bossFlavor(this._bossEnemy ? this._bossEnemy._bossType : 'hoarder');
    this.messages.push(flavor.intro);
    this.time.delayedCall(1200, function () { scene.messages.push(flavor.introDelayed); });
    this.time.delayedCall(2400, function () {
      scene.messages.push(MessageSystem.donutReaction('many_enemies'));
    });
    // Periodic taunts while boss lives
    this._bossLoopEvent = this.time.addEvent({
      delay: 13000,
      loop: true,
      callback: function () {
        var b = scene._bossEnemy;
        if (b && !b.isDead()) {
          scene.messages.push(_bossFlavor(b._bossType).taunt(b._phase));
        }
      },
    });
  },

  _spawnBossBox: function (tier, x, y) {
    var box = this.physics.add.staticImage(x, y, 'loot_box');
    box.setDepth(5).setTint(_tierTint(tier));
    box._opened = false; box._tier = tier;
    box._contents = this._lootTableForTier(tier);
    box._isBossBox = true;
    this.lootBoxes.push(box);
  },

  _onBossDeath: function (enemy) {
    var scene = this;
    // Stop taunt timer
    if (this._bossLoopEvent) { this._bossLoopEvent.remove(false); this._bossLoopEvent = null; }
    // Lore: all minions die when boss dies. Boss room is sealed during the fight,
    // so every spawned minion is still inside its bounds.
    if (this._bossRoom) {
      for (var mi = 0; mi < this.enemies.length; mi++) {
        var mob = this.enemies[mi];
        if (!mob.isDead() && !mob.isBoss &&
            this._isInsideRoom(mob.sprite.x, mob.sprite.y, this._bossRoom)) {
          mob.takeDamage(999999);
        }
      }
    }
    // Unseal door + unlock stairs
    if (this._bossRoom) {
      this.wallLayer.putTileAt(DungeonGenerator.FLOOR, this._bossRoom.doorX, this._bossRoom.doorY);
    }
    this._stairsUnlocked = true;
    this.status.bossKilledFloor = this.currentFloor;
    this.messages.push('BORANT CORPORATION: NEIGHBORHOOD STAIRWELL UNSEALED. EXIT NOW LIVE.');
    this.cameras.main.flash(400, 255, 220, 50);
    this.cameras.main.shake(200, 0.008);
    this.status.addViews(2000000);
    this.status.addFollowers(20000);
    this.status.addFavorites(5000);
    this.status.kills++;
    var ksu = this.status.addSkillXP(this.status.attackSkillName(), 25);
    if (ksu) this._onSkillUp(ksu);
    var bossLvlUp = this.status.addXP(enemy.xpValue);

    // Always drop a unique boss item — instant pickup, legendary tier
    var bflavor = _bossFlavor(enemy._bossType);
    var bossDropPool = bflavor.dropPool(scene.currentFloor);
    var uniqueDrop = bossDropPool[Math.floor(Math.random() * bossDropPool.length)];
    var ubox = scene.physics.add.staticImage(enemy.sprite.x - 20, enemy.sprite.y - 16, 'loot_box');
    ubox.setDepth(5).setTint(_tierTint('legendary'));
    ubox._opened = false; ubox._tier = 'legendary'; ubox._contents = uniqueDrop; ubox._isDrop = true;
    scene.lootBoxes.push(ubox);
    scene.messages.push(bflavor.dropMsg(uniqueDrop.name));

    // Survivor Box: <5% HP = Silver Survivor's Box, <10% HP = Bronze Survivor's Box (lore-accurate)
    var hpPct = this.status.hpPercent();
    if (hpPct < 0.05) {
      this.messages.push('SILVER SURVIVOR\'S BOX AWARDED. YOU WERE AT DEATH\'S DOOR. THE AUDIENCE IS LOSING THEIR MINDS.');
      scene._spawnBossBox('silver', enemy.sprite.x, enemy.sprite.y);
    } else if (hpPct < 0.10) {
      this.messages.push('BRONZE SURVIVOR\'S BOX AWARDED. NEARLY DEAD. IMPRESSIVE, IF RECKLESS.');
      scene._spawnBossBox('bronze', enemy.sprite.x, enemy.sprite.y);
    } else {
      this.messages.push('NEIGHBORHOOD BOSS DEFEATED. +' + enemy.xpValue + ' XP. DOOR UNSEALED. SOMETHING SHIFTS IN THE DUNGEON.');
      scene._spawnBossBox('gold', enemy.sprite.x, enemy.sprite.y);
    }

    this.time.delayedCall(800, function () {
      scene.messages.push(MessageSystem.donutReaction('kill'));
    });
    if (bossLvlUp) bossLvlUp.forEach(function (lu) { scene._onLevelUp(lu); });
    // Remove dead boss from enemies array
    this._pruneDeadEnemies();
    // Start creep wave — adjacent mobs infiltrate every 45s
    this._startCreepWaves();
  },

  _applyRotStickerBlast: function (damage) {
    var scene = this;
    this._lastKiller = 'Rot Sticker';
    var dmg = this.carl.receiveHit(damage, 'Rot Sticker');
    this._staggerCarl(this.carl.x(), this.carl.y() + 1);
    if (dmg === -1) {
      this._floatText(this.carl.x(), this.carl.y() - 24, 'DODGE!', '#ffff44', 13);
      return;
    }
    this._floatText(this.carl.x(), this.carl.y() - 24, 'BLAST! -' + dmg, '#ff6622', 13);
    this.messages.push('ROT STICKER DETONATED. TAKE DOWN DEBUFF. "THAT SMELLED AWFUL." — DONUT.');
    // Knockdown: freeze Carl for 1.8s
    this._knockdownUntil = Date.now() + 1800;
    var cs = this.carl.getSprite();
    cs.setTint(0xff8844);
    this.time.delayedCall(1800, function () {
      if (cs && cs.active) cs.clearTint();
      scene._knockdownUntil = 0;
    });
  },

  _bossGroundSlam: function (boss) {
    var scene = this;
    var SLAM_R = boss._phase === 2 ? 110 : 84; // px radius
    var SLAM_DMG = boss._phase === 2 ? 36 : 24;
    var bx = boss.sprite.x, by = boss.sprite.y;

    // Telegraph: red circle that pulses for 700ms
    var warn = scene.add.graphics().setDepth(20);
    warn.lineStyle(3, 0xff2200, 0.85);
    warn.strokeCircle(bx, by, SLAM_R);
    warn.fillStyle(0xff2200, 0.15);
    warn.fillCircle(bx, by, SLAM_R);

    scene._floatText(bx, by - 28, 'SLAM!', '#ff4400', 13);

    // After 700ms — deal damage if Carl is in radius
    scene.time.delayedCall(700, function () {
      warn.destroy();
      // Shockwave flash
      var flash = scene.add.graphics().setDepth(20);
      flash.fillStyle(0xff6600, 0.5);
      flash.fillCircle(bx, by, SLAM_R);
      scene.time.delayedCall(120, function () { flash.destroy(); });

      scene.cameras.main.shake(250, 0.012);
      _playBossSlam();

      var dx = scene.carl.x() - bx, dy = scene.carl.y() - by;
      if (dx * dx + dy * dy < SLAM_R * SLAM_R) {
        var dmg = scene.carl.receiveHit(SLAM_DMG, 'ground_slam');
        if (dmg > 0) {
          scene._onCarlHurt(dmg, 'ground slam');
          scene.messages.push('GROUND SLAM. -' + dmg + ' HP. DONUT SUGGESTS MOVING FASTER.');
        }
      }
    });
  },

  _bossThrowJunk: function (boss) {
    var scene = this;
    var bx = boss.sprite.x, by = boss.sprite.y;
    var tx = scene.carl.x(), ty = scene.carl.y();

    // Telegraph — flash above Carl
    scene._floatText(tx, ty - 28, '!', '#ff8800', 16);

    scene.time.delayedCall(350, function () {
      if (boss.isDead()) return;
      var junk = scene.physics.add.image(bx, by, 'weapon');
      junk.setDepth(14).setTint(0xcc8844).setScale(0.7);
      junk.setCircle(8);
      var dx = tx - bx, dy = ty - by;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var SPD = 240;
      junk.setVelocity((dx / dist) * SPD, (dy / dist) * SPD);
      junk.setAngularVelocity(360);

      // Check collision with Carl each frame via overlap
      var hitTimer = scene.time.addEvent({
        delay: 50, repeat: 20, callback: function () {
          if (!junk.active) { hitTimer.remove(); return; }
          var jdx = scene.carl.x() - junk.x, jdy = scene.carl.y() - junk.y;
          if (jdx * jdx + jdy * jdy < 32 * 32) {
            var dmg = scene.carl.receiveHit(12 + Math.floor(boss.hp / boss.maxHp * 8), 'thrown_junk');
            if (dmg > 0) {
              scene._onCarlHurt(dmg, 'thrown junk');
              scene._floatText(scene.carl.x(), scene.carl.y() - 18, '-' + dmg + ' JUNK', '#cc8844', 11);
            }
            junk.destroy();
            hitTimer.remove();
          }
        }
      });

      scene.time.delayedCall(1500, function () { if (junk.active) junk.destroy(); });
    });
  },

  _bossVomitScatterers: function (boss) {
    var scene = this;
    var bx = boss.sprite.x, by = boss.sprite.y;
    var count = boss._phase === 2 ? 3 : 2;
    scene._floatText(bx, by - 28, 'VOMIT!', '#cc8833', 13);
    scene.cameras.main.shake(120, 0.006);
    scene.time.delayedCall(350, function () {
      if (boss.isDead()) return;
      for (var i = 0; i < count; i++) {
        var ang = (i / count) * Math.PI * 2;
        scene._spawnSingleEnemy('scatterer', bx + Math.cos(ang) * 28, by + Math.sin(ang) * 28, scene.currentFloor);
      }
    });
  },

  _bossKrakarenSlam: function (boss) {
    // Tentacle sweep — wider arc than hoarder slam, green/purple tint
    var scene = this;
    var SWEEP_R = boss._phase === 2 ? 130 : 96;
    var SWEEP_DMG = boss._phase === 2 ? 28 : 18;
    var bx = boss.sprite.x, by = boss.sprite.y;

    var warn = scene.add.graphics().setDepth(20);
    warn.lineStyle(3, 0x44aa22, 0.85);
    warn.strokeCircle(bx, by, SWEEP_R);
    warn.fillStyle(0x228811, 0.12);
    warn.fillCircle(bx, by, SWEEP_R);
    scene._floatText(bx, by - 28, 'TENTACLES!', '#44dd22', 13);

    scene.time.delayedCall(800, function () {
      warn.destroy();
      var flash = scene.add.graphics().setDepth(20);
      flash.fillStyle(0x44cc22, 0.4);
      flash.fillCircle(bx, by, SWEEP_R);
      scene.time.delayedCall(150, function () { flash.destroy(); });
      scene.cameras.main.shake(200, 0.010);
      _playBossSlam();

      var dx = scene.carl.x() - bx, dy = scene.carl.y() - by;
      if (dx * dx + dy * dy < SWEEP_R * SWEEP_R) {
        var dmg = scene.carl.receiveHit(SWEEP_DMG, 'krakaren_tentacle');
        if (dmg > 0) {
          scene._onCarlHurt(dmg, 'tentacle sweep');
          scene.messages.push('TENTACLE SWEEP. -' + dmg + ' HP. THE MOUTHS ARE LAUGHING.');
        }
      }
    });
  },

  _bossKrakarenMist: function (boss) {
    // Phase 2 mist spray — applies Septic debuff, short range cone
    var scene = this;
    if (boss.isDead()) return;
    var bx = boss.sprite.x, by = boss.sprite.y;
    var tx = scene.carl.x(), ty = scene.carl.y();
    var MIST_R = 100;

    scene._floatText(bx, by - 24, 'MIST!', '#88ff44', 12);
    var mist = scene.add.graphics().setDepth(20);
    mist.fillStyle(0x55cc33, 0.35);
    mist.fillCircle(bx, by, MIST_R);

    scene.time.delayedCall(200, function () {
      mist.destroy();
      var dx = tx - bx, dy = ty - by;
      if (dx * dx + dy * dy < MIST_R * MIST_R) {
        if (!scene.status.hasDebuff(DEBUFF_SEPTIC)) {
          scene.status.applyDebuff(DEBUFF_SEPTIC, 8000, 1, 2000);
          scene._floatText(scene.carl.x(), scene.carl.y() - 20, 'SEPTIC!', '#44dd22', 12);
          scene.messages.push('VIGOROUS MEASLES MIST CLOUD. SEPTIC DEBUFF APPLIED. MOVEMENT SLOWED.');
        }
      }
    });
  },

  _startCreepWaves: function () {
    var scene = this;
    var waveInterval = 45000;
    var waveCount = 0;
    var maxWaves = 8;

    function spawnWave() {
      if (waveCount >= maxWaves || scene._stairsUnlocked) return;
      waveCount++;
      var types = EnemyFactory.typesForFloor(scene.currentFloor);
      var numMobs = 2 + Math.floor(waveCount / 2);
      // Spawn on arteries near Carl — pick random artery intersection points
      var artCols = scene.dungeonData.arteryCols;
      var artRows = scene.dungeonData.arteryRows;
      for (var i = 0; i < numMobs; i++) {
        var ax = artCols[Math.floor(Math.random() * artCols.length)];
        var ay = artRows[Math.floor(Math.random() * artRows.length)];
        // Offset slightly so they don't stack
        ax += Math.floor(Math.random() * 5) - 2;
        ay += Math.floor(Math.random() * 5) - 2;
        var type = types[Math.floor(Math.random() * types.length)];
        scene._spawnSingleEnemy(type, ax * 32 + 16, ay * 32 + 16, scene.currentFloor);
      }
      if (waveCount === 1) {
        scene.messages.push('BORANT CORPORATION: ADJACENT MOBS ARE CREEPING INTO YOUR QUADRANT. THIS IS NORMAL. BORANT IS NOT RESPONSIBLE.');
      }
      scene.time.delayedCall(waveInterval, spawnWave);
    }

    // First wave after a delay
    this.time.delayedCall(waveInterval, spawnWave);
  },

  _checkGuildHallEntry: function () {
    if (!this._guildHall) return;
    var inside = this._isInsideRoom(this.carl.x(), this.carl.y(), this._guildHall);

    if (inside === this._inGuildHall) return; // no change
    this._inGuildHall = inside;

    if (!inside) return;

    if (this.status.tutorialComplete) {
      this.messages.push(MessageSystem.guildGuide(this.currentFloor));
    } else if (!this._tutorialRunning) {
      this._startTutorial();
    }
  },

  _checkSecondaryGuildEntry: function () {
    if (!this._secondaryGuildHalls.length) return;
    var cx = this.carl.x(), cy = this.carl.y();
    var nowIn = -1;
    for (var i = 0; i < this._secondaryGuildHalls.length; i++) {
      if (this._isInsideRoom(cx, cy, this._secondaryGuildHalls[i])) { nowIn = i; break; }
    }
    if (nowIn === this._inSecondaryGuild) return;
    var prev = this._inSecondaryGuild;
    this._inSecondaryGuild = nowIn;
    if (nowIn >= 0 && prev < 0) {
      this.messages.push(MessageSystem.guildGuide(this.currentFloor));
    }
  },

  _onUrinate: function () {
    var scene = this;
    if (this.isInSafeRoom()) {
      this.messages.push('DESIGNATED RESTROOM FACILITIES IN USE. BORANT THANKS YOU FOR YOUR COMPLIANCE.');
      return;
    }
    // Already active — the elemental doesn't stack
    if (this._rageElemental && !this._rageElemental.isDead()) {
      this.messages.push('THE ELEMENTAL NOTES YOUR CONTINUED DISREGARD FOR FACILITY ETIQUETTE.');
      return;
    }
    this.messages.push('ACHIEVEMENT UNLOCKED: "WHEN NATURE CALLS." YOU HAVE URINATED OUTSIDE A DESIGNATED RESTROOM. THE DUNGEON IS AWARE.');
    this.time.delayedCall(1800, function () {
      scene._spawnRageElemental();
    });
  },

  _spawnRageElemental: function () {
    var scene = this;
    var cx = this.carl.x(), cy = this.carl.y();
    // Spawn off-screen — 220px to either side, so player sees it arrive
    var sx = cx + (Math.random() < 0.5 ? -220 : 220);
    var sy = cy + (Math.random() - 0.5) * 100;
    var elem = new EnemyFactory.RageElementalEnemy(this, sx, sy);
    this.physics.add.collider(elem.sprite, this.wallLayer);

    elem.setGravityCallback(function (dmg) {
      var gravDmg = scene.carl.receiveHit(dmg, 'Rage Elemental');
      if (gravDmg > 0) {
        scene._staggerCarl(elem.sprite.x, elem.sprite.y);
        if (!scene._rageGravAchievement) {
          scene._rageGravAchievement = true;
          scene.time.delayedCall(800, function () {
            scene.messages.push('ACHIEVEMENT UNLOCKED: "WHAT GOES UP..." REWARD: "MORE DURABLE THAN A MONKEY NAMED ALBERT."');
          });
        }
      }
    });

    elem.setSafeExitCallback(function () {
      scene.messages.push('THE ELEMENTAL RETREATS FROM SACRED GROUND. IT WILL RETURN.');
    });

    elem.onDeath(function () {
      scene._rageElemental = null;
      scene.messages.push('THE RAGE ELEMENTAL HAS CLAIMED ITS QUOTA. IT DISSIPATES. THE DUNGEON WATCHES IN SILENCE.');
    });

    this.enemies.push(elem);
    this._rageElemental = elem;
    this._rageMobKills  = 0;

    this.messages.push('A RAGE ELEMENTAL HAS MANIFESTED. IT WILL CLAIM 666 SOULS. GRUBS DO NOT COUNT. FIND A BATHROOM.');
    this.cameras.main.shake(600, 0.022);
  },

  _rageElementalMobKills: function (elem) {
    var KILL_R2 = 40 * 40, SEEK_R2 = 300 * 300;
    var ex = elem.sprite.x, ey = elem.sprite.y;
    var nearMob = null, nearD2 = Infinity;
    var scene = this;
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var mob = this.enemies[i];
      if (mob === elem || mob.isDead() || mob._isRageElemental) continue;
      var dx = mob.sprite.x - ex, dy = mob.sprite.y - ey;
      var d2 = dx * dx + dy * dy;
      if (d2 < SEEK_R2 && d2 < nearD2) { nearD2 = d2; nearMob = mob; }
      if (d2 < KILL_R2) {
        mob.takeDamage(9999);
        if (mob.isDead()) {
          scene._rageMobKills++;
          scene._floatText(ex, ey - 28, (666 - scene._rageMobKills) + ' SOULS REMAIN', '#cc44ff', 10);
          if (scene._rageMobKills >= 666) elem.takeDamage(999999);
        }
      }
    }
    elem._nearestMob = nearMob;
  },

  _startTutorial: function () {
    this._tutorialRunning = true;
    var scene = this;
    var STEP_MS = 3800;  // time between each dialog line
    var stepFn = scene.currentFloor >= 2 ? MessageSystem.tutorialStepFloor2 : MessageSystem.tutorialStep;

    // Fire steps 0-7 (dialog lines)
    for (var i = 0; i < 8; i++) {
      (function (step) {
        scene.time.delayedCall(step * STEP_MS, function () {
          scene.messages.push(stepFn(step));
          // Step 6: give heal spell (slot 0) + Donut glow
          if (step === 6) scene._tutorialGiveSpell();
          // Step 7: give starter items
          if (step === 7) scene._tutorialGiveItems();
        });
      })(i);
    }

    // Final step: unlock HUD
    scene.time.delayedCall(8 * STEP_MS, function () {
      scene.messages.push(stepFn(9));
      scene.status.tutorialComplete = true;
      SaveSystem.save(scene.status, scene.currentFloor);
      scene.registry.set('savedFlash', true);
      scene.registry.set('tutorialComplete', true);
      scene._tutorialRunning = false;
      // Guildmaster stops pulsing — becomes Game Guide
      if (scene._guildNPC) {
        scene.tweens.killTweensOf(scene._guildNPC);
        scene._guildNPC.setAlpha(1);
      }
    });
  },

  _tutorialGiveSpell: function () {
    // Heal spell is Donut's passive — just acknowledge it in hotlist slot 0
    // The actual spell object is a sentinel that hotlistUse won't consume
    var healSpell = { type: 'spell', name: 'Heal (Donut)', sprite: 'heal_orb' };
    this.status.hotlist[0] = healSpell;
    this.status.inventory.push(healSpell);
    this._markInvDirty();
  },

  _tutorialGiveItems: function () {
    for (var p = 0; p < 3; p++) {
      var pot = { type: 'potion', name: 'Health Potion', sprite: 'potion' };
      this.status.addItem(pot);
    }
    // Starter loot box — pop it immediately as pre-opened items
    var starterGear = [
      { type: 'weapon', name: 'Rusty Knife', sprite: 'weapon', damage: 4 },
      { type: 'armor',  name: 'Torn Shirt',  sprite: 'armor',  defense: 1 },
    ];
    for (var g = 0; g < starterGear.length; g++) {
      var result = this.status.addItem(starterGear[g]);
      this.messages.push(MessageSystem.loot(starterGear[g].name));
    }
    this._markInvDirty();
    _playPickup();
  },

  _openShop: function () {
    var stock = this._generateShopStock();
    this.registry.set('shopData', { stock: stock, gold: this.status.gold });
    this.registry.set('shopOpen', true);
  },

  _closeShop: function () {
    this.registry.set('shopOpen', false);
  },

  _generateShopStock: function () {
    var floor = this.currentFloor;
    var stock = [];
    stock.push({ name: 'Health Potion',  type: 'potion',      sprite: 'potion', cost: 20, healAmount: 30 });
    stock.push({ name: 'Mana Potion',    type: 'mana_potion', sprite: 'potion', cost: 25, mpAmount: 30 });
    var weapons = ['Rusty Knife', 'Shiv', 'Broken Bottle', 'Pipe', 'Crowbar',
      'Dungeon Blade', 'Gnawed Club', 'Spiked Bat', 'Goblin Sword', 'Bone Mace'];
    var wname = weapons[Math.floor(Math.random() * Math.min(5 + floor, weapons.length))];
    var wdmg  = 3 + floor + Math.floor(Math.random() * 4);
    stock.push({ name: wname, type: 'weapon', sprite: 'weapon', damage: wdmg, cost: 30 + floor * 10 });
    var armors = ['Torn Shirt', 'Leather Scraps', 'Padded Vest', 'Riveted Jacket',
      'Chain Shirt', 'Dungeon Plate', 'Goblin Mail', 'Bone Armor'];
    var aname = armors[Math.min(Math.floor(floor * 1.5 + Math.random() * 2), armors.length - 1)];
    var adef  = 1 + floor + Math.floor(Math.random() * 3);
    stock.push({ name: aname, type: 'armor', sprite: 'armor', defense: adef, cost: 25 + floor * 8 });
    stock.push({ name: 'Bronze Loot Box', type: 'loot_box', tier: 'bronze', sprite: 'loot_box', cost: 60 });
    stock.push({ name: 'SELL JUNK', type: 'sell_junk', cost: 0 });
    return stock;
  },

  _handleShopBuy: function (idx) {
    var shopData = this.registry.get('shopData');
    if (!shopData) return;
    var item = shopData.stock[idx];
    if (!item) return;

    if (item.type === 'sell_junk') {
      var soldCount = 0, goldEarned = 0;
      var eqWep = this.status.equippedWeapon;
      var eqArm = this.status.equippedArmor;
      this.status.inventory = this.status.inventory.filter(function (i) {
        if (i.type === 'crafting') { soldCount++; goldEarned += 2; return false; }
        if (i.type === 'weapon' && i !== eqWep && eqWep && i.damage < eqWep.damage) { soldCount++; goldEarned += 3; return false; }
        if (i.type === 'armor'  && i !== eqArm && eqArm && i.defense < eqArm.defense) { soldCount++; goldEarned += 3; return false; }
        return true;
      });
      if (soldCount === 0) {
        this.messages.push('TALLY: "YOU HAVE NOTHING WORTH JUNKING. I AM NOT IMPRESSED." NO SALE.');
      } else {
        this.status.gold += goldEarned;
        this.messages.push('TALLY TAKES YOUR JUNK. ' + soldCount + ' ITEM' + (soldCount > 1 ? 'S' : '') + ' SOLD FOR ' + goldEarned + 'G. "PLEASURE DOING BUSINESS."');
      }
      this._markInvDirty();
      this.registry.set('shopData', { stock: shopData.stock, gold: this.status.gold });
      return;
    }

    if (this.status.gold < item.cost) return;
    this.status.gold -= item.cost;

    if (item.type === 'loot_box') {
      this._claimedBoxes.push({ tier: item.tier });
    } else {
      var invItem = { type: item.type, name: item.name, sprite: item.sprite };
      if (item.damage)     invItem.damage     = item.damage;
      if (item.defense)    invItem.defense    = item.defense;
      if (item.healAmount) invItem.healAmount = item.healAmount;
      if (item.mpAmount)   invItem.mpAmount   = item.mpAmount;
      this.status.addItem(invItem);
    }

    this.messages.push(MessageSystem.shopBuy(item.name, item.cost));
    _playPickup();
    this.registry.set('shopData', { stock: shopData.stock, gold: this.status.gold });
    this._markInvDirty();
  },

  _handleDeath: function () {
    if (this._deathHandled) return;
    this._deathHandled = true;

    var scene = this;
    this.carl.getSprite().setVelocity(0, 0);
    this.cameras.main.shake(300, 0.015);
    this.messages.push(MessageSystem.death(this.currentFloor, this.status.kills));

    this.time.delayedCall(2500, function () {
      scene.cameras.main.fadeOut(600, 50, 0, 0);
      scene.time.delayedCall(650, function () {
        var deathData = {
          floor:         scene.currentFloor,
          kills:         scene.status.kills,
          level:         scene.status.level,
          crawlerName:   scene.status.crawlerName,
          crawlerNumber: scene.status.crawlerNumber,
          killer:        scene._lastKiller || 'Unknown',
          xp:            scene.status.xp,
          xpToNext:      scene.status.xpToNext,
          stats:         scene.status.stats,
          views:         scene.status.views,
          followers:     scene.status.followers,
          favorites:     scene.status.favorites,
        };
        SaveSystem.clear();
        // Clear registry so GameScene.init creates a fresh CrawlerStatus on next run
        // (avoids incrementing the crawler number before the player restarts)
        scene.registry.set('status', null);
        scene.registry.set('messages', null);
        scene.scene.stop('UIScene');
        scene.scene.start('DeathScene', deathData);
      });
    });
  },
});

function _dist2(ax, ay, bx, by) {
  var dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// Loot box _contents may be a single item, an array, or absent — always yield an array
function _boxContents(box) {
  if (Array.isArray(box._contents)) return box._contents;
  return box._contents ? [box._contents] : [];
}

// ── Floor decoration painter ──────────────────────────────────────────────────
// Draws a single floor prop at world position (wx,wy) using Phaser Graphics.
// type 0-4: bones, puddle, cracks, rubble, stain
function _drawDecor(gr, wx, wy, type) {
  var ox = wx + 4 + Math.floor(Math.random() * 24);
  var oy = wy + 4 + Math.floor(Math.random() * 24);
  if (type === 0) {
    // Bone fragments — two short white sticks
    gr.fillStyle(0xc8c0a0, 0.55);
    gr.fillRect(ox, oy, 7, 2);
    gr.fillRect(ox + 3, oy - 3, 2, 7);
    gr.fillStyle(0xa09878, 0.4);
    gr.fillRect(ox + 9, oy + 4, 5, 2);
  } else if (type === 1) {
    // Puddle — dark ellipse with sheen
    gr.fillStyle(0x223344, 0.50);
    gr.fillEllipse(ox, oy, 18, 10);
    gr.fillStyle(0x334455, 0.30);
    gr.fillEllipse(ox - 2, oy - 1, 8, 4);
  } else if (type === 2) {
    // Floor cracks — two thin lines
    gr.lineStyle(1, 0x181420, 0.7);
    gr.beginPath();
    gr.moveTo(ox, oy); gr.lineTo(ox + 9, oy + 5); gr.lineTo(ox + 14, oy + 3);
    gr.strokePath();
    gr.beginPath();
    gr.moveTo(ox + 2, oy + 7); gr.lineTo(ox + 7, oy + 10);
    gr.strokePath();
  } else if (type === 3) {
    // Rubble pebbles — scattered dots
    gr.fillStyle(0x6a6070, 0.55);
    for (var i = 0; i < 5; i++) {
      gr.fillRect(ox + Math.floor(Math.random() * 14), oy + Math.floor(Math.random() * 10), 2, 2);
    }
  } else if (type === 4) {
    // Dark stain — irregular blotch
    gr.fillStyle(0x110a18, 0.45);
    gr.fillEllipse(ox, oy, 14, 9);
    gr.fillStyle(0x1a1228, 0.25);
    gr.fillEllipse(ox + 4, oy + 2, 8, 5);
  } else {
    // Sharp rocks — jagged grey-brown shards (Floor 2 hazard underfoot)
    gr.fillStyle(0x8a7a6a, 0.70);
    gr.fillTriangle(ox, oy + 6, ox + 4, oy, ox + 8, oy + 6);
    gr.fillStyle(0x6a5a4a, 0.60);
    gr.fillTriangle(ox + 5, oy + 7, ox + 10, oy + 1, ox + 14, oy + 7);
    gr.fillStyle(0xaa9a8a, 0.40);
    gr.fillTriangle(ox + 1, oy + 1, ox + 3, oy, ox + 3, oy + 2);
    gr.fillTriangle(ox + 6, oy + 2, ox + 9, oy + 1, ox + 9, oy + 3);
  }
}

// ── Floor timer scaling ───────────────────────────────────────────────────────
// Floor 1: 25 min target. Later floors can be tuned separately.
function _getFloorTimerMs(floor) {
  var minutes = floor === 1 ? 25 : Math.max(15, 30 - floor * 2);
  return minutes * 60 * 1000;
}

// ── Module-level audio helpers ───────────────────────────────────────────────

function _playPickup() {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    var t = ctx.currentTime;
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t); osc.stop(t + 0.13);
  } catch (e) {}
}

function _playLevelUp() {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var gain = ctx.createGain();
    gain.connect(ctx.destination);
    var notes = [261, 330, 392, 523];
    notes.forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      osc.connect(gain);
      var t = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.16);
    });
  } catch (e) {}
}

function _playCrit() {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.13);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t); osc.stop(t + 0.16);
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(1100, t);
    osc2.frequency.exponentialRampToValueAtTime(180, t + 0.04);
    gain2.gain.setValueAtTime(0.10, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc2.start(t); osc2.stop(t + 0.06);
  } catch (e) {}
}

function _playDodge() {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.14);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.start(t); osc.stop(t + 0.17);
  } catch (e) {}
}

function _playConsumable(type) {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    if (type === 'stun') {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.start(t); osc.stop(t + 0.12);
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(180, t + 0.06);
      gain2.gain.setValueAtTime(0, t + 0.06);
      gain2.gain.linearRampToValueAtTime(0.07, t + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc2.start(t + 0.06); osc2.stop(t + 0.46);
    } else {
      var osc3 = ctx.createOscillator();
      var gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.connect(gain3); gain3.connect(ctx.destination);
      osc3.frequency.setValueAtTime(280, t);
      osc3.frequency.exponentialRampToValueAtTime(880, t + 0.18);
      gain3.gain.setValueAtTime(0.13, t);
      gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
      osc3.start(t); osc3.stop(t + 0.22);
    }
  } catch (e) {}
}


function _playBossSlam() {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 0.45);
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t); osc.stop(t + 0.52);
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(160, t);
    osc2.frequency.exponentialRampToValueAtTime(45, t + 0.28);
    gain2.gain.setValueAtTime(0.18, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc2.start(t); osc2.stop(t + 0.34);
  } catch (e) {}
}

function _playPhaseTransition() {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    [110, 220, 440, 880].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      gain.gain.setValueAtTime(0.14, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.12);
      osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.13);
    });
  } catch (e) {}
}

function _playDescend() {
  var ctx = GameAudio.getCtx();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.65);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.start(t); osc.stop(t + 0.72);
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(110, t + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(38, t + 0.65);
    gain2.gain.setValueAtTime(0.08, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc2.start(t + 0.1); osc2.stop(t + 0.72);
  } catch (e) {}
}
