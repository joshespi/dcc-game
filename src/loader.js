var GAME_VERSION = '0.2.3+20260530-01';
[
  'src/sprites.js',
  'src/systems/Audio.js',
  'src/systems/SaveSystem.js',
  'src/systems/CrawlerStatus.js',
  'src/systems/Messages.js',
  'src/dungeon/Generator.js',
  'src/entities/Enemy.js',
  'src/entities/Carl.js',
  'src/entities/Donut.js',
  'src/scenes/BootScene.js',
  'src/scenes/IntroScene.js',
  'src/scenes/CutsceneScene.js',
  'src/scenes/GameScene.js',
  'src/scenes/UIScene.js',
  'src/scenes/DeathScene.js',
  'src/main.js',
].forEach(function (src) {
  document.write('<script src="' + src + '?v=' + GAME_VERSION + '"><\/script>');
});
