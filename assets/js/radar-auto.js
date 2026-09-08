/* ═══════════════════════════════════════════════════════════════
   radar-auto.js — module additif pour ImmoSim
   À charger APRÈS lq-pdf.js (c'est l'exportPDF redéfini qu'il appelle).

   Rôle : quand ImmoSim est ouvert avec ?auto=pdf, produire le dossier
   dès que le formulaire est prérempli. Rien d'autre, aucun fichier
   existant modifié.

   Point clé : loadShareURL() enchaîne restForm() puis lv(), et lv() ne
   calcule pas — il ne rafraîchit que les champs dérivés (coût total,
   mensualité, amortissements). Sans un appel explicite à calc(), R
   reste nul et exportPDF() n'a rien à imprimer. Ce module fait donc ce
   que ferait le bouton « Calculer la rentabilité », puis exporte.

   R est déclaré `let R = null` au niveau script : c'est une liaison
   lexicale globale, absente de `window`. On ne cherche donc pas à la
   lire, on se contente de déclencher calc() et de vérifier que le
   panneau de résultats s'est rempli.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* loadShareURL() efface la query par history.replaceState dès le
     DOMContentLoaded : on la capture maintenant, au parsing du script. */
  var demande = (new URLSearchParams(location.search).get('auto') || '').toLowerCase();
  if (demande !== 'pdf' && demande !== 'visite') return;

  var PAS = 200, LIMITE = 60;      // 12 s d'attente au maximum
  var essais = 0, fini = false;

  function fn(nom) {
    try { return typeof window[nom] === 'function' ? window[nom] : null; }
    catch (e) { return null; }
  }
  function dire(msg, type) {
    var t = fn('toast');
    if (t) t(msg, type || 'ok'); else console.log('[radar-auto]', msg);
  }
  function champRempli() {
    var el = document.getElementById('prixAchat');
    return !!(el && String(el.value || '').trim() && String(el.value).trim() !== '0');
  }
  function resultatsAffiches() {
    var p = document.getElementById('panelMain');
    return !!(p && p.innerHTML && p.innerHTML.length > 400);
  }

  function exporter() {
    var nom = demande === 'visite' ? 'exportVisitePDF' : 'exportPDF';
    var f = fn(nom);
    if (!f) {
      dire('Simulation chargée. Générez le dossier depuis le menu.', 'ok');
      console.warn('[radar-auto] ' + nom + ' introuvable sur window.');
      return;
    }
    try {
      f();
    } catch (e) {
      console.warn('[radar-auto] ' + nom + ' a échoué', e);
      dire('Le dossier n\'a pas pu être généré automatiquement.', 'err');
    }
  }

  function tenter() {
    if (fini) return;

    /* Attendre que ?sim= ait été appliqué au formulaire */
    if (!champRempli()) {
      if (++essais > LIMITE) {
        console.warn('[radar-auto] formulaire jamais prérempli, abandon.');
        return;
      }
      setTimeout(tenter, PAS);
      return;
    }

    var calculer = fn('calc');
    if (!calculer) {
      if (++essais > LIMITE) { dire('Générez le dossier depuis le menu.', 'ok'); return; }
      setTimeout(tenter, PAS);
      return;
    }

    fini = true;
    try {
      calculer();                       // équivaut au bouton « Calculer la rentabilité »
    } catch (e) {
      console.warn('[radar-auto] calc() a échoué', e);
      dire('Le calcul n\'a pas abouti. Cliquez sur « Calculer la rentabilité ».', 'err');
      return;
    }

    /* calc() rend le panneau puis les graphiques ; on laisse le rendu
       se terminer avant de lancer jsPDF, qui lit ces éléments. */
    var attente = 0;
    (function prêt() {
      if (resultatsAffiches() || attente > 20) { setTimeout(exporter, 400); return; }
      attente++;
      setTimeout(prêt, 150);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(tenter, 250); });
  } else {
    setTimeout(tenter, 250);
  }
})();
