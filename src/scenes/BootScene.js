var BootScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'BootScene' }); },

  create: function () {
    // Generate all canvas textures — runs once at startup
    SpriteGen.init(this);
    this.scene.start('IntroScene');
  }
});
