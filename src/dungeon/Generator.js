// Floor 1 dungeon generator — city-grid layout
// Wide straight arteries divide the map into city blocks.
// Each block contains a neighborhood carved from maze-like alleyways.
// Safe rooms appear at artery intersections.
var DungeonGenerator = (function () {
  var FLOOR = 0, WALL = 1, STAIRS = 2, DOOR = 3, START = 4, SAFE = 5, GUILD = 6;

  function Generator(mapW, mapH) {
    this.mapW = mapW;
    this.mapH = mapH;
  }

  Generator.prototype.generate = function (floorNum) {
    var tiles = this._emptyMap();

    // ── Artery grid ──────────────────────────────────────────────────────────
    // Arteries are 3 tiles wide. Block size (between artery centers) is ~18 tiles.
    // This gives roughly a 4×4 grid of blocks on an 80×80 map.
    var ARTERY_W   = 3;
    var BLOCK_SIZE = 18;  // tiles between artery center-lines

    // Artery center-lines (every BLOCK_SIZE tiles, with a border margin)
    var arteryCols = [], arteryRows = [];
    for (var ax = BLOCK_SIZE; ax < this.mapW - BLOCK_SIZE / 2; ax += BLOCK_SIZE) {
      arteryCols.push(ax);
    }
    for (var ay = BLOCK_SIZE; ay < this.mapH - BLOCK_SIZE / 2; ay += BLOCK_SIZE) {
      arteryRows.push(ay);
    }

    // Carve all horizontal arteries
    for (var ri = 0; ri < arteryRows.length; ri++) {
      var ry = arteryRows[ri];
      for (var x = 1; x < this.mapW - 1; x++) {
        for (var aw = 0; aw < ARTERY_W; aw++) {
          if (ry + aw - 1 > 0 && ry + aw - 1 < this.mapH - 1)
            tiles[ry + aw - 1][x] = FLOOR;
        }
      }
    }

    // Carve all vertical arteries
    for (var ci = 0; ci < arteryCols.length; ci++) {
      var cx = arteryCols[ci];
      for (var y = 1; y < this.mapH - 1; y++) {
        for (var aw2 = 0; aw2 < ARTERY_W; aw2++) {
          if (cx + aw2 - 1 > 0 && cx + aw2 - 1 < this.mapW - 1)
            tiles[y][cx + aw2 - 1] = FLOOR;
        }
      }
    }

    // ── Blocks between arteries ──────────────────────────────────────────────
    // Each block is the rectangular region between two adjacent artery rows/cols.
    // We carve alleyways inside each block using a simple recursive-division maze.
    var blockBounds = this._getBlocks(arteryCols, arteryRows, ARTERY_W);
    var rooms = [];  // center-points of each block for enemy spawning
    for (var bi = 0; bi < blockBounds.length; bi++) {
      var b = blockBounds[bi];
      this._carveBlock(tiles, b);
      rooms.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    }

    // ── Safe rooms at intersections ──────────────────────────────────────────
    var namePool = _shuffled(SAFE_ROOM_NAMES.slice());
    var nameIdx  = 0;
    var safeRooms = [];
    for (var sri = 0; sri < arteryRows.length; sri++) {
      for (var sci = 0; sci < arteryCols.length; sci++) {
        // ~1 in 4 intersections gets a safe room (down from 1 in 2)
        if ((sri * arteryCols.length + sci) % 4 !== 0) continue;
        var srx = arteryCols[sci] - 4;
        var sry = arteryRows[sri] - 4;
        var srw = 9, srh = 9;
        if (srx > 1 && sry > 1 && srx + srw < this.mapW - 1 && sry + srh < this.mapH - 1) {
          this._carveRect(tiles, srx, sry, srw, srh, SAFE);
          var srName = namePool[nameIdx % namePool.length];
          nameIdx++;
          safeRooms.push({ x: srx, y: sry, w: srw, h: srh, name: srName });
        }
      }
    }

    // ── Start position: first artery intersection, top-left area ────────────
    var startX = arteryCols[0];
    var startY = arteryRows[0];
    // Mark a small start zone
    for (var sy2 = startY - 1; sy2 <= startY + 1; sy2++)
      for (var sx2 = startX - 1; sx2 <= startX + 1; sx2++)
        if (tiles[sy2] && tiles[sy2][sx2] === FLOOR) tiles[sy2][sx2] = START;

    // ── Tutorial Guild Hall — one room, placed on artery just east of start ──
    // Floors 1-3 only (lore: guild halls available on first 3 floors)
    var guildHall = null;
    if (floorNum <= 3) {
      var ghw = 11, ghh = 11;
      // Place just east of start along the horizontal artery
      var ghx = startX + 4;
      var ghy = startY - Math.floor(ghh / 2);
      // Clamp to map bounds
      if (ghx + ghw < this.mapW - 1 && ghy > 1 && ghy + ghh < this.mapH - 1) {
        this._carveRect(tiles, ghx, ghy, ghw, ghh, GUILD);
        // Doorway connecting to artery (south wall center tile becomes floor)
        var ghDoorX = Math.floor(ghx + ghw / 2);
        tiles[ghy + ghh - 1][ghDoorX] = FLOOR;
        tiles[ghy][ghDoorX] = FLOOR; // north opening too
        guildHall = { x: ghx, y: ghy, w: ghw, h: ghh };
      }
    }

    // ── Stairs (floor 2+, or after unlock timer on floor 1) ─────────────────
    // Place in the block farthest from start — makes players explore
    var stairsTile = null;
    if (floorNum >= 1) {
      var farthestBlock = null, farthestDist = 0;
      for (var fbi = 0; fbi < blockBounds.length; fbi++) {
        var fb = blockBounds[fbi];
        var fbcx = fb.x + fb.w / 2;
        var fbcy = fb.y + fb.h / 2;
        var dx = fbcx - startX, dy = fbcy - startY;
        var fbd = dx * dx + dy * dy; // squared — valid for comparison only
        if (fbd > farthestDist) { farthestDist = fbd; farthestBlock = fb; }
      }
      if (farthestBlock) {
        var stx = Math.floor(farthestBlock.x + farthestBlock.w / 2);
        var sty = Math.floor(farthestBlock.y + farthestBlock.h / 2);
        tiles[sty][stx] = STAIRS;
        stairsTile = { x: stx, y: sty };
      }
    }

    // ── Neighborhood boss room ────────────────────────────────────────────────
    // One per floor. Mid-distance from start (not too close, not the stairs block).
    // 9×9 chamber carved off an alley, connected via single 1-tile doorway.
    var bossRoom = null;
    // Exclude the stairs block from boss candidates so they don't share a room.
    var bossRoomCandidates = blockBounds.filter(function (b) {
      if (!stairsTile) return true;
      return !(stairsTile.x >= b.x && stairsTile.x < b.x + b.w &&
               stairsTile.y >= b.y && stairsTile.y < b.y + b.h);
    }).sort(function (a, b) {
      var aDist = Math.pow(a.x + a.w/2 - startX, 2) + Math.pow(a.y + a.h/2 - startY, 2);
      var bDist = Math.pow(b.x + b.w/2 - startX, 2) + Math.pow(b.y + b.h/2 - startY, 2);
      return aDist - bDist;
    });
    // Pick a random block in the back half of remaining candidates (40%-95%).
    var bossMinIdx = Math.floor(bossRoomCandidates.length * 0.40);
    var bossMaxIdx = Math.max(bossMinIdx, bossRoomCandidates.length - 1);
    var bossIdx = bossMinIdx + Math.floor(Math.random() * (bossMaxIdx - bossMinIdx + 1));
    var bossBlock = bossRoomCandidates[bossIdx];
    if (bossBlock) {
      var brw = 9, brh = 9;
      var brx = Math.floor(bossBlock.x + bossBlock.w / 2) - Math.floor(brw / 2);
      var bry = Math.floor(bossBlock.y + bossBlock.h / 2) - Math.floor(brh / 2);
      if (brx > 1 && bry > 1 && brx + brw < this.mapW - 1 && bry + brh < this.mapH - 1) {
        this._carveRect(tiles, brx, bry, brw, brh, FLOOR);
        // Wall the room back in on all sides
        for (var brty = bry; brty < bry + brh; brty++) {
          tiles[brty][brx] = WALL; tiles[brty][brx + brw - 1] = WALL;
        }
        for (var brtx = brx; brtx < brx + brw; brtx++) {
          tiles[bry][brtx] = WALL; tiles[bry + brh - 1][brtx] = WALL;
        }
        // South doorway — carve south until hitting existing FLOOR (artery/alley)
        var brdx = Math.floor(brx + brw / 2);
        var brdy = bry + brh - 1;
        tiles[brdy][brdx] = FLOOR;
        for (var bcy = bry + brh; bcy < this.mapH - 1; bcy++) {
          if (tiles[bcy][brdx] === FLOOR) break;
          tiles[bcy][brdx] = FLOOR;
          if (bcy > bry + brh + 8) break;
        }
        // West doorway — carve west until hitting existing FLOOR (alley in block)
        // West wall alleys are cut off by the room; this guarantees horizontal access
        var brmidy = Math.floor(bry + brh / 2);
        tiles[brmidy][brx] = FLOOR;
        for (var bcx = brx - 1; bcx > 0; bcx--) {
          if (tiles[brmidy][bcx] === FLOOR) break;
          tiles[brmidy][bcx] = FLOOR;
          if (bcx < brx - 8) break;
        }
        bossRoom = { x: brx, y: bry, w: brw, h: brh, doorX: brdx, doorY: brdy };
      }
    }

    // ── Secondary guild halls — ~1 in 10 safe rooms (floors 1-3, lore) ─────────
    var secondaryGuildHalls = [];
    if (floorNum <= 3 && safeRooms.length > 0) {
      var shuffled = _shuffled(safeRooms.slice());
      var ghCount = Math.max(1, Math.round(safeRooms.length / 10));
      for (var ghi = 0; ghi < ghCount && ghi < shuffled.length; ghi++) {
        secondaryGuildHalls.push(shuffled[ghi]);
      }
    }

    return {
      tiles: tiles,
      rooms: rooms,
      safeRooms: safeRooms,
      guildHall: guildHall,
      secondaryGuildHalls: secondaryGuildHalls,
      bossRoom: bossRoom,
      startPos: { x: startX * 32 + 16, y: startY * 32 + 16 },
      stairsTile: stairsTile,
      arteryCols: arteryCols,
      arteryRows: arteryRows,
    };
  };

  // Return bounding boxes of each city block (space between arteries)
  Generator.prototype._getBlocks = function (cols, rows, arteryW) {
    var half = Math.floor(arteryW / 2);
    var blocks = [];

    // Add map edges as virtual artery lines
    var xEdges = [0].concat(cols).concat([this.mapW]);
    var yEdges = [0].concat(rows).concat([this.mapH]);

    for (var ri = 0; ri < yEdges.length - 1; ri++) {
      for (var ci = 0; ci < xEdges.length - 1; ci++) {
        var bx = xEdges[ci] + half + 1;
        var by = yEdges[ri] + half + 1;
        var bx2 = xEdges[ci + 1] - half - 1;
        var by2 = yEdges[ri + 1] - half - 1;
        var bw = bx2 - bx;
        var bh = by2 - by;
        if (bw >= 5 && bh >= 5) blocks.push({ x: bx, y: by, w: bw, h: bh });
      }
    }
    return blocks;
  };

  // Carve a city block interior with alleyways using recursive subdivision
  Generator.prototype._carveBlock = function (tiles, b) {
    // First carve a grid of passages inside the block
    var ALLEY_SPACING = 4;

    // Horizontal alleys
    for (var ay = b.y + 2; ay < b.y + b.h - 2; ay += ALLEY_SPACING) {
      for (var ax = b.x + 1; ax < b.x + b.w - 1; ax++) {
        if (tiles[ay] && tiles[ay][ax] === WALL) tiles[ay][ax] = FLOOR;
      }
    }
    // Vertical alleys
    for (var ax2 = b.x + 2; ax2 < b.x + b.w - 2; ax2 += ALLEY_SPACING) {
      for (var ay2 = b.y + 1; ay2 < b.y + b.h - 1; ay2++) {
        if (tiles[ay2] && tiles[ay2][ax2] === WALL) tiles[ay2][ax2] = FLOOR;
      }
    }

    // Randomly extend some alleys into dead-ends for maze feel
    for (var i = 0; i < 6; i++) {
      var sx = b.x + 1 + Math.floor(Math.random() * (b.w - 2));
      var sy = b.y + 1 + Math.floor(Math.random() * (b.h - 2));
      var dir = Math.floor(Math.random() * 4);
      var dx = [1, -1, 0, 0][dir];
      var dy = [0, 0, 1, -1][dir];
      var len = 2 + Math.floor(Math.random() * 4);
      for (var step = 0; step < len; step++) {
        var nx = sx + dx * step;
        var ny = sy + dy * step;
        if (nx > b.x && nx < b.x + b.w - 1 && ny > b.y && ny < b.y + b.h - 1) {
          tiles[ny][nx] = FLOOR;
        }
      }
    }

    // Connect each block to adjacent arteries with at least one opening
    // (arteries are already carved; blocks abut them, so edge tiles touching artery = open)
    // Carve one guaranteed connection on each side
    var midX = Math.floor(b.x + b.w / 2);
    var midY = Math.floor(b.y + b.h / 2);
    if (b.y > 1)            tiles[b.y][midX]       = FLOOR; // top
    if (b.y + b.h < this.mapH - 1) tiles[b.y + b.h - 1][midX] = FLOOR; // bottom
    if (b.x > 1)            tiles[midY][b.x]       = FLOOR; // left
    if (b.x + b.w < this.mapW - 1) tiles[midY][b.x + b.w - 1] = FLOOR; // right
  };

  Generator.prototype._carveRect = function (tiles, x, y, w, h, tileType) {
    for (var ty = y; ty < y + h; ty++)
      for (var tx = x; tx < x + w; tx++)
        if (tx > 0 && ty > 0 && tx < this.mapW - 1 && ty < this.mapH - 1)
          tiles[ty][tx] = tileType;
  };

  Generator.prototype._emptyMap = function () {
    var tiles = [];
    for (var y = 0; y < this.mapH; y++) {
      tiles[y] = [];
      for (var x = 0; x < this.mapW; x++) tiles[y][x] = WALL;
    }
    return tiles;
  };

  // ── Safe room name pool (Floor 1 — The Meadows) ─────────────────────────
  var SAFE_ROOM_NAMES = [
    'WAFFLE HOUSE',
    'ALABAMA TACO BELL',
    'DMV WAITING ROOM',
    "CARL'S JR.",
    'BIG UGLY\'S BAR & GRILL',
    'THE GOLDEN CORAL',
    'CRACKER BARREL #47',
    'DENNYS',
    'BOJANGLES',
    'DOLLAR GENERAL',
    'FAMILY DOLLAR',
    'THE PIGGLY WIGGLY',
    'HARDEES',
    'STEAK N SHAKE',
    'IHOP',
    'SBARRO',
  ];

  function _shuffled(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  Generator.FLOOR  = FLOOR;
  Generator.WALL   = WALL;
  Generator.STAIRS = STAIRS;
  Generator.DOOR   = DOOR;
  Generator.START  = START;
  Generator.SAFE   = SAFE;
  Generator.GUILD  = GUILD;

  return Generator;
})();
