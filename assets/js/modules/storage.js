/**
 * ImmoSim — Module storage
 *
 * Façade autour de localStorage avec :
 *   - parsing JSON sécurisé
 *   - gestion des erreurs (quota dépassé, mode privé)
 *   - clés centralisées (évite les fautes de frappe)
 *   - migration future facile (passer à IndexedDB sans toucher au reste)
 *
 * Usage côté app.js :
 *   const portf = ImmoStorage.get(ImmoStorage.KEYS.PORTFOLIO, []);
 *   ImmoStorage.set(ImmoStorage.KEYS.PORTFOLIO, [...portf, nouveau]);
 *
 * Ce module est exposé globalement pour rester compatible avec l'app.js actuel.
 * Quand app.js sera lui-même découpé en modules ES6, on pourra basculer en `export`.
 */
(function (global) {
  'use strict';

  const KEYS = Object.freeze({
    THEME:          'immoV7_theme',
    PORTFOLIO:      'immoV7_portf',
    SHORTLIST:      'immoV9_shortlist',
    LISTINGS:       'immoV9_listings',
    PIPELINE:       'immoV9_pipeline',
    PDF_COLORS:     'immoV8_pdfColors',
    ONBOARDED:      'immoV8_onboarded',
    AI_PROVIDER:    'immoV9_aiProvider',
    AI_KEY:         'immoV9_aiKey',          // À supprimer une fois le proxy CF en place
    USER_PREFS:     'immoV9_userPrefs',
  });

  function isAvailable() {
    try {
      const test = '__immo_test__';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  const available = isAvailable();
  if (!available) {
    console.warn('[ImmoStorage] localStorage indisponible (mode privé ?). Les données ne seront pas persistées.');
  }

  /**
   * Récupère une valeur. Si elle est sérialisée en JSON, la parse.
   * @param {string} key
   * @param {*} fallback - valeur retournée si la clé est absente ou invalide
   */
  function get(key, fallback = null) {
    if (!available) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      // Tente JSON, sinon retourne la chaîne brute
      try { return JSON.parse(raw); }
      catch { return raw; }
    } catch (e) {
      console.warn(`[ImmoStorage] Lecture impossible (${key}) :`, e);
      return fallback;
    }
  }

  /**
   * Stocke une valeur (sérialise automatiquement les non-strings en JSON).
   */
  function set(key, value) {
    if (!available) return false;
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') {
        console.error(`[ImmoStorage] Quota dépassé pour ${key}`);
        global.dispatchEvent?.(new CustomEvent('immostorage:quota', { detail: { key } }));
      } else {
        console.warn(`[ImmoStorage] Écriture impossible (${key}) :`, e);
      }
      return false;
    }
  }

  function remove(key) {
    if (!available) return false;
    try { localStorage.removeItem(key); return true; }
    catch (e) { return false; }
  }

  /**
   * Vide TOUTES les données ImmoSim (utile pour un bouton "Réinitialiser l'application").
   */
  function clearAll(confirm = false) {
    if (!confirm) {
      console.warn('[ImmoStorage] clearAll(true) requis pour confirmer.');
      return false;
    }
    if (!available) return false;
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    return true;
  }

  /**
   * Estime l'espace utilisé par ImmoSim (en Ko).
   */
  function usage() {
    if (!available) return 0;
    let bytes = 0;
    Object.values(KEYS).forEach((k) => {
      const v = localStorage.getItem(k);
      if (v) bytes += new Blob([v]).size;
    });
    return Math.round(bytes / 1024 * 10) / 10;
  }

  global.ImmoStorage = { KEYS, get, set, remove, clearAll, usage, isAvailable: () => available };
})(window);
