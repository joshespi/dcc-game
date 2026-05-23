// Shared number formatter — T/B/M/K abbreviation, one decimal
function _fmtN(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
  return String(Math.floor(n));
}

// DCC-flavored dungeon AI message system — voice: Borant Corporation System AI (Cascadia)
var MessageSystem = (function () {
  function MessageSystem() {
    this._queue    = [];
    this._history  = [];
    this._handlers = [];
  }

  MessageSystem.prototype.push = function (text, type) {
    var msg = { text: text, type: type || 'system', ts: Date.now() };
    this._queue.push(msg);
    this._history.push(msg);
    this._handlers.forEach(function (h) { h(msg); });
  };

  MessageSystem.prototype.onMessage = function (fn) {
    this._handlers.push(fn);
  };

  MessageSystem.prototype.pop = function () {
    return this._queue.shift() || null;
  };

  MessageSystem.prototype.hasMessages = function () {
    return this._queue.length > 0;
  };

  // ── Floor name registry (DCC lore-accurate) ───────────────────────────────

  MessageSystem.floorName = function (floor) {
    // Canon names from wiki — floors 1 and 2 have no confirmed name
    var names = {
      3:  'THE OVER CITY',
      4:  'THE IRON TANGLE',
      5:  'THE BUBBLES',
      6:  'THE HUNTING GROUNDS',
      7:  'THE GREAT RACE',
      8:  'THE GHOSTS OF EARTH',
      9:  'FACTION WARS',
      11: 'A PARADE OF HORRIBLES',
      12: 'THE HALLS OF ASCENDANCY',
      15: 'SHEOL',
      16: 'AGONY OF MIRRORS',
      17: 'THE BACKSTAGE DEATH MAZE',
      18: "SCOLOPENDRA'S LAIR",
    };
    return names[floor] || 'FLOOR ' + floor;
  };

  // ── Static message factories — Borant Corporation System AI voice ──────────

  MessageSystem.newCrawler = function (number, name) {
    return 'YOU HAVE BEEN DESIGNATED CRAWLER #' + number + '. YOUR CRAWLER NAME IS "' + name + '". COMPANION: DONUT. BORANT CORPORATION WISHES YOU A PROFITABLE CRAWL.';
  };

  MessageSystem.floorEnter = function (floor) {
    var name = MessageSystem.floorName(floor);
    var lines = [
      'ENTERING ' + name + '. ESTIMATED SURVIVAL RATE: POOR.',
      'DESCENDING TO ' + name + '. LOCAL FAUNA HAS BEEN NOTIFIED.',
      name + ' ACCESSED. BORANT RATES YOUR ODDS AS COMMERCIALLY UNVIABLE.',
      'WELCOME TO ' + name + '. COMBAT RECOMMENDED. FLEEING ALSO AN OPTION.',
      'ENTERING ' + name + '. THE SYSTEM NOTES YOUR CONTINUED EXISTENCE. SURPRISING.',
    ];
    return lines[(floor - 1) % lines.length];
  };

  MessageSystem.levelUp = function (level, bankedPoints) {
    var lines = [
      'LEVEL ' + level + '. +3 STAT POINTS BANKED. ALLOCATE IN A SAFE ROOM.',
      'CRAWLER CARL ADVANCES TO LEVEL ' + level + '. ' + bankedPoints + ' STAT POINTS UNSPENT.',
      'LEVEL ' + level + ' ACHIEVED. BORANT UPDATES YOUR MARKET VALUE. SPEND YOUR POINTS.',
    ];
    return lines[level % lines.length];
  };

  MessageSystem.kill = function (enemyName, xp) {
    var lines = [
      enemyName.toUpperCase() + ' ELIMINATED. +' + xp + ' XP AWARDED BY BORANT CORPORATION.',
      enemyName.toUpperCase() + ' DEFEATED. +' + xp + ' XP. THE SYSTEM NOTES YOUR BRUTALITY.',
      enemyName.toUpperCase() + ' DISPATCHED. +' + xp + ' XP. DONUT LOOKS SMUG.',
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  };

  MessageSystem.loot = function (itemName) {
    return 'ACHIEVEMENT REWARD: ' + itemName.toUpperCase() + '. ALWAYS READ THE DESCRIPTION BEFORE USE.';
  };

  MessageSystem.potion = function (amount) {
    return 'POTION CONSUMED. +' + amount + ' HP. DONUT JUDGES YOUR LIFE CHOICES.';
  };

  MessageSystem.stairsFound = function (floor) {
    var nextName = MessageSystem.floorName(floor + 1);
    return 'STAIRWELL UNSEALED. PRESS [E] NEAR EXIT TO DESCEND TO ' + nextName + '. THERE IS NO GOING BACK.';
  };

  MessageSystem.stairsLocked = function (floor) {
    var lines = [
      'STAIRWELL SEALED. BORANT CORPORATION ADVISES PATIENCE. OR VIOLENCE.',
      'EXIT LOCKED. THE DUNGEON IS NOT DONE WITH YOU YET.',
      'STAIRWELL INACCESSIBLE. BORANT NOTES YOU TRIED THE DOOR. POINTS FOR ENTHUSIASM.',
    ];
    return lines[floor % lines.length];
  };

  MessageSystem.donutSpell = function (spellName) {
    var map = {
      magic_missile: 'DONUT SAYS "EXCUSE ME" AND FIRES A MAGIC MISSILE.',
      heal:          'DONUT ACTIVATES HEALING PURR. "YOU\'RE WELCOME," SHE ADDS.',
      shriek:        'DONUT UNLEASHES PRINCESS\'S SHRIEK. EARS MAY BE DAMAGED.',
    };
    return map[spellName] || 'DONUT DOES SOMETHING. THE SYSTEM DECLINES TO ELABORATE.';
  };

  MessageSystem.carlDamaged = function (amount, source) {
    if (amount > 20) return 'CARL TAKES ' + amount + ' DAMAGE FROM ' + source.toUpperCase() + '. BORANT NOTES YOUR SUFFERING.';
    return '';
  };

  MessageSystem.noHeal = function () {
    return 'NO POTIONS REMAINING. BORANT CORPORATION SENDS ITS CONDOLENCES.';
  };

  MessageSystem.shopBuy = function (itemName, cost) {
    var lines = [
      'TRANSACTION COMPLETE. TALLY WAVES GOODBYE WITHOUT MOVING ANY MUSCLES.',
      'ITEM ACQUIRED. TALLY NOTED YOUR SELECTION. TALLY NOTES EVERYTHING.',
      'PURCHASE LOGGED. TALLY SMELLS LIKE WET MOSS AND DOES NOT APOLOGIZE FOR IT.',
    ];
    return itemName.toUpperCase() + ' — ' + cost + 'G. ' + lines[Math.floor(Math.random() * lines.length)];
  };

  MessageSystem.donutCooldown = function () {
    return 'DONUT IS RECHARGING. SHE IS ON A SCHEDULE AND DOES NOT APPRECIATE RUSHING.';
  };

  MessageSystem.noMp = function () {
    return 'INSUFFICIENT MANA. DONUT STARES AT YOU JUDGMENTALLY.';
  };

  MessageSystem.bossHoarderTaunt = function (phase) {
    var p1 = [
      '"I WAS HERE FIRST! ALL OF THIS IS MINE!" — THE HOARDER',
      '"YOU CANNOT HAVE MY THINGS! ANY OF MY THINGS!" — THE HOARDER',
      '"MINE. MINE. MINE. MINE." — THE HOARDER',
      '"NO ONE TAKES FROM THE HOARDER. NO ONE EVER HAS." — THE HOARDER',
      '"I HAVE THIRTY-SEVEN GOBLIN SWORDS. I DO NOT EVEN HAVE ARMS." — THE HOARDER',
      '"I HAVE COLLECTED EVERYTHING. YOU ARE JUST ANOTHER THING TO COLLECT." — THE HOARDER',
    ];
    var p2 = [
      '"I WILL NOT LET YOU TAKE IT! I WILL NOT!" — THE HOARDER',
      '"EVERYTHING I HAVE — YOU WILL NOT HAVE IT! DO YOU HEAR ME?!" — THE HOARDER',
      '"MY COLLECTION. MY BEAUTIFUL COLLECTION." — THE HOARDER',
      '"YOU ARE THE WORST THING THAT HAS EVER HAPPENED TO ME." — THE HOARDER',
    ];
    var pool = (phase >= 2) ? p2 : p1;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  MessageSystem.viewsMilestone = function (views) {
    var fmt = _fmtN(views);
    var lines = {
      50000:    'VIEWER MILESTONE: ' + fmt + ' VIEWS. BORANT CORPORATION NOTES THE INTEREST.',
      100000:   'VIEWER MILESTONE: ' + fmt + ' VIEWS. ADVERTISING RATES ADJUSTING. STAY ALIVE.',
      250000:   'VIEWER MILESTONE: ' + fmt + ' VIEWS. YOUR SURVIVAL IS COMMERCIALLY RELEVANT.',
      500000:   'VIEWER MILESTONE: ' + fmt + ' VIEWS. BORANT CONGRATULATES ITSELF. YOU ARE INCIDENTAL TO THIS.',
      1000000:  'VIEWER MILESTONE: ' + fmt + ' VIEWS. THE RECAP EPISODE IS ALREADY IN PRODUCTION.',
      2500000:  'VIEWER MILESTONE: ' + fmt + ' VIEWS. BORANT NOTES THAT DONUT HAS MORE FOLLOWERS. THIS IS NORMAL.',
      5000000:  'VIEWER MILESTONE: ' + fmt + ' VIEWS. "WE DO NOT DISCUSS THE NUMBERS." — BORANT SPOKESPERSON, ON THE NUMBERS.',
      10000000: 'VIEWER MILESTONE: ' + fmt + ' VIEWS. BORANT LEGAL HAS REVIEWED THIS MESSAGE. IT CONTAINS NO INFORMATION.',
    };
    return lines[views] || ('VIEWER MILESTONE: ' + fmt + ' VIEWS. BORANT WISHES YOU CONTINUED SURVIVAL.');
  };

  MessageSystem.followersMilestone = function (followers) {
    return 'FOLLOWER MILESTONE: ' + _fmtN(followers) + ' FOLLOWERS. PEOPLE ARE INVESTED IN YOUR DEATH OR SURVIVAL. UNCLEAR WHICH.';
  };

  MessageSystem.death = function (floor, kills) {
    return 'CARL HAS DIED ON FLOOR ' + floor + ' WITH ' + kills + ' KILLS. BORANT THANKS YOU FOR YOUR PARTICIPATION.';
  };

  // Donut's in-character reactions
  MessageSystem.safeRoomEnter = function (name, isFirstVisit) {
    if (isFirstVisit) {
      var lines = [
        name + ' DETECTED. SAFE ZONE PROTOCOLS ACTIVE. BORANT REMINDS YOU: NO REFUNDS.',
        'ENTERING ' + name + '. HOSTILITIES SUSPENDED. ENJOY YOUR STAY. BORANT IS WATCHING.',
        name + ' ACCESSED. HEALTH REGENERATION SUSPENDED. AMBIANCE: COMPLIMENTARY.',
        'WELCOME TO ' + name + '. BORANT CORPORATION RATES THIS ESTABLISHMENT: ADEQUATE.',
      ];
      return lines[Math.floor(Math.random() * lines.length)];
    }
    var revisit = [
      'RETURNING TO ' + name + '. THE SYSTEM NOTES YOUR LACK OF PROGRESS.',
      name + ' AGAIN. BORANT EXPRESSES MILD DISAPPOINTMENT.',
      'BACK AT ' + name + '. THE STAFF PRETENDS NOT TO RECOGNIZE YOU.',
    ];
    return revisit[Math.floor(Math.random() * revisit.length)];
  };

  MessageSystem.safeRoomTV = function (name) {
    var screens = {
      'WAFFLE HOUSE':          '"SCATTERED, SMOTHERED, COVERED." THE TV SHOWS A NATURE DOCUMENTARY ABOUT WASPS.',
      'ALABAMA TACO BELL':     'THE TV ADVERTISES A CHALUPA. THE CHALUPA DOES NOT EXIST IN THE DUNGEON.',
      'DMV WAITING ROOM':      'NOW SERVING: NUMBER 4,847. THE COUNTER SHOWS NUMBER 4,846. THE ATTENDANT IS A SKELETON.',
      "CARL'S JR.":            'THE TV PLAYS A CARL\'S JR. AD. CARL IS BRIEFLY UNSETTLED.',
      'BIG UGLY\'S BAR & GRILL': 'THE SPECIALS BOARD READS: "MEATLOAF. JUST MEATLOAF." THE CHALK IS PERMANENT.',
      'THE GOLDEN CORAL':      'THE SNEEZE GUARD IS STILL UP. NO ONE IS SURE WHY.',
      'CRACKER BARREL #47':    'THE GIFT SHOP IS FULLY STOCKED. NOTHING IS FOR SALE. DONUT EYES A DECORATIVE ROOSTER.',
      'DENNYS':                'THE MENU IS LAMINATED. THE LAMINATION IS STRUCTURAL. THIS DENNY\'S HAS ALWAYS EXISTED.',
      'BOJANGLES':             '"BO KNOWS." THE TV DOES NOT ELABORATE.',
      'DOLLAR GENERAL':        'THREE OF EVERYTHING. NONE OF WHAT YOU NEED.',
      'FAMILY DOLLAR':         'THE CHECKOUT LINE HAS ONE REGISTER. IT IS CLOSED.',
      'THE PIGGLY WIGGLY':     'THE PA SYSTEM ANNOUNCES A BLUE LIGHT SPECIAL. THERE IS NO BLUE LIGHT.',
      'HARDEES':               'THE FRYER IS ON. THE FRYER HAS ALWAYS BEEN ON.',
      'STEAK N SHAKE':         'THE MILKSHAKE MACHINE IS BROKEN. CARL IS NOT SURPRISED.',
      'IHOP':                  'THE MENU IS 47 PAGES. PANCAKES ARE ON PAGE 38.',
      'SBARRO':                'A SINGLE SLICE OF PIZZA HAS BEEN ROTATING IN THE HEAT LAMP SINCE BEFORE THE DUNGEON SEALED.',
    };
    return screens[name] || 'THE TV DISPLAYS STATIC. A FAINT SHAPE IS VISIBLE. DONUT REFUSES TO DESCRIBE IT.';
  };

  // Tutorial Guild Hall dialog — Mordecai (skyfowl, Borant Corp liaison, Floor 1 avatar)
  // Lore-accurate: formally constrained, but quietly on Carl's side. Guarded warmth.
  MessageSystem.tutorialStep = function (step) {
    var steps = [
      'MORDECAI: "CRAWLER. TUTORIAL GUILD HALL. I WILL BE BRIEF. I AM REQUIRED TO BE BRIEF."',
      'MORDECAI: "YOUR WETWARE IS NOW ACTIVE. HUD SYSTEMS COMING ONLINE. TRY NOT TO PANIC."',
      'MORDECAI: "BARS AT TOP-LEFT: HP IS RED. MP IS BLUE. XP IS GOLD. NONE OF THEM SHOULD REACH ZERO."',
      'MORDECAI: "WASD TO MOVE. SPACE TO PUNCH OR KICK. Q FIRES DONUT\'S SPELL. E OPENS LOOT AND INTERACTS."',
      'MORDECAI: "I IS INVENTORY. STAT POINTS BANK ON LEVEL-UP. SPEND THEM IN A SAFE ROOM. FLOOR 3 ONWARDS."',
      'MORDECAI: "THIS IS DONUT. DUNGEON FAMILIAR. CATEGORY: PRINCESS CAT. SHE WILL HELP YOU. LISTEN TO HER."',
      'MORDECAI: "I AM PLACING A HEAL ABILITY IN YOUR HOTLIST. DONUT MANAGES IT. STAY OUT OF HER WAY."',
      'MORDECAI: "TAKE THE SUPPLIES. I AM GIVING YOU THIS BECAUSE IT IS MY JOB. NOT FOR ANY OTHER REASON."',
      'MORDECAI: "MENUS UNLOCKED. FIND THE STAIRS. AVOID DOING ANYTHING THAT WOULD REQUIRE ME TO INTERVENE."',
      'SYSTEM: TUTORIAL COMPLETE. FULL HUD ACCESS GRANTED. MORDECAI IS NOW YOUR FLOOR GUIDE.',
    ];
    return steps[step] || '';
  };

  MessageSystem.guildGuide = function () {
    var lines = [
      'MORDECAI: "STILL ALIVE. GOOD."',
      'MORDECAI: "I CANNOT TELL YOU WHAT IS DOWN THERE. I CAN TELL YOU TO BE CAREFUL."',
      'MORDECAI: "DONUT. KEEP HER HEALTHY. I MEAN THAT."',
      'MORDECAI: "YOU ARE DOING BETTER THAN MOST. I AM NOT SUPPOSED TO SAY THAT."',
      'MORDECAI: "STAY AWAY FROM THE GLOWING ONES. THAT IS ALL I CAN OFFER."',
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  };

  MessageSystem.donutReaction = function (type) {
    var reactions = {
      carl_hurt: [
        '"CARL!" - DONUT',
        '"CARL, THIS IS UNACCEPTABLE." - DONUT',
        '"CARL." - DONUT',
        '"I SWEAR, IF YOU DIE I AM EATING YOUR BODY." - DONUT',
        '"THAT LOOKED LIKE IT HURT. GOOD." - DONUT',
      ],
      many_enemies: [
        '"THIS IS AN OUTRAGE." - DONUT',
        '"CARL. CARL. CARL." - DONUT',
        '"I AM NOT AMUSED." - DONUT',
        '"THERE ARE A LOT OF THEM." - DONUT',
        '"I BLAME YOU FOR THIS." - DONUT',
      ],
      low_hp: [
        '"CARL, I SWEAR TO THE PRINCESS." - DONUT',
        '"THIS IS UNACCEPTABLE." - DONUT',
        '"CARL. POTION. NOW." - DONUT',
        '"IF YOU DIE I AM TAKING THE JACKET." - DONUT',
      ],
      kill: [
        '"GOOD." - DONUT',
        '"ABOUT TIME." - DONUT',
        '"HMPH." - DONUT',
        '"ACCEPTABLE." - DONUT',
        '"THAT ONE HAD IT COMING." - DONUT',
        '"DID YOU SEE THAT? I HELPED." - DONUT',
        '"..." - DONUT',
      ],
      spell_cast: [
        '"YOU\'RE WELCOME." - DONUT',
        '"MAGIC MISSILE." - DONUT',
        '"I AM EXTREMELY POWERFUL." - DONUT',
        '"THAT WAS MY GOOD EYE." - DONUT',
        '"PRESS Q AGAIN. I DARE YOU." - DONUT',
      ],
      loot: [
        '"FINALLY, SOMETHING WORTHY." - DONUT',
        '"ACCEPTABLE." - DONUT',
        '"READ THE DESCRIPTION, CARL." - DONUT',
        '"IS ANY OF THAT FOR ME?" - DONUT',
        '"I COULD USE A BRUSH." - DONUT',
      ],
      safe_room: [
        '"I COULD GET USED TO THIS." - DONUT',
        '"ACCEPTABLE ESTABLISHMENT." - DONUT',
        '"THE WIFI PASSWORD IS \'PRINCESS\'." - DONUT',
        '"DON\'T GET COMFORTABLE." - DONUT',
        '"THIS SMELLS LIKE WAFFLE HOUSE. I HAVE OPINIONS ABOUT THAT." - DONUT',
        '"I AM GOING TO SIT HERE AND YOU ARE NOT GOING TO RUSH ME." - DONUT',
      ],
      level_up: [
        '"NATURALLY." - DONUT',
        '"YOU\'RE WELCOME. I CARRIED THIS." - DONUT',
        '"STRONGER. GOOD. I NEED MORE FROM YOU." - DONUT',
        '"DO NOT LET THIS GO TO YOUR HEAD." - DONUT',
      ],
      idle: [
        '"CARL." - DONUT',
        '"ARE WE MOVING OR NOT." - DONUT',
        '"I AM BORED. THIS IS YOUR FAULT." - DONUT',
        '"THE DUNGEON IS NOT GOING TO CRAWL ITSELF." - DONUT',
        '"I SAW SOMETHING MOVE OVER THERE. JUST SAYING." - DONUT',
        '"CARL. CARL. CARL. CARL." - DONUT',
      ],
      no_mp: [
        '"I\'M RECHARGING. DON\'T RUSH ME." - DONUT',
        '"I NEED A MOMENT." - DONUT',
        '"MY EYES ARE TIRED." - DONUT',
      ],
      exploration: [
        '"THIS PLACE IS DISGUSTING." - DONUT',
        '"I HAVE BEEN IN NICER LITTER BOXES." - DONUT',
        '"THEY COULD AT LEAST VACUUM." - DONUT',
        '"I SMELL SOMETHING. MIGHT BE AN ENEMY. MIGHT BE YOU." - DONUT',
        '"THERE IS SOMETHING AROUND THAT CORNER. I KNOW BECAUSE I AM A CAT." - DONUT',
      ],
      crit: [
        '"NICE." - DONUT',
        '"THAT ONE COUNTS." - DONUT',
        '"CARL! THAT WAS GOOD." - DONUT',
        '"I KNEW YOU HAD IT IN YOU." - DONUT',
        '"LUCKY. BUT I WILL TAKE IT." - DONUT',
      ],
      dodge: [
        '"DID YOU SEE THAT? HE MOVED." - DONUT',
        '"NOT DEAD YET." - DONUT',
        '"I KNEW HE COULD DO THAT." - DONUT',
        '"CARL." - DONUT',
      ],
      consumable: [
        '"THAT IS WHAT THOSE ARE FOR." - DONUT',
        '"I CANNOT SEE ANYTHING." - DONUT',
        '"USEFUL. GOOD CARL." - DONUT',
        '"SMOKE. ALWAYS SMOKE WITH HIM." - DONUT',
      ],
      descend: [
        '"DEEPER. WONDERFUL." - DONUT',
        '"I HAVE A BAD FEELING ABOUT THIS." - DONUT',
        '"IF SOMETHING WORSE IS DOWN THERE I AM BLAMING YOU." - DONUT',
        '"GOING DOWN. THERE IS A METAPHOR HERE." - DONUT',
        '"I AM GOING TO NEED MORE SNACKS." - DONUT',
      ],
      craft: [
        '"THAT IS COMPETENT." - DONUT',
        '"YOU MADE A THING. GOOD." - DONUT',
        '"I COULD DO THAT. I CHOOSE NOT TO." - DONUT',
        '"THE SMELL. NOSTALGIC." - DONUT',
        '"FUNCTIONAL. DO NOT LET IT GO TO YOUR HEAD." - DONUT',
      ],
      heal_surge: [
        '"FINE. YOU\'RE WELCOME." - DONUT',
        '"I AM NOT A NURSE. THIS IS A ONE-TIME THING." - DONUT',
        '"PURRING. BEGRUDGINGLY." - DONUT',
        '"YOU NEED TO STOP GETTING HIT." - DONUT',
        '"I DID THAT BECAUSE I CHOSE TO. NOT FOR YOU." - DONUT',
      ],
    };
    var pool = reactions[type] || ['"..." - DONUT'];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  return MessageSystem;
})();
