/* ============================================================
   ImmoSim — connecteurs de données publiques
   BAN (adresses) · ADEME (DPE) · DVF (prix réels) · DHUP (loyers)
   Tout est appelé depuis le navigateur, sans clé et sans serveur.
   Résultats mis en cache 24 h dans localStorage.
   ============================================================ */
window.ANData = (function () {
  'use strict';

  var TTL = 24 * 3600 * 1000;
  var PREFIX = 'immosim.cache.';

  function cacheGet(key) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (Date.now() - o.t > TTL) { localStorage.removeItem(PREFIX + key); return null; }
      return o.v;
    } catch (e) { return null; }
  }

  function cacheSet(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value })); } catch (e) {}
  }

  function getJSON(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 9000);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) {
        clearTimeout(to);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  /* ---------- 1. BAN — géocodage d'adresse ---------- */

  var BAN = 'https://api-adresse.data.gouv.fr/search/';

  function geocode(query) {
    var q = String(query || '').trim();
    if (q.length < 3) return Promise.resolve(null);
    var key = 'ban.' + q.toLowerCase();
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);

    return getJSON(BAN + '?q=' + encodeURIComponent(q) + '&limit=1')
      .then(function (d) {
        if (!d.features || !d.features.length) return null;
        var f = d.features[0], p = f.properties;
        var out = {
          label: p.label,
          ville: p.city,
          codePostal: p.postcode,
          codeInsee: p.citycode,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          precision: p.type // housenumber | street | locality | municipality
        };
        cacheSet(key, out);
        return out;
      })
      .catch(function () { return null; });
  }

  /* ---------- 2. ADEME — DPE officiel ---------- */

  var ADEME_SETS = [
    'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines',
    'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines'
  ];

  function pick(row, names) {
    for (var i = 0; i < names.length; i++) {
      if (row[names[i]] !== undefined && row[names[i]] !== null && row[names[i]] !== '') return row[names[i]];
    }
    return null;
  }

  function normaliseDPE(row) {
    return {
      numero: pick(row, ['N°DPE', 'numero_dpe', 'N_DPE']),
      classe: String(pick(row, ['Etiquette_DPE', 'etiquette_dpe', 'classe_consommation_energie']) || '').toUpperCase(),
      classeGES: String(pick(row, ['Etiquette_GES', 'etiquette_ges']) || '').toUpperCase(),
      date: pick(row, ['Date_établissement_DPE', 'date_etablissement_dpe', 'Date_réception_DPE']),
      surface: parseFloat(pick(row, ['Surface_habitable_logement', 'surface_habitable_logement'])) || null,
      conso: parseFloat(pick(row, ['Conso_5_usages_é_finale', 'consommation_energie', 'Conso_5_usages/m²_é_primaire'])) || null,
      chauffage: pick(row, ['Type_générateur_chauffage_principal', 'type_installation_chauffage']),
      annee: pick(row, ['Année_construction', 'annee_construction']),
      cout: parseFloat(pick(row, ['Coût_total_5_usages', 'cout_total_5_usages'])) || null,
      adresse: pick(row, ['Adresse_(BAN)', 'adresse_ban', 'Adresse_brute'])
    };
  }

  /**
   * Recherche le DPE le plus récent pour une adresse.
   * L'étiquette n'est retenue que si la surface concorde (±15 %) quand elle est fournie,
   * afin de ne pas rattacher le DPE du voisin.
   */
  function dpeParAdresse(adresse, surfaceAttendue) {
    var q = String(adresse || '').trim();
    if (q.length < 5) return Promise.resolve(null);
    var key = 'dpe.' + q.toLowerCase() + '.' + (surfaceAttendue || '');
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);

    function tryset(i) {
      if (i >= ADEME_SETS.length) return Promise.resolve(null);
      return getJSON(ADEME_SETS[i] + '?q=' + encodeURIComponent(q) + '&size=20')
        .then(function (d) {
          var rows = (d && d.results) || [];
          if (!rows.length) return tryset(i + 1);
          var list = rows.map(normaliseDPE).filter(function (r) { return r.classe && r.classe.length === 1; });
          if (surfaceAttendue) {
            var proches = list.filter(function (r) {
              return !r.surface || Math.abs(r.surface - surfaceAttendue) / surfaceAttendue <= 0.15;
            });
            if (proches.length) list = proches;
          }
          if (!list.length) return tryset(i + 1);
          list.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
          var best = list[0];
          best.autres = list.length - 1;
          // La réforme du 1er janvier 2026 a modifié le coefficient électricité :
          // les étiquettes antérieures ne sont pas directement comparables.
          best.avantReforme2026 = String(best.date || '') < '2026-01-01';
          cacheSet(key, best);
          return best;
        })
        .catch(function () { return tryset(i + 1); });
    }
    return tryset(0);
  }

  /* ---------- 3. DVF — prix réellement payés ---------- */

  var DVF = 'https://api.cquest.org/dvf';

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /**
   * Médiane du prix au m² des ventes réelles autour d'un point.
   * type : 'appt' | 'maison'. Exclut les transactions atypiques (5 % extrêmes).
   */
  function prixMedianDVF(lat, lon, type, rayon) {
    if (!lat || !lon) return Promise.resolve(null);
    var r = rayon || 700;
    var key = 'dvf.' + lat.toFixed(4) + '.' + lon.toFixed(4) + '.' + type + '.' + r;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);

    return getJSON(DVF + '?lat=' + lat + '&lon=' + lon + '&dist=' + r, 12000)
      .then(function (d) {
        var feats = (d && d.features) || [];
        var wanted = type === 'maison' ? 'Maison' : 'Appartement';
        var prix = [];
        feats.forEach(function (f) {
          var p = f.properties || {};
          if (p.type_local !== wanted) return;
          var v = parseFloat(p.valeur_fonciere), s = parseFloat(p.surface_relle_bati || p.surface_reelle_bati);
          if (!v || !s || s < 9 || v < 10000) return;
          var m2 = v / s;
          if (m2 < 300 || m2 > 25000) return;      // aberrations manifestes
          prix.push(m2);
        });
        if (prix.length < 5) { return { median: 0, echantillon: prix.length, fiabilite: 'insuffisante' }; }
        prix.sort(function (a, b) { return a - b; });
        var k = Math.floor(prix.length * 0.05);
        var coeur = prix.slice(k, prix.length - k || prix.length);
        var out = {
          median: Math.round(median(coeur)),
          bas: Math.round(coeur[Math.floor(coeur.length * 0.25)]),
          haut: Math.round(coeur[Math.floor(coeur.length * 0.75)]),
          echantillon: coeur.length,
          fiabilite: coeur.length >= 40 ? 'haute' : (coeur.length >= 15 ? 'moyenne' : 'basse')
        };
        cacheSet(key, out);
        return out;
      })
      .catch(function () { return null; });
  }

  /* ---------- 4. Carte des loyers DHUP ---------- */

  var loyersPromise = null;

  /**
   * Charge le référentiel de loyers généré par tools/build-loyers.mjs
   * (assets/data/loyers.json, indexé par code INSEE).
   * Absent : la fonction renvoie null et le champ reste saisi à la main.
   */
  function chargerLoyers() {
    if (loyersPromise) return loyersPromise;
    loyersPromise = getJSON('assets/data/loyers.json', 15000).catch(function () { return null; });
    return loyersPromise;
  }

  function loyerMedian(codeInsee, type) {
    if (!codeInsee) return Promise.resolve(null);
    return chargerLoyers().then(function (base) {
      if (!base || !base[codeInsee]) return null;
      var row = base[codeInsee];
      // format : [loyer_appartement, loyer_maison, loyer_global]
      var v = type === 'maison' ? row[1] : row[0];
      return { loyerM2: v || row[2], millesime: base._millesime || null, source: 'Carte des loyers DHUP/MEF' };
    });
  }

  /* ---------- 5. Analyse groupée ---------- */

  /**
   * Enchaîne géocodage → DVF + loyers + DPE.
   * Chaque source échoue indépendamment : une panne ne bloque jamais l'analyse.
   * onStep(nom, etat) permet d'afficher la progression.
   */
  function enrichir(adresse, surface, type, onStep) {
    var step = onStep || function () {};
    step('geo', 'run');
    return geocode(adresse).then(function (geo) {
      step('geo', geo ? 'ok' : 'ko');
      if (!geo) return { geo: null };
      var jobs = [
        prixMedianDVF(geo.lat, geo.lon, type).then(function (r) { step('dvf', r && r.median ? 'ok' : 'ko'); return r; }),
        loyerMedian(geo.codeInsee, type).then(function (r) { step('loyer', r ? 'ok' : 'ko'); return r; }),
        (geo.precision === 'housenumber'
          ? dpeParAdresse(geo.label, surface)
          : Promise.resolve(null)).then(function (r) { step('dpe', r ? 'ok' : 'ko'); return r; })
      ];
      step('dvf', 'run'); step('loyer', 'run'); step('dpe', 'run');
      return Promise.all(jobs).then(function (res) {
        return { geo: geo, dvf: res[0], loyer: res[1], dpe: res[2] };
      });
    });
  }

  function viderCache() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
    loyersPromise = null;
  }

  return {
    geocode: geocode,
    dpeParAdresse: dpeParAdresse,
    prixMedianDVF: prixMedianDVF,
    loyerMedian: loyerMedian,
    chargerLoyers: chargerLoyers,
    enrichir: enrichir,
    viderCache: viderCache
  };
})();
