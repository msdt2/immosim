/* ═══════════════════════════════════════════════════════════════
   IMMOSIM V9 — Module « Analyse d'annonce »
   Sources publiques : BAN · DVF · ADEME · DHUP
   Réutilise les fonctions de app.js (calcMens, calcIR, getNotaire…)
   Chargé APRÈS app.js, ne redéfinit rien.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Compatibilité : vues retirées ─────────────── */

  var REMPLACE = { dashboard: 'annonce', search: 'annonce', shortlist: 'annonce' };

  ['gv', 'gvM'].forEach(function (nom) {
    var orig = window[nom];
    if (typeof orig !== 'function') return;
    window[nom] = function (v) {
      return orig.call(this, REMPLACE[v] || v);
    };
  });

  // Fonctions des modules retirés, neutralisées pour éviter les ReferenceError
  // si un bouton résiduel ou un raccourci clavier les appelle encore.
  ['searchRealListings', 'quickFilter', 'resetFilters', 'filterListings',
   'fitMapToListings', 'loadDemoListings', 'clearAllListings', 'clearSearchHist',
   'clearShortlist', 'shareShortlist', 'exportShortlistPDF', 'exportListingsCSV',
   'openAlertProfile', 'toggleImportZone', 'importAndAnalyze', 'saveAggApiKey',
   'testAggApiKey', 'toggleAggKeyVis', 'renderDashboard', 'renderShortlist',
   'renderListings', 'toggleChat', 'askChat'
  ].forEach(function (f) { if (typeof window[f] !== 'function') window[f] = function () {}; });

  /* ── Raccourcis ────────────────────────────────── */

  var g = function (id) { return document.getElementById(id); };
  var vn = function (id) {
    var e = g(id);
    if (!e) return 0;
    var v = parseFloat(String(e.value).replace(/\s|\u202f/g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  };
  var tx = function (id) { var e = g(id); return e ? e.value : ''; };
  var sv = function (id, v) { var e = g(id); if (e && v !== null && v !== undefined && v !== '') e.value = v; };
  var eur = function (n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; };
  var pc = function (n, d) { return (n > 0 ? '+' : '') + n.toFixed(d === undefined ? 1 : d) + ' %'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  var idx = function (c) { return CLASSES.indexOf(String(c || '').toUpperCase()); };

  var args = [];
  var srcAuto = {};

  window.anScroll = function (id) {
    var e = g(id);
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── Calendrier Loi Climat & Résilience ────────── */

  function echeance(c) {
    c = String(c || '').toUpperCase();
    if (c === 'G') return { an: 2025, txt: 'Location interdite depuis le 1ᵉʳ janvier 2025' };
    if (c === 'F') return { an: 2028, txt: 'Location interdite au 1ᵉʳ janvier 2028' };
    if (c === 'E') return { an: 2034, txt: 'Location interdite au 1ᵉʳ janvier 2034' };
    return { an: null, txt: 'Aucune échéance à ce jour' };
  }

  function coutReno(surface, de, vers) {
    var a = idx(de), b = idx(vers);
    if (a < 0 || b < 0 || b >= a) return { sauts: 0, bas: 0, haut: 0 };
    var s = a - b;
    return { sauts: s, bas: Math.round(surface * 115 * s), haut: Math.round(surface * 190 * s) };
  }

  /* ── Lecture de l'URL d'annonce ────────────────── */

  var PORTAILS = [
    [/seloger/i, 'SeLoger'], [/leboncoin/i, 'Leboncoin'], [/pap\.fr/i, 'PAP'],
    [/bienici/i, 'Bien\u2019ici'], [/logic-?immo/i, 'Logic-Immo'], [/century21/i, 'Century 21'],
    [/orpi/i, 'Orpi'], [/laforet/i, 'Laforêt'], [/figaro/i, 'Figaro Immobilier'],
    [/superimmo/i, 'SuperImmo'], [/avendrealouer/i, 'A Vendre A Louer']
  ];

  function lireUrl(url) {
    var o = { portail: null, prix: 0, surface: 0, cp: '' };
    if (!url) return o;
    for (var i = 0; i < PORTAILS.length; i++) {
      if (PORTAILS[i][0].test(url)) { o.portail = PORTAILS[i][1]; break; }
    }
    var s = decodeURIComponent(url).toLowerCase();
    var m = s.match(/(\d{5,7})(?:[-_ ]?(?:e|eur|euros?))/); if (m) o.prix = +m[1];
    var q = s.match(/(\d{2,4})[-_ ]?m2/);                    if (q) o.surface = +q[1];
    var c = s.match(/\b(\d{5})\b/);                          if (c) o.cp = c[1];
    return o;
  }

  /* ── Récupération des données publiques ────────── */

  var ETAPES = { geo: 'Adresse (BAN)', dvf: 'Prix réels (DVF)', loyer: 'Loyers (DHUP)', dpe: 'DPE (ADEME)' };
  var etat = {};

  function rendreEtapes() {
    var b = g('anSources');
    if (!b) return;
    b.innerHTML = ['geo', 'dvf', 'loyer', 'dpe'].map(function (k) {
      var e = etat[k] || 'idle';
      var i = e === 'run' ? '<span class="an-spin"></span>' : (e === 'ok' ? '✓' : (e === 'ko' ? '—' : '·'));
      return '<span class="an-src an-src-' + e + '">' + i + ' ' + ETAPES[k] + '</span>';
    }).join('');
    b.style.display = 'flex';
  }

  window.anFetch = function () {
    if (!window.ANData) return;
    var adr = tx('anAdresse').trim() || tx('anVille').trim();
    if (!adr) {
      if (typeof toast === 'function') toast('Renseignez une adresse ou une ville.', 'warn');
      else alert('Renseignez une adresse ou une ville.');
      var e0 = g('anAdresse'); if (e0) e0.focus();
      return;
    }
    var btn = g('anFetchBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Interrogation…'; }
    etat = {}; rendreEtapes();

    var type = tx('anType') === 'maison' ? 'maison' : 'appt';
    window.ANData.enrichir(adr, vn('anSurf') || null, type, function (k, s) {
      etat[k] = s; rendreEtapes();
    }).then(function (r) {
      var recus = [];
      if (r.geo) {
        sv('anVille', ((r.geo.ville || '') + ' ' + (r.geo.codePostal || '')).trim());
        if (r.geo.precision !== 'housenumber') recus.push('adresse localisée à la commune seulement');
      }
      if (r.dvf && r.dvf.median) {
        sv('anMedian', r.dvf.median);
        srcAuto.median = r.dvf;
        recus.push('prix médian DVF ' + eur(r.dvf.median) + '/m² · ' + r.dvf.echantillon + ' ventes · fiabilité ' + r.dvf.fiabilite);
      }
      if (r.loyer && r.loyer.loyerM2) {
        sv('anLoyerM2', r.loyer.loyerM2);
        srcAuto.loyer = r.loyer;
        recus.push('loyer médian ' + r.loyer.loyerM2 + ' €/m²');
      }
      if (r.dpe && r.dpe.classe) {
        sv('anDpe', r.dpe.classe);
        if (r.dpe.surface && !vn('anSurf')) sv('anSurf', Math.round(r.dpe.surface));
        if (r.dpe.cout && !vn('anCharges')) sv('anCharges', Math.round(r.dpe.cout));
        srcAuto.dpe = r.dpe;
        recus.push('DPE officiel ' + r.dpe.classe + (r.dpe.date ? ' du ' + String(r.dpe.date).slice(0, 10) : ''));
      }
      var n = g('anFetchNote');
      if (n) {
        n.innerHTML = recus.length
          ? '<b>Données récupérées :</b> ' + esc(recus.join(' · ')) + '.'
          : 'Aucune donnée publique exploitable pour cette adresse. Les champs restent saisissables à la main — fréquent en zone rurale, en Alsace-Moselle (hors DVF) ou pour un bien neuf.';
        n.style.display = 'block';
      }
      if (btn) { btn.disabled = false; btn.textContent = '🛰 Récupérer les données publiques'; }
      window.anRun(false);
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🛰 Récupérer les données publiques'; }
      var n = g('anFetchNote');
      if (n) {
        n.textContent = 'Bases publiques injoignables (réseau ou service indisponible). La saisie manuelle donne exactement la même analyse.';
        n.style.display = 'block';
      }
    });
  };

  window.anStart = function () {
    var i = lireUrl(tx('anUrl').trim());
    if (i.prix && !vn('anPrix')) sv('anPrix', i.prix);
    if (i.surface && !vn('anSurf')) sv('anSurf', i.surface);
    if (i.cp && !tx('anAdresse') && !tx('anVille')) sv('anVille', i.cp);
    var s = g('anResSub');
    if (s) {
      s.textContent = i.portail
        ? 'Annonce ' + i.portail + ' — croisée avec les bases publiques.'
        : 'Analyse fondée sur les bases publiques et vos hypothèses.';
    }
    anScroll('anForm');
    if (tx('anAdresse') || tx('anVille')) window.anFetch();
    else if (vn('anPrix') && vn('anSurf')) window.anRun(true);
  };

  window.anDemo = function () {
    var d = {
      anUrl: 'https://www.seloger.com/annonces/achat/appartement/nantes-44/68m2-245000e',
      anAdresse: '12 rue de la Bastille, Nantes', anPrix: 245000, anSurf: 68,
      anVille: 'Nantes 44000', anMedian: 3200, anLoyerM2: 12.5, anDelaiRef: 75,
      anAge: 168, anBaisses: 2, anCharges: 2400
    };
    Object.keys(d).forEach(function (k) { sv(k, d[k]); });
    sv('anDpe', 'F'); sv('anDpeCible', 'D'); sv('anEtat', '3'); sv('anVendeur', 'agence');
    window.anRun(true);
  };

  window.anReset = function () {
    ['anUrl', 'anAdresse', 'anPrix', 'anSurf', 'anVille', 'anMedian', 'anLoyerM2', 'anAge', 'anCharges']
      .forEach(function (k) { var e = g(k); if (e) e.value = ''; });
    sv('anBaisses', 0); sv('anDelaiRef', 75);
    ['anResults', 'anFetchNote', 'anSources', 'anRestore'].forEach(function (k) {
      var e = g(k); if (e) e.style.display = 'none';
    });
    srcAuto = {};
    if (window.ANStore) window.ANStore.clear();
    anScroll('anForm');
  };

  /* ── Analyse ───────────────────────────────────── */

  function kv(k, v, cls) {
    return '<div class="computed-row"><span>' + k + '</span><b' + (cls ? ' class="an-' + cls + '"' : '') + '>' + v + '</b></div>';
  }

  window.anRun = function (scroll) {
    var prix = vn('anPrix'), surf = vn('anSurf');
    if (!prix || !surf) {
      if (scroll) {
        if (typeof toast === 'function') toast('Renseignez au minimum le prix et la surface.', 'warn');
        else alert('Renseignez au minimum le prix et la surface.');
      }
      return;
    }
    if (window.ANStore) window.ANStore.save();
    var res = g('anResults'); if (res) res.style.display = 'block';

    var prixM2 = prix / surf;
    var median = vn('anMedian');
    var ecart = median ? (prixM2 / median - 1) * 100 : null;
    var age = vn('anAge'), ref = vn('anDelaiRef') || 75;
    var baisses = vn('anBaisses');
    var dpe = tx('anDpe'), cible = tx('anDpeCible');
    var etatBien = parseInt(tx('anEtat') || '2', 10);
    var vendeur = tx('anVendeur');
    var charges = vn('anCharges');
    var loyerM2 = vn('anLoyerM2');

    args = [];
    var sig = [], score = 0;

    /* Prix vs marché */
    if (ecart !== null) {
      var m = srcAuto.median;
      var suf = m ? ' (' + m.echantillon + ' ventes DVF, fiabilité ' + m.fiabilite + ')' : '';
      if (ecart > 8) {
        score += 30;
        sig.push(['ru', pc(ecart) + ' vs médiane locale', 'Le prix au m² dépasse nettement les ventes réellement enregistrées' + suf + '.']);
        args.push('Le prix demandé ressort à ' + eur(prixM2) + '/m², soit ' + pc(ecart) +
          ' au-dessus du prix médian réellement payé dans le secteur (' + eur(median) + '/m²' + suf + '). Sur quoi repose cet écart ?');
      } else if (ecart > 2) {
        score += 15;
        sig.push(['am', pc(ecart) + ' vs médiane locale', 'Prix légèrement au-dessus du marché' + suf + '.']);
        args.push('Le prix se situe ' + pc(ecart) + ' au-dessus de la médiane des ventes du secteur (' + eur(median) + '/m²).');
      } else if (ecart < -5) {
        sig.push(['em', pc(ecart) + ' vs médiane locale', 'Prix inférieur au marché : vérifiez ce qui le justifie (étage, vis-à-vis, travaux, servitudes).']);
      } else {
        sig.push(['em', 'Prix aligné sur le marché', 'Écart de ' + pc(ecart) + ' par rapport à la médiane locale' + suf + '.']);
      }
    } else {
      sig.push(['am', 'Référence de marché manquante', 'Lancez la récupération des données publiques, ou saisissez le prix médian local (€/m²).']);
    }

    /* Ancienneté */
    if (age) {
      if (age > ref * 2) {
        score += 25;
        sig.push(['ru', Math.round(age / 30) + ' mois en ligne', 'Bien au-delà du délai moyen local (~' + ref + ' j). L\u2019annonce a été vue par tout le marché.']);
        args.push("L'annonce est en ligne depuis environ " + Math.round(age / 30) +
          ' mois, contre un délai de vente moyen de ' + ref + ' jours dans le secteur. Le bien ne trouve pas preneur au prix affiché.');
      } else if (age > ref) {
        score += 12;
        sig.push(['am', age + ' jours en ligne', 'Au-dessus du délai moyen local (~' + ref + ' j).']);
        args.push("L'annonce dépasse le délai de vente moyen du secteur (" + age + ' j contre ' + ref + ' j).');
      } else {
        sig.push(['em', age + ' jours en ligne', 'Annonce récente : le vendeur est encore en phase d\u2019attente.']);
      }
    }

    /* Baisses */
    if (baisses >= 2) {
      score += 20;
      sig.push(['ru', baisses + ' baisses de prix', 'Le vendeur a déjà cédé plusieurs fois : le prix initial n\u2019était pas tenable.']);
      args.push('Le prix a déjà été revu à la baisse ' + baisses + ' fois. Une nouvelle marche reste envisageable pour conclure.');
    } else if (baisses === 1) {
      score += 10;
      sig.push(['am', '1 baisse de prix', 'Premier ajustement : le vendeur est ouvert à la discussion.']);
      args.push('Une première baisse de prix a déjà eu lieu, signe que le vendeur ajuste ses attentes.');
    }

    /* DPE */
    var ech = echeance(dpe);
    if (dpe && ech.an) {
      score += idx(dpe) >= 5 ? 15 : 8;
      sig.push([ech.an <= 2028 ? 'ru' : 'am', 'DPE ' + dpe + ' — ' + ech.txt,
        (dpe === 'F' || dpe === 'G') ? 'Gel des loyers en vigueur depuis le 24 août 2022.' : 'Travaux à anticiper.']);
    }

    /* État & vendeur */
    if (etatBien >= 3) {
      score += etatBien === 4 ? 15 : 8;
      sig.push([etatBien === 4 ? 'ru' : 'am',
        etatBien === 4 ? 'Travaux lourds à prévoir' : 'Rafraîchissement à prévoir',
        'Un devis chiffré transforme une impression en montant négociable.']);
    }
    if (vendeur === 'succession') {
      score += 12;
      sig.push(['am', 'Vente en succession', 'Les vendeurs recherchent souvent une sortie rapide plutôt que le prix maximal.']);
    }

    score = Math.min(100, score);

    /* Verdict */
    var v = g('anVerdict'), lab, txt, cls;
    if (score >= 55) {
      lab = 'Marge de négociation probable'; cls = 'ru';
      txt = 'Plusieurs signaux concordants indiquent que le prix affiché n\u2019est pas tenu par le marché. Préparez une offre argumentée.';
    } else if (score >= 28) {
      lab = 'Discussion possible'; cls = 'am';
      txt = 'Quelques signaux jouent en votre faveur. Une offre inférieure au prix affiché, appuyée sur des faits, a des chances d\u2019aboutir.';
    } else {
      lab = 'Prix a priori tenu'; cls = 'em';
      txt = 'Peu de signaux exploitables à ce stade. La visite et un devis travaux restent vos meilleurs leviers.';
    }
    if (v) {
      v.className = 'an-verdict an-v-' + cls;
      v.innerHTML =
        '<div class="an-score">' + score + '<small>Indice de levier</small></div>' +
        '<div class="an-verdict-txt"><h3>' + lab + '</h3><p>' + txt + '</p>' +
        '<p class="an-mini">Aucun pourcentage de remise n\u2019est affiché : la marge réelle dépend de la situation du vendeur, ' +
        'qu\u2019aucune donnée publique ne mesure. Un chiffre créerait un ancrage défavorable à l\u2019acheteur.</p></div>';
    }

    /* Carte négociation */
    var nb = g('anNego');
    if (nb) {
      nb.innerHTML = sig.map(function (s) {
        var ic = s[0] === 'ru' ? '▲' : (s[0] === 'am' ? '◆' : '●');
        return '<div class="an-sig an-sig-' + s[0] + '"><span class="an-sig-i">' + ic +
          '</span><span><b>' + esc(s[1]) + '</b><small>' + esc(s[2]) + '</small></span></div>';
      }).join('');
    }

    /* Carte prix — frais de notaire alignés sur getNotaire() : 8,5 % dans l'ancien */
    var notaire = prix * 0.085;
    var coutTotal = prix + notaire;
    var pb = g('anPrix2');
    if (pb) {
      var h = kv('Prix affiché', eur(prix)) + kv('Prix au m²', eur(prixM2));
      if (median) {
        var mm = srcAuto.median;
        h += kv('Médiane locale', eur(median) + '/m²' + (mm ? ' · ' + mm.echantillon + ' ventes' : ''));
        h += kv('Écart au marché', pc(ecart), ecart > 8 ? 'ru' : (ecart > 2 ? 'am' : 'em'));
        if (mm && mm.bas) h += kv('Fourchette des ventes', eur(mm.bas) + ' – ' + eur(mm.haut) + '/m²');
        var juste = median * surf;
        h += kv('Fourchette de juste prix',
          eur(juste * (etatBien >= 3 ? 0.92 : 0.97)) + ' – ' + eur(juste * (etatBien <= 2 ? 1.06 : 1.0)));
      }
      h += kv('Frais de notaire estimés', eur(notaire) + ' (8,5 %)');
      h += kv('Coût d\u2019acquisition', eur(coutTotal));
      pb.innerHTML = h;
    }

    /* Carte énergie */
    var db = g('anDpe2');
    if (db) {
      var scale = '<div class="an-dpe">' + CLASSES.map(function (c) {
        var cl = 'an-dpe-c an-dpe-' + c;
        if (c === dpe) cl += ' on';
        if (c === cible && cible !== dpe) cl += ' target';
        return '<div class="' + cl + '">' + c + '</div>';
      }).join('') + '</div>';
      var hd = scale;
      if (!dpe) {
        hd += '<p class="an-mini">Étiquette non communiquée. Le DPE est obligatoire dans toute annonce : son absence est en soi un point à soulever.</p>';
      } else {
        var md = srcAuto.dpe;
        hd += kv('Étiquette', dpe + (md ? ' · officiel ADEME' : ' · saisie'), idx(dpe) >= 5 ? 'ru' : (idx(dpe) === 4 ? 'am' : 'em'));
        if (md && md.classeGES) hd += kv('Étiquette climat', md.classeGES);
        if (md && md.date) hd += kv('Date du diagnostic', String(md.date).slice(0, 10));
        if (md && md.avantReforme2026) {
          hd += '<p class="an-mini an-mini-am">DPE antérieur à la réforme du 1ᵉʳ janvier 2026 : le coefficient appliqué à l\u2019électricité a changé. ' +
            'Une comparaison directe avec un diagnostic plus récent peut induire en erreur.</p>';
        }
        hd += kv('Loi Climat & Résilience', ech.txt, ech.an ? 'ru' : 'em');
        if (dpe === 'F' || dpe === 'G') hd += kv('Gel des loyers F/G', 'Actif depuis août 2022', 'am');
        var rn = coutReno(surf, dpe, cible);
        if (rn.sauts > 0) {
          hd += kv('Travaux pour atteindre ' + cible, eur(rn.bas) + ' – ' + eur(rn.haut), 'am');
          hd += '<p class="an-mini">Fourchette indicative : isolation de l\u2019enveloppe en priorité, puis chauffage et ventilation. ' +
            'À confirmer sur devis — c\u2019est ce devis qui fera levier.</p>';
          args.push("Le passage de l'étiquette " + dpe + ' à ' + cible + ' représente un budget travaux estimé entre ' +
            eur(rn.bas) + ' et ' + eur(rn.haut) + ', à déduire de la valeur du bien.');
        }
      }
      db.innerHTML = hd;
    }

    /* Carte locatif — utilise calcMens() de app.js */
    var lb = g('anLoc');
    if (lb) {
      if (!loyerM2) {
        lb.innerHTML = '<p class="an-mini">Renseignez le loyer médian local (€/m²/mois), ou lancez la récupération des données publiques. Source : Carte des loyers DHUP/MEF.</p>';
      } else {
        var loyer = loyerM2 * surf;
        var chg = charges || coutTotal * 0.012;
        var brut = (loyer * 12) / coutTotal * 100;
        var net = (loyer * 12 * 0.95 - chg) / coutTotal * 100;
        var emprunt = prix * 0.9 + notaire;
        var mens = (typeof calcMens === 'function' ? calcMens(emprunt, 3.5, 20) : 0) + emprunt * 0.0036 / 12;
        var cash = loyer * 0.95 - chg / 12 - mens;
        var hl = kv('Loyer de marché estimé', eur(loyer) + '/mois' + (srcAuto.loyer ? ' · DHUP' : ' · saisie'));
        hl += kv('Rendement brut', brut.toFixed(2) + ' %', brut >= 6 ? 'em' : (brut >= 4 ? 'am' : 'ru'));
        hl += kv('Rendement net de charges', net.toFixed(2) + ' %', net >= 4 ? 'em' : (net >= 3 ? 'am' : 'ru'));
        hl += kv('Charges retenues', eur(chg) + '/an');
        hl += kv('Mensualité (90 %, 3,5 %, 20 ans)', eur(mens));
        hl += kv('Cashflow mensuel', (cash >= 0 ? '+' : '') + eur(cash), cash >= 0 ? 'em' : 'ru');
        if (ech.an) {
          hl += '<p class="an-mini an-mini-ru">Ce bien tombe sous le calendrier d\u2019interdiction de location : le business plan suppose les travaux réalisés.</p>';
        }
        lb.innerHTML = hl;
        if (net < 3.5) {
          args.push('Au prix affiché, le rendement net ressort à ' + net.toFixed(2) +
            ' %, en dessous du seuil de rentabilité recherché sur ce type de bien.');
        }
      }
    }

    /* Arguments */
    var ab = g('anArgs');
    if (ab) {
      if (args.length) {
        ab.innerHTML = '<h3>Vos arguments pour la négociation</h3><ol>' +
          args.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ol>' +
          '<p class="an-args-note">Présentez des faits, jamais un pourcentage. Une offre écrite, datée, accompagnée d\u2019un devis travaux ' +
          'et d\u2019une attestation de financement pèse bien plus qu\u2019un chiffre lancé oralement.</p>';
        ab.style.display = 'block';
      } else { ab.style.display = 'none'; }
    }

    if (window.ANStore) { window.ANStore.archive({ score: score }); rendreHist(); }
    if (scroll) anScroll('anResults');
  };

  /* ── Actions ───────────────────────────────────── */

  window.anCopyArgs = function () {
    if (!args.length) { alert('Lancez d\u2019abord une analyse.'); return; }
    var t = 'Éléments de négociation — ' + (tx('anAdresse') || tx('anVille') || 'bien analysé') + '\n\n' +
      args.map(function (a, i) { return (i + 1) + '. ' + a; }).join('\n\n') +
      '\n\nSources : DVF (DGFiP), ADEME, Carte des loyers DHUP/MEF, INSEE.';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(t).then(function () {
        if (typeof toast === 'function') toast('Arguments copiés.', 'ok'); else alert('Arguments copiés.');
      });
    } else { window.prompt('Copiez les arguments :', t); }
  };

  /**
   * Bascule vers le simulateur en pré-remplissant les champs réels
   * (prixAffiche, prixAchat, surface, ville, loyerMensuel, dpe, taxeFonc)
   * puis déclenche lv() et calc() de app.js.
   */
  window.anToSim = function () {
    var prix = vn('anPrix'), surf = vn('anSurf'), loyer = Math.round(vn('anLoyerM2') * surf);
    sv('prixAffiche', prix);
    sv('prixAchat', prix);
    sv('surface', surf);
    sv('ville', tx('anVille'));
    if (loyer) sv('loyerMensuel', loyer);
    if (tx('anDpe')) sv('dpe', tx('anDpe'));
    if (vn('anCharges')) sv('taxeFonc', Math.round(vn('anCharges') * 0.45));
    var etatB = parseInt(tx('anEtat') || '2', 10);
    if (etatB >= 3 && !vn('travaux')) {
      var rn = coutReno(surf, tx('anDpe'), tx('anDpeCible'));
      if (rn.bas) sv('travaux', rn.bas);
    }
    window.gv('sim');
    try { if (typeof lv === 'function') lv(); } catch (e) {}
    try { if (typeof calc === 'function') calc(); } catch (e) {}
  };

  /* ── Historique local ──────────────────────────── */

  function rendreHist() {
    var b = g('anHistList');
    if (!b || !window.ANStore) return;
    var l = window.ANStore.historique();
    if (!l.length) { b.innerHTML = '<div class="an-empty">Aucun bien analysé pour l\u2019instant.</div>'; return; }
    b.innerHTML = l.map(function (e, i) {
      var lieu = e.anAdresse || e.anVille || 'Bien sans adresse';
      var p = e.anPrix ? parseInt(e.anPrix, 10).toLocaleString('fr-FR') + ' €' : '—';
      var cls = e.score >= 55 ? 'ru' : (e.score >= 28 ? 'am' : 'em');
      return '<button class="an-hist" onclick="anLoadHist(' + i + ')">' +
        '<span class="an-hist-score an-hs-' + cls + '">' + (e.score == null ? '?' : e.score) + '</span>' +
        '<span class="an-hist-txt"><b>' + esc(lieu) + '</b><small>' + p +
        (e.anSurf ? ' · ' + e.anSurf + ' m²' : '') + ' · ' + new Date(e.date).toLocaleDateString('fr-FR') +
        '</small></span></button>';
    }).join('');
  }

  window.anLoadHist = function (i) {
    if (window.ANStore && window.ANStore.charger(i)) window.anRun(true);
  };
  window.anClearHist = function () {
    if (confirm('Effacer l\u2019historique des biens analysés ?') && window.ANStore) {
      window.ANStore.viderHistorique(); rendreHist();
    }
  };
  window.anClearCache = function () {
    if (window.ANData) window.ANData.viderCache();
    if (window.ANLocate) window.ANLocate.viderCache();
    if (typeof toast === 'function') toast('Cache des données publiques vidé.', 'ok');
    else alert('Cache vidé.');
  };

  /* ── Checklist de visite ───────────────────────── */

  var CHECK = [
    ['Avant d\u2019entrer', [
      'Façade, toiture, gouttières : fissures, humidité, mousses',
      'Environnement sonore à l\u2019heure de la visite… et à une autre heure',
      'Stationnement, commerces, transports, écoles à pied',
      'Parties communes : entretien, ascenseur, boîtes aux lettres',
      'Chantiers ou terrains libres à proximité (consulter le PLU)'
    ]],
    ['Structure & second œuvre', [
      'Fissures traversantes, planchers qui plient, portes qui frottent',
      'Traces d\u2019humidité en bas des murs, odeur de renfermé',
      'État des menuiseries : simple ou double vitrage, étanchéité',
      'Isolation des combles : présence, épaisseur, état',
      'Tableau électrique aux normes, nombre de prises par pièce',
      'Plomberie : pression, évacuation, état du réseau apparent'
    ]],
    ['Énergie', [
      'DPE fourni, date d\u2019établissement (avant ou après réforme 2026)',
      'Système de chauffage : type, âge, dernier entretien',
      'Montant réel des factures d\u2019énergie sur 12 mois',
      'Ventilation : VMC en fonctionnement, aérations non obstruées'
    ]],
    ['Copropriété & juridique', [
      '3 derniers PV d\u2019assemblée générale',
      'Travaux votés non encore appelés (à la charge de l\u2019acheteur)',
      'Montant des charges et leur répartition (tantièmes)',
      'Fonds de travaux (loi ALUR) et impayés de la copropriété',
      'Taxe foncière de l\u2019année précédente',
      'Servitudes, mitoyenneté, bornage pour une maison'
    ]],
    ['Après la visite', [
      'Photos de chaque pièce et de chaque défaut relevé',
      'Devis travaux demandé à un artisan avant l\u2019offre',
      'Vérification des prix de vente réels du secteur (DVF)',
      'Attestation de financement obtenue auprès de la banque',
      'Offre écrite, datée, avec durée de validité'
    ]]
  ];

  var CK = 'immosim.checkvisite';
  function loadCk() { try { return JSON.parse(localStorage.getItem(CK) || '{}'); } catch (e) { return {}; } }
  function saveCk(s) { try { localStorage.setItem(CK, JSON.stringify(s)); } catch (e) {} }

  function rendreCheck() {
    var grid = g('anCheckGrid');
    if (!grid) return;
    var st = loadCk(), tot = 0, ok = 0;
    grid.innerHTML = CHECK.map(function (cat, ci) {
      return '<div class="an-ck-cat"><h4>' + cat[0] + '</h4>' + cat[1].map(function (it, ii) {
        var id = 'c' + ci + '_' + ii; tot++;
        var on = !!st[id]; if (on) ok++;
        return '<label class="an-ck' + (on ? ' done' : '') + '">' +
          '<input type="checkbox" data-ck="' + id + '"' + (on ? ' checked' : '') + '/>' +
          '<span>' + it + '</span></label>';
      }).join('') + '</div>';
    }).join('');
    var bar = g('anCheckBar');
    if (bar) {
      var p = tot ? Math.round(ok / tot * 100) : 0;
      bar.style.width = p + '%';
      if (bar.parentNode) bar.parentNode.setAttribute('aria-valuenow', String(p));
      var c = g('anCheckCount');
      if (c) c.textContent = ok + ' / ' + tot + ' points vérifiés';
    }
  }

  window.anCheckReset = function () { saveCk({}); rendreCheck(); };

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.dataset && t.dataset.ck) {
      var s = loadCk(); s[t.dataset.ck] = t.checked; saveCk(s); rendreCheck();
    }
  });

  /* ── Init ──────────────────────────────────────── */

  function init() {
    rendreCheck();
    rendreHist();
    if (window.ANStore && window.ANStore.restore()) {
      var r = g('anRestore'); if (r) r.style.display = 'block';
    }
    var u = g('anUrl');
    if (u) u.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.anStart(); });
    var a = g('anAdresse');
    if (a) a.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.anFetch(); });
    if (window.ANStore) {
      window.ANStore.CHAMPS.forEach(function (id) {
        var e = g(id);
        if (e) e.addEventListener('change', function () { window.ANStore.save(); });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
