/* ============================================================
   IMMOSIM V9 — Interface du module de localisation
   Chargé après localisation.js et annonce.js.
   ============================================================ */
(function () {
  'use strict';

  var L = window.ANLocate;
  var $ = function (id) { return document.getElementById(id); };
  var val = function (id) { var e = $(id); return e ? e.value.trim() : ''; };
  var num = function (id) { var e = $(id); var v = e ? parseFloat(e.value) : NaN; return isNaN(v) ? 0 : v; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var derniers = [];

  /* ---------- Jeton Mapillary ---------- */

  window.anSaveToken = function () {
    var t = val('anMlyToken');
    L.setToken(t);
    var s = $('anTokenStatus');
    if (s) {
      s.textContent = t ? 'Jeton enregistré dans ce navigateur.' : 'Jeton effacé.';
      s.hidden = false;
    }
    if (t) { $('anMlyToken').value = t.slice(0, 8) + '…'; }
  };

  window.anToggleToken = function () {
    var w = $('anTokenWrap');
    if (w) w.hidden = !w.hidden;
  };

  /* ---------- Recherche ---------- */

  window.anFindAddress = function () {
    var commune = val('anLocCommune') || val('anVille');
    var cp = (commune.match(/\b(\d{5})\b/) || [])[1] || '';
    var nom = commune.replace(/\b\d{5}\b/, '').trim();

    if (!cp && !nom) {
      alert('Renseignez au moins une commune ou un code postal.');
      return;
    }

    var btn = $('anFindBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Recherche en cours…'; }
    var res = $('anLocResults');
    if (res) {
      res.innerHTML = '<p class="an-mini"><span class="an-spin"></span> Interrogation de la base ADEME…</p>';
      res.hidden = false;
    }

    L.candidats({
      commune: nom,
      codePostal: cp,
      surface: num('anSurf') || num('anLocSurf'),
      classe: val('anDpe'),
      type: val('anType') === 'maison' ? 'maison' : 'appt',
      anneeMin: num('anLocAnneeMin') || null,
      anneeMax: num('anLocAnneeMax') || null
    }).then(function (r) {
      derniers = r.candidats;
      return L.token() ? L.illustrer(r.candidats).then(function () { return r; }) : r;
    }).then(function (r) {
      rendre(r);
      if (btn) { btn.disabled = false; btn.textContent = 'Chercher des adresses candidates'; }
    }).catch(function (e) {
      if (res) {
        res.innerHTML = '<p class="an-mini an-mini-ru">Recherche impossible : ' + esc(e.message || e) +
          '</p><p class="an-mini">La base ADEME est peut-être momentanément indisponible. Vous pouvez saisir l\u2019adresse à la main.</p>';
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Chercher des adresses candidates'; }
    });
  };

  /* ---------- Rendu ---------- */

  function rendre(r) {
    var box = $('anLocResults');
    if (!box) return;

    if (!r.candidats.length) {
      box.innerHTML = '<div class="an-conf an-conf-aucune"><b>Aucun candidat</b>' +
        '<p>Aucun DPE de cette commune ne correspond à la surface et à l\u2019étiquette renseignées. ' +
        'Cela arrive quand le logement n\u2019a jamais été diagnostiqué, quand la surface annoncée diffère de la surface habitable ' +
        '(loi Carrez contre surface DPE), ou quand l\u2019annonce elle-même est imprécise. Élargissez la tolérance ou saisissez l\u2019adresse à la main.</p></div>';
      return;
    }

    var c = r.confiance;
    var h = '<div class="an-conf an-conf-' + c.niveau + '">' +
      '<b>Confiance ' + c.niveau + '</b><p>' + esc(c.texte) + '</p>' +
      '<small>' + r.candidats.length + ' candidat(s) retenu(s) sur ' + r.totalExamine + ' diagnostics examinés.</small></div>';

    h += '<p class="an-mini an-warn-strong">Une adresse erronée contaminerait le DPE, le prix DVF et tous vos arguments de négociation. ' +
      'Ne validez un candidat que si la façade correspond sans ambiguïté.</p>';

    h += '<div class="an-cands">' + r.candidats.map(function (k, i) {
      var g = L.coords(k);
      var photos = (k.photos || []).slice(0, 3);
      var img = photos.length
        ? '<div class="an-cand-photos">' + photos.map(function (p) {
            return '<a href="' + esc(p.thumb_1024_url) + '" target="_blank" rel="noopener">' +
              '<img src="' + esc(p.thumb_1024_url) + '" alt="Façade à ' + (p.distance || '?') + ' m" loading="lazy"/>' +
              '<span>' + (p.distance != null ? p.distance + ' m' : '') + (p.annee ? ' · ' + p.annee : '') + '</span></a>';
          }).join('') + '</div>'
        : (L.token()
            ? '<p class="an-mini">Aucune photo de rue disponible à cette adresse.</p>'
            : '<p class="an-mini">Ajoutez un jeton Mapillary pour voir les façades.</p>');

      return '<article class="an-cand">' +
        '<header><span class="an-cand-rank">' + (i + 1) + '</span>' +
        '<div><b>' + esc(k.adresse) + '</b>' +
        '<small>' + esc(k.codePostal) + ' ' + esc(k.commune || '') +
        (k.lots > 1 ? ' · ' + k.lots + ' lots diagnostiqués à cette adresse' : '') + '</small></div>' +
        '<span class="an-cand-score">' + k.score + '</span></header>' +
        '<ul class="an-cand-facts">' +
        (k.surface ? '<li>' + k.surface + ' m²</li>' : '') +
        (k.classe ? '<li>DPE ' + k.classe + (k.classeGES ? ' / GES ' + k.classeGES : '') + '</li>' : '') +
        (k.annee ? '<li>construit en ' + k.annee + '</li>' : '') +
        (k.date ? '<li>diagnostic du ' + esc(String(k.date).slice(0, 10)) + '</li>' : '') +
        '</ul>' +
        (k.motifs && k.motifs.length ? '<p class="an-cand-why">' + esc(k.motifs.join(' · ')) + '</p>' : '') +
        img +
        '<div class="an-cand-actions">' +
        '<button class="btn btn-p btn-sm" onclick="anUseCandidate(' + i + ')">Utiliser cette adresse</button>' +
        (g ? '<a class="btn btn-g btn-sm" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' +
             g.lat + '&mlon=' + g.lon + '#map=19/' + g.lat + '/' + g.lon + '">Voir sur la carte</a>' : '') +
        '</div></article>';
    }).join('') + '</div>';

    box.innerHTML = h;
    box.hidden = false;
  }

  /* ---------- Validation ---------- */

  window.anUseCandidate = function (i) {
    var k = derniers[i];
    if (!k) return;
    if (!confirm('Confirmez-vous que la façade correspond bien au bien de l\u2019annonce ?\n\n' +
                 k.adresse + '\n\nUne adresse erronée fausserait toute l\u2019analyse.')) return;

    var a = $('anAdresse');
    if (a) a.value = k.adresse + (k.commune ? ', ' + k.commune : '');
    var v = $('anVille');
    if (v) v.value = ((k.commune || '') + ' ' + (k.codePostal || '')).trim();
    if (k.classe && $('anDpe')) $('anDpe').value = k.classe;
    if (k.surface && $('anSurf') && !$('anSurf').value) $('anSurf').value = Math.round(k.surface);
    if (k.cout && $('anCharges') && !$('anCharges').value) $('anCharges').value = Math.round(k.cout);

    if (typeof window.anFetch === 'function') window.anFetch();
    if (typeof window.anScroll === 'function') window.anScroll('anForm');
  };

  window.anClearLocCache = function () {
    L.viderCache();
    alert('Cache de localisation vidé.');
  };

  /* ---------- Initialisation ---------- */

  function init() {
    var t = L.token();
    if (t && $('anMlyToken')) {
      $('anMlyToken').value = t.slice(0, 8) + '…';
      var s = $('anTokenStatus');
      if (s) { s.textContent = 'Jeton actif.'; s.hidden = false; }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
