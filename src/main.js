var config = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  backgroundColor: '#0a0812',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    }
  },
  scene: [BootScene, IntroScene, CutsceneScene, ClassSelectScene, GameScene, UIScene, DeathScene],
  render: {
    pixelArt: true,
    antialias: false,
  }
};

var game = new Phaser.Game(config);
