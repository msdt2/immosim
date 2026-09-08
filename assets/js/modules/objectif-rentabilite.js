/* ════════════════════════════════════════════════════════════════════════════
   ImmoSim — OBJECTIF DE RENTABILITÉ / PRIX D'ACHAT CIBLE
   ────────────────────────────────────────────────────────────────────────────
   Fichier ADDITIF. Ne modifie ni app.js ni styles.css.
   À charger APRÈS app.js :
       <script src="assets/js/modules/objectif-rentabilite.js"></script>

   Calcule, pour un ou plusieurs objectifs de rentabilité brute, le prix
   d'achat maximal à ne pas dépasser, la décote à obtenir et le pourcentage
   de négociation correspondant.

   BASE DE CALCUL RETENUE (hors frais de notaire) :
       rentabilité brute = loyer annuel / (prix d'achat + travaux)
       prix cible        = loyer annuel / (objectif / 100) - travaux

   Sont donc exclus du dénominateur : frais de notaire, frais d'agence,
   ameublement et autres frais.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LS_KEY = 'immoV10_objRent';
  const DEFAULTS = [10, 11];
  const MAX_TARGETS = 5;

  /* ── Helpers tolérants (les globales viennent de app.js) ────────────────── */
  const el = (id) => document.getElementById(id);
  const num = (id) => { const n = parseFloat((el(id) || {}).value); return isNaN(n) ? 0 : n; };
  const eur = (n) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' \u20AC';
  const pct = (n, d) => (isFinite(n) ? n : 0).toLocaleString('fr-FR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }) + ' %';

  /* ── Objectifs mémorisés ────────────────────────────────────────────────── */
  function getTargets() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (Array.isArray(raw) && raw.length) {
        const clean = raw.map(Number).filter(v => isFinite(v) && v > 0 && v <= 40);
        if (clean.length) return clean.slice(0, MAX_TARGETS);
      }
    } catch (err) {}
    return DEFAULTS.slice();
  }
  function setTargets(arr) {
    const clean = (arr || []).map(Number).filter(v => isFinite(v) && v > 0 && v <= 40).slice(0, MAX_TARGETS);
    try { localStorage.setItem(LS_KEY, JSON.stringify(clean.length ? clean : DEFAULTS)); } catch (err) {}
    return clean.length ? clean : DEFAULTS.slice();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CALCUL
     ══════════════════════════════════════════════════════════════════════════ */
  function compute(r, targets) {
    if (!r) return null;
    const loyerAn = +r.loyerAn || 0;
    const travaux = +r.tr || num('travaux') || 0;
    const paActuel = +r.pa || 0;
    // Le prix affiché est l'ancre de négociation ; à défaut, le prix retenu.
    const prixRef = (+r.prixAffiche > 0 ? +r.prixAffiche : paActuel);
    const base = paActuel + travaux;
    const rentActuelle = base > 0 ? (loyerAn / base) * 100 : 0;

    const rows = (targets || getTargets()).map(cible => {
      const prixCible = cible > 0 ? (loyerAn / (cible / 100)) - travaux : 0;
      const faisable = prixCible > 0;
      const decote = prixRef - prixCible;          // > 0 : effort à obtenir
      const negoPct = prixRef > 0 ? (1 - prixCible / prixRef) * 100 : 0;
      const ecartActuel = paActuel - prixCible;
      return {
        cible,
        prixCible,
        faisable,
        atteint: rentActuelle >= cible - 1e-9,
        decote,
        negoPct,
        ecartActuel,
        // Négociation applicable dans le simulateur
        applicable: faisable && prixRef > 0 && negoPct > 0 && negoPct < 95,
        prixM2: (+r.surface > 0 && faisable) ? prixCible / +r.surface : null
      };
    });

    return { loyerAn, travaux, paActuel, prixRef, base, rentActuelle, rows };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INTERFACE — bloc ajouté au panneau de résultats
     ══════════════════════════════════════════════════════════════════════════ */
  const BOX_ID = 'objRentBox';

  function render() {
    const panel = el('panelMain');
    const R_ = (typeof R !== 'undefined') ? R : null;
    if (!panel || !R_) return;

    const d = compute(R_);
    if (!d) return;

    const old = el(BOX_ID);
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.className = 'rg';
    wrap.id = BOX_ID;

    const inStyle = 'width:58px;background:var(--bg3);border:1px solid var(--bd2);border-radius:5px;'
      + 'color:var(--gold);font-weight:700;font-size:.8rem;padding:3px 5px;text-align:right;font-family:inherit';
    const btnStyle = 'background:transparent;border:1px solid var(--bd2);border-radius:5px;color:var(--ink3);'
      + 'font-size:.62rem;padding:3px 7px;cursor:pointer;font-family:inherit;white-space:nowrap';

    let html = '<div class="rg-label">Objectif de rentabilité — prix d\'achat cible</div>';

    html += '<div class="rc"><span class="rl">Rentabilité brute actuelle'
      + '<br/><span style="font-size:.62rem;color:var(--ink4)">Base : prix d\'achat ' + eur(d.paActuel)
      + (d.travaux > 0 ? ' + travaux ' + eur(d.travaux) : '') + ' — hors frais de notaire</span></span>'
      + '<span class="rv" style="color:var(--gold)">' + pct(d.rentActuelle) + '</span></div>';

    d.rows.forEach((row, i) => {
      let cls = 'rc', right, sub;
      if (!row.faisable) {
        cls += ' neg';
        right = 'Hors d\'atteinte';
        sub = 'Les travaux (' + eur(d.travaux) + ') dépassent déjà la valeur compatible avec cet objectif.';
      } else if (row.atteint) {
        cls += ' pos';
        right = eur(row.prixCible);
        sub = 'Objectif déjà atteint — marge de ' + eur(Math.abs(row.ecartActuel)) + ' sur le prix retenu.';
      } else {
        cls += ' gold';
        right = eur(row.prixCible);
        sub = 'Décote de ' + eur(row.decote) + ' sur le prix affiché (' + eur(d.prixRef) + ')'
          + ' — négociation ' + pct(row.negoPct, 1)
          + (row.prixM2 ? ' · ' + eur(row.prixM2) + '/m²' : '');
      }
      html += '<div class="' + cls + '" style="align-items:flex-start">'
        + '<span class="rl" style="display:flex;flex-direction:column;gap:4px">'
        + '<span style="display:flex;align-items:center;gap:6px">'
        + '<input type="number" step="0.25" min="1" max="40" value="' + row.cible + '" data-obj-i="' + i + '" style="' + inStyle + '"/>'
        + '<span style="font-weight:600;color:var(--ink2)">de rentabilité brute</span>'
        + '<button data-obj-del="' + i + '" style="' + btnStyle + '" title="Retirer cet objectif">×</button>'
        + '</span>'
        + '<span style="font-size:.63rem;color:var(--ink4);line-height:1.35">' + sub + '</span>'
        + '</span>'
        + '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">'
        + '<span class="rv">' + right + '</span>'
        + (row.applicable ? '<button data-obj-apply="' + i + '" style="' + btnStyle + '">Appliquer la négociation</button>' : '')
        + '</span></div>';
    });

    if (d.rows.length < MAX_TARGETS) {
      html += '<div style="margin-top:6px"><button data-obj-add="1" style="' + btnStyle + '">+ Ajouter un objectif</button></div>';
    }

    html += '<p style="font-size:.62rem;color:var(--ink4);margin-top:7px;line-height:1.45">'
      + 'Prix cible = loyer annuel ÷ objectif − travaux. Les frais de notaire, d\'agence, '
      + 'l\'ameublement et les autres frais sont exclus du calcul.</p>';

    wrap.innerHTML = html;
    // Placé en deuxième position plutôt qu'en fin de panneau : le prix cible
    // est une donnée de décision, elle ne doit pas exiger de faire défiler.
    if (panel.children.length > 1) panel.insertBefore(wrap, panel.children[1]);
    else panel.appendChild(wrap);

    /* ── Interactions ── */
    wrap.addEventListener('change', (ev) => {
      const inp = ev.target.closest('[data-obj-i]');
      if (!inp) return;
      const t = getTargets();
      const v = parseFloat(inp.value);
      if (isFinite(v) && v > 0 && v <= 40) { t[+inp.getAttribute('data-obj-i')] = v; setTargets(t); render(); }
    });
    wrap.addEventListener('click', (ev) => {
      const del = ev.target.closest('[data-obj-del]');
      const add = ev.target.closest('[data-obj-add]');
      const app = ev.target.closest('[data-obj-apply]');
      if (del) {
        const t = getTargets();
        if (t.length <= 1) { try { toast('Au moins un objectif est nécessaire.', 'err'); } catch (e) {} return; }
        t.splice(+del.getAttribute('data-obj-del'), 1); setTargets(t); render();
      } else if (add) {
        const t = getTargets();
        t.push(Math.min(40, Math.round((Math.max.apply(null, t) + 1) * 4) / 4));
        setTargets(t); render();
      } else if (app) {
        applyNego(d.rows[+app.getAttribute('data-obj-apply')]);
      }
    });
  }

  /* Reporte la négociation calculée dans le simulateur puis relance le calcul */
  function applyNego(row) {
    if (!row || !row.applicable) return;
    const f = el('negoP');
    if (!f) { try { toast('Champ de négociation introuvable.', 'err'); } catch (e) {} return; }
    f.value = row.negoPct.toFixed(2);
    try { if (typeof updateNego === 'function') updateNego(); } catch (err) {}
    try { if (typeof calc === 'function') calc(); } catch (err) {}
    try { toast('Négociation ' + pct(row.negoPct, 1) + ' appliquée — objectif ' + pct(row.cible, 2), 'ok'); } catch (err) {}
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ALIGNEMENT DE LA RENTABILITÉ BRUTE
     ──────────────────────────────────────────────────────────────────────────
     app.js calcule la rentabilité brute sur le coût total (frais de notaire,
     agence, ameublement inclus). La définition retenue ici est celle de
     l'investisseur :

         rentabilité brute = loyer annuel / (prix d'achat + travaux)

     On recalcule donc R.rentBrute après chaque simulation, on rejoue le score
     avec cette valeur, et on met à jour l'affichage. Le dossier PDF suit
     automatiquement puisqu'il lit R.rentBrute.

     Pour revenir au comportement d'origine :
         window.IMMOSIM_RENT_BASE = 'cout-total';
     ══════════════════════════════════════════════════════════════════════════ */

  function baseHorsNotaire(r) {
    const travaux = +r.tr || num('travaux') || 0;
    return (+r.pa || 0) + travaux;
  }

  function alignRentBrute() {
    if (window.IMMOSIM_RENT_BASE === 'cout-total') return;
    const r = (typeof R !== 'undefined') ? R : null;
    if (!r || !r.loyerAn) return;

    const base = baseHorsNotaire(r);
    if (base <= 0) return;

    const rb = (r.loyerAn / base) * 100;
    if (r.rentBruteCoutTotal === undefined) r.rentBruteCoutTotal = r.rentBrute;
    if (Math.abs(r.rentBrute - rb) < 1e-9) return;   // déjà aligné
    r.rentBrute = rb;
    r.rentBruteBase = 'prix + travaux, hors frais de notaire';

    // Le score dépend de la rentabilité : il doit être rejoué sur la même base.
    let score = r.score;
    try {
      if (typeof calcScore === 'function') {
        score = calcScore({
          rentBrute: rb, cfAvant: r.cfAvant, dpe: r.dpe,
          vacance: num('vacance'), loyer: r.loyerM, mens: r.mensFin
        });
        r.score = score;
      }
    } catch (err) {}

    patchAffichage(rb, score);
  }

  /* Mise à jour de l'affichage déjà produit par app.js */
  function patchAffichage(rb, score) {
    const panel = el('panelMain');
    if (!panel) return;

    // Ligne « Rentabilité brute »
    panel.querySelectorAll('.rc').forEach(row => {
      const lab = row.querySelector('.rl');
      const val = row.querySelector('.rv');
      if (!lab || !val) return;
      if (lab.textContent.trim() === 'Rentabilité brute') {
        val.textContent = pct(rb);
        if (!row.querySelector('[data-rb-note]')) {
          const n = document.createElement('span');
          n.setAttribute('data-rb-note', '1');
          n.style.cssText = 'display:block;font-size:.6rem;color:var(--ink4);font-weight:400;margin-top:1px';
          n.textContent = 'Base : prix d\'achat + travaux, hors frais de notaire';
          lab.appendChild(n);
        }
      }
    });

    // Bloc de score
    try {
      const col = (typeof scColor === 'function') ? scColor(score) : null;
      const lab = (typeof scLabel === 'function') ? scLabel(score) : null;
      const n2 = panel.querySelector('.sn2');
      if (n2) { n2.textContent = Math.round(score); if (col) n2.style.color = col; }
      const ring = panel.querySelector('.score-ring');
      if (ring && col) { ring.style.borderColor = col; ring.style.background = col + '18'; }
      const sl = panel.querySelector('.sl');
      if (sl && lab) { sl.textContent = lab.l; if (col) sl.style.color = col; }
      const ss = panel.querySelector('.ss');
      if (ss && lab) ss.textContent = lab.s;
      const bar = panel.querySelector('.sbar-f');
      if (bar) { bar.style.width = score + '%'; if (col) bar.style.background = col; }
    } catch (err) {}
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BRANCHEMENT SUR LE CALCUL
     ══════════════════════════════════════════════════════════════════════════ */
  function hookCalc() {
    if (typeof window.calc !== 'function' || window.calc.__objRentHooked) return true;
    const orig = window.calc;
    const wrapped = function () {
      const out = orig.apply(this, arguments);
      try { alignRentBrute(); } catch (err) { console.warn('[ImmoSim Objectif]', err); }
      try { render(); } catch (err) { console.warn('[ImmoSim Objectif]', err); }
      return out;
    };
    wrapped.__objRentHooked = true;
    window.calc = wrapped;
    return true;
  }

  /* Filet de sécurité : app.js réécrit #panelMain à chaque calcul. On observe
     ce conteneur et on réinjecte le bloc dès qu'il disparaît. Ce mécanisme
     fonctionne même si window.calc n'est pas exposé (script chargé en module,
     fonction encapsulée, etc.). */
  function observePanel() {
    const panel = el('panelMain');
    const MO = window.MutationObserver || window.WebKitMutationObserver;
    if (!panel || panel.__objRentObserved || !MO) return;
    panel.__objRentObserved = true;
    let busy = false;
    new MO(() => {
      if (busy) return;
      if (el(BOX_ID)) return;                       // bloc déjà présent
      const hasR = (typeof R !== 'undefined') && R;
      if (!hasR) return;
      busy = true;
      try { alignRentBrute(); } catch (err) {}
      try { render(); } catch (err) { console.warn('[ImmoSim Objectif]', err); }
      busy = false;
    }).observe(panel, { childList: true });
  }

  window.ImmoSimObjectif = { getTargets, setTargets, compute, render, alignRentBrute, DEFAULTS };

  const boot = () => {
    hookCalc();
    observePanel();
    try { if (typeof R !== 'undefined' && R) render(); } catch (err) {}
    // app.js peut être chargé après nous : on retente brièvement.
    let n = 0;
    const retry = setInterval(() => {
      hookCalc(); observePanel();
      if (++n > 20 || (typeof window.calc === 'function' && window.calc.__objRentHooked)) clearInterval(retry);
    }, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.info('[ImmoSim] Module « objectif de rentabilité » actif (base hors frais de notaire : prix + travaux).');
})();
