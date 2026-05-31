// All game assets generated programmatically via canvas
// Character designs reference the DCC book cover art
var SpriteGen = (function () {
  var T = 32;   // tile size
  var CS = 48;  // Carl/Donut sprite size

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function ctx2d(c) { return c.getContext('2d', { willReadFrequently: true }); }

  // Shorthand helpers
  function fill(ctx, color) { ctx.fillStyle = color; }
  function rect(ctx, x, y, w, h, color) {
    if (color) ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function circle(ctx, x, y, r, color) {
    if (color) ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function arc(ctx, x, y, r, a0, a1, color) {
    if (color) ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.fill();
  }
  // Soft outline drawn around any opaque pixels — call after drawing sprite
  function outline(ctx, color, w, h) {
    var imageData = ctx.getImageData(0, 0, w, h);
    var d = imageData.data;
    var out = new Uint8ClampedArray(d.length);
    for (var i = 0; i < d.length; i++) out[i] = d[i];
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = (y * w + x) * 4;
        if (d[idx + 3] > 0) continue; // already has pixel
        // Check neighbors
        var hasNeighbor = d[((y-1)*w+x)*4+3] > 0 || d[((y+1)*w+x)*4+3] > 0 ||
                          d[(y*w+(x-1))*4+3] > 0   || d[(y*w+(x+1))*4+3] > 0;
        if (hasNeighbor) {
          out[idx]   = 20;
          out[idx+1] = 10;
          out[idx+2] = 30;
          out[idx+3] = 200;
        }
      }
    }
    ctx.putImageData(new ImageData(out, w, h), 0, 0);
  }

  // ── TILES ─────────────────────────────────────────────────────────────────

  function tileFloor() {
    var c = canvas(T, T), ctx = ctx2d(c);
    // Base stone
    ctx.fillStyle = '#48444e'; ctx.fillRect(0, 0, T, T);
    // Grout lines
    ctx.fillStyle = '#282430';
    ctx.fillRect(0, 10, T, 1); ctx.fillRect(0, 21, T, 1);
    ctx.fillRect(15, 0, 1, 10); ctx.fillRect(8, 11, 1, 10); ctx.fillRect(22, 11, 1, 10); ctx.fillRect(15, 22, 1, T);
    // Stone highlights
    ctx.fillStyle = '#5e5a68';
    ctx.fillRect(1, 1, 13, 8); ctx.fillRect(17, 1, 13, 8);
    ctx.fillRect(1, 12, 5, 7); ctx.fillRect(10, 12, 11, 7); ctx.fillRect(24, 12, 7, 7);
    ctx.fillRect(1, 23, 13, 7); ctx.fillRect(17, 23, 13, 7);
    // Subtle pixel highlight
    ctx.fillStyle = '#6e6a78';
    ctx.fillRect(1, 1, 3, 1); ctx.fillRect(17, 1, 3, 1); ctx.fillRect(1, 12, 3, 1);
    return c;
  }

  function tileWall() {
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#1a1622'; ctx.fillRect(0, 0, T, T);
    // Brick rows
    var colors = ['#2a2436', '#252030', '#2e2840'];
    for (var row = 0; row < 4; row++) {
      var y = row * 8;
      ctx.fillStyle = colors[row % colors.length]; ctx.fillRect(0, y, T, 7);
      ctx.fillStyle = '#10080e'; ctx.fillRect(0, y + 7, T, 1);
      // Staggered joints
      var xo = (row % 2) * 16;
      ctx.fillStyle = '#10080e'; ctx.fillRect(xo, y, 1, 7); ctx.fillRect((xo+16)%T, y, 1, 7);
      // Top highlight
      ctx.fillStyle = '#3e3850'; ctx.fillRect(xo + 1, y, 14, 1);
    }
    // Top-face (visible edge in top-down)
    ctx.fillStyle = '#4a4458'; ctx.fillRect(0, 0, T, 3);
    return c;
  }

  function tileStairs() {
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#38344a'; ctx.fillRect(0, 0, T, T);
    // Concentric steps
    var steps = [
      [4, 4, 24, 5, '#484460'],
      [6, 9, 20, 5, '#3a3650'],
      [8, 14, 16, 5, '#2e2a40'],
      [10, 19, 12, 5, '#222030'],
      [12, 24, 8, 4, '#161422'],
    ];
    steps.forEach(function(s) {
      ctx.fillStyle = s[4]; ctx.fillRect(s[0], s[1], s[2], s[3]);
      ctx.fillStyle = '#7a7090'; ctx.fillRect(s[0], s[1], s[2], 1);
    });
    // Gold arrow
    ctx.fillStyle = '#ffdd57';
    ctx.fillRect(15, 5, 2, 16);
    ctx.fillRect(11, 15, 10, 2); ctx.fillRect(12, 17, 8, 2);
    ctx.fillRect(13, 19, 6, 2); ctx.fillRect(14, 21, 4, 2); ctx.fillRect(15, 23, 2, 2);
    return c;
  }

  function tileDoor() {
    var c = canvas(T, T), ctx = ctx2d(c);
    // Archway
    ctx.fillStyle = '#48444e'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#8a5c2e'; ctx.fillRect(3, 0, 4, T); ctx.fillRect(25, 0, 4, T); ctx.fillRect(3, 0, 26, 4);
    ctx.fillStyle = '#5a3c1a'; ctx.fillRect(7, 4, 18, T-4);
    ctx.fillStyle = '#a07040'; ctx.fillRect(3, 0, 26, 2);
    return c;
  }

  function tileStart() {
    // The collapse zone — rubble and debris
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#504c5c'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#282430';
    ctx.fillRect(0, 10, T, 1); ctx.fillRect(0, 21, T, 1);
    ctx.fillRect(15, 0, 1, 10);
    // Rubble
    [[3,2,5,3,'#8a7a68'],[12,6,3,3,'#6a5a48'],[19,3,6,4,'#7a6a58'],
     [6,15,4,5,'#8a7a68'],[20,17,4,3,'#6a5a48'],[2,22,5,4,'#7a6a58']].forEach(function(r) {
      ctx.fillStyle = r[4]; ctx.fillRect(r[0],r[1],r[2],r[3]);
      ctx.fillStyle = '#aaa090'; ctx.fillRect(r[0],r[1],r[2],1);
    });
    return c;
  }

  function tileSafeRoom() {
    // Warm linoleum floor — fast food / Waffle House aesthetic
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#3a2e1e'; ctx.fillRect(0, 0, T, T);
    // Checkerboard-ish tiles
    var colors = ['#4a3e2a', '#3e3420'];
    for (var ty = 0; ty < 4; ty++) {
      for (var tx = 0; tx < 4; tx++) {
        ctx.fillStyle = colors[(tx + ty) % 2];
        ctx.fillRect(tx * 8, ty * 8, 7, 7);
      }
    }
    // Warm glow tint overlay
    ctx.fillStyle = 'rgba(255, 180, 60, 0.08)';
    ctx.fillRect(0, 0, T, T);
    // Scuff marks
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(5, 11, 6, 1); ctx.fillRect(18, 24, 4, 1); ctx.fillRect(24, 7, 5, 1);
    return c;
  }

  function tileGuildHall() {
    // Deep blue guild hall floor — polished stone with subtle emblem
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#1a1830'; ctx.fillRect(0, 0, T, T);
    // Stone tiles — darker blue-grey
    var colors = ['#222040', '#1e1c38'];
    for (var ty = 0; ty < 4; ty++) {
      for (var tx = 0; tx < 4; tx++) {
        ctx.fillStyle = colors[(tx + ty) % 2];
        ctx.fillRect(tx * 8, ty * 8, 7, 7);
      }
    }
    // Faint gold emblem — guild symbol (stylized G)
    ctx.fillStyle = 'rgba(200,160,30,0.18)';
    ctx.beginPath(); ctx.arc(16, 16, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,160,30,0.10)';
    ctx.fillRect(14, 8, 4, 16); ctx.fillRect(8, 14, 16, 4);
    return c;
  }

  function genTileset() {
    var tiles = [tileFloor(), tileWall(), tileStairs(), tileDoor(), tileStart(), tileSafeRoom(), tileGuildHall()];
    var c = canvas(T * tiles.length, T), ctx = ctx2d(c);
    tiles.forEach(function(t, i) { ctx.drawImage(t, i * T, 0); });
    return c;
  }

  function tileFloorF2() {
    // Floor 2: white/light concrete floor, cracked
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#d8d4cc'; ctx.fillRect(0, 0, T, T);
    // Grout lines
    ctx.fillStyle = '#b0aca4';
    ctx.fillRect(0, 10, T, 1); ctx.fillRect(0, 21, T, 1);
    ctx.fillRect(15, 0, 1, 10); ctx.fillRect(8, 11, 1, 10); ctx.fillRect(22, 11, 1, 10); ctx.fillRect(15, 22, 1, T);
    // Stone highlights
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(1, 1, 13, 8); ctx.fillRect(17, 1, 13, 8);
    ctx.fillRect(1, 12, 5, 7); ctx.fillRect(10, 12, 11, 7); ctx.fillRect(24, 12, 7, 7);
    ctx.fillRect(1, 23, 13, 7); ctx.fillRect(17, 23, 13, 7);
    // Cracks (dark lines on white floor — more visible)
    ctx.fillStyle = '#8a8480';
    ctx.fillRect(5, 3, 6, 1); ctx.fillRect(9, 4, 3, 2);
    ctx.fillRect(19, 14, 5, 1); ctx.fillRect(22, 15, 2, 3);
    ctx.fillRect(3, 25, 4, 1); ctx.fillRect(6, 26, 2, 2);
    return c;
  }

  function tileWallF2() {
    // Floor 2: orange-tinted cinderblock
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#7a4010'; ctx.fillRect(0, 0, T, T);
    // Cinderblock rows (wider, more industrial than brick)
    var blocks = [
      [0, 0, 31, 14, '#8a5020'],
      [0, 16, 31, 14, '#804818'],
      [16, 0, 14, 14, '#9a5c28'],
      [0, 16, 14, 14, '#906020'],
    ];
    blocks.forEach(function(b) {
      ctx.fillStyle = b[4]; ctx.fillRect(b[0], b[1], b[2], b[3]);
    });
    // Mortar gaps
    ctx.fillStyle = '#5a2c08'; ctx.fillRect(0, 14, T, 2); ctx.fillRect(0, 30, T, 2);
    ctx.fillStyle = '#5a2c08'; ctx.fillRect(15, 0, 1, 14); ctx.fillRect(0, 16, 1, 14);
    // Top highlight
    ctx.fillStyle = '#c07840'; ctx.fillRect(0, 0, T, 2);
    ctx.fillStyle = '#b06030'; ctx.fillRect(16, 0, T - 16, 2);
    return c;
  }

  function genTilesetFloor2() {
    var tiles = [tileFloorF2(), tileWallF2(), tileStairs(), tileDoor(), tileStart(), tileSafeRoom(), tileGuildHall()];
    var c = canvas(T * tiles.length, T), ctx = ctx2d(c);
    tiles.forEach(function(t, i) { ctx.drawImage(t, i * T, 0); });
    return c;
  }

  function tileFloorF3() {
    // Floor 3 (The Over City): grey asphalt street with paving seams
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#484c52'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#50555c';
    ctx.fillRect(1, 1, 13, 13); ctx.fillRect(17, 1, 13, 13);
    ctx.fillRect(1, 17, 13, 13); ctx.fillRect(17, 17, 13, 13);
    // Seams between slabs
    ctx.fillStyle = '#34373c'; ctx.fillRect(0, 15, T, 2); ctx.fillRect(15, 0, 2, T);
    // Grime specks
    ctx.fillStyle = '#3e4248';
    ctx.fillRect(5, 6, 3, 2); ctx.fillRect(23, 9, 2, 3); ctx.fillRect(9, 23, 3, 2); ctx.fillRect(24, 24, 2, 2);
    // Faint road paint
    ctx.fillStyle = '#8a7836'; ctx.fillRect(14, 4, 4, 1); ctx.fillRect(14, 25, 4, 1);
    return c;
  }

  function tileWallF3() {
    // Floor 3 (The Over City): steel-and-glass tower face with lit windows
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#2b3340'; ctx.fillRect(0, 0, T, T);
    // Muted glass panes (2×2)
    ctx.fillStyle = '#4a6076'; ctx.fillRect(3, 3, 11, 11);
    ctx.fillStyle = '#42566a'; ctx.fillRect(18, 3, 11, 11);
    ctx.fillStyle = '#42566a'; ctx.fillRect(3, 18, 11, 11);
    ctx.fillStyle = '#4a6076'; ctx.fillRect(18, 18, 11, 11);
    // A couple of lit windows (one cool, one warm) for city-at-night feel
    ctx.fillStyle = '#bcd4f0'; ctx.fillRect(4, 4, 5, 5);
    ctx.fillStyle = '#e8cc7a'; ctx.fillRect(19, 19, 5, 5);
    // Steel frame
    ctx.fillStyle = '#1e2530';
    ctx.fillRect(0, 0, 2, T); ctx.fillRect(15, 0, 2, T); ctx.fillRect(30, 0, 2, T);
    ctx.fillRect(0, 0, T, 2); ctx.fillRect(0, 15, T, 2); ctx.fillRect(0, 30, T, 2);
    return c;
  }

  function genTilesetFloor3() {
    var tiles = [tileFloorF3(), tileWallF3(), tileStairs(), tileDoor(), tileStart(), tileSafeRoom(), tileGuildHall()];
    var c = canvas(T * tiles.length, T), ctx = ctx2d(c);
    tiles.forEach(function(t, i) { ctx.drawImage(t, i * T, 0); });
    return c;
  }

  function tileFloorF4() {
    // Floor 4 (The Iron Tangle): riveted rusted metal plating
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#5a4632'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#64503a';
    ctx.fillRect(1, 1, 29, 13); ctx.fillRect(1, 17, 29, 13);
    // Plate seams
    ctx.fillStyle = '#2e2316'; ctx.fillRect(0, 14, T, 2); ctx.fillRect(0, 30, T, 2); ctx.fillRect(15, 0, 2, T);
    // Corner rivets
    ctx.fillStyle = '#8a7050';
    [[3,3],[27,3],[3,11],[27,11],[3,19],[27,19],[3,27],[27,27]].forEach(function (p) { ctx.fillRect(p[0], p[1], 2, 2); });
    // Rust streaks
    ctx.fillStyle = '#7a3a1a';
    ctx.fillRect(8, 5, 5, 1); ctx.fillRect(20, 21, 5, 1); ctx.fillRect(11, 24, 3, 2);
    return c;
  }

  function tileWallF4() {
    // Floor 4 (The Iron Tangle): corroded iron girders
    var c = canvas(T, T), ctx = ctx2d(c);
    ctx.fillStyle = '#322a20'; ctx.fillRect(0, 0, T, T);
    // Vertical girders
    ctx.fillStyle = '#5a4a36'; ctx.fillRect(2, 0, 9, T); ctx.fillRect(21, 0, 9, T);
    // Horizontal cross-beam
    ctx.fillStyle = '#4a3c2a'; ctx.fillRect(0, 12, T, 8);
    // Rust patches
    ctx.fillStyle = '#7a3e1c'; ctx.fillRect(4, 4, 4, 5); ctx.fillRect(23, 18, 4, 6); ctx.fillRect(5, 24, 3, 4);
    // Rivets
    ctx.fillStyle = '#8a7452';
    [[4,2],[8,2],[23,2],[27,2],[4,28],[8,28],[23,28],[27,28]].forEach(function (p) { ctx.fillRect(p[0], p[1], 2, 2); });
    // Dark structural gaps
    ctx.fillStyle = '#1a140c'; ctx.fillRect(0, 0, 2, T); ctx.fillRect(11, 0, 2, T); ctx.fillRect(30, 0, 2, T);
    return c;
  }

  function genTilesetFloor4() {
    var tiles = [tileFloorF4(), tileWallF4(), tileStairs(), tileDoor(), tileStart(), tileSafeRoom(), tileGuildHall()];
    var c = canvas(T * tiles.length, T), ctx = ctx2d(c);
    tiles.forEach(function(t, i) { ctx.drawImage(t, i * T, 0); });
    return c;
  }

  // ── CARL ──────────────────────────────────────────────────────────────────
  // Reference: leather jacket, light-blue heart boxer shorts, bare feet, dark messy hair
  // Sprite size: 48×48 for readability

  var CARL = {
    skin:       '#c8856a',
    skinDark:   '#a86850',
    skinShad:   '#8a5438',
    hair:       '#1a0a02',
    hairMid:    '#2e1408',
    jacket:     '#4a2e10',
    jacketDark: '#301a06',
    jacketMid:  '#5a3e1e',
    jacketLt:   '#6a4e28',
    shorts:     '#aac0d8',
    shortsDark: '#7a98b8',
    shortsMid:  '#90aec8',
    heart:      '#cc2233',
    feet:       '#c8856a',
    feetDark:   '#a86850',
    nail:       '#e8a888',
  };

  function _carlBase(ctx, dir) {
    var C = CARL;
    var S = CS; // 48

    if (dir === 'down') {
      // ── Legs ──
      rect(ctx, 14, 33, 8, 11, C.skin);
      rect(ctx, 26, 33, 8, 11, C.skin);
      rect(ctx, 14, 33, 3, 11, C.skinDark);
      rect(ctx, 26, 33, 3, 11, C.skinDark);
      // ── Feet (bare, flat) ──
      rect(ctx, 11, 43, 13, 5, C.feet);
      rect(ctx, 24, 43, 13, 5, C.feet);
      rect(ctx, 11, 43, 4, 5, C.feetDark);
      rect(ctx, 24, 43, 4, 5, C.feetDark);
      // Toenail hints
      ctx.fillStyle = C.nail;
      ctx.fillRect(12,43,2,1); ctx.fillRect(15,43,2,1); ctx.fillRect(18,43,2,1);
      ctx.fillRect(25,43,2,1); ctx.fillRect(28,43,2,1); ctx.fillRect(31,43,2,1);
      // ── Shorts (heart boxers) ──
      rect(ctx, 13, 24, 22, 10, C.shorts);
      rect(ctx, 13, 24, 8, 10, C.shortsDark);
      rect(ctx, 21, 24, 6, 10, C.shortsMid);
      // Heart pattern (left hip)
      ctx.fillStyle = C.heart;
      ctx.fillRect(16,27,4,3); ctx.fillRect(15,28,6,2); ctx.fillRect(16,30,4,1);
      // Heart (right hip)
      ctx.fillRect(28,27,4,3); ctx.fillRect(27,28,6,2); ctx.fillRect(28,30,4,1);
      // Waistband
      rect(ctx, 13, 24, 22, 2, C.shortsDark);
      // ── Jacket body ──
      rect(ctx, 12, 14, 24, 11, C.jacket);
      rect(ctx, 12, 14, 5, 11, C.jacketDark);   // left lapel shadow
      rect(ctx, 31, 14, 5, 11, C.jacketDark);   // right lapel shadow
      rect(ctx, 17, 15, 14, 10, C.jacketMid);   // center chest
      rect(ctx, 21, 14, 6, 11, C.jacketLt);     // center highlight strip
      // Collar V
      ctx.fillStyle = C.skinDark;
      ctx.fillRect(20,14,8,3); ctx.fillRect(21,17,6,2); ctx.fillRect(22,19,4,2);
      // ── Arms ──
      circle(ctx, 8, 21, 6, C.jacket);
      circle(ctx, 40, 21, 6, C.jacket);
      circle(ctx, 8, 21, 4, C.jacketMid);
      circle(ctx, 40, 21, 4, C.jacketMid);
      // Fists
      rect(ctx, 4, 26, 9, 7, C.skinDark);
      rect(ctx, 35, 26, 9, 7, C.skinDark);
      rect(ctx, 5, 27, 7, 5, C.skin);
      rect(ctx, 36, 27, 7, 5, C.skin);
      // Knuckle lines
      ctx.fillStyle = C.skinShad;
      ctx.fillRect(6,27,1,4); ctx.fillRect(8,27,1,4); ctx.fillRect(10,27,1,4);
      ctx.fillRect(37,27,1,4); ctx.fillRect(39,27,1,4); ctx.fillRect(41,27,1,4);
      // ── Head ──
      circle(ctx, 24, 9, 9, C.skin);
      circle(ctx, 24, 9, 8, C.skin);
      // Neck
      rect(ctx, 20, 13, 8, 4, C.skin);
      // Hair — messy dark, covers top
      ctx.fillStyle = C.hair;
      ctx.beginPath(); ctx.arc(24, 9, 9, Math.PI * 1.05, 0, false); ctx.fill();
      circle(ctx, 24, 3, 5, C.hairMid);
      // Messy tufts
      circle(ctx, 18, 4, 3, C.hair);
      circle(ctx, 30, 4, 3, C.hair);
      circle(ctx, 24, 1, 3, C.hairMid);
      ctx.fillStyle = C.hairMid;
      ctx.fillRect(19,2,3,3); ctx.fillRect(26,2,3,3);
      // Eyes — blue-grey, determined
      rect(ctx, 18, 10, 4, 3, '#4a70b0');
      rect(ctx, 26, 10, 4, 3, '#4a70b0');
      rect(ctx, 19, 10, 2, 3, '#1a2840');
      rect(ctx, 27, 10, 2, 3, '#1a2840');
      // Eye whites
      ctx.fillStyle = '#c8d8e8'; ctx.fillRect(18,10,1,3); ctx.fillRect(26,10,1,3);
      // Eyebrows — furrowed
      rect(ctx, 17, 8, 6, 2, C.hair);
      rect(ctx, 25, 8, 6, 2, C.hair);
      ctx.fillStyle = C.hairMid;
      ctx.fillRect(17,8,3,1); ctx.fillRect(25,8,3,1);
      // Nose
      ctx.fillStyle = C.skinShad;
      ctx.fillRect(22,13,4,2); ctx.fillRect(21,14,2,1); ctx.fillRect(25,14,2,1);
      // Mouth — set jaw, thin line
      ctx.fillStyle = C.skinShad;
      ctx.fillRect(20,16,3,1); ctx.fillRect(25,16,3,1);

    } else if (dir === 'up') {
      // ── Back view ──
      rect(ctx, 14, 33, 8, 11, C.skin);
      rect(ctx, 26, 33, 8, 11, C.skin);
      rect(ctx, 17, 33, 3, 11, C.skinDark);
      rect(ctx, 29, 33, 3, 11, C.skinDark);
      rect(ctx, 11, 43, 13, 5, C.feet);
      rect(ctx, 24, 43, 13, 5, C.feet);
      rect(ctx, 19, 43, 5, 5, C.feetDark);
      rect(ctx, 32, 43, 5, 5, C.feetDark);
      rect(ctx, 13, 24, 22, 10, C.shorts);
      rect(ctx, 13, 24, 8, 10, C.shortsDark);
      rect(ctx, 13, 24, 22, 2, C.shortsDark);
      // Jacket back
      rect(ctx, 12, 14, 24, 11, C.jacket);
      rect(ctx, 12, 14, 5, 11, C.jacketDark);
      rect(ctx, 31, 14, 5, 11, C.jacketDark);
      rect(ctx, 18, 14, 12, 11, C.jacketMid);
      // Back seam
      ctx.fillStyle = C.jacketDark; ctx.fillRect(23,14,2,11);
      circle(ctx, 8, 21, 6, C.jacket); circle(ctx, 40, 21, 6, C.jacket);
      circle(ctx, 8, 21, 4, C.jacketMid); circle(ctx, 40, 21, 4, C.jacketMid);
      rect(ctx, 4, 26, 9, 7, C.skinDark); rect(ctx, 35, 26, 9, 7, C.skinDark);
      rect(ctx, 5, 27, 7, 5, C.skin); rect(ctx, 36, 27, 7, 5, C.skin);
      // Head back
      circle(ctx, 24, 9, 9, C.skin);
      rect(ctx, 20, 13, 8, 3, C.skin);
      // All hair from back
      circle(ctx, 24, 8, 9, C.hair);
      circle(ctx, 24, 5, 7, C.hairMid);
      circle(ctx, 17, 6, 4, C.hair);
      circle(ctx, 31, 6, 4, C.hair);
      circle(ctx, 24, 1, 4, C.hairMid);
      ctx.fillStyle = C.hair; ctx.fillRect(19,2,10,4);

    } else if (dir === 'right') {
      // ── Right profile ──
      // Legs
      rect(ctx, 17, 33, 8, 11, C.skin);
      rect(ctx, 27, 33, 6, 11, C.skinDark);
      rect(ctx, 17, 43, 15, 5, C.feet);
      rect(ctx, 26, 43, 6, 5, C.feetDark);
      // Shorts
      rect(ctx, 16, 24, 20, 10, C.shorts);
      rect(ctx, 28, 24, 8, 10, C.shortsDark);
      rect(ctx, 16, 24, 20, 2, C.shortsDark);
      ctx.fillStyle = C.heart;
      ctx.fillRect(19,27,4,3); ctx.fillRect(18,28,6,2); ctx.fillRect(19,30,4,1);
      // Jacket body
      rect(ctx, 15, 14, 20, 11, C.jacket);
      rect(ctx, 29, 14, 6, 11, C.jacketDark);
      rect(ctx, 15, 14, 6, 11, C.jacketMid);
      // Collar
      ctx.fillStyle = C.skinDark; ctx.fillRect(15,14,5,4);
      // Back arm (tucked behind body)
      circle(ctx, 10, 20, 5, C.jacketDark);
      circle(ctx, 9, 27, 4, C.skinDark); circle(ctx, 10, 27, 3, C.skin);
      // Front arm (relaxed at side)
      rect(ctx, 33, 17, 7, 10, C.jacket);
      rect(ctx, 37, 17, 3, 10, C.jacketDark);
      rect(ctx, 33, 25, 7, 6, C.skinDark);
      rect(ctx, 34, 26, 5, 5, C.skin);
      // Head (profile)
      circle(ctx, 20, 9, 9, C.skin);
      ctx.fillStyle = C.hair;
      ctx.beginPath(); ctx.arc(20, 9, 9, Math.PI * 0.55, Math.PI * 1.7); ctx.fill();
      circle(ctx, 18, 3, 5, C.hairMid);
      circle(ctx, 24, 4, 4, C.hair);
      // Eye
      rect(ctx, 25, 10, 3, 3, '#4a70b0');
      rect(ctx, 25, 10, 2, 3, '#1a2840');
      ctx.fillStyle = '#c8d8e8'; ctx.fillRect(25,10,1,3);
      rect(ctx, 24, 8, 5, 2, C.hair);
      // Nose profile
      ctx.fillStyle = C.skinShad;
      ctx.fillRect(28,13,3,2); ctx.fillRect(29,15,2,1);
      // Jaw/chin
      rect(ctx, 23,17,4,1, C.skinShad);

    } else { // left
      // ── Left profile ──
      rect(ctx, 23, 33, 8, 11, C.skin);
      rect(ctx, 15, 33, 6, 11, C.skinDark);
      rect(ctx, 16, 43, 15, 5, C.feet);
      rect(ctx, 16, 43, 6, 5, C.feetDark);
      rect(ctx, 12, 24, 20, 10, C.shorts);
      rect(ctx, 12, 24, 8, 10, C.shortsDark);
      rect(ctx, 12, 24, 20, 2, C.shortsDark);
      ctx.fillStyle = C.heart;
      ctx.fillRect(25,27,4,3); ctx.fillRect(24,28,6,2); ctx.fillRect(25,30,4,1);
      // Jacket
      rect(ctx, 13, 14, 20, 11, C.jacket);
      rect(ctx, 13, 14, 6, 11, C.jacketDark);
      rect(ctx, 27, 14, 6, 11, C.jacketMid);
      ctx.fillStyle = C.skinDark; ctx.fillRect(28,14,5,4);
      // Back arm (tucked behind body)
      circle(ctx, 38, 20, 5, C.jacketDark);
      circle(ctx, 38, 27, 4, C.skinDark); circle(ctx, 37, 27, 3, C.skin);
      // Front arm (relaxed at side)
      rect(ctx, 8, 17, 7, 10, C.jacket);
      rect(ctx, 8, 17, 3, 10, C.jacketDark);
      rect(ctx, 8, 25, 7, 6, C.skinDark);
      rect(ctx, 9, 26, 5, 5, C.skin);
      // Head (profile, mirrored)
      circle(ctx, 28, 9, 9, C.skin);
      ctx.fillStyle = C.hair;
      ctx.beginPath(); ctx.arc(28, 9, 9, Math.PI * 1.3, Math.PI * 2.45); ctx.fill();
      circle(ctx, 30, 3, 5, C.hairMid);
      circle(ctx, 24, 4, 4, C.hair);
      rect(ctx, 19, 8, 5, 2, C.hair);
      // Eye
      rect(ctx, 20, 10, 3, 3, '#4a70b0');
      rect(ctx, 21, 10, 2, 3, '#1a2840');
      ctx.fillStyle = '#c8d8e8'; ctx.fillRect(22,10,1,3);
      ctx.fillStyle = C.skinShad;
      ctx.fillRect(16,13,3,2); ctx.fillRect(16,15,2,1);
      rect(ctx, 21,17,4,1, C.skinShad);
    }
  }

  function genCarl(dir) {
    var c = canvas(CS, CS), ctx = ctx2d(c);
    _carlBase(ctx, dir);
    outline(ctx, '#14080c', CS, CS);
    return c;
  }

  function genCarlHit(dir) {
    var c = canvas(CS, CS), ctx = ctx2d(c);
    _carlBase(ctx, dir);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 60, 60, 0.55)';
    ctx.fillRect(0, 0, CS, CS);
    ctx.globalCompositeOperation = 'source-over';
    outline(ctx, '#14080c', CS, CS);
    return c;
  }

  // ── DONUT ─────────────────────────────────────────────────────────────────
  // Reference: tortoiseshell Persian, flat face, large YELLOW eyes, very fluffy
  // Sprite size: 48×48

  function _donutBase(ctx) {
    var BEIGE  = '#c8a870';
    var CREAM  = '#e8dcc0';
    var BLACK  = '#1a100a';
    var FACE   = '#ede4d0';
    var EYE_Y  = '#d8aa00';
    var EYE_AM = '#f0c820';
    var PUPIL  = '#080604';
    var NOSE   = '#d08090';
    var PINK   = '#e8a8b8';

    // ── Tail (behind body) ──
    ctx.fillStyle = BEIGE;
    ctx.beginPath(); ctx.ellipse(38, 36, 8, 6, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.ellipse(37, 38, 5, 4, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.ellipse(35, 40, 4, 3, 0.3, 0, Math.PI*2); ctx.fill();

    // ── Outer body fluff ──
    circle(ctx, 24, 28, 17, BEIGE);
    // Tortoiseshell patches — dark
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.ellipse(12, 22, 6, 8, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(36, 20, 5, 7, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, 38, 7, 5, 0.2, 0, Math.PI*2); ctx.fill();
    // Cream patches
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.ellipse(34, 34, 6, 5, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30, 15, 5, 4, 0, 0, Math.PI*2); ctx.fill();
    // ── Inner body ──
    circle(ctx, 24, 28, 11, CREAM);
    // ── Cheek puffs ──
    circle(ctx, 14, 26, 6, BEIGE);
    circle(ctx, 34, 26, 6, BEIGE);
    // ── Paw hints at bottom ──
    ctx.fillStyle = BEIGE;
    ctx.beginPath(); ctx.ellipse(17, 43, 5, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(29, 44, 5, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = PINK;
    ctx.fillRect(14,43,3,1); ctx.fillRect(18,43,2,1); ctx.fillRect(21,43,2,1);
    ctx.fillRect(27,44,2,1); ctx.fillRect(30,44,2,1); ctx.fillRect(33,44,2,1);

    // ── Ears — sit on top of head, not splayed sideways ──
    // Left ear (black tortoiseshell)
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.moveTo(16,13); ctx.lineTo(12,4); ctx.lineTo(20,8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.moveTo(16,13); ctx.lineTo(13,6); ctx.lineTo(19,9); ctx.closePath(); ctx.fill();
    // Right ear (beige)
    ctx.fillStyle = BEIGE;
    ctx.beginPath(); ctx.moveTo(32,13); ctx.lineTo(28,4); ctx.lineTo(36,8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.moveTo(32,13); ctx.lineTo(29,6); ctx.lineTo(35,9); ctx.closePath(); ctx.fill();

    // ── Flat Persian face ──
    circle(ctx, 24, 22, 11, FACE);
    circle(ctx, 24, 22, 9, FACE);

    // ── Large yellow eyes ──
    // Outer glow
    ctx.fillStyle = 'rgba(220,168,0,0.25)';
    ctx.beginPath(); ctx.ellipse(18, 21, 7, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30, 21, 7, 6, 0, 0, Math.PI*2); ctx.fill();
    // Iris
    ctx.fillStyle = EYE_Y;
    ctx.beginPath(); ctx.ellipse(18, 21, 5.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30, 21, 5.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
    // Inner amber
    ctx.fillStyle = EYE_AM;
    ctx.beginPath(); ctx.ellipse(18, 21, 3.5, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30, 21, 3.5, 3, 0, 0, Math.PI*2); ctx.fill();
    // Vertical slit pupils
    ctx.fillStyle = PUPIL;
    ctx.fillRect(17, 16, 2, 10);
    ctx.fillRect(29, 16, 2, 10);
    // Eye shine
    ctx.fillStyle = 'rgba(255,255,220,0.8)';
    ctx.fillRect(20, 18, 2, 3);
    ctx.fillRect(32, 18, 2, 3);

    // ── Flat nose ──
    ctx.fillStyle = NOSE;
    ctx.beginPath(); ctx.ellipse(24, 26, 3, 2, 0, 0, Math.PI*2); ctx.fill();
    // Mouth — small M shape
    ctx.fillStyle = '#a05060';
    ctx.fillRect(21,28,3,1); ctx.fillRect(25,28,3,1); ctx.fillRect(23,29,3,1);

    // ── Whisker dots ──
    ctx.fillStyle = '#9a9080';
    [13,16].forEach(function(x) { ctx.fillRect(x, 24, 1, 1); ctx.fillRect(x, 27, 1, 1); });
    [31,34].forEach(function(x) { ctx.fillRect(x, 24, 1, 1); ctx.fillRect(x, 27, 1, 1); });
  }

  function genDonut() {
    var c = canvas(CS, CS), ctx = ctx2d(c);
    _donutBase(ctx);
    outline(ctx, '#14080c', CS, CS);
    return c;
  }

  function genDonutGlow() {
    var c = canvas(CS, CS), ctx = ctx2d(c);
    var g = ctx.createRadialGradient(CS/2, CS/2, 4, CS/2, CS/2, CS/2 - 2);
    g.addColorStop(0, 'rgba(240,200,20,0.85)');
    g.addColorStop(0.4, 'rgba(200,140,0,0.4)');
    g.addColorStop(1, 'rgba(160,100,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CS/2, CS/2, CS/2 - 2, 0, Math.PI*2); ctx.fill();
    return c;
  }

  // ── ENEMIES ───────────────────────────────────────────────────────────────

  function genRat() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BRN = '#6a4a30', BRL = '#8a6a4a', BRD = '#4a2e18', PNK = '#c08878';
    // Tail
    ctx.strokeStyle = BRD; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(22, 18); ctx.quadraticCurveTo(28, 22, 26, 30); ctx.stroke();
    // Body
    ctx.fillStyle = BRN; ctx.beginPath(); ctx.ellipse(14, 19, 11, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = BRL; ctx.beginPath(); ctx.ellipse(13, 18, 8, 6, 0, 0, Math.PI*2); ctx.fill();
    // Head
    circle(ctx, 12, 10, 7, BRN);
    circle(ctx, 12, 10, 5, BRL);
    // Snout — wedge
    ctx.fillStyle = BRL;
    ctx.beginPath(); ctx.moveTo(12,10); ctx.lineTo(8,5); ctx.lineTo(16,5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PNK; ctx.fillRect(11,4,3,2);
    // Ears
    circle(ctx, 7, 6, 4, BRD); circle(ctx, 7, 6, 3, PNK);
    circle(ctx, 17, 6, 4, BRD); circle(ctx, 17, 6, 3, PNK);
    // Red eyes — disease vector
    ctx.fillStyle = '#ee1100'; ctx.fillRect(9,8,3,3); ctx.fillRect(14,8,3,3);
    ctx.fillStyle = '#000'; ctx.fillRect(10,8,2,3); ctx.fillRect(15,8,2,3);
    ctx.fillStyle = 'rgba(255,60,0,0.5)'; ctx.fillRect(9,8,3,3); ctx.fillRect(14,8,3,3);
    outline(ctx, '#18080c', T, T);
    return c;
  }

  function genGoblin() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var G = '#3a7228', GD = '#285018', GL = '#4a8a38', SKIN = '#5a9a40';
    // Legs
    rect(ctx, 9, 22, 5, 8, GD); rect(ctx, 18, 22, 5, 8, GD);
    // Body
    ctx.fillStyle = '#4a3820'; ctx.beginPath(); ctx.ellipse(16,18,8,6,0,0,Math.PI*2); ctx.fill();
    // Arms
    circle(ctx, 6, 17, 4, GD); circle(ctx, 26, 17, 4, GD);
    circle(ctx, 4, 21, 3, G); circle(ctx, 28, 21, 3, G);
    // Head
    circle(ctx, 16, 9, 7, G);
    // Big ears
    ctx.fillStyle = GD;
    ctx.beginPath(); ctx.moveTo(9,7); ctx.lineTo(3,3); ctx.lineTo(8,12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23,7); ctx.lineTo(29,3); ctx.lineTo(24,12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cc8860';
    ctx.beginPath(); ctx.moveTo(9,7); ctx.lineTo(5,5); ctx.lineTo(8,10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23,7); ctx.lineTo(27,5); ctx.lineTo(24,10); ctx.closePath(); ctx.fill();
    // Eyes — yellow
    ctx.fillStyle = '#ddcc00';
    ctx.beginPath(); ctx.ellipse(13,9,2.5,2,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(19,9,2.5,2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(13,8,2,3); ctx.fillRect(19,8,2,3);
    // Teeth
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(14,13,2,2); ctx.fillRect(17,13,2,2);
    outline(ctx, '#0a1a08', T, T);
    return c;
  }

  function genCrackCamel() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var TAN = '#c8a050', DARK = '#a07830', LITE = '#d8b870';
    // Legs (four stubs)
    rect(ctx, 7, 24, 4, 8, DARK); rect(ctx, 13, 25, 4, 7, DARK);
    rect(ctx, 17, 25, 4, 7, DARK); rect(ctx, 23, 24, 4, 8, DARK);
    // Body
    ctx.fillStyle = TAN; ctx.beginPath(); ctx.ellipse(16, 19, 11, 7, 0, 0, Math.PI*2); ctx.fill();
    // Two humps visible from above
    circle(ctx, 11, 14, 5, TAN); circle(ctx, 21, 14, 5, TAN);
    circle(ctx, 11, 13, 4, LITE); circle(ctx, 21, 13, 4, LITE);
    // Neck + head
    rect(ctx, 14, 7, 6, 8, TAN);
    circle(ctx, 17, 6, 5, TAN);
    circle(ctx, 17, 6, 4, LITE);
    // Bloodshot eyes
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(14,5,2.5,2,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20,5,2.5,2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc0000'; ctx.fillRect(14,4,2,3); ctx.fillRect(20,4,2,3);
    ctx.fillStyle = '#000'; ctx.fillRect(15,4,1,3); ctx.fillRect(21,4,1,3);
    // Red veins in eyes
    ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(12,5); ctx.lineTo(14,5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18,5); ctx.lineTo(20,5); ctx.stroke();
    outline(ctx, '#200c00', T, T);
    return c;
  }

  function genFairy() {
    var c = canvas(24, 24), ctx = ctx2d(c);
    var PK = '#e060cc', PD = '#a030a0', WG = 'rgba(180,220,255,0.6)';
    // Wings (translucent)
    ctx.fillStyle = WG;
    ctx.beginPath(); ctx.ellipse(8, 10, 7, 4, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, 10, 7, 4, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, 14, 6, 3, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, 14, 6, 3, -0.3, 0, Math.PI*2); ctx.fill();
    // Body
    circle(ctx, 12, 13, 4, PK);
    // Head
    circle(ctx, 12, 8, 4, '#f0e0ff');
    // Tiny crown
    ctx.fillStyle = '#ffdd00';
    ctx.fillRect(9,5,6,2); ctx.fillRect(9,3,2,3); ctx.fillRect(12,3,2,3); ctx.fillRect(15,3,2,3);
    // Eyes — glowing
    ctx.fillStyle = '#00ffcc';
    ctx.fillRect(10,8,2,2); ctx.fillRect(14,8,2,2);
    // Wand glow
    ctx.strokeStyle = '#ffffa0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(18,18); ctx.lineTo(22,22); ctx.stroke();
    circle(ctx, 18, 17, 2, '#ffff80');
    outline(ctx, '#180820', 24, 24);
    return c;
  }

  function genSkeleton() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var W = '#e8e0d0', WD = '#c0b8a8', WY = '#d0c890';
    // Feet
    ctx.fillStyle = WD; ctx.beginPath(); ctx.ellipse(11,30,4,2,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(21,30,4,2,0,0,Math.PI*2); ctx.fill();
    // Legs (bones)
    rect(ctx, 9, 22, 4, 9, W); rect(ctx, 19, 22, 4, 9, W);
    circle(ctx, 11, 22, 3, WD); circle(ctx, 21, 22, 3, WD);
    // Pelvis
    ctx.fillStyle = WD; ctx.beginPath(); ctx.ellipse(16,21,7,3,0,0,Math.PI*2); ctx.fill();
    // Spine
    rect(ctx, 14, 13, 4, 9, W);
    // Ribcage
    for (var i = 0; i < 3; i++) {
      var ry = 13 + i * 3;
      ctx.strokeStyle = W; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(16, ry + 1, 6, Math.PI * 1.1, 0, false); ctx.stroke();
    }
    // Arms
    rect(ctx, 5, 14, 9, 3, W); rect(ctx, 18, 14, 9, 3, W);
    circle(ctx, 5, 15, 3, WD); circle(ctx, 27, 15, 3, WD);
    circle(ctx, 5, 15, 2, W); circle(ctx, 27, 15, 2, W);
    // Skull
    circle(ctx, 16, 8, 6, W);
    circle(ctx, 16, 8, 5, WY);
    // Eye sockets
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(13,8,2.5,2,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(19,8,2.5,2,0,0,Math.PI*2); ctx.fill();
    // Nose cavity
    rect(ctx, 15, 11, 2, 2, '#181410');
    // Teeth
    ctx.fillStyle = WD;
    for (var t = 0; t < 4; t++) { ctx.fillRect(13 + t * 2, 13, 1, 2); }
    outline(ctx, '#0c0a08', T, T);
    return c;
  }

  // ── GUILDMASTER NPC — Mordecai (skyfowl / eagle-headed) ─────────────────────
  // Lore: Mordecai is skyfowl species (eagle-headed). Wears Borant Corp uniform.
  // Glowing hand grants HUD access (wetware activation mechanic).

  function genGuildmaster() {
    var c = canvas(T, T), ctx = ctx2d(c);

    var F1   = '#7a5828';  // tawny brown feathers
    var F2   = '#a07840';  // lighter feathers / face
    var F3   = '#4a3010';  // dark crown / wing feathers
    var BEK  = '#e8c020';  // golden beak
    var BEKD = '#aa8c10';  // beak shadow / hook tip
    var EYE  = '#dd9900';  // amber raptor iris
    var UNI  = '#1e1c38';  // Borant Corp uniform (dark navy)
    var UNID = '#0d0c1c';  // uniform shadow
    var UNIL = '#2e2c52';  // uniform highlight
    var TRIM = '#b09030';  // gold trim (Borant livery)
    var GLOW = '#ffdd44';

    // ── Uniform body ─────────────────────────────────────────────────────────
    ctx.fillStyle = UNI;
    ctx.beginPath(); ctx.moveTo(7,14); ctx.lineTo(25,14); ctx.lineTo(28,31); ctx.lineTo(4,31); ctx.closePath(); ctx.fill();
    // Side shadow panels
    ctx.fillStyle = UNID;
    ctx.beginPath(); ctx.moveTo(7,14); ctx.lineTo(11,14); ctx.lineTo(9,31); ctx.lineTo(4,31); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(21,14); ctx.lineTo(25,14); ctx.lineTo(28,31); ctx.lineTo(23,31); ctx.closePath(); ctx.fill();
    // Center chest panel
    ctx.fillStyle = UNIL;
    ctx.beginPath(); ctx.moveTo(13,14); ctx.lineTo(19,14); ctx.lineTo(20,31); ctx.lineTo(12,31); ctx.closePath(); ctx.fill();
    // Gold shoulder trim
    ctx.fillStyle = TRIM;
    ctx.fillRect(7, 14, 18, 2);
    ctx.fillRect(7, 14, 1, 12); ctx.fillRect(24, 14, 1, 12);
    // Borant insignia — small chevron on chest
    ctx.fillStyle = TRIM;
    ctx.fillRect(14, 18, 4, 1); ctx.fillRect(15, 19, 2, 1);

    // ── Left arm (hanging) ───────────────────────────────────────────────────
    rect(ctx, 2, 15, 5, 9, UNID);
    // Talon/hand hint
    ctx.fillStyle = F1;
    ctx.fillRect(2, 23, 2, 3); ctx.fillRect(4, 23, 2, 3); ctx.fillRect(6, 22, 2, 3);

    // ── Right arm — raised, glowing hand ─────────────────────────────────────
    rect(ctx, 25, 12, 5, 9, UNID);
    // Glow aura
    ctx.fillStyle = 'rgba(255,220,50,0.45)';
    ctx.beginPath(); ctx.arc(28, 11, 7, 0, Math.PI*2); ctx.fill();
    // Talon/hand
    ctx.fillStyle = F1;
    ctx.fillRect(25, 8, 2, 4); ctx.fillRect(27, 7, 2, 5); ctx.fillRect(29, 8, 3, 4);
    // Gold glow core
    ctx.fillStyle = GLOW;
    ctx.beginPath(); ctx.arc(28, 10, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(27, 9, 2, 2);

    // ── Eagle head ───────────────────────────────────────────────────────────
    // Main head — tawny brown
    circle(ctx, 16, 7, 7, F1);
    // Lighter face area
    ctx.fillStyle = F2;
    ctx.beginPath(); ctx.ellipse(16, 9, 5, 5, 0, 0, Math.PI*2); ctx.fill();
    // Crown tufts (raised feathers — authority display)
    ctx.fillStyle = F3;
    ctx.beginPath(); ctx.moveTo(12,4); ctx.lineTo(13,0); ctx.lineTo(15,4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(15,3); ctx.lineTo(16,0); ctx.lineTo(18,3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18,4); ctx.lineTo(20,1); ctx.lineTo(21,5); ctx.closePath(); ctx.fill();
    // Dark wing-stripe across forehead
    ctx.fillStyle = F3;
    ctx.fillRect(11, 5, 10, 2);

    // ── Raptor eyes — amber, forward-facing, piercing ────────────────────────
    // Brow ridge shadow
    ctx.fillStyle = F3;
    ctx.fillRect(11, 6, 4, 1); ctx.fillRect(18, 6, 4, 1);
    // Iris
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(14, 8, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, 8, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();
    // Dark slit pupil
    ctx.fillStyle = '#080400';
    ctx.fillRect(13, 6, 2, 4); ctx.fillRect(19, 6, 2, 4);
    // Eye shine
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.fillRect(13, 6, 1, 1); ctx.fillRect(19, 6, 1, 1);

    // ── Hooked beak — upper and lower mandible ───────────────────────────────
    ctx.fillStyle = BEK;
    // Upper mandible — hooks down past lower
    ctx.beginPath();
    ctx.moveTo(13, 10); ctx.lineTo(19, 10);
    ctx.lineTo(19, 12); ctx.lineTo(17, 15); ctx.lineTo(15, 14);
    ctx.lineTo(13, 12); ctx.closePath();
    ctx.fill();
    // Lower mandible
    ctx.fillStyle = BEKD;
    ctx.beginPath();
    ctx.moveTo(14, 12); ctx.lineTo(18, 12); ctx.lineTo(17, 14); ctx.lineTo(15, 14); ctx.closePath();
    ctx.fill();
    // Cere (fleshy base of beak — pale yellow-green)
    ctx.fillStyle = '#ccaa30';
    ctx.fillRect(14, 9, 4, 2);
    // Beak center ridge line
    ctx.fillStyle = '#f0cc30';
    ctx.fillRect(15, 10, 2, 4);

    // ── Neck feathers — collar between head and uniform ──────────────────────
    ctx.fillStyle = F1;
    ctx.beginPath(); ctx.moveTo(10,14); ctx.lineTo(22,14); ctx.lineTo(20,17); ctx.lineTo(12,17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = F3;
    ctx.fillRect(14, 14, 4, 2);

    outline(ctx, '#080614', T, T);
    return c;
  }

  // ── BUGABOO — Mordecai's Floor 2 avatar ──────────────────────────────────
  // Lore: bear-like, obsidian fur, enormous owlish eyes, no neck, skinny legs, 7ft tall.
  // Solitary creatures found on lower floors. Non-Combatant NPC. Level 50.

  function genBugaboo() {
    var c = canvas(T, T), ctx = ctx2d(c);

    var FUR  = '#0d0d14';  // obsidian near-black fur
    var FURL = '#1e1e2e';  // fur highlight (subtle blue-black)
    var FURD = '#060608';  // fur deep shadow
    var EYE  = '#e8f4ff';  // enormous owlish eyes — pale blue-white
    var EYEG = '#b8d8ff';  // eye glow ring
    var PUP  = '#0a0a10';  // pupil
    var SHIN = '#ffffff';  // eye shine

    // ── Skinny legs — disproportionately thin ────────────────────────────────
    rect(ctx, 11, 25, 3, 7, FURD);
    rect(ctx, 18, 25, 3, 7, FURD);
    // Feet — stubby
    ctx.fillStyle = FUR;
    ctx.fillRect(10, 30, 5, 2);
    ctx.fillRect(17, 30, 5, 2);

    // ── Body — wide rounded bear torso, no neck ───────────────────────────────
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.ellipse(16, 20, 10, 8, 0, 0, Math.PI*2); ctx.fill();
    // Fur texture highlight along top
    ctx.fillStyle = FURL;
    ctx.beginPath(); ctx.ellipse(16, 16, 7, 4, 0, 0, Math.PI*2); ctx.fill();
    // Deep shadow underside
    ctx.fillStyle = FURD;
    ctx.beginPath(); ctx.ellipse(16, 23, 8, 4, 0, 0, Math.PI*2); ctx.fill();

    // ── Arms — short, hanging at sides ───────────────────────────────────────
    ctx.fillStyle = FURD;
    ctx.beginPath(); ctx.ellipse(7, 20, 3, 5, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(25, 20, 3, 5, -0.3, 0, Math.PI*2); ctx.fill();
    // Claws — 3 per hand, barely visible
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(4, 24, 2, 1); ctx.fillRect(6, 25, 2, 1); ctx.fillRect(8, 24, 2, 1);
    ctx.fillRect(22, 24, 2, 1); ctx.fillRect(24, 25, 2, 1); ctx.fillRect(26, 24, 2, 1);

    // ── Head — large, sits directly on body (no neck) ────────────────────────
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.ellipse(16, 10, 9, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = FURL;
    ctx.beginPath(); ctx.ellipse(16, 8, 6, 5, 0, 0, Math.PI*2); ctx.fill();

    // ── Round ears ────────────────────────────────────────────────────────────
    ctx.fillStyle = FUR;
    circle(ctx, 8, 4, 3, FUR);
    circle(ctx, 24, 4, 3, FUR);
    ctx.fillStyle = FURD;
    circle(ctx, 8, 4, 1.5, FURD);
    circle(ctx, 24, 4, 1.5, FURD);

    // ── Enormous owlish eyes — defining feature ───────────────────────────────
    // Glow rings (slightly larger than iris)
    ctx.fillStyle = EYEG;
    ctx.beginPath(); ctx.ellipse(12, 10, 5, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, 10, 5, 5, 0, 0, Math.PI*2); ctx.fill();
    // Iris — pale blue-white, huge
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(12, 10, 4, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, 10, 4, 4, 0, 0, Math.PI*2); ctx.fill();
    // Pupil — round, black
    ctx.fillStyle = PUP;
    ctx.beginPath(); ctx.ellipse(12, 10, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, 10, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
    // Eye shine — two dots each
    ctx.fillStyle = SHIN;
    ctx.fillRect(11, 8, 1, 1); ctx.fillRect(13, 9, 1, 1);
    ctx.fillRect(19, 8, 1, 1); ctx.fillRect(21, 9, 1, 1);

    // ── Snout — small, barely visible under eyes ──────────────────────────────
    ctx.fillStyle = FURD;
    ctx.beginPath(); ctx.ellipse(16, 14, 3, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#181820';
    ctx.fillRect(15, 13, 2, 1); // nostrils hint

    outline(ctx, '#000000', T, T);
    return c;
  }

  // ── PROJECTILES / EFFECTS ─────────────────────────────────────────────────

  function genMagicMissile() {
    var c = canvas(16, 16), ctx = ctx2d(c);
    var g = ctx.createRadialGradient(8,8,1,8,8,7);
    g.addColorStop(0,'#ffffff'); g.addColorStop(0.3,'#aaddff');
    g.addColorStop(0.7,'#2266ff'); g.addColorStop(1,'rgba(0,30,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(8, 8, 7, 0, Math.PI*2); ctx.fill();
    // Sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(7,2,2,2); ctx.fillRect(2,7,2,2); ctx.fillRect(12,7,2,2); ctx.fillRect(7,12,2,2);
    return c;
  }

  function genHealOrb() {
    var c = canvas(14, 14), ctx = ctx2d(c);
    var g = ctx.createRadialGradient(7,7,1,7,7,6);
    g.addColorStop(0,'#ffffff'); g.addColorStop(0.4,'#88ffaa'); g.addColorStop(1,'rgba(0,180,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(7,7,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#00ff88'; ctx.fillRect(6,2,2,10); ctx.fillRect(2,6,10,2);
    return c;
  }

  function genXPOrb() {
    var c = canvas(10, 10), ctx = ctx2d(c);
    var g = ctx.createRadialGradient(5,5,1,5,5,4);
    g.addColorStop(0,'#ffffff'); g.addColorStop(0.4,'#ffee44'); g.addColorStop(1,'rgba(220,150,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(5,5,4,0,Math.PI*2); ctx.fill();
    return c;
  }

  function genSlash() {
    var c = canvas(44, 44), ctx = ctx2d(c);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(4,4); ctx.lineTo(40,40); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,210,255,0.5)'; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10,4); ctx.lineTo(44,38); ctx.stroke();
    return c;
  }

  // ── ITEMS ─────────────────────────────────────────────────────────────────

  function genLootBox(open) {
    var c = canvas(T, T), ctx = ctx2d(c);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(16,28,11,4,0,0,Math.PI*2); ctx.fill();
    // Box body
    ctx.fillStyle = open ? '#3a1e0a' : '#7a4a20';
    ctx.fillRect(5, 11, 22, 15);
    // Wood grain
    ctx.fillStyle = open ? '#2a1208' : '#5a3010';
    ctx.fillRect(5, 11, 22, 2); ctx.fillRect(5, 17, 22, 2);
    // Sides
    ctx.fillStyle = open ? '#4a2a10' : '#8a5a28';
    ctx.fillRect(5, 11, 3, 15); ctx.fillRect(24, 11, 3, 15);
    // Metal bands
    ctx.fillStyle = '#c0900a'; ctx.fillRect(5,16,22,2); ctx.fillRect(14,11,4,15);
    // Rivets
    circle(ctx, 16, 11, 2, '#d4a820'); circle(ctx, 16, 26, 2, '#d4a820');
    if (!open) {
      // Padlock
      ctx.fillStyle = '#e8c030'; ctx.fillRect(13,17,6,5); ctx.fillRect(14,14,4,4);
      ctx.fillStyle = '#8a6800'; ctx.fillRect(15,19,2,2);
    } else {
      // Lid open + glow
      ctx.fillStyle = '#7a4a20'; ctx.fillRect(5,5,22,7);
      ctx.fillStyle = '#5a3010'; ctx.fillRect(5,5,22,2);
      var g = ctx.createRadialGradient(16,14,0,16,14,10);
      g.addColorStop(0,'rgba(255,220,50,0.8)'); g.addColorStop(1,'rgba(255,180,0,0)');
      ctx.fillStyle = g; ctx.fillRect(7,11,18,13);
    }
    outline(ctx, '#0a0400', T, T);
    return c;
  }

  function genPotion() {
    var c = canvas(20, 24), ctx = ctx2d(c);
    // Cork
    ctx.fillStyle = '#8a6040'; ctx.fillRect(8,4,5,4);
    ctx.fillStyle = '#6a4020'; ctx.fillRect(8,4,5,1);
    // Bottle
    ctx.fillStyle = '#88aacc'; ctx.fillRect(7,7,7,12); ctx.fillRect(5,10,11,7);
    ctx.fillStyle = '#aaccee'; ctx.fillRect(8,8,5,10); ctx.fillRect(6,11,9,5);
    // Liquid
    ctx.fillStyle = '#cc2244'; ctx.fillRect(7,13,7,6); ctx.fillRect(5,14,11,3);
    // Bubble
    circle(ctx, 10, 15, 1, '#ff6688');
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(8,8,2,7);
    outline(ctx, '#0a0408', 20, 24);
    return c;
  }

  function genWeapon() {
    var c = canvas(24, 24), ctx = ctx2d(c);
    // Blade
    ctx.fillStyle = '#d0d0d8'; ctx.fillRect(4,2,4,14);
    ctx.fillStyle = '#b0b0b8'; ctx.fillRect(6,2,2,14);
    // Tip
    ctx.fillStyle = '#d0d0d8';
    ctx.beginPath(); ctx.moveTo(4,2); ctx.lineTo(8,2); ctx.lineTo(6,0); ctx.closePath(); ctx.fill();
    // Guard
    ctx.fillStyle = '#c8a030'; ctx.fillRect(2,15,10,2);
    // Grip
    ctx.fillStyle = '#5a3010'; ctx.fillRect(4,17,4,5);
    ctx.fillStyle = '#7a4820'; ctx.fillRect(4,17,2,5);
    // Pommel
    circle(ctx, 6, 23, 2, '#c8a030');
    outline(ctx, '#080808', 24, 24);
    return c;
  }

  function genArmor() {
    var c = canvas(24, 24), ctx = ctx2d(c);
    // Chest plate
    ctx.fillStyle = '#6a6878'; ctx.beginPath(); ctx.ellipse(12,13,9,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#7a7888';
    ctx.beginPath(); ctx.ellipse(12,12,8,7,0,0,Math.PI*2); ctx.fill();
    // Shoulder guards
    circle(ctx, 5, 9, 5, '#5a5868');
    circle(ctx, 19, 9, 5, '#5a5868');
    circle(ctx, 5, 9, 4, '#6a6878');
    circle(ctx, 19, 9, 4, '#6a6878');
    // Rivet details
    ctx.fillStyle = '#a0a0b0';
    circle(ctx, 8, 10, 1, null); circle(ctx, 16, 10, 1, null);
    circle(ctx, 12, 8, 1, null);
    // Center groove
    ctx.fillStyle = '#4a4858'; ctx.fillRect(11,7,2,12);
    outline(ctx, '#080810', 24, 24);
    return c;
  }

  // ── BOSS: THE HOARDER ────────────────────────────────────────────────────
  // 48×48 sprite — hunched figure buried under piled junk
  function genHoarder() {
    var c = canvas(48, 48), ctx = ctx2d(c);
    var SKIN = '#b07848', DARK = '#704820', JUNK1 = '#888888', JUNK2 = '#cc9944', JUNK3 = '#446688';
    // Shadow blob
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(24, 43, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Legs — thick, bent
    rect(ctx, 10, 34, 8, 12, DARK); rect(ctx, 28, 34, 8, 12, DARK);
    rect(ctx, 11, 38, 7, 8, SKIN);  rect(ctx, 29, 38, 7, 8, SKIN);
    // Body — hunched, wide
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(24, 28, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    // Torn shirt
    ctx.fillStyle = '#5566aa';
    ctx.beginPath(); ctx.ellipse(24, 29, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    // Arms reaching forward
    rect(ctx, 4, 26, 10, 6, SKIN); rect(ctx, 34, 26, 10, 6, SKIN);
    // Fists
    circle(ctx, 7, 29, 4, DARK); circle(ctx, 41, 29, 4, DARK);
    // Head — big, angry
    circle(ctx, 24, 17, 10, SKIN);
    circle(ctx, 24, 17, 9, SKIN);
    // Brow ridge (angry)
    ctx.fillStyle = DARK;
    ctx.beginPath(); ctx.moveTo(14,14); ctx.lineTo(22,16); ctx.lineTo(22,13); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34,14); ctx.lineTo(26,16); ctx.lineTo(26,13); ctx.closePath(); ctx.fill();
    // Eyes — red angry
    ctx.fillStyle = '#cc2200'; ctx.fillRect(17, 15, 4, 4); ctx.fillRect(27, 15, 4, 4);
    ctx.fillStyle = '#000';    ctx.fillRect(18, 16, 2, 3); ctx.fillRect(28, 16, 2, 3);
    // Mouth — open snarl
    ctx.fillStyle = '#330000';
    ctx.beginPath(); ctx.ellipse(24, 23, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(20,22,3,2); ctx.fillRect(25,22,3,2);
    // Junk pile on back (stacked above body)
    // Toaster
    rect(ctx, 16, 6, 10, 7, JUNK1);
    rect(ctx, 18, 4, 2, 3, DARK); rect(ctx, 22, 4, 2, 3, DARK);
    ctx.fillStyle = '#444'; ctx.fillRect(17, 8, 8, 4);
    // Lamp shade
    ctx.fillStyle = JUNK2;
    ctx.beginPath(); ctx.moveTo(28, 12); ctx.lineTo(38, 8); ctx.lineTo(40, 14); ctx.lineTo(30, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffdd88'; ctx.fillRect(31, 9, 5, 4);
    // Bag strap
    ctx.strokeStyle = JUNK3; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 12); ctx.quadraticCurveTo(8, 22, 12, 28); ctx.stroke();
    // Rivets on shirt
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(20,27,2,2); ctx.fillRect(26,27,2,2); ctx.fillRect(23,31,2,2);
    outline(ctx, '#200800', 48, 48);
    return c;
  }

  function genRotSticker() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var SHELL = '#3a3018', LIGHT = '#5a4e2a', ACC = '#cc4400', SPOT = '#888866';
    // Ravioli-shaped body — flat oval
    ctx.fillStyle = SHELL;
    ctx.beginPath(); ctx.ellipse(16, 18, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIGHT;
    ctx.beginPath(); ctx.ellipse(15, 17, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Seam line (ravioli crimp)
    ctx.strokeStyle = SHELL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(16, 18, 13, 9, 0, 0, Math.PI * 2); ctx.stroke();
    // Spots
    circle(ctx, 11, 15, 2, SPOT); circle(ctx, 19, 14, 2, SPOT); circle(ctx, 15, 21, 2, SPOT);
    // Stubby legs (cling grips) — 6 of them
    ctx.fillStyle = SHELL;
    ctx.fillRect(4, 14, 4, 3); ctx.fillRect(4, 20, 4, 3);
    ctx.fillRect(26, 14, 4, 3); ctx.fillRect(26, 20, 4, 3);
    ctx.fillRect(13, 7, 3, 4); ctx.fillRect(19, 7, 3, 4);
    // Eyes — two tiny red beads
    ctx.fillStyle = ACC; ctx.fillRect(12, 13, 3, 3); ctx.fillRect(19, 13, 3, 3);
    ctx.fillStyle = '#000'; ctx.fillRect(13, 14, 2, 2); ctx.fillRect(20, 14, 2, 2);
    // Fuse-like antenna (detonator)
    ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 9); ctx.quadraticCurveTo(22, 4, 26, 6); ctx.stroke();
    circle(ctx, 26, 6, 3, '#ffdd00');
    outline(ctx, '#180e00', T, T);
    return c;
  }

  function genDangerDingo() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var FUR = '#c8a050', FDARK = '#8a6020', FBELLY = '#e8c880';
    var PAINT = '#111111'; // corpse paint — black face markings
    // Body — low, muscular dog
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.ellipse(20, 24, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = FBELLY;
    ctx.beginPath(); ctx.ellipse(20, 26, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Legs (4 stubby)
    rect(ctx, 8,  28, 5, 8, FDARK); rect(ctx, 14, 29, 5, 7, FUR);
    rect(ctx, 24, 28, 5, 8, FDARK); rect(ctx, 30, 29, 5, 7, FUR);
    // Tail (curved right)
    ctx.strokeStyle = FUR; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(33, 20); ctx.quadraticCurveTo(40, 14, 38, 10); ctx.stroke();
    // Head — large, forward
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.ellipse(8, 20, 9, 7, -0.3, 0, Math.PI * 2); ctx.fill();
    // Ears (upright, pointed)
    ctx.fillStyle = FDARK;
    ctx.beginPath(); ctx.moveTo(5, 14); ctx.lineTo(2, 6); ctx.lineTo(9, 12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(11, 13); ctx.lineTo(10, 5); ctx.lineTo(16, 12); ctx.closePath(); ctx.fill();
    // Corpse paint — black eye patches + stripe across snout
    ctx.fillStyle = PAINT;
    ctx.beginPath(); ctx.ellipse(6, 19, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, 18, 4, 3, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(4, 22, 10, 2); // snout stripe
    // Eyes — glowing white in paint
    ctx.fillStyle = '#ffffff'; ctx.fillRect(4, 18, 3, 3); ctx.fillRect(10, 17, 3, 3);
    ctx.fillStyle = '#cc2200'; ctx.fillRect(5, 19, 2, 2); ctx.fillRect(11, 18, 2, 2);
    // Fangs
    ctx.fillStyle = '#eeeeee'; ctx.fillRect(3, 23, 2, 4); ctx.fillRect(6, 23, 2, 4);
    outline(ctx, '#3a2000', T, T);
    return c;
  }

  function genBrindleGrub() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BODY = '#8a7a4a', BDARK = '#6a5a30', BLIGHT = '#b09a60';
    var RING = '#7a6a38', SEG = '#c8b870', EYE = '#cc3300';
    // Fat segmented worm body — horizontal oval, no legs
    ctx.fillStyle = BDARK;
    ctx.beginPath(); ctx.ellipse(16, 20, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(16, 19, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Highlight
    ctx.fillStyle = BLIGHT;
    ctx.beginPath(); ctx.ellipse(14, 17, 6, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    // Segment rings — 4 across body
    ctx.strokeStyle = RING; ctx.lineWidth = 1.5;
    for (var sx = 8; sx <= 24; sx += 5) {
      ctx.beginPath(); ctx.ellipse(sx, 19, 2, 7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // Tail knob (right)
    ctx.fillStyle = BDARK;
    ctx.beginPath(); ctx.ellipse(29, 20, 3, 5, 0.2, 0, Math.PI * 2); ctx.fill();
    // Head (left) — slightly larger, blunt
    ctx.fillStyle = BDARK;
    ctx.beginPath(); ctx.ellipse(5, 20, 5, 7, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(5, 19, 4, 6, -0.1, 0, Math.PI * 2); ctx.fill();
    // Eyes — tiny red beads
    circle(ctx, 4, 16, 2, EYE);
    ctx.fillStyle = '#000'; ctx.fillRect(3, 15, 2, 2);
    // Mouth — small dark slit
    ctx.fillStyle = BDARK; ctx.fillRect(2, 21, 5, 2);
    outline(ctx, '#2a1e00', T, T);
    return c;
  }

  // ── BOPCA PROTECTOR (merchant NPC) ───────────────────────────────────────
  // Lore: gnome-like, brown hair (green tinge), huge beard, blue apron, paper hat, nametag
  function genBopca() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var HAIR  = '#4a3a18';   // brown with mossy undertone
    var BEARD = '#5a4a28';
    var SKIN  = '#c8906a';
    var SKIND = '#a06848';
    var APRON = '#2a4a8a';   // blue apron
    var APRONI= '#3a5aaa';   // apron highlight
    var HAT   = '#e8e0cc';   // paper hat (waffle house style)
    var HATD  = '#c8c0aa';
    var NOSE  = '#cc5040';   // bulbous red nose

    // ── Paper hat (flat cylinder, top of head) ───────────────────────────────
    ctx.fillStyle = HAT;
    ctx.fillRect(9, 2, 14, 7);          // hat cylinder
    ctx.fillStyle = HATD;
    ctx.fillRect(9, 2, 14, 1);          // top stripe
    ctx.fillRect(9, 8, 14, 1);          // brim line
    ctx.fillStyle = HAT;
    ctx.fillRect(7, 8, 18, 2);          // brim width

    // ── Head (round, squat) ──────────────────────────────────────────────────
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(16, 13, 7, 0, Math.PI * 2); ctx.fill();

    // ── Eyes — small black beads above beard ─────────────────────────────────
    ctx.fillStyle = '#111111';
    ctx.fillRect(11, 11, 3, 3);
    ctx.fillRect(18, 11, 3, 3);
    // Eyebrow-ridge shadow
    ctx.fillStyle = HAIR;
    ctx.fillRect(10, 10, 4, 1);
    ctx.fillRect(18, 10, 4, 1);

    // ── Bulbous red-veined nose ───────────────────────────────────────────────
    ctx.fillStyle = NOSE;
    ctx.beginPath(); ctx.arc(16, 15, 3, 0, Math.PI * 2); ctx.fill();
    // Red veins
    ctx.strokeStyle = '#aa2020'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(16, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, 14); ctx.lineTo(16, 15); ctx.stroke();

    // ── Huge beard (covers chin + lower face completely) ─────────────────────
    ctx.fillStyle = BEARD;
    ctx.beginPath();
    ctx.moveTo(8, 16);
    ctx.lineTo(6, 21); ctx.lineTo(7, 28); ctx.lineTo(10, 31);
    ctx.lineTo(16, 32); ctx.lineTo(22, 31); ctx.lineTo(25, 28);
    ctx.lineTo(26, 21); ctx.lineTo(24, 16);
    ctx.closePath(); ctx.fill();
    // Beard highlight
    ctx.fillStyle = '#7a6a38';
    ctx.beginPath(); ctx.ellipse(16, 24, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Hair color hint (mossy tinge)
    ctx.fillStyle = '#4a5228';
    ctx.fillRect(8, 16, 4, 3);  // left sideburn
    ctx.fillRect(20, 16, 4, 3); // right sideburn

    // ── Body + blue apron ────────────────────────────────────────────────────
    ctx.fillStyle = APRON;
    ctx.fillRect(8, 19, 16, 12);
    ctx.fillStyle = APRONI;
    ctx.fillRect(10, 20, 12, 10);
    // Apron strings at top
    ctx.strokeStyle = APRON; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, 19); ctx.lineTo(6, 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, 19); ctx.lineTo(26, 17); ctx.stroke();
    // Nametag (small rectangle on apron)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 22, 8, 5);
    ctx.fillStyle = '#2244aa';
    ctx.fillRect(13, 23, 6, 1);  // "TALLY" text hint
    ctx.fillRect(13, 25, 4, 1);

    // ── Stubby arms ─────────────────────────────────────────────────────────
    ctx.fillStyle = SKIN;
    ctx.fillRect(2, 20, 6, 8);   // left arm
    ctx.fillRect(24, 20, 6, 8);  // right arm
    ctx.fillStyle = SKIND;
    ctx.fillRect(2, 27, 6, 2); ctx.fillRect(24, 27, 6, 2); // cuffs/hands

    outline(ctx, '#181008', T, T);
    return c;
  }

  function genTrogPygmy() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BDY = '#4a7028', DRK = '#2c4a14', LIT = '#6a9038', CLO = '#6a4a18', WOD = '#7a5820';
    // Tail — curves behind lower body
    ctx.strokeStyle = DRK; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(19, 22); ctx.quadraticCurveTo(27, 25, 28, 31); ctx.stroke();
    // Legs
    rect(ctx, 12, 22, 4, 7, DRK); rect(ctx, 17, 22, 4, 7, DRK);
    // Splayed feet
    rect(ctx, 10, 28, 6, 3, BDY); rect(ctx, 17, 28, 6, 3, BDY);
    // Body
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 18, 6, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = LIT; ctx.beginPath(); ctx.ellipse(15, 17, 4, 3, 0, 0, Math.PI*2); ctx.fill();
    // Scale dots
    circle(ctx, 14, 17, 1, LIT); circle(ctx, 18, 17, 1, LIT); circle(ctx, 16, 21, 1, LIT);
    // Loincloth
    rect(ctx, 10, 21, 12, 3, CLO); rect(ctx, 12, 24, 8, 2, '#3a2808');
    // Left arm — raised with club
    rect(ctx, 6, 15, 6, 3, DRK);
    // Club: shaft + knob
    rect(ctx, 3, 9,  3, 8, WOD); rect(ctx, 1, 8, 7, 3, '#5a3808');
    // Right arm — dangling
    rect(ctx, 21, 17, 5, 3, DRK); rect(ctx, 25, 19, 3, 4, BDY);
    // Neck
    rect(ctx, 14, 13, 5, 5, BDY);
    // Head
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 10, 7, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = LIT; ctx.beginPath(); ctx.ellipse(16, 9, 5, 4, 0, 0, Math.PI*2); ctx.fill();
    // Snout
    ctx.fillStyle = DRK; ctx.beginPath(); ctx.ellipse(16, 14, 5, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 14, 4, 2, 0, 0, Math.PI*2); ctx.fill();
    // Slit eyes
    rect(ctx, 11, 7, 4, 2, '#ccbb00'); rect(ctx, 18, 7, 4, 2, '#ccbb00');
    rect(ctx, 12, 7, 2, 2, '#000');    rect(ctx, 19, 7, 2, 2, '#000');
    outline(ctx, '#102008', T, T);
    return c;
  }

  function genTrogBasher() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BDY = '#3a5a20', DRK = '#1e3610', LIT = '#5a7a30', MUD = '#5a4020', WOD = '#6a4010';
    // Thick tail
    ctx.strokeStyle = DRK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(20, 24); ctx.quadraticCurveTo(28, 27, 29, 31); ctx.stroke();
    // Beefy legs
    rect(ctx, 10, 21, 6, 9, DRK); rect(ctx, 17, 21, 6, 9, DRK);
    rect(ctx, 9, 28, 7, 3, BDY);  rect(ctx, 17, 28, 7, 3, BDY);
    // Wide body
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 17, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIT; ctx.beginPath(); ctx.ellipse(15, 16, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Scale rows
    circle(ctx, 12, 14, 2, LIT); circle(ctx, 17, 14, 2, LIT); circle(ctx, 20, 18, 2, LIT);
    circle(ctx, 13, 19, 2, LIT); circle(ctx, 19, 12, 2, LIT);
    // Arms — thick
    rect(ctx, 4,  15, 7, 4, DRK); // left arm
    rect(ctx, 22, 15, 7, 4, DRK); // right arm
    // Big club — left hand
    rect(ctx, 1,  5, 4, 12, WOD);
    rect(ctx, 0,  4, 6,  5, '#4a2808'); // knob
    // Right fist
    rect(ctx, 29, 18, 4, 5, BDY);
    // Neck + big head
    rect(ctx, 13, 11, 7, 6, BDY);
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 8, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIT; ctx.beginPath(); ctx.ellipse(16, 7, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Low brow ridge
    rect(ctx, 9, 5, 15, 3, DRK);
    // Small eyes deep under brow — yellow
    rect(ctx, 11, 6, 3, 2, '#aaaa00'); rect(ctx, 19, 6, 3, 2, '#aaaa00');
    rect(ctx, 12, 6, 2, 2, '#000');    rect(ctx, 20, 6, 2, 2, '#000');
    // Wide snout / jaw
    ctx.fillStyle = DRK; ctx.beginPath(); ctx.ellipse(16, 13, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 13, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    outline(ctx, '#0c1a04', T, T);
    return c;
  }

  function genTrogVirtuoso() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BDY = '#5a6a18', DRK = '#2e3808', LIT = '#7a8a28', ACC = '#cc4488';
    // Thin tail
    ctx.strokeStyle = DRK; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(18, 23); ctx.quadraticCurveTo(25, 26, 26, 31); ctx.stroke();
    // Legs
    rect(ctx, 11, 22, 4, 8, DRK); rect(ctx, 17, 22, 4, 8, DRK);
    rect(ctx, 9,  28, 6, 3, BDY); rect(ctx, 17, 28, 6, 3, BDY);
    // Slender body
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 18, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIT; ctx.beginPath(); ctx.ellipse(15, 17, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Arms down, no weapon
    rect(ctx, 6, 17, 5, 3, DRK); rect(ctx, 22, 17, 5, 3, DRK);
    rect(ctx, 5, 20, 3, 4, BDY); rect(ctx, 25, 20, 3, 4, BDY);
    // Neck
    rect(ctx, 14, 13, 5, 5, BDY);
    // Head — slightly elongated snout
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 10, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIT; ctx.beginPath(); ctx.ellipse(16, 9,  5, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Long protruding snout
    ctx.fillStyle = DRK; ctx.beginPath(); ctx.ellipse(16, 14, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 14, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    // Tongue extended out — pink/red forked
    ctx.strokeStyle = ACC; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 16); ctx.lineTo(16, 24); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(16, 22); ctx.lineTo(13, 27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 22); ctx.lineTo(19, 27); ctx.stroke();
    // Piercing eyes — larger, brighter
    rect(ctx, 10, 7, 4, 3, '#dddd00'); rect(ctx, 18, 7, 4, 3, '#dddd00');
    rect(ctx, 11, 7, 2, 3, '#000');    rect(ctx, 19, 7, 2, 3, '#000');
    outline(ctx, '#101404', T, T);
    return c;
  }

  function genScatterer() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BDY = '#6b4423', DRK = '#3d2210', LIT = '#8b6040', SEG = '#4a3018';
    // Oval body — horizontal, cockroach-shaped
    ctx.fillStyle = BDY; ctx.beginPath(); ctx.ellipse(16, 18, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Segmented bands
    rect(ctx, 8, 17, 16, 2, SEG); rect(ctx, 9, 20, 14, 2, SEG);
    // Lighter thorax
    ctx.fillStyle = LIT; ctx.beginPath(); ctx.ellipse(16, 14, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.fillStyle = DRK; ctx.beginPath(); ctx.ellipse(16, 9, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Antennae
    ctx.strokeStyle = DRK; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(14, 7); ctx.lineTo(9, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, 7); ctx.lineTo(23, 2); ctx.stroke();
    // 6 legs — 3 per side
    ctx.strokeStyle = DRK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, 14); ctx.lineTo(2, 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, 17); ctx.lineTo(1, 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 21); ctx.lineTo(2, 25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, 14); ctx.lineTo(30, 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25, 17); ctx.lineTo(31, 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, 21); ctx.lineTo(30, 25); ctx.stroke();
    // Eyes
    circle(ctx, 14, 9, 1, '#dd4400'); circle(ctx, 18, 9, 1, '#dd4400');
    outline(ctx, '#1a0800', T, T);
    return c;
  }

  function genBadLlama() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var WHL = '#ddd8c0', DRK = '#9a9080', ORN = '#cc4400', BRN = '#887860';
    // Legs — 4 stumpy posts
    rect(ctx, 8,  22, 4, 9, BRN); rect(ctx, 14, 22, 4, 9, BRN);
    rect(ctx, 18, 22, 4, 9, BRN); rect(ctx, 24, 22, 4, 9, BRN);
    // Hooves
    rect(ctx, 7, 29, 6, 3, DRK); rect(ctx, 13, 29, 6, 3, DRK);
    rect(ctx, 17, 29, 6, 3, DRK); rect(ctx, 23, 29, 6, 3, DRK);
    // Body — wide rectangle + rounded top
    ctx.fillStyle = WHL; ctx.beginPath(); ctx.ellipse(17, 19, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Belly shading
    ctx.fillStyle = DRK; ctx.beginPath(); ctx.ellipse(17, 22, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = WHL; ctx.beginPath(); ctx.ellipse(17, 21, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Long neck
    rect(ctx, 13, 8, 6, 13, WHL); rect(ctx, 14, 8, 4, 12, '#eee8d0');
    // Head — oval, horizontal snout
    ctx.fillStyle = WHL; ctx.beginPath(); ctx.ellipse(16, 5, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Ears
    rect(ctx, 10, 1, 3, 5, WHL); rect(ctx, 20, 1, 3, 5, WHL);
    rect(ctx, 11, 2, 2, 3, '#ffeecc'); rect(ctx, 21, 2, 2, 3, '#ffeecc');
    // Snout / lip with lava glow hint
    ctx.fillStyle = DRK; ctx.beginPath(); ctx.ellipse(16, 8, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ORN; ctx.beginPath(); ctx.ellipse(16, 8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    // Nostrils
    circle(ctx, 14, 8, 1, '#661100'); circle(ctx, 18, 8, 1, '#661100');
    // Eyes
    circle(ctx, 12, 4, 1, '#222'); circle(ctx, 20, 4, 1, '#222');
    outline(ctx, '#2a2010', T, T);
    return c;
  }

  function genScatThug() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var GRY = '#888888', DRK = '#333333', MSK = '#111111', SKN = '#ccaa80', SPR = '#cccccc';
    // Legs — bipedal
    rect(ctx, 11, 21, 5, 9, DRK); rect(ctx, 17, 21, 5, 9, DRK);
    // Feet
    rect(ctx, 9, 28, 7, 3, '#222'); rect(ctx, 17, 28, 7, 3, '#222');
    // Body — compact humanoid
    ctx.fillStyle = GRY; ctx.beginPath(); ctx.ellipse(16, 17, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Arms — left up holding spear, right down
    rect(ctx, 5, 13, 6, 4, GRY);  // left arm
    rect(ctx, 22, 15, 6, 4, GRY); // right arm
    // Spear — thin needle shaft
    ctx.strokeStyle = SPR; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(7, 18); ctx.stroke();
    // Spear tip
    ctx.fillStyle = SPR; ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(7, 3); ctx.lineTo(6, 7); ctx.closePath(); ctx.fill();
    // Neck
    rect(ctx, 14, 11, 5, 6, SKN);
    // Raccoon head — round
    ctx.fillStyle = GRY; ctx.beginPath(); ctx.ellipse(16, 8, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Ears
    circle(ctx, 10, 3, 3, GRY); circle(ctx, 22, 3, 3, GRY);
    circle(ctx, 10, 3, 2, DRK); circle(ctx, 22, 2, 2, DRK);
    // Face mask — raccoon bandit stripe across eyes
    rect(ctx, 9, 6, 14, 4, MSK);
    // Eyes — glinting inside mask
    circle(ctx, 13, 7, 2, '#dd8800'); circle(ctx, 19, 7, 2, '#dd8800');
    circle(ctx, 13, 7, 1, '#000');    circle(ctx, 19, 7, 1, '#000');
    // Snout
    ctx.fillStyle = SKN; ctx.beginPath(); ctx.ellipse(16, 12, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Nose
    circle(ctx, 16, 12, 2, '#554433');
    outline(ctx, '#111111', T, T);
    return c;
  }

  // ── CLURICHAUN (Floor 2) — small troll, ranged slingshot, inflicts The Taint ──
  // Lore: oversized head, hook nose, ruddy cheeks, tattered green overalls, pilgrim shoes
  function genClurichaun() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var SKIN  = '#c06848', SKIND = '#9a4828';
    var GRPN  = '#2a5818'; // green overalls
    var GRPNL = '#3a6a24';
    var NOSE  = '#cc3a2a'; // bulbous red nose
    var HAIR  = '#1a0e06'; // dark curly hair
    var SHOE  = '#2a1e0a'; // buckle shoes

    // Legs + buckle shoes
    rect(ctx, 11, 22, 4, 8, GRPN); rect(ctx, 17, 22, 4, 8, GRPN);
    rect(ctx, 9, 28, 6, 4, SHOE);  rect(ctx, 17, 28, 6, 4, SHOE);
    // Buckles — small gold squares
    ctx.fillStyle = '#c8a020';
    ctx.fillRect(10, 30, 3, 2); ctx.fillRect(18, 30, 3, 2);

    // Torso — tattered green overalls
    ctx.fillStyle = GRPN;
    ctx.beginPath(); ctx.ellipse(16, 18, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = GRPNL;
    ctx.beginPath(); ctx.ellipse(15, 17, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Ragged hem lines
    ctx.strokeStyle = '#1a3a0a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, 22); ctx.lineTo(13, 24); ctx.lineTo(16, 22); ctx.lineTo(19, 24); ctx.lineTo(22, 22); ctx.stroke();

    // Arms — one raised with slingshot, one down
    rect(ctx, 4, 15, 6, 4, SKIN); // left arm (slingshot hand)
    rect(ctx, 22, 16, 5, 4, SKIN); // right arm (down)
    // Slingshot — Y-fork
    ctx.strokeStyle = '#6a4010'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(2, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(7, 8); ctx.stroke();
    ctx.strokeStyle = '#8a7060'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2, 8); ctx.lineTo(7, 8); ctx.stroke();
    // Rock projectile hint
    ctx.fillStyle = '#888070'; ctx.beginPath(); ctx.arc(4, 10, 2, 0, Math.PI * 2); ctx.fill();

    // Neck
    rect(ctx, 13, 11, 6, 5, SKIN);

    // Oversized head — much bigger than body
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(16, 7, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
    // Ruddy cheeks
    ctx.fillStyle = 'rgba(200,80,60,0.35)';
    ctx.beginPath(); ctx.ellipse(9, 8, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(23, 8, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Curly black hair
    ctx.fillStyle = HAIR;
    ctx.beginPath(); ctx.arc(16, 2, 7, Math.PI, 0, false); ctx.fill();
    circle(ctx, 10, 4, 3, HAIR); circle(ctx, 22, 4, 3, HAIR);
    circle(ctx, 13, 2, 3, HAIR); circle(ctx, 19, 2, 3, HAIR); circle(ctx, 16, 0, 3, HAIR);

    // Hook nose — prominent
    ctx.fillStyle = NOSE;
    ctx.beginPath(); ctx.moveTo(13, 9); ctx.lineTo(15, 13); ctx.lineTo(19, 13); ctx.lineTo(20, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aa2a1a';
    ctx.beginPath(); ctx.arc(17, 13, 2, 0, Math.PI * 2); ctx.fill();

    // Eyes — beady, few teeth
    ctx.fillStyle = '#221100';
    ctx.fillRect(11, 6, 3, 3); ctx.fillRect(19, 6, 3, 3);
    ctx.fillStyle = '#ffeecc';
    ctx.fillRect(13, 12, 2, 2); ctx.fillRect(17, 12, 2, 2); // only a couple teeth

    // Sneezing lime-green goo (The Taint aura hint)
    ctx.fillStyle = 'rgba(80,200,40,0.45)';
    ctx.beginPath(); ctx.ellipse(16, 14, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

    outline(ctx, '#0a1804', T, T);
    return c;
  }

  // ── BRINDLED VESPA (Floor 2) — evolved grub, huge hornet + grasping arms ──
  // Lore: giant hornet body, pair of arms with clawed fingers, top face still looks like brindle grub
  function genBrindledVespa() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BODY  = '#c88820', BODYD = '#8a5510', BODYL = '#e8aa30';
    var WING  = 'rgba(180,220,255,0.55)';
    var ARM   = '#b07018', CLAW = '#6a3808';
    var GRB   = '#8a7a4a'; // grub-head remnant coloring

    // Wings — translucent, wasp-style
    ctx.fillStyle = WING;
    ctx.beginPath(); ctx.ellipse(9, 10, 8, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(23, 10, 8, 4, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, 14, 7, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(24, 14, 7, 3, -0.3, 0, Math.PI * 2); ctx.fill();

    // Abdomen — banded yellow/black wasp
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(16, 24, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Black bands
    ctx.fillStyle = '#221100';
    ctx.fillRect(10, 20, 12, 2); ctx.fillRect(10, 24, 12, 2); ctx.fillRect(10, 28, 12, 2);
    // Stinger tip
    ctx.fillStyle = BODYD;
    ctx.beginPath(); ctx.moveTo(14, 32); ctx.lineTo(18, 32); ctx.lineTo(16, 36); ctx.closePath(); ctx.fill();

    // Thorax
    ctx.fillStyle = BODYL;
    ctx.beginPath(); ctx.ellipse(16, 15, 5, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Grasping arms (the unsettling part — grub arms on a hornet)
    rect(ctx, 4, 14, 6, 3, ARM); rect(ctx, 22, 14, 6, 3, ARM);
    // Clawed fingers
    ctx.fillStyle = CLAW;
    ctx.fillRect(2, 14, 3, 2); ctx.fillRect(2, 17, 3, 2); ctx.fillRect(4, 12, 2, 3); // left claws
    ctx.fillRect(27, 14, 3, 2); ctx.fillRect(27, 17, 3, 2); ctx.fillRect(26, 12, 2, 3); // right claws

    // Head — still looks like a brindle grub head (lore-accurate)
    ctx.fillStyle = GRB;
    ctx.beginPath(); ctx.ellipse(16, 8, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b09a60';
    ctx.beginPath(); ctx.ellipse(16, 7, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Bead eyes (grub remnant)
    ctx.fillStyle = '#cc3300'; ctx.fillRect(13, 6, 2, 2); ctx.fillRect(18, 6, 2, 2);
    // Acid spit goo hint — white droplets below mouth
    ctx.fillStyle = 'rgba(255,255,220,0.8)';
    ctx.fillRect(15, 11, 2, 2); ctx.fillRect(13, 13, 2, 1); ctx.fillRect(17, 13, 2, 1);

    outline(ctx, '#180800', T, T);
    return c;
  }

  // ── KOBOLD RIDER (Floor 2) — armored chihuahua-like, beer-can-tab chainmail, lance ──
  // Lore: size of chihuahua standing upright, nearly identical DNA, chainmail of beer can tabs
  function genKoboldRider() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var FUR   = '#c8a868', FURD = '#8a6830', FURL = '#e8c888';
    var MAIL  = '#8a9898'; // beer-can-tab chainmail
    var MAILD = '#5a6868';
    var SPIKE = '#c0c0b0'; // spike on cap
    var LANCE = '#7a5020';

    // Lance — long diagonal shaft
    ctx.strokeStyle = LANCE; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, 28); ctx.lineTo(28, 4); ctx.stroke();
    // Lance tip
    ctx.fillStyle = '#d0c0a0';
    ctx.beginPath(); ctx.moveTo(26, 2); ctx.lineTo(30, 5); ctx.lineTo(28, 7); ctx.closePath(); ctx.fill();
    // Feather on lance (decorative)
    ctx.strokeStyle = '#cc4422'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(12, 22); ctx.lineTo(8, 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 22); ctx.lineTo(14, 26); ctx.stroke();

    // Legs — short, stubby, armored greaves
    rect(ctx, 11, 22, 4, 7, MAILD); rect(ctx, 17, 22, 4, 7, MAILD);
    // Small feet
    rect(ctx, 9, 27, 6, 3, FURD); rect(ctx, 17, 27, 6, 3, FURD);

    // Body — chainmail torso
    ctx.fillStyle = MAIL;
    ctx.beginPath(); ctx.ellipse(16, 18, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Tab pattern (beer can tabs) — small horizontal lines
    ctx.strokeStyle = MAILD; ctx.lineWidth = 1;
    for (var my = 14; my <= 22; my += 2) {
      ctx.beginPath(); ctx.moveTo(11, my); ctx.lineTo(21, my); ctx.stroke();
    }
    // Pauldrons
    circle(ctx, 10, 16, 3, MAILD); circle(ctx, 22, 16, 3, MAILD);

    // Arms — one gripping lance, one out
    rect(ctx, 5, 15, 5, 3, MAIL); rect(ctx, 22, 14, 6, 3, MAIL);

    // Neck
    rect(ctx, 14, 11, 5, 5, FUR);

    // Head — chihuahua-like, large ears, tiny body ratio
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.ellipse(16, 8, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Big ears — chihuahua style
    ctx.fillStyle = FURD;
    ctx.beginPath(); ctx.moveTo(9, 5); ctx.lineTo(5, 0); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23, 5); ctx.lineTo(27, 0); ctx.lineTo(20, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffccaa';
    ctx.beginPath(); ctx.moveTo(9, 5); ctx.lineTo(6, 1); ctx.lineTo(11, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23, 5); ctx.lineTo(26, 1); ctx.lineTo(21, 4); ctx.closePath(); ctx.fill();

    // Spiked cap
    ctx.fillStyle = MAILD;
    ctx.beginPath(); ctx.ellipse(16, 5, 6, 3, 0, 0, Math.PI); ctx.fill(); // half circle cap
    ctx.fillStyle = SPIKE;
    ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(18, 3); ctx.lineTo(16, -1); ctx.closePath(); ctx.fill();

    // Face — angry chihuahua
    ctx.fillStyle = '#221100';
    ctx.fillRect(12, 7, 3, 3); ctx.fillRect(18, 7, 3, 3); // eyes
    ctx.fillStyle = '#cc2200'; ctx.fillRect(13, 8, 2, 2); ctx.fillRect(19, 8, 2, 2); // irises
    ctx.fillStyle = FURL; // snout
    ctx.beginPath(); ctx.ellipse(16, 11, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#331100'; // angry mouth
    ctx.beginPath(); ctx.moveTo(12, 12); ctx.lineTo(16, 13); ctx.lineTo(20, 12); ctx.stroke();

    outline(ctx, '#2a1a00', T, T);
    return c;
  }

  // ── MIND HORROR (Floor 2) — floating brain/jellyfish, psionic attacks ──────
  // Lore: floating brain with tentacles underneath, looks like jellyfish/mini-blimp.
  // Moves slowly. Psionic attack causes debilitating headache. Physically weak — punch splatters.
  function genMindHorror() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var BRAIN = '#c878a0', BRAIND = '#a05078', BRAINL = '#e8a0c8';
    var VEIN  = '#882060';
    var TENT  = 'rgba(180,100,160,0.7)';
    var GLOW  = 'rgba(200,80,180,0.3)';
    var PUPIL = '#200010';

    // Psionic glow aura
    ctx.fillStyle = GLOW;
    ctx.beginPath(); ctx.arc(16, 14, 14, 0, Math.PI * 2); ctx.fill();

    // Tentacles — trailing downward like a jellyfish
    ctx.strokeStyle = TENT; ctx.lineWidth = 2; ctx.lineCap = 'round';
    var tentPositions = [9, 11, 14, 17, 20, 23];
    for (var ti = 0; ti < tentPositions.length; ti++) {
      var tx2 = tentPositions[ti];
      var wag = (ti % 2 === 0 ? 1 : -1) * 4;
      ctx.beginPath();
      ctx.moveTo(tx2, 22);
      ctx.quadraticCurveTo(tx2 + wag, 28, tx2 + wag * 0.5, 32);
      ctx.stroke();
    }

    // Brain body — dome shape (top hemisphere, flat bottom)
    ctx.fillStyle = BRAIN;
    ctx.beginPath(); ctx.ellipse(16, 16, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BRAINL;
    ctx.beginPath(); ctx.ellipse(15, 14, 8, 6, -0.2, 0, Math.PI * 2); ctx.fill();

    // Brain folds — irregular lines across surface
    ctx.strokeStyle = VEIN; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, 14); ctx.quadraticCurveTo(12, 11, 16, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 14); ctx.quadraticCurveTo(20, 11, 24, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 18); ctx.quadraticCurveTo(16, 16, 22, 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 21); ctx.quadraticCurveTo(16, 19, 20, 21); ctx.stroke();

    // Veins branching
    ctx.strokeStyle = 'rgba(136,32,96,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(12, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, 12); ctx.lineTo(20, 9); ctx.stroke();

    // Central eye — the unnerving bit
    ctx.fillStyle = '#220012';
    ctx.beginPath(); ctx.ellipse(16, 16, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#880040';
    ctx.beginPath(); ctx.ellipse(16, 16, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,80,200,0.9)';
    ctx.fillRect(15, 15, 2, 2); // eye glow center

    outline(ctx, '#180010', T, T);
    return c;
  }

  // ── LAMINAK ELITE (Floor 2 fairy-class manager) ──────────────────────────────
  // Lore: miniature 40-something woman, hummingbird wings, leaf pantsuit, no weapons.
  // Crow-sized. Manages clurichaun workers. Disease-immune.
  function genLaminakElite() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var SKIN = '#d4a070', SKIND = '#b08050', HAIR = '#553020';
    var LEAF  = '#5a8c30', LEAFD = '#3a5c18', LEAFL = '#88cc50';
    var WING  = 'rgba(180,230,255,0.55)', WINGD = 'rgba(100,180,220,0.8)';

    // Hummingbird wings — iridescent, blurry, fast
    ctx.fillStyle = WING;
    ctx.beginPath(); ctx.ellipse(10, 16, 9, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(22, 16, 9, 4,  0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = WINGD; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(10, 16, 9, 4, -0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(22, 16, 9, 4,  0.5, 0, Math.PI * 2); ctx.stroke();

    // Body — leaf pantsuit
    ctx.fillStyle = LEAF;
    ctx.fillRect(13, 18, 6, 10); // torso/skirt
    ctx.fillStyle = LEAFL;
    ctx.fillRect(13, 18, 3, 5);  // lapel highlight
    // Jacket collar
    ctx.fillStyle = LEAFD; ctx.fillRect(14, 18, 4, 2);

    // Arms
    ctx.fillStyle = SKIN;
    ctx.fillRect(11, 19, 2, 5); // left arm
    ctx.fillRect(19, 19, 2, 5); // right arm

    // Head
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(16, 14, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKIND;
    ctx.beginPath(); ctx.ellipse(16, 16, 5, 3, 0, 0, Math.PI); ctx.fill(); // jaw shadow

    // Hair — inverted bob, dark brown
    ctx.fillStyle = HAIR;
    ctx.beginPath(); ctx.ellipse(16, 11, 5, 4, 0, Math.PI, Math.PI * 2); ctx.fill(); // top
    ctx.fillRect(11, 11, 2, 5); ctx.fillRect(19, 11, 2, 5); // bob sides

    // Face — 40s woman, slightly stern
    ctx.fillStyle = '#220000';
    ctx.fillRect(14, 13, 2, 1); ctx.fillRect(18, 13, 2, 1); // eyes
    ctx.fillStyle = '#cc3344'; ctx.fillRect(14, 16, 4, 1); // lipstick mouth

    // Tiny clipboard/pamphlet — she's always managing
    ctx.fillStyle = '#f0e8c8'; ctx.fillRect(19, 21, 3, 4);
    ctx.fillStyle = '#888870'; ctx.fillRect(20, 22, 1, 2); ctx.fillRect(20, 24, 2, 1);

    outline(ctx, '#2a1a00', T, T);
    return c;
  }

  // ── KRAKAREN CLONE (Floor 2 neighborhood boss) ───────────────────────────────
  // Lore: communal brain entity. Pink tentacles, each covered in human-shaped screaming mouths.
  // Breaks through walls. Cannot see. Swings blindly. Larger than a neighborhood boss.
  function genKrakarenClone() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var PINK   = '#e060a0', PINKD = '#b03070', PINKL = '#f890c8';
    var MOUTH  = '#cc1040', TEETH = '#f8f0e0', DARK = '#600020';

    // Central mass — pulsing pink blob
    ctx.fillStyle = PINKD;
    ctx.beginPath(); ctx.ellipse(16, 18, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.ellipse(15, 17, 10, 8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PINKL;
    ctx.beginPath(); ctx.ellipse(13, 14, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();

    // Tentacles radiating outward — thick, sinuous
    var tentacles = [
      { x1: 16, y1: 12, cx: 8,  cy: 4,  x2: 4,  y2: 2  },
      { x1: 22, y1: 14, cx: 30, cy: 8,  x2: 32, y2: 6  },
      { x1: 28, y1: 18, cx: 36, cy: 18, x2: 38, y2: 22 },
      { x1: 22, y1: 26, cx: 28, cy: 34, x2: 24, y2: 36 },
      { x1: 10, y1: 26, cx: 4,  cy: 34, x2: 6,  y2: 38 },
      { x1: 4,  y1: 18, cx: -4, cy: 18, x2: -4, y2: 14 },
    ];
    ctx.strokeStyle = PINK; ctx.lineWidth = 4; ctx.lineCap = 'round';
    tentacles.forEach(function(t) {
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1);
      ctx.quadraticCurveTo(t.cx, t.cy, t.x2, t.y2); ctx.stroke();
    });
    // Darker outline on tentacles
    ctx.strokeStyle = PINKD; ctx.lineWidth = 2;
    tentacles.forEach(function(t) {
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1);
      ctx.quadraticCurveTo(t.cx, t.cy, t.x2, t.y2); ctx.stroke();
    });

    // Screaming mouths on tentacles — wide open, bright red, tiny teeth
    var mouthPos = [[6, 4], [31, 8], [36, 20], [25, 34], [8, 36]];
    mouthPos.forEach(function(m) {
      ctx.fillStyle = MOUTH;
      ctx.beginPath(); ctx.ellipse(m[0], m[1], 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = TEETH;
      for (var i = -3; i <= 3; i += 2) {
        ctx.fillRect(m[0] + i - 0.5, m[1] - 1.5, 1, 1.5);
      }
    });

    // Central face on main body — the main scream
    ctx.fillStyle = DARK;
    ctx.beginPath(); ctx.ellipse(16, 19, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = MOUTH;
    ctx.beginPath(); ctx.ellipse(16, 19, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = TEETH;
    for (var mi = -3; mi <= 3; mi += 2) {
      ctx.fillRect(16 + mi - 0.5, 17, 1, 2);
    }

    outline(ctx, DARK, T, T);
    return c;
  }

  // ── MAILBOX (safe rooms Floor 2+) — standard black mailbox with red flag ──
  function genMailbox() {
    var c = canvas(T, T), ctx = ctx2d(c);
    // Pole
    ctx.fillStyle = '#666666'; ctx.fillRect(15, 14, 3, 18);
    // Box body — standard mailbox shape
    ctx.fillStyle = '#111111'; ctx.fillRect(7, 8, 18, 12);
    ctx.fillStyle = '#222222'; ctx.fillRect(7, 8, 18, 4); // darker top
    // Dome top (postal box shape)
    ctx.fillStyle = '#111111';
    ctx.beginPath(); ctx.ellipse(16, 8, 9, 4, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#333333';
    ctx.beginPath(); ctx.ellipse(16, 8, 7, 3, 0, 0, Math.PI); ctx.fill();
    // Door/slot line
    ctx.fillStyle = '#444444'; ctx.fillRect(9, 15, 14, 1);
    // Red flag (raised)
    ctx.fillStyle = '#cc2222'; ctx.fillRect(24, 8, 3, 7);
    ctx.fillStyle = '#ff3333'; ctx.fillRect(24, 8, 3, 1);
    // Flag pole
    ctx.fillStyle = '#888888'; ctx.fillRect(24, 8, 1, 9);
    outline(ctx, '#000000', T, T);
    return c;
  }

  // ── RAGE ELEMENTAL — 15ft black/purple smoke, badger skull, goat horns, six obsidian-clawed legs ──
  function genRageElemental() {
    var c = canvas(T, T), ctx = ctx2d(c);
    var SMKD = '#120820';
    var SMKM = '#1f0d36';
    var SMKL = '#2e1250';
    var SMKP = '#5c1a8a';
    var BONE = '#ccc8b8';
    var BONED = '#9a9080';
    var HORN = '#7a6040';
    var CLAW = '#0c0a12';

    // Smoke wisps around body — irregular, menacing
    ctx.fillStyle = SMKL;
    [[4,24,4,5],[27,22,4,6],[3,16,3,5],[28,15,3,5],[9,29,5,3],[21,28,4,3]].forEach(function(w) {
      ctx.beginPath(); ctx.ellipse(w[0],w[1],w[2],w[3],0,0,Math.PI*2); ctx.fill();
    });

    // Main smoke body
    ctx.fillStyle = SMKD;
    ctx.beginPath(); ctx.ellipse(16,22,10,10,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = SMKM;
    ctx.beginPath(); ctx.ellipse(16,21,8,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = SMKL;
    ctx.beginPath(); ctx.ellipse(16,19,6,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = SMKP;
    ctx.beginPath(); ctx.ellipse(16,17,3,4,0,0,Math.PI*2); ctx.fill();

    // Six legs — three per side, each with obsidian claw at tip
    ctx.strokeStyle = SMKD;
    ctx.lineCap = 'round';
    var legs = [
      [-1, [10,16],[3,14]], [-1, [8,21],[1,20]], [-1, [10,26],[2,26]],
      [ 1, [22,16],[29,14]], [ 1, [24,21],[31,20]], [ 1, [22,26],[30,26]]
    ];
    legs.forEach(function(l) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = SMKD;
      ctx.beginPath(); ctx.moveTo(l[1][0],l[1][1]); ctx.lineTo(l[2][0],l[2][1]); ctx.stroke();
      rect(ctx, l[2][0]-1, l[2][1]-2, 3, 3, CLAW);
    });

    // Badger skull — wide braincase, narrow jaw
    ctx.fillStyle = BONED;
    ctx.beginPath(); ctx.ellipse(16,9,8,7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = BONE;
    ctx.beginPath(); ctx.ellipse(16,8,7,6,0,0,Math.PI*2); ctx.fill();
    // Brow ridges (badger has heavy supraorbital ridges)
    rect(ctx, 9, 10, 5, 2, BONED);
    rect(ctx, 18, 10, 5, 2, BONED);
    // Eye sockets — void black
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.ellipse(12,9,2.5,2,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20,9,2.5,2,0,0,Math.PI*2); ctx.fill();
    // Red ember glow inside eye sockets
    ctx.fillStyle = '#cc2200';
    ctx.beginPath(); ctx.ellipse(12,9,1.2,1,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20,9,1.2,1,0,0,Math.PI*2); ctx.fill();
    // White nasal stripe (badger marking on skull)
    rect(ctx, 15, 11, 2, 4, '#e0dcd0');
    // Snout / upper jaw
    ctx.fillStyle = BONED;
    ctx.beginPath(); ctx.ellipse(16,14,5,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = BONE;
    ctx.beginPath(); ctx.ellipse(16,13,4,2,0,0,Math.PI*2); ctx.fill();
    // Teeth — lower jaw
    rect(ctx, 11, 15, 10, 1, BONED);
    for (var ti = 0; ti < 4; ti++) {
      rect(ctx, 12 + ti*3, 16, 2, 2, '#ffffff');
    }

    // Goat horns — quadratic curves from crown outward and upward
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = HORN;
    ctx.beginPath(); ctx.moveTo(10,4); ctx.quadraticCurveTo(5,2,6,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22,4); ctx.quadraticCurveTo(27,2,26,0); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#5a4030';
    ctx.beginPath(); ctx.moveTo(10,4); ctx.quadraticCurveTo(5,2,6,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22,4); ctx.quadraticCurveTo(27,2,26,0); ctx.stroke();

    outline(ctx, '#0a0614', T, T);
    return c;
  }

  // ── REGISTER ALL ─────────────────────────────────────────────────────────

  function init(scene) {
    scene.textures.addCanvas('tileset',        genTileset());
    scene.textures.addCanvas('tileset_f2',     genTilesetFloor2());
    scene.textures.addCanvas('tileset_f3',     genTilesetFloor3());
    scene.textures.addCanvas('tileset_f4',     genTilesetFloor4());
    scene.textures.addCanvas('carl_down',      genCarl('down'));
    scene.textures.addCanvas('carl_up',        genCarl('up'));
    scene.textures.addCanvas('carl_right',     genCarl('right'));
    scene.textures.addCanvas('carl_left',      genCarl('left'));
    scene.textures.addCanvas('carl_hit_down',  genCarlHit('down'));
    scene.textures.addCanvas('carl_hit_up',    genCarlHit('up'));
    scene.textures.addCanvas('carl_hit_right', genCarlHit('right'));
    scene.textures.addCanvas('carl_hit_left',  genCarlHit('left'));
    scene.textures.addCanvas('donut',          genDonut());
    scene.textures.addCanvas('donut_glow',     genDonutGlow());
    scene.textures.addCanvas('rat',          genRat());
    scene.textures.addCanvas('goblin',       genGoblin());
    scene.textures.addCanvas('crack_camel',  genCrackCamel());
    scene.textures.addCanvas('fairy',        genFairy());
    scene.textures.addCanvas('skeleton',     genSkeleton());
    scene.textures.addCanvas('magic_missile',genMagicMissile());
    scene.textures.addCanvas('heal_orb',     genHealOrb());
    scene.textures.addCanvas('xp_orb',       genXPOrb());
    scene.textures.addCanvas('slash',        genSlash());
    scene.textures.addCanvas('loot_box',     genLootBox(false));
    scene.textures.addCanvas('loot_box_open',genLootBox(true));
    scene.textures.addCanvas('potion',       genPotion());
    scene.textures.addCanvas('weapon',       genWeapon());
    scene.textures.addCanvas('armor',        genArmor());
    scene.textures.addCanvas('guildmaster',  genGuildmaster());
    scene.textures.addCanvas('bugaboo',      genBugaboo());
    scene.textures.addCanvas('hoarder',      genHoarder());
    scene.textures.addCanvas('rot_sticker',  genRotSticker());
    scene.textures.addCanvas('trog_pygmy',     genTrogPygmy());
    scene.textures.addCanvas('trog_basher',    genTrogBasher());
    scene.textures.addCanvas('trog_virtuoso',  genTrogVirtuoso());
    scene.textures.addCanvas('scatterer',      genScatterer());
    scene.textures.addCanvas('bad_llama',      genBadLlama());
    scene.textures.addCanvas('scat_thug',      genScatThug());
    scene.textures.addCanvas('brindle_grub',    genBrindleGrub());
    scene.textures.addCanvas('danger_dingo',    genDangerDingo());
    scene.textures.addCanvas('bopca',           genBopca());
    scene.textures.addCanvas('clurichaun',      genClurichaun());
    scene.textures.addCanvas('brindled_vespa',  genBrindledVespa());
    scene.textures.addCanvas('kobold_rider',    genKoboldRider());
    scene.textures.addCanvas('mind_horror',     genMindHorror());
    scene.textures.addCanvas('mailbox',         genMailbox());
    scene.textures.addCanvas('krakaren_clone',  genKrakarenClone());
    scene.textures.addCanvas('laminak_elite',   genLaminakElite());
    scene.textures.addCanvas('rage_elemental',  genRageElemental());
  }

  return { init: init };
})();
