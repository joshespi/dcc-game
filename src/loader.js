var GAME_VERSION = '20260524-2';
[
  'src/sprites.js',
  'src/systems/SaveSystem.js',
  'src/systems/CrawlerStatus.js',
  'src/systems/Messages.js',
  'src/dungeon/Generator.js',
  'src/entities/Enemy.js',
  'src/entities/Carl.js',
  'src/entities/Donut.js',
  'src/scenes/BootScene.js',
  'src/scenes/IntroScene.js',
  'src/scenes/GameScene.js',
  'src/scenes/UIScene.js',
  'src/scenes/DeathScene.js',
  'src/main.js',
].forEach(function (src) {
  document.write('<script src="' + src + '?v=' + GAME_VERSION + '"><\/script>');
});
