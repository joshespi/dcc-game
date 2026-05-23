var SaveSystem = (function () {
  var KEY = 'dcc_save_v1';

  function save(status, floor, extra) {
    try {
      var data = status.serialize();
      data.floor = floor;
      if (extra) {
        if (extra.floorTimerElapsed != null) data.floorTimerElapsed = extra.floorTimerElapsed;
      }
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  return { save: save, load: load, clear: clear };
})();
