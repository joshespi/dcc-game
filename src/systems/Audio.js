var GameAudio = (function () {
  var ctx = null;
  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) {}
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  return { getCtx: getCtx };
})();
