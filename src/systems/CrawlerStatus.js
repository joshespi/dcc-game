var DEBUFF_POISON  = 'poison';
var DEBUFF_SEPTIC  = 'septic';
var DEBUFF_TAINT   = 'taint';   // cannot heal by any method for duration

// Tracks Carl's level, stats, HP, XP, inventory — the dungeon's crawler record
var CrawlerStatus = (function () {
  function CrawlerStatus() {
    this.level      = 1;
    this.xp         = 0;
    this.xpToNext   = 100;
    this.maxHp      = 100;
    this.hp         = 100;
    this.floor      = 1;
    this.kills      = 0;
    this.statPoints = 0; // banked points — spend at safe room after floor 3 class selection
    // Assigned on dungeon entry per lore: sequential number + first name + enough surname to be unique
    // Counter persists in localStorage so numbers increment across sessions
    this.crawlerNumber = CrawlerStatus._nextNumber++;
    CrawlerStatus._saveNextNumber();
    this.crawlerName   = 'CARL';
    // DCC stats: STR/CON/DEX/INT/CHA/LUCK
    this.stats    = { str: 5, con: 5, dex: 5, int: 5, cha: 3, luck: 3 };
    this.inventory = [];
    this.hotlist   = new Array(10).fill(null); // 10 quick-use slots, indices 0-9 → keys 1-0
    this.equippedWeapon = null;
    this.equippedArmor  = null;
    this._lastDamageTime = 0;
    this._potionCdUntil  = 0;
    this.tutorialComplete    = false;
    this.firstSafeRoomDone   = false;
    // Social metrics — accumulate during the run; Floor 1 starts with a small seed
    this.views     = 10000 + Math.floor(Math.random() * 5000);
    this.followers = 50 + Math.floor(Math.random() * 20);
    this.favorites = 5;
    this.gold   = 0;
    this.debuffs = [];  // [{ type, expiresAt, tickDamage, tickInterval, lastTick }]
    // Train-by-use skills — level via gameplay, max 15
    this.skills   = { unarmed: 3, melee: 1, endurance: 2, dodge: 1 };
    this.skillXp  = { unarmed: 0, melee: 0, endurance: 0, dodge: 0 };
    // MP pool scales with INT. Regen rate scales with INT per lore.
    // INT*10 gives a workable pool — Donut's Magic Missile costs 10 MP/cast at level 1.
    this.mp    = this.stats.int * 10;
    this.maxMp = this.stats.int * 10;
    this.bossKilledFloor = 0;
    this.hasGoblinPass   = false;
    // Temporary scroll/buff effects — set to 0 by default, non-zero while active
    this._swiftnessUntil   = 0;
    this._ironSkinUntil    = 0;
    this._ironSkinDefense  = 0;
    this._dexBuffUntil     = 0;
  }

  CrawlerStatus.prototype.addXP = function (amount) {
    this.xp += amount;
    var results = [];
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      results.push(this._levelUp());
    }
    return results.length ? results : null;
  };

  CrawlerStatus.prototype._levelUp = function () {
    this.level++;
    this.xpToNext = Math.floor(this.xpToNext * 1.6);
    // maxHp increases on level-up; hp does NOT auto-restore (must heal)
    this.maxHp += 15 + this.stats.con;
    // Bank 3 stat points — player spends them manually at safe room (Floor 3+)
    this.statPoints += 3;
    return { level: this.level };
  };

  function _skillXpNeeded(level) {
    return Math.floor(30 * Math.pow(level, 1.4));
  }

  var VALID_STATS = ['str', 'con', 'dex', 'int', 'cha', 'luck'];

  CrawlerStatus.prototype.spendStatPoint = function (stat) {
    if (this.statPoints <= 0) return false;
    if (VALID_STATS.indexOf(stat) === -1) return false;
    // Lore: stat points bank until Floor 3+ class selection, spent in safe room only
    if (this.floor < 3) return false;
    this.statPoints--;
    this.stats[stat]++;
    if (stat === 'int') this._syncMp();
    if (stat === 'con') {
      this.maxHp += 5;
      this.hp = Math.min(this.hp + 5, this.maxHp);
    }
    return true;
  };

  // Keep maxMp = INT*10; called after any INT change
  CrawlerStatus.prototype._syncMp = function () {
    var newMax = this.stats.int * 10;
    if (newMax > this.maxMp) {
      this.mp += (newMax - this.maxMp);
    }
    this.maxMp = newMax;
    this.mp = Math.min(this.mp, this.maxMp);
  };

  CrawlerStatus.prototype.spendMp = function (amount) {
    if (this.mp < amount) return false;
    this.mp -= amount;
    return true;
  };

  CrawlerStatus.prototype.addViews     = function (n) { this.views     += n; };
  CrawlerStatus.prototype.addFollowers = function (n) { this.followers += n; };
  CrawlerStatus.prototype.addFavorites = function (n) { this.favorites += n; };

  CrawlerStatus.prototype.effectiveDex = function () {
    var bonus = (this._dexBuffUntil && Date.now() < this._dexBuffUntil) ? 1 : 0;
    return this.stats.dex + bonus;
  };

  CrawlerStatus.prototype.regenMp = function (amount) {
    this.mp = Math.min(this.maxMp, this.mp + amount);
  };

  CrawlerStatus.prototype.mpPercent = function () {
    return this.maxMp > 0 ? this.mp / this.maxMp : 0;
  };

  CrawlerStatus.prototype.takeDamage = function (raw) {
    // Defense comes from armor + temporary Iron Skin scroll
    var defense = (this.equippedArmor ? this.equippedArmor.defense : 0)
                + (this._ironSkinDefense || 0);
    var dmg = Math.max(1, raw - defense);
    this.hp = Math.max(0, this.hp - dmg);
    this._lastDamageTime = Date.now();
    return dmg;
  };

  CrawlerStatus.prototype.heal = function (amount) {
    if (this.hasDebuff(DEBUFF_TAINT)) return 0;
    var prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - prev;
  };

  // Returns { skill, level } if leveled up, null otherwise
  CrawlerStatus.prototype.addSkillXP = function (skill, amount) {
    if (!(skill in this.skills)) return null;
    this.skillXp[skill] = (this.skillXp[skill] || 0) + amount;
    if (this.skills[skill] >= 15) return null;
    var needed = _skillXpNeeded(this.skills[skill]);
    if (this.skillXp[skill] >= needed) {
      this.skillXp[skill] -= needed;
      this.skills[skill]++;
      if (skill === 'endurance') { this.maxHp += 3; this.hp = Math.min(this.hp + 3, this.maxHp); }
      return { skill: skill, level: this.skills[skill] };
    }
    return null;
  };

  CrawlerStatus.prototype.skillXpPercent = function (skill) {
    var lvl = this.skills[skill] || 0;
    if (lvl >= 15) return 1;
    return (this.skillXp[skill] || 0) / _skillXpNeeded(lvl);
  };

  CrawlerStatus.prototype.getMeleeDamage = function () {
    var base = 5 + Math.floor(this.stats.str * 1.5);
    var bonus = this.equippedWeapon ? this.equippedWeapon.damage : 0;
    var skillLvl = this.equippedWeapon ? this.skills.melee : this.skills.unarmed;
    return base + bonus + skillLvl + Math.floor(Math.random() * 4);
  };

  CrawlerStatus.prototype.getSpellPower = function () {
    // INT drives missile damage; CHA gives Donut a small bonus
    return 8 + Math.floor(this.stats.int * 2) + Math.floor(this.stats.cha / 3);
  };

  CrawlerStatus.prototype.addItem = function (item) {
    if (item.type === 'gold') {
      this.gold += item.amount || 1;
      return 'gold';
    }
    this.inventory.push(item);
    if (item.type === 'weapon') {
      if (!this.equippedWeapon || item.damage > this.equippedWeapon.damage) {
        this.equippedWeapon = item;
        return 'equipped';
      }
    }
    if (item.type === 'armor') {
      if (!this.equippedArmor || item.defense > this.equippedArmor.defense) {
        this.equippedArmor = item;
        return 'equipped';
      }
    }
    // Potions, mana potions, and consumables auto-fill first empty hotlist slot
    if (item.type === 'potion' || item.type === 'mana_potion' || item.type === 'consumable') this._autoHotlist(item);
    return 'added';
  };

  CrawlerStatus.prototype._autoHotlist = function (item) {
    for (var i = 0; i < this.hotlist.length; i++) {
      if (this.hotlist[i] === null) { this.hotlist[i] = item; return; }
    }
  };

  // Manual assign: put item at slot (0-9). Clears any previous occupant.
  CrawlerStatus.prototype.hotlistAssign = function (slot, item) {
    if (slot < 0 || slot > 9) return false;
    // Remove item from any existing slot first
    for (var i = 0; i < this.hotlist.length; i++) {
      if (this.hotlist[i] === item) this.hotlist[i] = null;
    }
    this.hotlist[slot] = item;
    return true;
  };

  CrawlerStatus.prototype.hotlistClear = function (slot) {
    if (slot < 0 || slot > 9) return;
    this.hotlist[slot] = null;
  };

  // Use item in slot — returns { used: bool, healed: number }
  CrawlerStatus.prototype.hotlistUse = function (slot) {
    var item = this.hotlist[slot];
    if (!item) return { used: false, healed: 0 };
    if (item.type === 'potion') {
      if (this.potionOnCooldown()) return { used: false, healed: 0, onCooldown: true };
      var idx = this.inventory.indexOf(item);
      if (idx === -1) { this.hotlist[slot] = null; return { used: false, healed: 0 }; }
      this.inventory.splice(idx, 1);
      // Crafted bandages carry a fixed healAmount; real potions use the level-scaled formula
      var healAmt = item.healAmount != null ? item.healAmount : this._potionHeal();
      var healed = this.heal(healAmt);
      this._potionCdUntil = Date.now() + this.potionCooldownMs();
      this.hotlist[slot] = null;
      var next = this._findInInventory('potion');
      if (next) this.hotlist[slot] = next;
      return { used: true, healed: healed };
    }
    if (item.type === 'mana_potion') {
      var midx = this.inventory.indexOf(item);
      if (midx === -1) { this.hotlist[slot] = null; return { used: false, healed: 0 }; }
      this.inventory.splice(midx, 1);
      var mpAmt = item.mpAmount != null ? item.mpAmount : 30;
      this.regenMp(mpAmt);
      this.hotlist[slot] = null;
      var nextMp = this._findInInventory('mana_potion');
      if (nextMp) this.hotlist[slot] = nextMp;
      return { used: true, healed: 0, mpRestored: mpAmt };
    }
    if (item.type === 'consumable') {
      var cidx = this.inventory.indexOf(item);
      if (cidx === -1) { this.hotlist[slot] = null; return { used: false, healed: 0 }; }
      this.inventory.splice(cidx, 1);
      this.hotlist[slot] = null;
      var nextC = this._findInInventory('consumable');
      if (nextC) this.hotlist[slot] = nextC;
      return { used: true, healed: 0, consumable: item };
    }
    return { used: false, healed: 0 };
  };

  CrawlerStatus.prototype._findInInventory = function (type) {
    for (var i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].type === type) return this.inventory[i];
    }
    return null;
  };

  CrawlerStatus.prototype._potionHeal = function () {
    return 30 + this.level * 5 + this.stats.con;
  };

  // CON 6 = 15s (Carl's confirmed lore cooldown), CON 2 = 95s (~Donut's 2-min lore cooldown)
  CrawlerStatus.prototype.potionCooldownMs = function () {
    return Math.max(10000, 135000 - 20000 * this.stats.con);
  };

  CrawlerStatus.prototype.potionOnCooldown = function () {
    return Date.now() < this._potionCdUntil;
  };

  CrawlerStatus.prototype.potionCooldownRemainSec = function () {
    return Math.ceil(Math.max(0, this._potionCdUntil - Date.now()) / 1000);
  };

  CrawlerStatus.prototype.usePotion = function () {
    if (this.potionOnCooldown()) return 0;
    var idx = -1;
    for (var i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].type === 'potion') { idx = i; break; }
    }
    if (idx === -1) return 0;
    var item = this.inventory.splice(idx, 1)[0];
    var healAmt = item.healAmount != null ? item.healAmount : this._potionHeal();
    this._potionCdUntil = Date.now() + this.potionCooldownMs();
    return this.heal(healAmt);
  };

  CrawlerStatus.prototype.hasPotions = function () {
    return this.inventory.some(function (i) { return i.type === 'potion'; });
  };

  CrawlerStatus.prototype.countPotions = function () {
    var n = 0;
    for (var i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].type === 'potion') n++;
    }
    return n;
  };

  CrawlerStatus.prototype.countCraftingMat = function (name) {
    var n = 0;
    for (var i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].type === 'crafting' && this.inventory[i].name === name) n++;
    }
    return n;
  };

  // Remove up to `count` crafting mats with given name. Returns true if all removed.
  CrawlerStatus.prototype.consumeCraftingMats = function (name, count) {
    var removed = 0;
    for (var i = this.inventory.length - 1; i >= 0 && removed < count; i--) {
      if (this.inventory[i].type === 'crafting' && this.inventory[i].name === name) {
        this.inventory.splice(i, 1);
        removed++;
      }
    }
    return removed === count;
  };

  // ── Debuff system ─────────────────────────────────────────────────────────

  CrawlerStatus.prototype.applyDebuff = function (type, durationMs, tickDamage, tickIntervalMs) {
    // Refresh duration if already active
    for (var i = 0; i < this.debuffs.length; i++) {
      if (this.debuffs[i].type === type) {
        this.debuffs[i].expiresAt = Date.now() + durationMs;
        return;
      }
    }
    this.debuffs.push({
      type:         type,
      expiresAt:    Date.now() + durationMs,
      tickDamage:   tickDamage    || 0,
      tickInterval: tickIntervalMs || 1000,
      lastTick:     Date.now(),
    });
  };

  // Returns damage dealt this tick (for float text). Removes expired.
  CrawlerStatus.prototype.tickDebuffs = function () {
    var now = Date.now();
    var totalDmg = 0;
    for (var i = this.debuffs.length - 1; i >= 0; i--) {
      var d = this.debuffs[i];
      if (now > d.expiresAt) { this.debuffs.splice(i, 1); continue; }
      if (d.tickDamage > 0 && now - d.lastTick >= d.tickInterval) {
        d.lastTick = now;
        totalDmg += d.tickDamage;
      }
    }
    if (totalDmg > 0) {
      this.hp = Math.max(0, this.hp - totalDmg);
      this._lastDamageTime = now;
    }
    return totalDmg;
  };

  CrawlerStatus.prototype.hasDebuff = function (type) {
    var now = Date.now();
    for (var i = 0; i < this.debuffs.length; i++) {
      if (this.debuffs[i].type === type && this.debuffs[i].expiresAt > now) return true;
    }
    return false;
  };

  CrawlerStatus.prototype.isDead = function () { return this.hp <= 0; };
  CrawlerStatus.prototype.xpPercent = function () { return this.xp / this.xpToNext; };
  CrawlerStatus.prototype.hpPercent = function () { return this.hp / this.maxHp; };

  CrawlerStatus.prototype.serialize = function () {
    // Hotlist stores refs into inventory — save as inventory indices
    var self = this;
    var hotlistIndices = this.hotlist.map(function (item) {
      if (!item) return null;
      var idx = self.inventory.indexOf(item);
      return idx >= 0 ? idx : null;
    });
    return {
      level:         this.level,
      xp:            this.xp,
      xpToNext:      this.xpToNext,
      maxHp:         this.maxHp,
      hp:            this.hp,
      kills:         this.kills,
      statPoints:    this.statPoints,
      crawlerNumber: this.crawlerNumber,
      crawlerName:   this.crawlerName,
      stats:         Object.assign({}, this.stats),
      inventory:     this.inventory.slice(),
      hotlistIndices: hotlistIndices,
      equippedWeaponIdx: this.equippedWeapon ? this.inventory.indexOf(this.equippedWeapon) : null,
      equippedArmorIdx:  this.equippedArmor  ? this.inventory.indexOf(this.equippedArmor)  : null,
      mp:               this.mp,
      maxMp:            this.maxMp,
      tutorialComplete:  this.tutorialComplete,
      firstSafeRoomDone: this.firstSafeRoomDone,
      views:     this.views,
      followers: this.followers,
      favorites: this.favorites,
      gold:      this.gold,
      skills:    Object.assign({}, this.skills),
      skillXp:   Object.assign({}, this.skillXp),
      bossKilledFloor: this.bossKilledFloor || 0,
      hasGoblinPass:   this.hasGoblinPass   || false,
    };
  };

  CrawlerStatus.restore = function (data) {
    // Bypass the constructor so _nextNumber isn't incremented for a restored crawler
    var s = Object.create(CrawlerStatus.prototype);
    s._lastDamageTime = 0;
    s._potionCdUntil  = 0;
    s.debuffs = [];
    s.level         = data.level;
    s.xp            = data.xp;
    s.xpToNext      = data.xpToNext;
    s.maxHp         = data.maxHp;
    s.hp            = data.hp;
    s.floor         = data.floor;
    s.kills         = data.kills;
    s.statPoints    = data.statPoints;
    s.crawlerNumber = data.crawlerNumber;
    s.crawlerName   = data.crawlerName;
    s.stats         = Object.assign({}, data.stats);
    s.inventory     = data.inventory.slice();
    s.mp              = data.mp;
    s.maxMp           = data.maxMp;
    s.tutorialComplete    = data.tutorialComplete    || false;
    s.firstSafeRoomDone   = data.firstSafeRoomDone   || false;
    s.views     = data.views     || 10000;
    s.followers = data.followers || 50;
    s.favorites = data.favorites || 5;
    s.gold      = data.gold      || 0;
    s.skills  = Object.assign({ unarmed: 3, melee: 1, endurance: 2, dodge: 1 }, data.skills  || {});
    s.skillXp = Object.assign({ unarmed: 0, melee: 0, endurance: 0, dodge: 0 }, data.skillXp || {});
    s.bossKilledFloor    = data.bossKilledFloor || 0;
    s.hasGoblinPass      = data.hasGoblinPass   || false;
    // Scroll buffs don't persist across save/load (they'd have expired anyway)
    s._swiftnessUntil   = 0;
    s._ironSkinUntil    = 0;
    s._ironSkinDefense  = 0;
    s._dexBuffUntil     = 0;
    s.equippedWeapon = data.equippedWeaponIdx != null ? s.inventory[data.equippedWeaponIdx] : null;
    s.equippedArmor  = data.equippedArmorIdx  != null ? s.inventory[data.equippedArmorIdx]  : null;
    s.hotlist = (data.hotlistIndices || []).map(function (idx) {
      return idx != null ? s.inventory[idx] : null;
    });
    return s;
  };

  return CrawlerStatus;
})();

CrawlerStatus.SKILL_LABELS = { unarmed: 'UNARMED COMBAT', melee: 'MELEE', endurance: 'ENDURANCE', dodge: 'DODGE' };

CrawlerStatus.prototype.attackSkillName = function () {
  return this.equippedWeapon ? 'melee' : 'unarmed';
};

// Sequential crawler numbers persist across browser sessions via localStorage
CrawlerStatus._nextNumber = (function () {
  try { return parseInt(localStorage.getItem('dcc_crawler_seq') || '1', 10); } catch (e) { return 1; }
})();
CrawlerStatus._saveNextNumber = function () {
  try { localStorage.setItem('dcc_crawler_seq', String(CrawlerStatus._nextNumber)); } catch (e) {}
};
