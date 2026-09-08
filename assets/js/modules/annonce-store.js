/* ═══════════════════════════════════════════════════════════════
   IMMOSIM V9 — Persistance de l'analyse d'annonce
   S'appuie sur la façade Storage de modules/storage.js quand elle
   est présente, sinon retombe directement sur localStorage.
   ═══════════════════════════════════════════════════════════════ */
window.ANStore = (function () {
  'use strict';

  var K = 'immosim.annonce.courante';
  var H = 'immosim.annonce.historique';
  var MAX = 20;

  var CHAMPS = ['anUrl', 'anAdresse', 'anPrix', 'anSurf', 'anVille', 'anType', 'anMedian',
    'anLoyerM2', 'anDelaiRef', 'anAge', 'anBaisses', 'anVendeur', 'anDpe', 'anDpeCible',
    'anEtat', 'anCharges'];

  // Façade : réutilise Storage si le module de app.js l'expose.
  var S = (window.Storage && typeof window.Storage.get === 'function') ? window.Storage : null;

  function lire(k) {
    try {
      if (S) { var v = S.get(k); return typeof v === 'string' ? JSON.parse(v) : (v || null); }
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch (e) { return null; }
  }
  function ecrire(k, v) {
    try {
      if (S && typeof S.set === 'function') { S.set(k, JSON.stringify(v)); return true; }
      localStorage.setItem(k, JSON.stringify(v)); return true;
    } catch (e) { return false; }
  }
  function effacer(k) {
    try {
      if (S && typeof S.remove === 'function') { S.remove(k); return; }
      localStorage.removeItem(k);
    } catch (e) {}
  }

  function collecter() {
    var o = {};
    CHAMPS.forEach(function (id) {
      var e = document.getElementById(id);
      if (e) o[id] = e.value;
    });
    return o;
  }

  function appliquer(d) {
    if (!d) return false;
    var n = 0;
    CHAMPS.forEach(function (id) {
      var e = document.getElementById(id);
      if (e && d[id] !== undefined && d[id] !== '') { e.value = d[id]; n++; }
    });
    return n > 0;
  }

  function archive(meta) {
    var l = lire(H) || [];
    var e = Object.assign({ date: Date.now() }, meta, collecter());
    var sig = (e.anAdresse || e.anVille || '') + '|' + e.anPrix;
    l = l.filter(function (x) { return ((x.anAdresse || x.anVille || '') + '|' + x.anPrix) !== sig; });
    l.unshift(e);
    ecrire(H, l.slice(0, MAX));
    return l.length;
  }

  return {
    CHAMPS: CHAMPS,
    save:    function () { return ecrire(K, collecter()); },
    restore: function () { return appliquer(lire(K)); },
    clear:   function () { effacer(K); },
    collecter: collecter,
    appliquer: appliquer,
    archive: archive,
    historique: function () { return lire(H) || []; },
    charger: function (i) { var l = lire(H) || []; return l[i] ? appliquer(l[i]) : false; },
    viderHistorique: function () { effacer(H); },
    exporter: function () {
      return {
        version: 1,
        exporteLe: new Date().toISOString(),
        courante: lire(K),
        historique: lire(H) || [],
        checklist: lire('immosim.checkvisite')
      };
    },
    importer: function (o) {
      if (!o || o.version !== 1) return false;
      if (o.courante) ecrire(K, o.courante);
      if (o.historique) ecrire(H, o.historique);
      if (o.checklist) ecrire('immosim.checkvisite', o.checklist);
      return true;
    }
  };
})();
