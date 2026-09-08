/* ============================================================
   ImmoSim — localisation d'un bien à partir de l'annonce
   Triangulation ADEME (adresses candidates) + Mapillary (façades).

   Principe : on ne « devine » jamais une adresse. On produit une
   liste de candidats classés, avec un niveau de confiance, que
   l'utilisateur confirme visuellement. Une adresse fausse est bien
   pire qu'une adresse absente : elle contaminerait le DPE, le prix
   DVF et toute la négociation.
   ============================================================ */
window.ANLocate = (function () {
  'use strict';

  var ADEME_SETS = [
    'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines',
    'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines'
  ];
  var MAPILLARY = 'https://graph.mapillary.com/images';
  var TTL = 24 * 3600 * 1000;
  var PREFIX = 'immosim.loc.';

  /* ---------- Cache ---------- */

  function cacheGet(k) {
    try {
      var raw = localStorage.getItem(PREFIX + k);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (Date.now() - o.t > TTL) { localStorage.removeItem(PREFIX + k); return null; }
      return o.v;
    } catch (e) { return null; }
  }
  function cacheSet(k, v) {
    try { localStorage.setItem(PREFIX + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
  }

  function getJSON(url, ms) {
    var c = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var to = setTimeout(function () { if (c) c.abort(); }, ms || 15000);
    return fetch(url, { signal: c ? c.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) { clearTimeout(to); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  /* ---------- Normalisation des lignes ADEME ---------- */

  function pick(row, names) {
    for (var i = 0; i < names.length; i++) {
      var v = row[names[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  }

  function normalise(row) {
    return {
      numero: pick(row, ['N°DPE', 'numero_dpe', 'N_DPE']),
      adresse: pick(row, ['Adresse_(BAN)', 'adresse_ban', 'Adresse_brute', 'adresse_brute']),
      codePostal: String(pick(row, ['Code_postal_(BAN)', 'code_postal_ban', 'Code_postal_(brut)']) || ''),
      commune: pick(row, ['Nom__commune_(BAN)', 'nom_commune_ban', 'Nom__commune_(Brut)']),
      classe: String(pick(row, ['Etiquette_DPE', 'etiquette_dpe']) || '').toUpperCase(),
      classeGES: String(pick(row, ['Etiquette_GES', 'etiquette_ges']) || '').toUpperCase(),
      surface: parseFloat(pick(row, ['Surface_habitable_logement', 'surface_habitable_logement'])) || null,
      annee: parseInt(pick(row, ['Année_construction', 'annee_construction']), 10) || null,
      etage: pick(row, ['Etage_du_logement', 'etage_logement']),
      typeBien: String(pick(row, ['Type_bâtiment', 'type_batiment']) || ''),
      chauffage: pick(row, ['Type_générateur_chauffage_principal', 'type_installation_chauffage']),
      date: pick(row, ['Date_établissement_DPE', 'date_etablissement_dpe']),
      lat: parseFloat(pick(row, ['_geopoint_lat', 'Coordonnée_cartographique_Y_(BAN)'])) || null,
      lon: parseFloat(pick(row, ['_geopoint_lon', 'Coordonnée_cartographique_X_(BAN)'])) || null,
      cout: parseFloat(pick(row, ['Coût_total_5_usages', 'cout_total_5_usages'])) || null,
      _geopoint: pick(row, ['_geopoint'])
    };
  }

  function coords(c) {
    if (c.lat && c.lon && Math.abs(c.lat) <= 90) return { lat: c.lat, lon: c.lon };
    if (c._geopoint && typeof c._geopoint === 'string') {
      var p = c._geopoint.split(',');
      if (p.length === 2) {
        var la = parseFloat(p[0]), lo = parseFloat(p[1]);
        if (!isNaN(la) && !isNaN(lo)) return { lat: la, lon: lo };
      }
    }
    return null;
  }

  /* ---------- 1. Recherche de candidats ADEME ---------- */

  /**
   * critere : {
   *   commune, codePostal,     — au moins l'un des deux
   *   surface,                 — surface annoncée (m²)
   *   classe,                  — étiquette DPE de l'annonce
   *   type,                    — 'appt' | 'maison'
   *   anneeMin, anneeMax,      — optionnel
   *   tolerance                — écart de surface accepté, défaut 4 %
   * }
   */
  function candidats(critere, onStep) {
    var step = onStep || function () {};
    var cp = String(critere.codePostal || '').trim();
    var commune = String(critere.commune || '').trim();
    if (!cp && !commune) {
      return Promise.reject(new Error('Il faut au moins une commune ou un code postal.'));
    }

    var key = 'cand.' + (cp || commune).toLowerCase() + '.' + (critere.surface || '') +
      '.' + (critere.classe || '') + '.' + (critere.type || '');
    var hit = cacheGet(key);
    if (hit) { step('cache', 'ok'); return Promise.resolve(hit); }

    var tol = critere.tolerance === undefined ? 0.04 : critere.tolerance;
    var surf = parseFloat(critere.surface) || null;
    var classe = String(critere.classe || '').toUpperCase();
    var maison = critere.type === 'maison';

    // La syntaxe des filtres varie selon le millésime du jeu de données :
    // on tente le filtre structuré, puis on retombe sur la recherche libre.
    function requetes(base) {
      var out = [];
      if (cp) {
        out.push(base + '?qs=' + encodeURIComponent('Code_postal_(BAN):"' + cp + '"') + '&size=1000');
        out.push(base + '?qs=' + encodeURIComponent('code_postal_ban:"' + cp + '"') + '&size=1000');
      }
      if (commune) {
        out.push(base + '?q=' + encodeURIComponent(commune) + '&size=1000');
      }
      return out;
    }

    function essayer(urls, i) {
      if (i >= urls.length) return Promise.resolve([]);
      step('ademe', 'run');
      return getJSON(urls[i])
        .then(function (d) {
          var rows = (d && d.results) || [];
          if (!rows.length) return essayer(urls, i + 1);
          return rows;
        })
        .catch(function () { return essayer(urls, i + 1); });
    }

    var urls = [];
    ADEME_SETS.forEach(function (s) { urls = urls.concat(requetes(s)); });

    return essayer(urls, 0).then(function (rows) {
      step('ademe', rows.length ? 'ok' : 'ko');
      var list = rows.map(normalise).filter(function (c) {
        if (!c.adresse || !c.classe || c.classe.length !== 1) return false;
        if (cp && c.codePostal && c.codePostal !== cp) return false;
        if (maison && /appartement/i.test(c.typeBien)) return false;
        if (!maison && /maison/i.test(c.typeBien)) return false;
        return true;
      });

      // Notation de chaque candidat.
      list.forEach(function (c) {
        var pts = 0, motifs = [];
        if (surf && c.surface) {
          var ecart = Math.abs(c.surface - surf) / surf;
          if (ecart <= 0.01) { pts += 45; motifs.push('surface identique (' + c.surface + ' m²)'); }
          else if (ecart <= tol) { pts += 32; motifs.push('surface à ' + Math.round(ecart * 100) + ' % près'); }
          else if (ecart <= 0.10) { pts += 12; motifs.push('surface proche'); }
          else { pts -= 25; }
        }
        if (classe && c.classe) {
          if (c.classe === classe) { pts += 30; motifs.push('étiquette ' + c.classe + ' identique'); }
          else { pts -= 20; motifs.push('étiquette ' + c.classe + ' ≠ ' + classe); }
        }
        if (critere.anneeMin && c.annee && c.annee >= critere.anneeMin && c.annee <= (critere.anneeMax || 9999)) {
          pts += 12; motifs.push('année de construction compatible');
        }
        if (critere.chauffage && c.chauffage &&
            String(c.chauffage).toLowerCase().indexOf(String(critere.chauffage).toLowerCase()) >= 0) {
          pts += 10; motifs.push('chauffage compatible');
        }
        if (coords(c)) pts += 3;
        c.score = pts;
        c.motifs = motifs;
      });

      list = list.filter(function (c) { return c.score > 15; })
                 .sort(function (a, b) { return b.score - a.score; });

      // Regroupement par adresse : plusieurs lots d'un même immeuble
      // ne doivent pas occuper toute la liste.
      var vues = {}, groupes = [];
      list.forEach(function (c) {
        var k = String(c.adresse).toLowerCase().replace(/\s+/g, ' ').trim();
        if (vues[k]) { vues[k].lots++; return; }
        vues[k] = c; c.lots = 1; groupes.push(c);
      });

      var top = groupes.slice(0, 8);
      var res = {
        candidats: top,
        totalExamine: rows.length,
        confiance: niveauConfiance(top)
      };
      cacheSet(key, res);
      return res;
    });
  }

  /**
   * Le niveau de confiance dépend autant de l'écart entre le premier et
   * le deuxième candidat que du score absolu. Deux candidats à 80 points
   * signifient qu'on ne sait pas trancher.
   */
  function niveauConfiance(list) {
    if (!list.length) return { niveau: 'aucune', texte: 'Aucun candidat ne correspond aux critères.' };
    var a = list[0].score, b = list.length > 1 ? list[1].score : 0;
    var ecart = a - b;
    if (a >= 70 && ecart >= 25 && list.length <= 3) {
      return { niveau: 'forte', texte: 'Un candidat se détache nettement. À confirmer visuellement avant utilisation.' };
    }
    if (a >= 55 && ecart >= 10) {
      return { niveau: 'moyenne', texte: 'Plusieurs candidats plausibles, un se détache. La confirmation visuelle est indispensable.' };
    }
    return { niveau: 'faible', texte: 'Les candidats sont trop proches pour être départagés par les données seules. Ne retenez une adresse que si la façade correspond sans ambiguïté.' };
  }

  /* ---------- 2. Mapillary — imagerie de façade ---------- */

  var TOKEN_KEY = 'immosim.mapillary.token';

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t.trim());
      else localStorage.removeItem(TOKEN_KEY);
      return true;
    } catch (e) { return false; }
  }

  function bbox(lat, lon, metres) {
    var dLat = metres / 111320;
    var dLon = metres / (111320 * Math.cos(lat * Math.PI / 180));
    return [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  }

  /**
   * Photos de rue les plus proches d'un point.
   * Mapillary est de l'imagerie contributive sous licence CC-BY-SA :
   * son usage pour vérifier une façade est explicitement permis, à la
   * différence de Street View dont les CGU l'interdisent.
   */
  function facades(lat, lon, rayon, limite) {
    var t = token();
    if (!t) return Promise.resolve({ erreur: 'token', images: [] });
    if (!lat || !lon) return Promise.resolve({ images: [] });

    var r = rayon || 40;
    var key = 'mly.' + lat.toFixed(5) + '.' + lon.toFixed(5) + '.' + r;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);

    var url = MAPILLARY + '?access_token=' + encodeURIComponent(t) +
      '&fields=id,thumb_1024_url,computed_geometry,compass_angle,captured_at,is_pano' +
      '&bbox=' + bbox(lat, lon, r) + '&limit=' + (limite || 12);

    return getJSON(url).then(function (d) {
      var imgs = (d && d.data) || [];
      imgs.forEach(function (im) {
        var g = im.computed_geometry && im.computed_geometry.coordinates;
        im.distance = g ? Math.round(haversine(lat, lon, g[1], g[0])) : null;
        im.annee = im.captured_at ? new Date(im.captured_at).getFullYear() : null;
      });
      imgs.sort(function (a, b) { return (a.distance || 9999) - (b.distance || 9999); });
      var out = { images: imgs.slice(0, 6) };
      cacheSet(key, out);
      return out;
    }).catch(function (e) {
      return { erreur: String(e.message || e).indexOf('401') >= 0 ? 'token' : 'reseau', images: [] };
    });
  }

  function haversine(la1, lo1, la2, lo2) {
    var R = 6371000, p = Math.PI / 180;
    var a = 0.5 - Math.cos((la2 - la1) * p) / 2 +
      Math.cos(la1 * p) * Math.cos(la2 * p) * (1 - Math.cos((lo2 - lo1) * p)) / 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** Enrichit chaque candidat de ses photos de façade. */
  function illustrer(list) {
    if (!token()) return Promise.resolve(list);
    return Promise.all(list.map(function (c) {
      var g = coords(c);
      if (!g) { c.photos = []; return c; }
      return facades(g.lat, g.lon).then(function (r) {
        c.photos = r.images || [];
        c.photoErreur = r.erreur || null;
        return c;
      });
    }));
  }

  function viderCache() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  return {
    candidats: candidats,
    facades: facades,
    illustrer: illustrer,
    coords: coords,
    token: token,
    setToken: setToken,
    viderCache: viderCache
  };
})();
