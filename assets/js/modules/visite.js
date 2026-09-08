/* ════════════════════════════════════════════════════════════════════════════
   ImmoSim — ONGLET VISITE
   ────────────────────────────────────────────────────────────────────────────
   Fichier ADDITIF. Ne modifie ni app.js ni styles.css.
   À charger APRÈS app.js :
       <script src="assets/js/modules/visite.js"></script>

   Ajoute une vue « Visite » : grille de contrôle complète pour la visite d'un
   bien locatif, avec un bloc détaillé PAR LOGEMENT en cas d'immeuble de
   rapport (les lots saisis dans le simulateur sont repris automatiquement).

   Chaque point se note en trois états : conforme / à surveiller / problème,
   avec une note libre et, pour les points techniques, un chiffrage de travaux.
   L'ensemble est enregistré localement et exportable en fiche PDF imprimable.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LS = 'immoV10_visite';
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const eur = (n) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ') + ' \u20AC';
  const toast_ = (m, t) => { try { toast(m, t); } catch (e) { console.log('[Visite]', m); } };

  /* ══════════════════════════════════════════════════════════════════════════
     RÉFÉRENTIEL DES POINTS DE CONTRÔLE
     `c` = chiffrable (fait apparaître un champ de coût de travaux)
     ══════════════════════════════════════════════════════════════════════════ */

  // Points portant sur l'immeuble / le bien dans son ensemble
  const COMMUN = [
    {
      cat: 'Environnement et abords', items: [
        { t: 'Quartier et voisinage', h: 'Ambiance générale, propreté, présence de commerces, écoles, emploi.' },
        { t: 'Nuisances', h: 'Bruit routier ou ferroviaire, bar de nuit, chantier, odeurs, passage.' },
        { t: 'Transports et accessibilité', h: 'Distance réelle à pied jusqu\'à l\'arrêt, fréquence de passage.' },
        { t: 'Stationnement', h: 'Facilité de se garer en journée et le soir, zone payante, place privative.' },
        { t: 'Exposition et vis-à-vis', h: 'Orientation, luminosité réelle à l\'heure de la visite, vis-à-vis direct.' },
        { t: 'Risques du secteur', h: 'Inondation, retrait-gonflement des argiles, sites industriels — vérifier Géorisques.' }
      ]
    },
    {
      cat: 'Extérieur du bâtiment', items: [
        { t: 'Façade', h: 'Fissures, enduit cloqué, salissures, dernier ravalement.', c: 1 },
        { t: 'Toiture et couverture', h: 'Tuiles déplacées, mousse, faîtage, date de la dernière réfection.', c: 1 },
        { t: 'Gouttières et descentes', h: 'Fixation, corrosion, traces de ruissellement sur la façade.', c: 1 },
        { t: 'Menuiseries extérieures', h: 'Type de vitrage, étanchéité, volets, état des dormants.', c: 1 },
        { t: 'Fissures structurelles', h: 'Fissures traversantes, en escalier, évolutives — photographier avec une règle.', c: 1 },
        { t: 'Terrain, cour, dépendances', h: 'Clôtures, murs de soutènement, végétation proche des fondations.', c: 1 }
      ]
    },
    {
      cat: 'Parties communes', items: [
        { t: 'Hall et cage d\'escalier', h: 'Propreté, éclairage, revêtements, garde-corps, main courante.', c: 1 },
        { t: 'Sécurité d\'accès', h: 'Interphone, digicode, serrure, boîtes aux lettres normalisées.', c: 1 },
        { t: 'Local poubelles et vélos', h: 'Présence, dimensionnement, odeurs, accès.', c: 1 },
        { t: 'Ascenseur', h: 'Présence, année, contrat d\'entretien, dernier rapport de contrôle.' },
        { t: 'Caves, combles, greniers', h: 'Humidité, ventilation, affectation des lots, encombrement.' },
        { t: 'Traces d\'humidité en communs', h: 'Salpêtre en pied de mur, auréoles au plafond du dernier étage.', c: 1 },
        { t: 'Affichage et entretien', h: 'Contrats affichés, présence d\'un syndic, régularité de l\'entretien.' }
      ]
    },
    {
      cat: 'Technique — immeuble', items: [
        { t: 'Charpente', h: 'Bois sain, absence de vrillettes ou capricornes, déformation des pannes.', c: 1 },
        { t: 'Colonnes montantes', h: 'Électricité et eau, âge apparent, plomb sur canalisations anciennes.', c: 1 },
        { t: 'Tableau électrique général', h: 'Disjoncteur différentiel, mise à la terre, état des protections.', c: 1 },
        { t: 'Évacuations et assainissement', h: 'Tout-à-l\'égout ou fosse, état des chutes en fonte, odeurs.', c: 1 },
        { t: 'Chauffage collectif', h: 'Type, âge de la chaudière, contrat, mode de répartition des charges.', c: 1 },
        { t: 'Isolation et performance', h: 'Combles isolés, murs, ponts thermiques, cohérence avec le DPE annoncé.', c: 1 },
        { t: 'Amiante et plomb', h: 'Diagnostics fournis, repérage avant travaux si construction avant 1997.', c: 1 },
        { t: 'Termites et mérule', h: 'Selon zone réglementée — demander l\'état parasitaire.', c: 1 }
      ]
    },
    {
      cat: 'Juridique et administratif', items: [
        { t: 'Statut du bien', h: 'Monopropriété ou copropriété, nombre de lots, tantièmes.' },
        { t: 'Procès-verbaux d\'assemblée générale', h: 'Trois derniers PV, travaux votés, travaux à voter, litiges en cours.' },
        { t: 'Appels de charges', h: 'Montant réel, régularisations, part récupérable et non récupérable.' },
        { t: 'Impayés de copropriété', h: 'Solde du fonds de travaux, copropriétaires débiteurs, procédures.' },
        { t: 'Conformité de la division', h: 'Autorisations, décence de chaque logement, surface Carrez et Boutin.' },
        { t: 'Urbanisme et servitudes', h: 'PLU, alignement, droit de préemption, servitudes de passage ou de vue.' },
        { t: 'Taxe foncière', h: 'Avis d\'imposition de l\'année en cours, exonérations en cours.' },
        { t: 'Sinistres et assurance', h: 'Historique des sinistres, déclarations en cours, garantie décennale active.' }
      ]
    }
  ];

  // Points portant sur chaque logement (dupliqués par lot)
  const LOGEMENT = [
    {
      cat: 'Occupation et bail', items: [
        { t: 'Statut d\'occupation', h: 'Occupé, vacant, préavis en cours, congé délivré.' },
        { t: 'Bail en cours', h: 'Type, date d\'effet, durée restante, clauses particulières.' },
        { t: 'Loyer réel encaissé', h: 'Comparer au loyer annoncé et aux quittances des douze derniers mois.' },
        { t: 'Dépôt de garantie', h: 'Montant, séquestre, transfert à l\'acquéreur.' },
        { t: 'Historique d\'impayés', h: 'Retards, procédures, garantie loyers impayés en place.' },
        { t: 'Potentiel de revalorisation', h: 'Écart au loyer de marché, encadrement applicable, IRL à jour.' }
      ]
    },
    {
      cat: 'État général', items: [
        { t: 'Sols', h: 'Parquet, carrelage, souplesse du plancher, points durs, plinthes.', c: 1 },
        { t: 'Murs et plafonds', h: 'Fissures, cloques, traces d\'infiltration, papier peint décollé.', c: 1 },
        { t: 'Peintures et finitions', h: 'Fraîcheur, ampleur du rafraîchissement à prévoir avant relocation.', c: 1 },
        { t: 'Humidité et moisissures', h: 'Angles de murs, derrière les meubles, odeur de renfermé.', c: 1 },
        { t: 'Isolation phonique', h: 'Bruits du voisinage, de la cage d\'escalier, de la rue.', c: 1 },
        { t: 'Luminosité et vis-à-vis', h: 'Orientation, taille des ouvertures, obstruction.' }
      ]
    },
    {
      cat: 'Équipements techniques', items: [
        { t: 'Tableau électrique du lot', h: 'Différentiel 30 mA, nombre de circuits, terre, conformité NF C 15-100.', c: 1 },
        { t: 'Prises et éclairages', h: 'Nombre suffisant par pièce, prises vétustes, fils apparents.', c: 1 },
        { t: 'Plomberie et pression', h: 'Ouvrir tous les robinets, vérifier débit, fuites sous évier, siphons.', c: 1 },
        { t: 'Production d\'eau chaude', h: 'Ballon ou chaudière, âge, capacité, entretien, emplacement.', c: 1 },
        { t: 'Chauffage', h: 'Type, nombre de radiateurs, régulation, cohérence avec la surface.', c: 1 },
        { t: 'Ventilation', h: 'VMC en fonctionnement, grilles non obturées, aération des pièces humides.', c: 1 },
        { t: 'Menuiseries et volets', h: 'Ouverture et fermeture réelles, joints, condensation entre vitrages.', c: 1 }
      ]
    },
    {
      cat: 'Pièces d\'eau', items: [
        { t: 'Cuisine', h: 'Équipement, plan de travail, évacuation, arrivée d\'eau, hotte.', c: 1 },
        { t: 'Salle d\'eau', h: 'Douche ou baignoire, joints, faïence décollée, étanchéité du receveur.', c: 1 },
        { t: 'WC', h: 'Séparé ou non, évacuation, chasse, ventilation.', c: 1 },
        { t: 'Compteurs individuels', h: 'Eau, électricité, gaz — relevés et individualisation effective.' }
      ]
    },
    {
      cat: 'Diagnostics et conclusion du lot', items: [
        { t: 'DPE du logement', h: 'Classe, date, cohérence avec l\'état constaté, échéance réglementaire.' },
        { t: 'Décence du logement', h: 'Surface minimale, hauteur sous plafond, ouvrant, sanitaires.' },
        { t: 'Travaux à prévoir', h: 'Lister poste par poste et chiffrer avant de faire une offre.', c: 1 },
        { t: 'Ressenti de relocation', h: 'Facilité à relouer, profil de locataire visé, délai estimé.' }
      ]
    }
  ];

  /* ══════════════════════════════════════════════════════════════════════════
     ÉTAT
     ══════════════════════════════════════════════════════════════════════════ */
  const STATES = [
    { k: 0, lbl: '—', title: 'Non vérifié', color: 'var(--ink4)', bg: 'var(--bg2)', bd: 'var(--bd)' },
    { k: 1, lbl: '✓', title: 'Conforme', color: 'var(--em)', bg: 'var(--em-a)', bd: 'var(--em-b)' },
    { k: 2, lbl: '!', title: 'À surveiller', color: 'var(--am)', bg: 'var(--am-a)', bd: 'rgba(245,165,32,.25)' },
    { k: 3, lbl: '✕', title: 'Problème', color: 'var(--ru)', bg: 'var(--ru-a)', bd: 'var(--ru-b)' }
  ];

  let S = null;

  function blankState() {
    return { meta: { adresse: '', date: new Date().toISOString().slice(0, 10), presents: '', synthese: '' }, items: {}, units: [] };
  }
  function load() {
    try { const raw = JSON.parse(localStorage.getItem(LS) || 'null'); if (raw && raw.items) return raw; } catch (err) {}
    return blankState();
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (err) {} }

  /* Les lots du simulateur alimentent la liste des logements à visiter.
     La reprise n'est automatique qu'au premier affichage : ensuite elle est
     explicite, sinon un logement retiré volontairement réapparaîtrait. */
  function syncUnits(force) {
    let src = [];
    try { if (typeof lots !== 'undefined' && Array.isArray(lots)) src = lots; } catch (err) {}
    if (src.length && (force || !S.units.length)) {
      src.forEach((l, i) => {
        const name = l.nom || ('Lot ' + (i + 1));
        if (!S.units.some(u => u.name === name)) {
          S.units.push({ name, info: [l.type, l.surf ? l.surf + ' m²' : '', l.loyer ? eur(l.loyer) + '/mois' : ''].filter(Boolean).join(' · '), items: {} });
        }
      });
    }
    if (!S.units.length) S.units.push({ name: 'Logement', info: '', items: {} });
    S.units.forEach(u => { if (!u.items) u.items = {}; });
  }

  const key = (cat, t) => cat + '|' + t;
  function cell(store, k) { if (!store[k]) store[k] = { s: 0, n: '', c: 0 }; return store[k]; }

  /* ══════════════════════════════════════════════════════════════════════════
     STATISTIQUES
     ══════════════════════════════════════════════════════════════════════════ */
  function stats() {
    let total = 0, ok = 0, warn = 0, ko = 0, cost = 0;
    const scan = (defs, store) => defs.forEach(g => g.items.forEach(it => {
      total++;
      const c = store[key(g.cat, it.t)];
      if (!c) return;
      if (c.s === 1) ok++; else if (c.s === 2) warn++; else if (c.s === 3) ko++;
      cost += (+c.c || 0);
    }));
    scan(COMMUN, S.items);
    S.units.forEach(u => scan(LOGEMENT, u.items));
    return { total, ok, warn, ko, done: ok + warn + ko, cost };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDU
     ══════════════════════════════════════════════════════════════════════════ */
  function rowHTML(scope, g, it, c) {
    const st = STATES[c.s] || STATES[0];
    const btns = STATES.slice(1).map(s =>
      '<button data-v-set="' + scope + '" data-k="' + esc(key(g.cat, it.t)) + '" data-s="' + s.k + '" title="' + s.title + '" '
      + 'style="width:26px;height:24px;border-radius:5px;cursor:pointer;font-size:.72rem;font-weight:700;font-family:inherit;'
      + 'border:1px solid ' + (c.s === s.k ? s.bd : 'var(--bd2)') + ';background:' + (c.s === s.k ? s.bg : 'transparent') + ';'
      + 'color:' + (c.s === s.k ? s.color : 'var(--ink4)') + '">' + s.lbl + '</button>').join('');

    return '<div style="padding:8px 10px;border-radius:var(--r);border:1px solid ' + st.bd + ';background:' + st.bg + ';margin-bottom:5px">'
      + '<div style="display:flex;gap:10px;align-items:flex-start">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:.76rem;font-weight:600;color:var(--ink);line-height:1.3">' + esc(it.t) + '</div>'
      + '<div style="font-size:.64rem;color:var(--ink4);line-height:1.4;margin-top:2px">' + esc(it.h) + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:3px;flex-shrink:0">' + btns + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:6px">'
      + '<input type="text" data-v-note="' + scope + '" data-k="' + esc(key(g.cat, it.t)) + '" value="' + esc(c.n) + '" placeholder="Observation…" '
      + 'style="flex:1;min-width:0;background:var(--bg3);border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:.7rem;color:var(--ink2);font-family:inherit"/>'
      + (it.c ? '<input type="number" min="0" step="100" data-v-cost="' + scope + '" data-k="' + esc(key(g.cat, it.t)) + '" value="' + (c.c || '') + '" placeholder="Travaux €" '
        + 'style="width:92px;background:var(--bg3);border:1px solid var(--bd);border-radius:5px;padding:4px 7px;font-size:.7rem;color:var(--am);font-family:inherit;text-align:right"/>' : '')
      + '</div></div>';
  }

  function groupHTML(scope, store, defs) {
    return defs.map(g =>
      '<div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--ink4);margin:14px 0 6px">' + esc(g.cat) + '</div>'
      + g.items.map(it => rowHTML(scope, g, it, cell(store, key(g.cat, it.t)))).join('')
    ).join('');
  }

  function render() {
    const view = el('view-visite');
    if (!view) return;
    syncUnits(false);
    const st = stats();
    const pctDone = st.total ? Math.round(st.done / st.total * 100) : 0;
    const inp = 'background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:6px 9px;font-size:.75rem;color:var(--ink);font-family:inherit;width:100%';

    let bien = '';
    try {
      const t = (document.getElementById('typeBien') || {}).value || '';
      const v = (document.getElementById('ville') || {}).value || '';
      bien = [t, v].filter(Boolean).join(' — ');
    } catch (err) {}

    view.innerHTML =
      '<div class="page">'
      + '<div class="ph ph-row"><div>'
      + '<h2>🔎 Fiche de visite</h2>'
      + '<p>Grille de contrôle complète, avec un bloc détaillé par logement en cas d\'immeuble de rapport.'
      + (bien ? ' Bien en cours : <strong>' + esc(bien) + '</strong>.' : '') + '</p></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn btn-p btn-sm" data-v-pdf="1">↓ Fiche PDF</button>'
      + '<button class="btn btn-g btn-sm" data-v-copy="1">⧉ Copier</button>'
      + '<button class="btn btn-d btn-sm" data-v-reset="1">↺ Nouvelle visite</button>'
      + '</div></div>'

      // Synthèse
      + '<div class="card"><h3>Synthèse</h3>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px">'
      + [['Points vérifiés', st.done + ' / ' + st.total, 'var(--ink)'],
      ['Conformes', String(st.ok), 'var(--em)'],
      ['À surveiller', String(st.warn), 'var(--am)'],
      ['Problèmes', String(st.ko), 'var(--ru)'],
      ['Travaux chiffrés', eur(st.cost), 'var(--gold)']]
        .map(k => '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:9px 11px">'
          + '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink4)">' + k[0] + '</div>'
          + '<div style="font-size:1.05rem;font-weight:700;color:' + k[2] + ';margin-top:3px">' + k[1] + '</div></div>').join('')
      + '</div>'
      + '<div style="height:5px;border-radius:3px;background:var(--bg3);overflow:hidden;margin-bottom:12px">'
      + '<div style="height:100%;width:' + pctDone + '%;background:var(--gold)"></div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px">'
      + '<label style="font-size:.66rem;color:var(--ink3)">Adresse visitée<input type="text" data-v-meta="adresse" value="' + esc(S.meta.adresse) + '" style="' + inp + ';margin-top:3px"/></label>'
      + '<label style="font-size:.66rem;color:var(--ink3)">Date de visite<input type="date" data-v-meta="date" value="' + esc(S.meta.date) + '" style="' + inp + ';margin-top:3px"/></label>'
      + '<label style="font-size:.66rem;color:var(--ink3)">Personnes présentes<input type="text" data-v-meta="presents" value="' + esc(S.meta.presents) + '" placeholder="Agent, vendeur, artisan…" style="' + inp + ';margin-top:3px"/></label>'
      + '</div>'
      + '<label style="font-size:.66rem;color:var(--ink3);display:block;margin-top:9px">Impression générale et points bloquants'
      + '<textarea data-v-meta="synthese" rows="3" placeholder="Ce qui vous a marqué, ce qui reste à trancher…" style="' + inp + ';margin-top:3px;resize:vertical">' + esc(S.meta.synthese) + '</textarea></label>'
      + '</div>'

      // Immeuble
      + '<div class="card"><h3>Immeuble et parties communes</h3>'
      + groupHTML('common', S.items, COMMUN)
      + '</div>'

      // Logements
      + S.units.map((u, i) =>
        '<div class="card"><h3 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        + '<span>Logement — ' + esc(u.name) + '</span>'
        + (u.info ? '<span style="font-size:.68rem;font-weight:400;color:var(--ink4)">' + esc(u.info) + '</span>' : '')
        + '<span style="flex:1"></span>'
        + (S.units.length > 1 ? '<button class="btn btn-d btn-sm" data-v-delunit="' + i + '">✕ Retirer</button>' : '')
        + '</h3>'
        + groupHTML('u' + i, u.items, LOGEMENT)
        + '</div>').join('')

      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:26px">'
      + '<button class="btn btn-g btn-sm" data-v-addunit="1">+ Ajouter un logement</button>'
      + '<button class="btn btn-g btn-sm" data-v-sync="1">⟳ Reprendre les lots du simulateur</button>'
      + '</div>'
      + '<p style="font-size:.66rem;color:var(--ink4);margin-bottom:30px">La fiche est enregistrée automatiquement sur cet appareil. '
      + 'Elle ne remplace pas les diagnostics obligatoires ni l\'avis d\'un professionnel du bâtiment.</p>'
      + '</div>';

    bindEvents(view);
  }

  /* Un seul jeu d'écouteurs, posé après chaque rendu */
  function bindEvents(view) {
    if (view.__vBound) return;
    view.__vBound = true;

    const storeFor = (scope) => scope === 'common' ? S.items : (S.units[+scope.slice(1)] || {}).items || {};

    view.addEventListener('click', (ev) => {
      const set = ev.target.closest('[data-v-set]');
      if (set) {
        const store = storeFor(set.getAttribute('data-v-set'));
        const c = cell(store, set.getAttribute('data-k'));
        const s = +set.getAttribute('data-s');
        c.s = (c.s === s ? 0 : s);
        save(); render();
        return;
      }
      if (ev.target.closest('[data-v-addunit]')) {
        S.units.push({ name: 'Logement ' + (S.units.length + 1), info: '', items: {} });
        save(); render(); return;
      }
      const del = ev.target.closest('[data-v-delunit]');
      if (del) {
        if (S.units.length <= 1) return;
        S.units.splice(+del.getAttribute('data-v-delunit'), 1);
        save(); render(); return;
      }
      if (ev.target.closest('[data-v-sync]')) {
        const before = S.units.length;
        syncUnits(true); save(); render();
        toast_(S.units.length > before ? (S.units.length - before) + ' logement(s) ajouté(s)' : 'Aucun nouveau lot à reprendre', 'ok');
        return;
      }
      if (ev.target.closest('[data-v-reset]')) {
        if (!window.confirm('Effacer la fiche de visite en cours ? Cette action est définitive.')) return;
        S = blankState(); save(); render(); toast_('Nouvelle fiche de visite', 'ok'); return;
      }
      if (ev.target.closest('[data-v-copy]')) { copyText(); return; }
      if (ev.target.closest('[data-v-pdf]')) { exportFichePDF(); return; }
    });

    // Saisies : pas de re-rendu, pour ne pas perdre le focus pendant la frappe
    view.addEventListener('input', (ev) => {
      const t = ev.target;
      const meta = t.getAttribute && t.getAttribute('data-v-meta');
      if (meta) { S.meta[meta] = t.value; save(); return; }
      const note = t.getAttribute && t.getAttribute('data-v-note');
      if (note) { cell(storeFor(note), t.getAttribute('data-k')).n = t.value; save(); return; }
      const cost = t.getAttribute && t.getAttribute('data-v-cost');
      if (cost) { cell(storeFor(cost), t.getAttribute('data-k')).c = parseFloat(t.value) || 0; save(); return; }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     EXPORTS
     ══════════════════════════════════════════════════════════════════════════ */
  function asText() {
    const L = [];
    L.push('FICHE DE VISITE — ' + (S.meta.adresse || 'Bien non renseigné'));
    L.push('Date : ' + (S.meta.date || '—') + (S.meta.presents ? '  ·  Présents : ' + S.meta.presents : ''));
    const st = stats();
    L.push('Points vérifiés : ' + st.done + '/' + st.total + '  ·  Conformes ' + st.ok + '  ·  À surveiller ' + st.warn + '  ·  Problèmes ' + st.ko);
    L.push('Travaux chiffrés : ' + eur(st.cost));
    const dump = (title, defs, store) => {
      L.push('', '── ' + title.toUpperCase() + ' ──');
      defs.forEach(g => {
        const lines = g.items.map(it => {
          const c = store[key(g.cat, it.t)];
          if (!c || (!c.s && !c.n && !c.c)) return null;
          return '  [' + (STATES[c.s] || STATES[0]).lbl + '] ' + it.t
            + (c.n ? ' — ' + c.n : '') + (c.c ? ' (' + eur(c.c) + ')' : '');
        }).filter(Boolean);
        if (lines.length) { L.push('', g.cat); L.push.apply(L, lines); }
      });
    };
    dump('Immeuble et parties communes', COMMUN, S.items);
    S.units.forEach(u => dump('Logement — ' + u.name, LOGEMENT, u.items));
    if (S.meta.synthese) L.push('', '── IMPRESSION GÉNÉRALE ──', S.meta.synthese);
    return L.join('\n');
  }

  function copyText() {
    const txt = asText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => toast_('Fiche copiée ✓', 'ok'), () => toast_('Copie impossible', 'err'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast_('Fiche copiée ✓', 'ok'); } catch (e) { toast_('Copie impossible', 'err'); }
      ta.remove();
    }
  }

  /* Fiche PDF imprimable — cases à cocher si la visite n'est pas encore faite */
  function exportFichePDF() {
    if (typeof window.jspdf === 'undefined') { toast_('jsPDF non disponible.', 'err'); return; }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const M = 16, RR = 194, PW = 210;
      /* ── Palette ──────────────────────────────────────────────────────
         Reprise du thème du dossier (onglet « Couleurs PDF »), de sorte
         qu'un seul réglage habille les deux documents. Un durcissement est
         appliqué par-dessus : les gris qui passent à l'écran disparaissent
         à l'impression, surtout en noir et blanc. */
      const DEF = {
        ink: [18, 33, 28], ink2: [58, 74, 68], ink3: [124, 138, 132], ink4: [162, 173, 168],
        gold2: [143, 104, 52], green: [15, 61, 51], rule: [214, 207, 194], rule2: [235, 230, 220],
        pos: [31, 111, 74], warn: [154, 107, 21], neg: [163, 47, 47]
      };
      let TH = DEF;
      try {
        if (window.ImmoSimPDFTheme && typeof window.ImmoSimPDFTheme.current === 'function') {
          const t = window.ImmoSimPDFTheme.current();
          if (t && Array.isArray(t.ink)) TH = t;
        }
      } catch (err) {}
      const rgb = (k) => (Array.isArray(TH[k]) ? TH[k] : DEF[k]).slice();
      const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
      // Assombrit tant que la couleur reste trop claire pour du papier
      const print = (c, maxL) => { let g = c, n = 0; while (lum(g) > maxL && n++ < 14) g = g.map(v => Math.round(v * 0.88)); return g; };

      const INK = print(rgb('ink'), 0.34);
      const INK2 = print(rgb('ink2'), 0.42);
      const INK3 = print(rgb('ink3'), 0.48);
      const INK4 = print(rgb('ink4'), 0.55);
      const HINT = print(rgb('ink3'), 0.45);        // sous-commentaires
      const GOLD = print(rgb('gold2'), 0.50);
      const GREEN = print(rgb('green'), 0.46);
      const RULE = print(rgb('rule'), 0.62);
      const RULE2 = print(rgb('rule2'), 0.80);
      const POS = print(rgb('pos'), 0.55), WARN = print(rgb('warn'), 0.58), NEG = print(rgb('neg'), 0.55);
      const SC = [INK4, POS, WARN, NEG];
      let y = 28, page = 1;

      const txt = (t, x, yy, o) => doc.text(String(t == null ? '' : t), x, yy, o);
      const line = (yy, c, w) => { doc.setDrawColor.apply(doc, c || RULE2); doc.setLineWidth(w || 0.15); doc.line(M, yy, RR, yy); };
      const caps = (t, x, yy, sz, c, sp, al) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.setTextColor.apply(doc, c);
        const u = String(t).toUpperCase();
        try { doc.setCharSpace(sp); } catch (e) {}
        txt(u, al === 'right' ? x - sp * Math.max(0, u.length - 1) : x, yy, al ? { align: al } : undefined);
        try { doc.setCharSpace(0); } catch (e) {}
      };
      const header = () => {
        doc.setFillColor.apply(doc, GOLD); doc.rect(M, 14, 14, 0.9, 'F');
        caps('ImmoSim', M + 17, 15.6, 6, GREEN, 1.3);
        caps('Fiche de visite', RR, 15.6, 5.6, INK4, 0.7, 'right');
        line(19, RULE, 0.2);
      };
      const footer = () => {
        line(280, RULE2, 0.15);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor.apply(doc, INK3);
        txt('Document d\'aide à la visite — ne remplace pas les diagnostics réglementaires', M, 284);
        doc.setFont('times', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, GOLD);
        txt(String(page), RR, 284.2, { align: 'right' });
      };
      const newPage = () => { footer(); doc.addPage(); page++; header(); y = 28; };
      const need = (h) => { if (y + h > 274) newPage(); };

      header();

      // Titre
      doc.setFont('times', 'bold'); doc.setFontSize(20); doc.setTextColor.apply(doc, INK);
      txt('Fiche de visite', M, y + 4);
      y += 10;
      doc.setFont('times', 'italic'); doc.setFontSize(10); doc.setTextColor.apply(doc, INK2);
      txt(S.meta.adresse || 'Adresse à compléter sur place', M, y);
      y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor.apply(doc, INK2);
      txt('Date : ' + (S.meta.date || '……/……/………') + '     Présents : ' + (S.meta.presents || '……………………………'), M, y);
      y += 4;
      const st = stats();
      txt('Points vérifiés : ' + st.done + ' / ' + st.total
        + '     Conformes : ' + st.ok + '     À surveiller : ' + st.warn
        + '     Problèmes : ' + st.ko + '     Travaux chiffrés : ' + eur(st.cost), M, y);
      y += 4;
      line(y, RULE, 0.3); y += 7;

      const block = (title, defs, store) => {
        need(20);
        doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor.apply(doc, INK);
        txt(title, M, y); y += 2.6;
        line(y, RULE, 0.3); y += 6;
        defs.forEach(g => {
          need(14);
          caps(g.cat, M, y, 6, GREEN, 1); y += 2.2;
          line(y, RULE2, 0.15); y += 5;
          g.items.forEach(it => {
            const c = store[key(g.cat, it.t)] || { s: 0, n: '', c: 0 };
            const noteTxt = (c.n || '') + (c.c ? (c.n ? '  ·  ' : '') + 'travaux ' + eur(c.c) : '');
            const nl = noteTxt ? doc.splitTextToSize(noteTxt, RR - M - 46) : [];
            need(7 + nl.length * 3.6);
            // trois cases à cocher, la case retenue est remplie
            [1, 2, 3].forEach((s, i) => {
              const x = M + i * 5;
              doc.setDrawColor.apply(doc, c.s === s ? SC[s] : RULE);
              doc.setLineWidth(0.35);
              doc.rect(x, y - 2.7, 3.2, 3.2, 'S');
              if (c.s === s) { doc.setFillColor.apply(doc, SC[s]); doc.rect(x + 0.7, y - 2, 1.8, 1.8, 'F'); }
            });
            doc.setFont('helvetica', c.s ? 'bold' : 'normal'); doc.setFontSize(7.5);
            doc.setTextColor.apply(doc, c.s ? SC[c.s] : INK);
            txt(it.t, M + 18, y);
            doc.setFont('times', 'italic'); doc.setFontSize(7.1); doc.setTextColor.apply(doc, HINT);
            const hl = doc.splitTextToSize(it.h, RR - M - 20);
            txt(hl[0], M + 18, y + 3.5);
            y += 6.6;
            if (nl.length) {
              doc.setFont('helvetica', 'normal'); doc.setFontSize(7.1); doc.setTextColor.apply(doc, INK);
              doc.setFillColor.apply(doc, c.s ? SC[c.s] : INK4);
              doc.rect(M + 18, y - 1.7, 1.2, 1.2, 'F');
              txt(nl, M + 21.5, y); y += nl.length * 3.7 + 3;
            } else {
              // ligne de saisie manuscrite pour une visite sur papier
              doc.setDrawColor.apply(doc, RULE2); doc.setLineWidth(0.2);
              doc.line(M + 18, y - 0.6, RR, y - 0.6);
              y += 3;
            }
          });
          y += 3;
        });
        y += 3;
      };

      // Légende des cases
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.9); doc.setTextColor.apply(doc, INK3);
      txt('Cases, de gauche à droite : conforme  ·  à surveiller  ·  problème', M, y);
      y += 10;

      block('Immeuble et parties communes', COMMUN, S.items);
      S.units.forEach(u => {
        need(24);
        block('Logement — ' + u.name + (u.info ? '  (' + u.info + ')' : ''), LOGEMENT, u.items);
      });

      // Impression générale
      need(40);
      doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor.apply(doc, INK);
      txt('Impression générale', M, y); y += 2.6;
      line(y, RULE, 0.3); y += 6;
      if (S.meta.synthese) {
        doc.setFont('times', 'normal'); doc.setFontSize(8.4); doc.setTextColor.apply(doc, INK2);
        const sl = doc.splitTextToSize(S.meta.synthese, RR - M);
        txt(sl, M, y, { lineHeightFactor: 1.35 }); y += sl.length * 4.2 + 4;
      }
      for (let i = 0; i < 6; i++) { doc.setDrawColor.apply(doc, RULE2); doc.setLineWidth(0.2); doc.line(M, y, RR, y); y += 7; }

      footer();
      const safe = (S.meta.adresse || 'visite').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'visite';
      doc.save('ImmoSim_Fiche_visite_' + safe + '_' + (S.meta.date || new Date().toISOString().slice(0, 10)) + '.pdf');
      toast_('Fiche de visite · ' + doc.getNumberOfPages() + ' pages', 'ok');
    } catch (err) {
      console.error('[Visite PDF]', err);
      toast_('Erreur PDF : ' + (err && err.message ? err.message : err), 'err');
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INTÉGRATION À L'APPLICATION
     ══════════════════════════════════════════════════════════════════════════ */
  function ensureView() {
    if (el('view-visite')) return;
    const v = document.createElement('div');
    v.id = 'view-visite';
    v.className = 'view';
    const last = document.querySelector('.view:last-of-type');
    if (last && last.parentNode) last.parentNode.insertBefore(v, last.nextSibling);
    else document.body.appendChild(v);
  }

  /* Affiche la vue sans dépendre de window.gv : on reproduit son comportement
     (masquer les .view, activer la nôtre) et on l'appelle si elle existe. */
  function showVisite() {
    ensureView();
    if (typeof window.gv === 'function') {
      try { window.gv('visite'); } catch (err) {}
    } else {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.nb, .db').forEach(b => b.classList.remove('active'));
      const v = el('view-visite');
      if (v) v.classList.add('active');
    }
    const btn = document.querySelector('.desk-nav [data-v-nav]');
    if (btn) btn.classList.add('active');
    try { render(); } catch (err) { console.warn('[Visite]', err); }
    try { window.scrollTo(0, 0); } catch (err) {}
  }

  function ensureNav() {
    const nav = document.querySelector('.desk-nav');
    if (nav && !nav.querySelector('[data-v-nav]')) {
      const b = document.createElement('button');
      b.className = 'nb';
      b.setAttribute('data-v-nav', '1');
      b.setAttribute('onclick', "gv('visite')");
      b.addEventListener('click', (ev) => { ev.preventDefault(); showVisite(); });
      b.innerHTML = '🔎 Visite';
      b.style.color = 'var(--gold)';
      b.style.fontWeight = '600';
      // La barre défile horizontalement : placé en fin de liste, le bouton
      // serait hors écran. On l'insère juste après « Simulateur ».
      const kids = Array.prototype.slice.call(nav.children);
      const sim = kids.find(c => /gv\(\s*['"]sim['"]\s*\)/.test(c.getAttribute('onclick') || ''));
      const guide = kids.find(c => /gv\(\s*['"]doc['"]\s*\)/.test(c.getAttribute('onclick') || ''));
      if (sim) nav.insertBefore(b, sim.nextSibling);
      else nav.insertBefore(b, guide || null);
    }
    const drawer = document.querySelector('.db');
    if (drawer && drawer.parentNode && !drawer.parentNode.querySelector('[data-v-navd]')) {
      const d = document.createElement('button');
      d.className = 'db';
      d.setAttribute('data-v-navd', '1');
      d.textContent = '🔎 Fiche de visite';
      d.addEventListener('click', () => { showVisite(); try { closeDrawer(); } catch (e) {} });
      drawer.parentNode.insertBefore(d, drawer);
    }
  }

  function hookGv() {
    if (typeof window.gv !== 'function' || window.gv.__visiteHooked) return false;
    const orig = window.gv;
    const wrapped = function (name) {
      const out = orig.apply(this, arguments);
      if (name === 'visite') { try { render(); } catch (err) { console.warn('[Visite]', err); } }
      return out;
    };
    wrapped.__visiteHooked = true;
    window.gv = wrapped;
    return true;
  }

  window.ImmoSimVisite = {
    open: showVisite,
    state: () => S,
    stats,
    asText,
    exportPDF: exportFichePDF,
    reset: () => { S = blankState(); save(); render(); },
    COMMUN, LOGEMENT
  };

  const boot = () => {
    S = load(); ensureView(); ensureNav(); hookGv();
    // La barre de navigation peut être reconstruite par l'application :
    // on vérifie quelques secondes que notre bouton est toujours en place.
    let n = 0;
    const retry = setInterval(() => {
      ensureView(); ensureNav(); hookGv();
      if (++n > 20) clearInterval(retry);
    }, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.info('[ImmoSim] Onglet « Visite » actif — ' + (COMMUN.reduce((n, g) => n + g.items.length, 0))
    + ' points immeuble + ' + (LOGEMENT.reduce((n, g) => n + g.items.length, 0)) + ' points par logement.');
})();
