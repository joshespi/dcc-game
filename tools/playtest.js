// Smoke + scenario playtest via Playwright.
// Usage:  node tools/playtest.js
// Requires dev server at http://localhost:8090.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = '/tmp/dcc-playtest';
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL = (process.env.DCC_URL || 'http://localhost:8090') + '/?debug=1';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await ctx.newPage();

  const errors = [];
  const stamp = () => '[' + new Date().toISOString().slice(11, 23) + ']';
  page.on('pageerror', (e) => {
    const msg = stamp() + ' PAGE: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n');
    errors.push(msg);
    console.log('  !! ' + msg.split('\n')[0]);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(stamp() + ' ERROR: ' + msg.text());
  });

  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });

  async function shot(name) {
    const p = path.join(OUT_DIR, name + '.png');
    await page.screenshot({ path: p });
    console.log('  📸 ' + name);
  }
  async function wait(ms) { await page.waitForTimeout(ms); }
  async function tap(key, n = 1, gap = 80) {
    for (let i = 0; i < n; i++) { await page.keyboard.press(key); await wait(gap); }
  }
  async function dccState() { return await page.evaluate(() => window.dccDebug && window.dccDebug.state()); }
  async function dccCall(fn, ...args) {
    return await page.evaluate(([f, a]) => window.dccDebug[f].apply(null, a), [fn, args]);
  }
  async function waitForDcc(maxMs = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const ok = await page.evaluate(() => !!window.dccDebug);
      if (ok) return true;
      await wait(200);
    }
    throw new Error('dccDebug never appeared');
  }

  console.log(`→ navigating ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await wait(8000);
  await shot('01-intro');

  console.log('→ click NEW GAME');
  await page.mouse.click(480, 576);
  await wait(1500);
  // NEW GAME plays the Mordecai cutscene before GameScene; skip it.
  console.log('→ skip cutscene (Space)');
  await tap('Space');
  await wait(1500);

  await waitForDcc(15000);
  const s0 = await dccState();
  console.log('  state:', JSON.stringify({ floor: s0.floor, hp: s0.hp, level: s0.level, hasMordecai: !!s0.mordecai }));
  await shot('02-spawned');

  // Tutorial flow: teleport to Mordecai, walk into guild hall.
  console.log('→ teleport to Mordecai');
  if (!await dccCall('teleportTo', 'mordecai')) console.log('  ! no mordecai');
  await wait(1500);
  await shot('03-mordecai');

  // Tutorial advances on entry — wait for HUD unlock
  console.log('→ wait for tutorial complete');
  let s1 = s0;
  for (let i = 0; i < 30; i++) {
    s1 = await dccState();
    if (s1.inventory > 0 || s1.kills > 0) break; // some state changed
    await wait(500);
  }
  await shot('04-tutorial-end');

  // Force tutorial done (in case auto-flow stalled)
  await dccCall('forceTutorialDone');
  await wait(500);

  // Open inventory
  console.log('→ inventory (I)');
  await tap('KeyI');
  await wait(700);
  await shot('05-inventory');
  await tap('Escape'); await wait(300);

  // Skills
  console.log('→ skills (K)');
  await tap('KeyK');
  await wait(700);
  await shot('06-skills');
  await tap('Escape'); await wait(300);

  // Teleport to first safe room, open pack (silver Sanctuary box)
  console.log('→ teleport to first safe room');
  await dccCall('teleportTo', 'firstSafeRoom');
  await wait(1500);
  const sSR = await dccState();
  console.log('  inSafeRoom:', sSR.inSafeRoom, 'claimed:', sSR.claimedBoxes);
  await shot('07-safe-room');

  console.log('→ open pack with E');
  await tap('KeyE');
  await wait(3500); // animation
  await shot('08-after-open');
  const sAfter = await dccState();
  console.log('  inventory now:', sAfter.inventory);

  // Teleport to boss room + kill
  console.log('→ teleport to boss');
  await dccCall('teleportTo', 'boss');
  await wait(1500);
  await shot('09-boss-room');

  console.log('→ kill boss');
  await dccCall('killBoss');
  await wait(2500);
  const sPost = await dccState();
  console.log('  stairsUnlocked:', sPost.stairsUnlocked, 'bossAlive:', sPost.bossAlive);
  await shot('10-boss-dead');

  // Teleport to stairs + descend (close shop first if open from prior interaction)
  console.log('→ teleport to stairs + descend');
  await dccCall('teleportTo', 'stairs');
  await wait(800);
  await tap('Escape'); await wait(300); // close any open shop/inv
  await tap('KeyE');
  await wait(2500);
  await shot('11-descent');

  // After descend should be on floor 2
  await wait(2500);
  const sF2 = await dccState();
  console.log('  floor:', sF2 && sF2.floor);
  await shot('12-floor2');

  // ── Floor 2 → 3: kill boss, descend into race/class selection ───────────────
  console.log('→ floor 2 boss + descend');
  await dccCall('teleportTo', 'boss'); await wait(1200);
  await dccCall('killBoss');           await wait(1500);
  await dccCall('teleportTo', 'stairs'); await wait(800);
  await tap('Escape'); await wait(300);
  await tap('KeyE');   await wait(2600); // descend → ClassSelectScene
  const csActive = await page.evaluate(() =>
    window.game.scene.getScene('ClassSelectScene') &&
    window.game.scene.getScene('ClassSelectScene').scene.isActive());
  console.log('  class select active:', csActive);
  await shot('13-class-select');

  console.log('→ pick Dvergr + Fighter');
  await page.evaluate(() =>
    window.game.scene.getScene('ClassSelectScene').selectAndDescend('dvergr', 'fighter'));
  await wait(2600);
  await waitForDcc();
  const sF3 = await page.evaluate(() => {
    const st = window.game.scene.getScene('GameScene').status;
    return { floor: st.floor, classChosen: st.classChosen, race: st.race,
             className: st.className, str: st.stats.str, statPoints: st.statPoints };
  });
  console.log('  floor 3 state:', JSON.stringify(sF3));
  await shot('14-floor3');

  console.log('→ floor 3 boss kill');
  await dccCall('teleportTo', 'boss'); await wait(1200);
  await dccCall('killBoss');           await wait(1500);
  const sF3b = await dccState();
  console.log('  stairsUnlocked:', sF3b && sF3b.stairsUnlocked);
  await shot('15-floor3-boss-dead');

  console.log('\n=== Errors ===');
  if (errors.length === 0) console.log('  (none)');
  else errors.forEach((e) => console.log('  ' + e));

  await browser.close();
  console.log('\nScreenshots in ' + OUT_DIR);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
