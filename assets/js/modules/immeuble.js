/* ════════════════════════════════════════════════════════════════════════════
   ImmoSim — IMMEUBLE DE RAPPORT
   ────────────────────────────────────────────────────────────────────────────
   Fichier ADDITIF. Ne modifie ni app.js ni styles.css.
   À charger APRÈS app.js :
       <script src="assets/js/modules/immeuble.js"></script>

   Quand « Immeuble » est choisi dans « Type de bien », une section de saisie
   apparaît sous le bloc « Bien immobilier » : nombre de lots, puis pour chaque
   lot son étage, son type, sa surface, son loyer hors charges, la provision
   pour charges, son statut d'occupation, son DPE, sa vacance et les travaux
   à prévoir.

   Les lots alimentent le tableau `lots` déjà utilisé par app.js (mode
   multi-lots), la fiche de visite et le dossier PDF.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LS = 'immoV10_immeuble';
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const eur = (n) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' \u20AC';
  const pct = (n, d) => (isFinite(n) ? n : 0).toLocaleString('fr-FR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }) + ' %';
  const toast_ = (m, t) => { try { toast(m, t); } catch (e) { console.log('[Immeuble]', m); } };

  const TYPES = ['Studio / T1', 'T2', 'T3', 'T4', 'T5+', 'Local commercial', 'Parking', 'Cave', 'Autre'];
  const ETAGES = ['Sous-sol', 'RDC', '1er', '2e', '3e', '4e', '5e+', 'Combles'];
  const STATUTS = ['Loué', 'Vacant', 'Préavis en cours', 'Occupé par le vendeur'];
  const DPES = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const BAUX = ['', 'Nu 3 ans', 'Meublé 1 an', 'Étudiant 9 mois', 'Mobilité', 'Commercial 3/6/9', 'Précaire'];

  let S = null;

  /* ── État ───────────────────────────────────────────────────────────────── */
  const blank = () => ({ lots: [], chargesCommunes: 0 });

  function newLot(i) {
    return {
      nom: 'Lot ' + (i + 1), etage: i === 0 ? 'RDC' : '', type: 'T2',
      surf: 0, loyer: 0, cc: 0, statut: 'Loué', dpe: '', bail: '',
      vacance: 5, travaux: 0, note: ''
    };
  }
  function load() {
    try { const r = JSON.parse(localStorage.getItem(LS) || 'null'); if (r && Array.isArray(r.lots)) return r; } catch (e) {}
    return blank();
  }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

  /* ── Totaux ─────────────────────────────────────────────────────────────── */
  function totaux() {
    const t = { n: S.lots.length, surf: 0, loyer: 0, cc: 0, travaux: 0, loues: 0, vacants: 0, loyerNet: 0, habitables: 0 };
    S.lots.forEach(l => {
      t.surf += +l.surf || 0;
      t.loyer += +l.loyer || 0;
      t.cc += +l.cc || 0;
      t.travaux += +l.travaux || 0;
      t.loyerNet += (+l.loyer || 0) * (1 - (+l.vacance || 0) / 100);
      if (l.statut === 'Loué') t.loues++;
      else if (l.statut === 'Vacant') t.vacants++;
      if (!['Parking', 'Cave'].includes(l.type)) t.habitables++;
    });
    t.loyerM2 = t.surf > 0 ? t.loyer / t.surf : 0;
    t.occupation = t.n > 0 ? (t.loues / t.n) * 100 : 0;
    // Rendement brut sur prix d'achat + travaux, conformément à la définition retenue
    const prix = (parseFloat((el('prixAchat') || {}).value) || parseFloat((el('prixAffiche') || {}).value) || 0);
    const trav = (parseFloat((el('travaux') || {}).value) || 0) || t.travaux;
    t.base = prix + trav;
    t.rendement = t.base > 0 ? (t.loyer * 12 / t.base) * 100 : 0;
    return t;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDU
     ══════════════════════════════════════════════════════════════════════════ */
  const SEC_ID = 'immeubleSec';

  const iStyle = 'width:100%;background:var(--bg3);border:1px solid var(--bd);border-radius:5px;'
    + 'padding:5px 7px;font-size:.76rem;color:var(--ink);font-family:inherit';
  const lStyle = 'display:block;font-size:.58rem;text-transform:uppercase;letter-spacing:.06em;'
    + 'color:var(--ink4);margin-bottom:3px';
  const btn = 'background:transparent;border:1px solid var(--bd2);border-radius:5px;color:var(--ink3);'
    + 'font-size:.66rem;padding:4px 9px;cursor:pointer;font-family:inherit;white-space:nowrap';

  function field(lab, html) {
    return '<div><label style="' + lStyle + '">' + lab + '</label>' + html + '</div>';
  }
  function sel(i, key, opts, val) {
    return '<select data-im-i="' + i + '" data-im-k="' + key + '" style="' + iStyle + '">'
      + opts.map(o => '<option' + (String(val) === String(o) ? ' selected' : '') + '>' + esc(o) + '</option>').join('')
      + '</select>';
  }
  function inp(i, key, val, type, ph) {
    return '<input type="' + (type || 'number') + '" data-im-i="' + i + '" data-im-k="' + key + '" '
      + 'value="' + esc(val === 0 && type !== 'text' ? '' : val) + '" placeholder="' + esc(ph || '') + '" '
      + (type === 'number' ? 'min="0" ' : '') + 'style="' + iStyle + '"/>';
  }

  function render() {
    const host = el(SEC_ID);
    if (!host) return;
    const t = totaux();

    let h = '<div class="sh"><span class="sn">🏢</span><span class="st">Composition de l\'immeuble</span></div>';

    // Barre de génération
    h += '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px">'
      + '<div style="max-width:150px">' + field('Nombre de lots',
        '<input type="number" id="imNbLots" min="1" max="40" value="' + (S.lots.length || 4) + '" style="' + iStyle + '"/>')
      + '</div>'
      + '<button class="btn btn-p btn-sm" data-im-gen="1">Générer les lots</button>'
      + '<button class="btn btn-g btn-sm" data-im-add="1">+ Ajouter un lot</button>'
      + (S.lots.length ? '<button class="btn btn-d btn-sm" data-im-clear="1">Tout effacer</button>' : '')
      + '</div>';

    if (!S.lots.length) {
      h += '<p style="font-size:.76rem;color:var(--ink4);padding:14px 0">'
        + 'Indiquez le nombre de lots puis cliquez sur « Générer les lots ». '
        + 'Chaque lot sera détaillé individuellement : surface, loyer, charges, occupation et travaux.</p>';
      host.innerHTML = h;
      bind(host);
      return;
    }

    // Cartes de lots
    S.lots.forEach((l, i) => {
      const vac = l.statut === 'Vacant';
      const bord = vac ? 'var(--am)' : 'var(--bd)';
      h += '<div style="background:var(--bg2);border:1px solid ' + bord + ';border-left:3px solid '
        + (vac ? 'var(--am)' : 'var(--gold)') + ';border-radius:var(--r);padding:12px 14px;margin-bottom:10px">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<input type="text" data-im-i="' + i + '" data-im-k="nom" value="' + esc(l.nom) + '" '
        + 'style="background:transparent;border:none;border-bottom:1px solid var(--bd2);color:var(--gold);'
        + 'font-weight:700;font-size:.86rem;font-family:inherit;padding:2px 0;max-width:190px"/>'
        + '<span style="flex:1;font-size:.7rem;color:var(--ink4)">'
        + (l.surf ? l.surf + ' m² · ' : '') + (l.loyer ? eur(l.loyer) + '/mois' : '')
        + (l.surf && l.loyer ? ' · ' + (l.loyer / l.surf).toFixed(1) + ' €/m²' : '') + '</span>'
        + '<button data-im-dup="' + i + '" style="' + btn + '" title="Dupliquer ce lot">⧉</button>'
        + '<button data-im-del="' + i + '" style="' + btn + ';color:var(--ru);border-color:var(--ru-b)">✕</button>'
        + '</div>'

        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:9px">'
        + field('Étage', sel(i, 'etage', ETAGES, l.etage))
        + field('Type', sel(i, 'type', TYPES, l.type))
        + field('Surface (m²)', inp(i, 'surf', l.surf, 'number', '45'))
        + field('Loyer HC (€/mois)', inp(i, 'loyer', l.loyer, 'number', '450'))
        + field('Charges CC (€/mois)', inp(i, 'cc', l.cc, 'number', '40'))
        + field('Statut', sel(i, 'statut', STATUTS, l.statut))
        + field('Bail en cours', sel(i, 'bail', BAUX, l.bail))
        + field('DPE', sel(i, 'dpe', DPES, l.dpe))
        + field('Vacance (%)', inp(i, 'vacance', l.vacance, 'number', '5'))
        + field('Travaux (€)', inp(i, 'travaux', l.travaux, 'number', '0'))
        + '</div>'
        + '<div style="margin-top:9px">' + field('Observation',
          inp(i, 'note', l.note, 'text', 'Loyer sous le marché, locataire en place depuis 2015…')) + '</div>'
        + '</div>';
    });

    // Synthèse
    const kpi = (lab, val, col) =>
      '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:9px 11px">'
      + '<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink4)">' + lab + '</div>'
      + '<div style="font-size:1rem;font-weight:700;color:' + (col || 'var(--ink)') + ';margin-top:3px">' + val + '</div></div>';

    h += '<div class="rg" style="margin-top:16px"><div class="rg-label">Synthèse de l\'immeuble</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:9px;margin-bottom:11px">'
      + kpi('Lots', String(t.n))
      + kpi('Surface totale', t.surf ? t.surf + ' m²' : '—')
      + kpi('Loyer HC', eur(t.loyer) + '/mois', 'var(--em)')
      + kpi('Charges CC', eur(t.cc) + '/mois')
      + kpi('Loyer au m²', t.loyerM2 ? t.loyerM2.toFixed(2) + ' €' : '—', 'var(--gold)')
      + kpi('Occupation', pct(t.occupation, 0), t.occupation >= 90 ? 'var(--em)' : t.occupation >= 70 ? 'var(--am)' : 'var(--ru)')
      + kpi('Travaux lots', eur(t.travaux), t.travaux ? 'var(--am)' : 'var(--ink)')
      + kpi('Rendement brut', t.base ? pct(t.rendement) : '—', 'var(--gold)')
      + '</div>'
      + '<div class="rc"><span class="rl">Loyer annuel hors charges</span><span class="rv">' + eur(t.loyer * 12) + '</span></div>'
      + '<div class="rc"><span class="rl">Loyer annuel après vacance provisionnée</span><span class="rv">' + eur(t.loyerNet * 12) + '</span></div>'
      + (t.vacants ? '<div class="rc neg"><span class="rl">Lots vacants</span><span class="rv">' + t.vacants + ' sur ' + t.n + '</span></div>' : '')
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:11px">'
      + '<button class="btn btn-p btn-sm" data-im-apply="1">↓ Reporter dans le simulateur</button>'
      + '<button class="btn btn-g btn-sm" data-im-copy="1">⧉ Copier le tableau</button>'
      + '</div>'
      + '<p style="font-size:.63rem;color:var(--ink4);margin-top:9px;line-height:1.45">'
      + 'Le report renseigne la surface totale, bascule le simulateur en mode multi-lots et transmet les loyers. '
      + 'Les charges CC sont des provisions récupérables sur les locataires : elles ne sont pas comptées comme revenu.</p>'
      + '</div>';

    host.innerHTML = h;
    bind(host);
  }

  /* ── Interactions ───────────────────────────────────────────────────────── */
  function bind(host) {
    if (host.__imBound) return;
    host.__imBound = true;

    // Saisie : mise à jour silencieuse, pas de re-rendu (le focus serait perdu)
    host.addEventListener('input', (ev) => {
      const t = ev.target;
      const i = t.getAttribute && t.getAttribute('data-im-i');
      if (i === null || i === undefined) return;
      const k = t.getAttribute('data-im-k');
      const lot = S.lots[+i];
      if (!lot) return;
      lot[k] = (t.type === 'number') ? (parseFloat(t.value) || 0) : t.value;
      save();
      majSynthese();
    });
    host.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.getAttribute && t.getAttribute('data-im-i') !== null && t.tagName === 'SELECT') {
        const lot = S.lots[+t.getAttribute('data-im-i')];
        if (lot) { lot[t.getAttribute('data-im-k')] = t.value; save(); render(); }
      }
    });

    host.addEventListener('click', (ev) => {
      const g = (a) => ev.target.closest('[' + a + ']');
      if (g('data-im-gen')) {
        const n = Math.max(1, Math.min(40, parseInt((el('imNbLots') || {}).value, 10) || 1));
        const anciens = S.lots.slice();
        S.lots = [];
        for (let i = 0; i < n; i++) S.lots.push(anciens[i] || newLot(i));
        save(); render();
        toast_(n + ' lot' + (n > 1 ? 's' : '') + ' à renseigner', 'ok');
      } else if (g('data-im-add')) {
        S.lots.push(newLot(S.lots.length)); save(); render();
      } else if (g('data-im-del')) {
        S.lots.splice(+g('data-im-del').getAttribute('data-im-del'), 1); save(); render();
      } else if (g('data-im-dup')) {
        const i = +g('data-im-dup').getAttribute('data-im-dup');
        const c = Object.assign({}, S.lots[i]);
        c.nom = 'Lot ' + (S.lots.length + 1);
        S.lots.splice(i + 1, 0, c); save(); render();
      } else if (g('data-im-clear')) {
        if (!window.confirm('Effacer tous les lots saisis ?')) return;
        S = blank(); save(); render();
      } else if (g('data-im-apply')) {
        appliquer();
      } else if (g('data-im-copy')) {
        copier();
      }
    });
  }

  /* Recalcul de la seule synthèse pendant la frappe */
  function majSynthese() {
    clearTimeout(majSynthese._t);
    majSynthese._t = setTimeout(() => {
      const host = el(SEC_ID);
      if (!host) return;
      const focus = document.activeElement;
      const id = focus && focus.getAttribute ? [focus.getAttribute('data-im-i'), focus.getAttribute('data-im-k')] : null;
      render();
      if (id && id[0] !== null) {
        const back = host.querySelector('[data-im-i="' + id[0] + '"][data-im-k="' + id[1] + '"]');
        if (back) { back.focus(); try { back.setSelectionRange(back.value.length, back.value.length); } catch (e) {} }
      }
    }, 700);
  }

  /* ── Report vers le simulateur ──────────────────────────────────────────── */
  function appliquer() {
    if (!S.lots.length) { toast_('Aucun lot à reporter.', 'err'); return; }
    const t = totaux();

    // 1. Alimente le tableau `lots` de app.js (format existant + champs enrichis)
    try {
      if (typeof lots !== 'undefined' && Array.isArray(lots)) {
        lots.length = 0;
        S.lots.forEach(l => lots.push({
          nom: l.nom, type: l.type, surf: +l.surf || 0, loyer: +l.loyer || 0,
          vacance: +l.vacance || 0, charges: 0,
          // champs supplémentaires, repris par le dossier PDF
          etage: l.etage, cc: +l.cc || 0, statut: l.statut, dpe: l.dpe,
          bail: l.bail, travaux: +l.travaux || 0, note: l.note
        }));
        if (typeof renderLots === 'function') renderLots();
      }
    } catch (err) { console.warn('[Immeuble]', err); }

    // 2. Surface totale
    if (el('surface') && t.surf > 0) el('surface').value = Math.round(t.surf);

    // 3. Bascule en mode multi-lots : calc() somme alors les loyers des lots
    try { if (typeof switchFin === 'function') switchFin('multilot'); } catch (err) {}

    // 4. Loyer mensuel, utile si le mode multi-lots n'est pas actif
    if (el('loyerMensuel') && t.loyer > 0) el('loyerMensuel').value = Math.round(t.loyer);

    // 5. Travaux : proposés sans écraser une saisie existante
    const trv = el('travaux');
    if (trv && t.travaux > 0 && !(parseFloat(trv.value) > 0)) trv.value = Math.round(t.travaux);

    try { if (typeof calc === 'function') calc(); } catch (err) {}
    toast_(t.n + ' lots reportés · ' + eur(t.loyer) + '/mois', 'ok');
  }

  function copier() {
    const t = totaux();
    const L = ['COMPOSITION DE L\'IMMEUBLE', ''];
    L.push(['Lot', 'Étage', 'Type', 'Surface', 'Loyer HC', 'Charges CC', 'Statut', 'DPE', 'Travaux'].join('\t'));
    S.lots.forEach(l => L.push([l.nom, l.etage, l.type, (l.surf || 0) + ' m²',
      eur(l.loyer), eur(l.cc), l.statut, l.dpe || '—', eur(l.travaux)].join('\t')));
    L.push('', 'TOTAL\t' + t.n + ' lots\t' + t.surf + ' m²\t' + eur(t.loyer) + '/mois\t' + eur(t.cc) + '/mois');
    L.push('Loyer annuel HC : ' + eur(t.loyer * 12) + ' · Occupation : ' + pct(t.occupation, 0)
      + ' · Rendement brut : ' + (t.base ? pct(t.rendement) : 'n/c'));
    const txt = L.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => toast_('Tableau copié ✓', 'ok'), () => toast_('Copie impossible', 'err'));
    } else { toast_('Copie non supportée', 'err'); }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INSERTION DANS LA PAGE
     ══════════════════════════════════════════════════════════════════════════ */
  function ensureSection() {
    if (el(SEC_ID)) return el(SEC_ID);
    const tb = el('typeBien');
    if (!tb) return null;
    const sec = tb.closest('.sec');
    if (!sec || !sec.parentNode) return null;
    const d = document.createElement('div');
    d.className = 'sec';
    d.id = SEC_ID;
    d.style.display = 'none';
    sec.parentNode.insertBefore(d, sec.nextSibling);
    return d;
  }

  function majVisibilite() {
    const host = ensureSection();
    if (!host) return;
    const tb = el('typeBien');
    const estImmeuble = tb && /immeuble/i.test(tb.value || '');
    if (estImmeuble) {
      if (host.style.display === 'none') { host.style.display = ''; render(); }
    } else {
      host.style.display = 'none';
    }
  }

  window.ImmoSimImmeuble = {
    state: () => S,
    totaux,
    render,
    appliquer,
    open: () => { const tb = el('typeBien'); if (tb) { tb.value = 'Immeuble'; } majVisibilite(); }
  };

  const boot = () => {
    S = load();
    const tb = el('typeBien');
    if (tb) tb.addEventListener('change', majVisibilite);
    majVisibilite();
    // La page peut se construire après nous : on vérifie quelques secondes.
    let n = 0;
    const retry = setInterval(() => {
      const t2 = el('typeBien');
      if (t2 && !t2.__imHooked) { t2.__imHooked = 1; t2.addEventListener('change', majVisibilite); }
      majVisibilite();
      if (++n > 20) clearInterval(retry);
    }, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.info('[ImmoSim] Module « immeuble de rapport » actif — saisie lot par lot.');
})();
