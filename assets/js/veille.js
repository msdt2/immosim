/**
 * ImmoSim — Module « Veille Melo »  (additif, à charger APRÈS app.js et les autres modules)
 * ---------------------------------------------------------------------------------------
 * - Récupère les annonces reçues par le Worker « veille » (alimenté par les webhooks Melo)
 * - Les injecte dans la vue Recherche comme des annonces ImmoSim (score, simulateur, shortlist…)
 * - Ouvre directement une annonce depuis Telegram : https://msdt2.github.io/immosim/?melo=<uuid>
 * - Rafraîchit automatiquement toutes les N minutes quand l'onglet est visible
 * - Aligne la rentabilité brute des annonces sur ta convention : loyer annuel ÷ (prix + travaux),
 *   sans frais de notaire (désactivable via ALIGN_RENTA_MARC)
 *
 * Ne modifie ni app.js ni styles.css : extension par enveloppes de fonctions + injection DOM.
 */
(function () {
  'use strict';

  const ALIGN_RENTA_MARC = true;
  const LS_CFG = 'immoV9_veille_cfg';
  const LS_SINCE = 'immoV9_veille_since';
  const LS_SEEN = 'immoV9_veille_seen';
  const MAX_VEILLE = 150;            // annonces veille conservées localement (quota localStorage)
  const DESC_MAX = 2500;
  const SITES = { 'leboncoin.fr': 'leboncoin', 'seloger.com': 'seloger', 'bienici.com': 'bienici', 'pap.fr': 'pap', 'logic-immo.com': 'logicimmo' };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const euro = (n) => (typeof eur === 'function' ? eur(n, 0) : Math.round(n).toLocaleString('fr-FR') + ' €');
  const say = (m, t) => { if (typeof toast === 'function') toast(m, t || ''); };
  const hasApp = () => typeof listings !== 'undefined' && typeof renderListings === 'function';

  let cfg = load(LS_CFG, { url: '', key: '', minutes: 5, auto: true });
  let timer = null, lastSync = 0, syncing = false, activeChip = null;

  function load(k, d) { try { return Object.assign({}, d, JSON.parse(localStorage.getItem(k) || 'null') || {}); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
  const since = () => parseInt(localStorage.getItem(LS_SINCE) || '0', 10) || 0;
  const configured = () => !!(cfg.url && cfg.key);
  const base = () => cfg.url.replace(/\/+$/, '');

  /* ───────────── API Worker ───────────── */
  async function api(path, opts = {}) {
    const r = await fetch(base() + path, { ...opts, headers: { 'X-Veille-Key': cfg.key, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
    return data;
  }

  /* ───────────── Conversion annonce Worker → annonce ImmoSim ───────────── */
  function sourceOf(url) {
    try { const h = new URL(url).hostname.replace(/^www\./, ''); for (const k in SITES) if (h.endsWith(k)) return SITES[k]; } catch (e) {}
    return 'melo';
  }

  function toListing(a) {
    const lien = (a.liens && a.liens[0]) || {};
    const loyerTexte = a.loyerMensuel || 0;
    const l = {
      id: 'melo_' + a.uuid, meloUuid: a.uuid, fromVeille: true,
      source: sourceOf(lien.url), url: lien.url || '#',
      title: esc(a.title), description: esc(String(a.description || '').slice(0, DESC_MAX)),
      prix: a.prix || 0, surface: a.surface || 0, pieces: a.pieces || 0,
      type: a.type || 'Immeuble', ville: esc(a.ville), cp: a.cp || '', dpe: a.dpe || '',
      lat: a.lat || null, lon: a.lon || null,
      img: (a.photos && a.photos[0]) || '', date: (a.publieLe || '').slice(0, 10),
      loyerActuel: a.loyerNature === 'actuel' ? loyerTexte : 0,
      loyerEstime: a.loyerNature !== 'actuel' ? loyerTexte : 0,
      taxeFonciere: a.taxeFonciere || 0, chargesCopro: 0, travaux: 0,
      locataireEnPlace: !!a.locataires,
      // Données propres à la veille
      veille: {
        statut: a.statut || 'nouvelle', firstSeen: a.firstSeen, updatedAt: a.updatedAt,
        loyerNature: a.loyerNature, loyerExtrait: a.loyerExtrait ? esc(a.loyerExtrait) : '',
        nbLots: a.nbLots, localCommercial: !!a.localCommercial, rentaCible: a.rentaCible || 10,
        prixInitial: a.prixInitial || a.prix, historiquePrix: a.historiquePrix || [],
        liens: (a.liens || []).map(x => ({ url: x.url, site: esc(x.site) })),
        contact: a.contact ? { agence: esc(a.contact.agence), nom: esc(a.contact.nom), tel: esc(a.contact.tel), ref: esc(a.contact.ref) } : null,
        photos: a.photos || []
      }
    };
    // Loyer absent du texte → estimation marché de l'app, signalée comme telle
    if (!loyerTexte && typeof estimateRent === 'function' && l.surface) {
      l.loyerEstime = estimateRent(l);
      l.veille.loyerNature = 'estimation marché';
    }
    return l;
  }

  /* ───────────── Rentabilité alignée sur ta convention ───────────── */
  function wrapAnalyze() {
    if (!ALIGN_RENTA_MARC || typeof window.analyzeListingLocal !== 'function' || window.analyzeListingLocal._veille) return;
    const orig = window.analyzeListingLocal;
    const wrapped = function (l) {
      orig(l);
      const denom = (l.prix || 0) + (l.travaux || 0);
      if (!denom) return;
      const avant = l.rentBrute;
      l.rentBrute = l.loyerAn / denom * 100;
      l.rentNette = (l.loyerAn - (l.charges || 0)) / denom * 100;
      l.score = Math.max(0, Math.min(100, Math.round(l.score - Math.min(30, avant * 3.5) + Math.min(30, l.rentBrute * 3.5))));
      l.verdict = l.score >= 65 ? 'good' : l.score < 40 ? 'avoid' : 'caution';
      l.verdictLabel = { good: '✓ Bonne affaire', caution: '⚠ Prudence', avoid: '✗ À écarter' }[l.verdict];
    };
    wrapped._veille = true;
    window.analyzeListingLocal = wrapped;
    if (hasApp() && listings.length) { listings.forEach(x => wrapped(x)); }
  }

  /* ───────────── Synchronisation ───────────── */
  async function sync(opts = {}) {
    if (!hasApp()) return;
    if (!configured()) { if (!opts.silent) openCfg('Renseigne l\'adresse du Worker et ta clé pour recevoir les annonces.'); return; }
    if (syncing) return;
    syncing = true; setBtnState('…');
    try {
      const hasLocal = listings.some(l => l.fromVeille);
      const from = opts.full || !hasLocal ? 0 : since();
      const data = await api('/annonces?since=' + from + '&limit=' + MAX_VEILLE);
      const seen = new Set(load(LS_SEEN, { ids: [] }).ids);
      let nouvelles = 0, maj = 0;
      for (const a of data.items) {
        const idx = listings.findIndex(x => x.id === 'melo_' + a.uuid);
        if (a.statut === 'ecartee') { if (idx >= 0) listings.splice(idx, 1); continue; }
        const l = toListing(a);
        analyzeListingLocal(l);
        if (idx >= 0) { listings[idx] = Object.assign(listings[idx], l); maj++; }
        else { listings.push(l); if (!seen.has(a.uuid) && a.statut === 'nouvelle') nouvelles++; }
      }
      trimVeille();
      const maxTs = data.items.reduce((m, a) => Math.max(m, a.updatedAt || 0), from);
      save(LS_SINCE, String(maxTs));
      lastSync = Date.now();
      refreshView();
      if (typeof saveListingsLS === 'function') saveListingsLS();
      if (nouvelles) {
        say('📡 ' + nouvelles + ' nouvelle(s) annonce(s) Melo', 'ok');
        if (typeof addNotif === 'function') addNotif('📡 ' + nouvelles + ' nouvelle(s) annonce(s) Melo', 'alert');
      } else if (!opts.silent) {
        say(maj ? maj + ' annonce(s) mise(s) à jour' : 'Veille à jour — aucune nouvelle annonce');
      }
    } catch (e) {
      if (!opts.silent) say('Veille : ' + e.message, 'err');
      console.warn('[veille]', e);
    } finally {
      syncing = false; updateBadge();
    }
  }

  function trimVeille() {
    const v = listings.filter(l => l.fromVeille).sort((a, b) => (b.veille?.updatedAt || 0) - (a.veille?.updatedAt || 0));
    const drop = new Set(v.slice(MAX_VEILLE).filter(l => !(typeof shortlist !== 'undefined' && shortlist.some(s => s.id === l.id))).map(l => l.id));
    if (drop.size) for (let i = listings.length - 1; i >= 0; i--) if (drop.has(listings[i].id)) listings.splice(i, 1);
  }

  function refreshView() {
    if (typeof updateSourceCounts === 'function') updateSourceCounts();
    updatePill();
    if (activeChip) applyChip(activeChip);
    else if (typeof filterListings === 'function') filterListings();
    else { filteredListings = [...listings]; renderListings(); }
  }

  async function setStatut(uuid, statut) {
    const l = listings.find(x => x.meloUuid === uuid);
    if (l && l.veille) l.veille.statut = statut;
    if (statut === 'ecartee' && l) {
      listings.splice(listings.indexOf(l), 1);
      if (typeof closeDetail === 'function' && typeof currentDetail !== 'undefined' && currentDetail && currentDetail.id === l.id) closeDetail();
      refreshView();
      if (typeof saveListingsLS === 'function') saveListingsLS();
      say('Annonce écartée');
    }
    if (statut === 'suivie' && l && typeof shortlist !== 'undefined' && !shortlist.some(s => s.id === l.id) && typeof toggleShort === 'function') toggleShort(l.id);
    try { await api('/annonce/' + uuid + '/statut', { method: 'POST', body: JSON.stringify({ statut }) }); } catch (e) { console.warn('[veille] statut', e); }
    updateBadge();
  }

  function markSeen(uuid) {
    const s = load(LS_SEEN, { ids: [] });
    if (!s.ids.includes(uuid)) { s.ids.push(uuid); s.ids = s.ids.slice(-800); save(LS_SEEN, s); }
  }

  /* ───────────── Lien profond depuis Telegram ───────────── */
  async function handleDeepLink() {
    const uuid = new URLSearchParams(location.search).get('melo');
    if (!uuid || !/^[0-9a-f-]{36}$/i.test(uuid)) return;
    if (!configured()) { openCfg('Configure la veille sur cet appareil pour ouvrir l\'annonce reçue sur Telegram.', uuid); return; }
    try {
      const a = await api('/annonce/' + uuid);
      const l = toListing(a); analyzeListingLocal(l);
      const idx = listings.findIndex(x => x.id === l.id);
      if (idx >= 0) listings[idx] = l; else listings.push(l);
      if (typeof gv === 'function') gv('search');
      refreshView();
      if (typeof saveListingsLS === 'function') saveListingsLS();
      if (typeof openDetail === 'function') openDetail(l.id);
      window.history.replaceState(null, '', location.pathname);
    } catch (e) { say('Annonce introuvable : ' + e.message, 'err'); }
  }

  /* ───────────── Interface : bouton, puces, cartes, détail ───────────── */
  function injectUI() {
    const bar = document.querySelector('#view-search .agg-action-bar');
    if (bar && !$('veilleBtn')) {
      const b = document.createElement('button');
      b.className = 'btn btn-g'; b.id = 'veilleBtn'; b.type = 'button';
      b.title = 'Récupérer les annonces reçues par la veille Melo';
      b.innerHTML = '📡 Veille <span id="veilleBadge" class="vl-badge" hidden></span>';
      b.addEventListener('click', () => { sync(); applyChip('veille'); });
      const c = document.createElement('button');
      c.className = 'btn btn-g'; c.type = 'button'; c.title = 'Réglages de la veille'; c.textContent = '⚙';
      c.addEventListener('click', () => openCfg());
      const ref = bar.querySelector('[onclick^="clearAllListings"]');
      bar.insertBefore(b, ref); bar.insertBefore(c, ref);
    }
    const qf = $('qfBar');
    if (qf && !$('vlChipVeille')) {
      [['veille', '📡 Veille', 'vlChipVeille'], ['cible', '🎯 Veille ≥ cible', 'vlChipCible']].forEach(([k, label, id]) => {
        const s = document.createElement('span');
        s.className = 'qf-chip'; s.id = id; s.textContent = label;
        s.addEventListener('click', () => applyChip(k));
        qf.appendChild(s);
      });
      // Les puces natives désactivent la nôtre
      qf.querySelectorAll('.qf-chip:not([id^="vlChip"])').forEach(s => s.addEventListener('click', () => { activeChip = null; }));
    }
    const src = $('aggSources');
    if (src && !$('vlPill')) {
      const p = document.createElement('span');
      p.className = 'agg-src-pill'; p.id = 'vlPill';
      p.style.cssText = 'background:var(--gold-a);color:var(--gold);border:1px dashed var(--gold-b);cursor:pointer';
      p.innerHTML = '📡 Veille Melo <span class="qf-count" id="vlPillCount"></span>';
      p.addEventListener('click', () => applyChip('veille'));
      src.appendChild(p);
    }
  }

  function applyChip(kind) {
    if (!hasApp()) return;
    activeChip = kind;
    document.querySelectorAll('.qf-chip').forEach(c => c.classList.remove('active'));
    const chip = $(kind === 'cible' ? 'vlChipCible' : 'vlChipVeille'); if (chip) chip.classList.add('active');
    if (typeof activeQF !== 'undefined') { try { activeQF = 'veille'; } catch (e) {} }
    // « ≥ cible » ne retient que les loyers lus dans l'annonce, jamais l'estimation marché
    filteredListings = listings.filter(l => l.fromVeille && (kind !== 'cible' || (l.veille?.loyerNature !== 'estimation marché' && l.rentBrute >= (l.veille?.rentaCible || 10))));
    if (typeof sortListings === 'function') sortListings(); else renderListings();
  }

  function setBtnState(t) { const b = $('veilleBadge'); if (b && t) { b.hidden = false; b.textContent = t; } }
  function updateBadge() {
    const b = $('veilleBadge'); if (!b || !hasApp()) return;
    const seen = new Set(load(LS_SEEN, { ids: [] }).ids);
    const n = listings.filter(l => l.fromVeille && l.veille?.statut === 'nouvelle' && !seen.has(l.meloUuid)).length;
    b.hidden = !n; b.textContent = n || '';
    updatePill();
  }
  function updatePill() {
    const c = $('vlPillCount'); if (c && hasApp()) { const n = listings.filter(l => l.fromVeille).length; c.textContent = n ? '(' + n + ')' : ''; }
  }

  function decorateCards() {
    if (!hasApp()) return;
    const seen = new Set(load(LS_SEEN, { ids: [] }).ids);
    document.querySelectorAll('#aggGrid .lcard').forEach(card => {
      const m = (card.getAttribute('onclick') || '').match(/openDetail\('(melo_[^']+)'\)/);
      if (!m || card.querySelector('.vl-strip')) return;
      const l = listings.find(x => x.id === m[1]); if (!l || !l.veille) return;
      const v = l.veille;
      const flags = [];
      if (v.statut === 'nouvelle' && !seen.has(l.meloUuid)) flags.push('<span class="vl-flag vl-new">Nouvelle</span>');
      const h = v.historiquePrix; if (h && h.length) { const pct = Math.round((l.prix - v.prixInitial) / v.prixInitial * 100); if (pct) flags.push('<span class="vl-flag vl-drop">' + (pct > 0 ? '+' : '') + pct + ' % depuis ' + euro(v.prixInitial) + '</span>'); }
      if (v.localCommercial) flags.push('<span class="vl-flag vl-com">Local commercial mentionné</span>');
      if (v.nbLots) flags.push('<span class="vl-flag">' + v.nbLots + ' lots</span>');
      const loyer = l.loyer ? euro(l.loyer) + '/mois · ' + esc(v.loyerNature || '') : 'loyer inconnu';
      const cible = l.loyerAn ? euro(l.loyerAn / (v.rentaCible / 100) - (l.travaux || 0)) : '—';
      const strip = document.createElement('div');
      strip.className = 'vl-strip';
      strip.innerHTML = (flags.length ? '<div class="vl-flags">' + flags.join('') + '</div>' : '') +
        '<div class="vl-line"><span>Loyer : ' + loyer + '</span><span>Prix à ' + v.rentaCible + ' % : <b>' + cible + '</b></span></div>' +
        '<div class="vl-acts"><button type="button" class="btn btn-g btn-sm" data-vl="suivie">★ Suivre</button><button type="button" class="btn btn-g btn-sm" data-vl="ecartee">Écarter</button></div>';
      strip.addEventListener('click', e => {
        const act = e.target.closest('[data-vl]'); if (!act) return;
        e.stopPropagation(); setStatut(l.meloUuid, act.dataset.vl);
      });
      const actions = card.querySelector('.lcard-actions');
      (actions ? actions.parentNode : card).insertBefore(strip, actions || null);
    });
  }

  function decorateDetail(id) {
    const l = hasApp() && listings.find(x => x.id === id);
    const body = $('detailBody');
    if (!l || !l.veille || !body || body.querySelector('.vl-detail')) return;
    const v = l.veille;
    markSeen(l.meloUuid);
    if (v.statut === 'nouvelle') setStatut(l.meloUuid, 'vue');
    const rows = [];
    const r = (k, val) => rows.push('<div class="rc"><span class="rl">' + k + '</span><span class="rv">' + val + '</span></div>');
    r('Loyer retenu', l.loyer ? euro(l.loyer) + '/mois (' + esc(v.loyerNature) + ')' : 'non trouvé');
    if (v.loyerExtrait) r('Lu dans l\'annonce', '« ' + v.loyerExtrait + ' »');
    r('Renta brute (hors notaire)', l.rentBrute ? l.rentBrute.toFixed(1).replace('.', ',') + ' %' : '—');
    if (l.loyerAn) {
      const pc = l.loyerAn / (v.rentaCible / 100) - (l.travaux || 0);
      const ecart = Math.round((1 - pc / l.prix) * 100);
      r('Prix pour ' + v.rentaCible + ' % brut', '<b style="color:var(--gold)">' + euro(pc) + '</b> ' + (ecart > 0 ? '(−' + ecart + ' % à négocier)' : '(déjà sous ce prix)'));
    }
    if (v.nbLots) r('Nombre de lots', v.nbLots);
    if (v.historiquePrix.length) r('Historique du prix', [euro(v.prixInitial)].concat(v.historiquePrix.map(p => euro(p.nouveau))).join(' → '));
    if (v.localCommercial) r('Point bloquant', '<span style="color:var(--ru)">local commercial mentionné — à vérifier</span>');
    if (v.contact && (v.contact.agence || v.contact.tel)) r('Contact', [v.contact.agence, v.contact.nom, v.contact.tel ? '<a href="tel:' + v.contact.tel.replace(/\s/g, '') + '" style="color:var(--gold)">' + v.contact.tel + '</a>' : '', v.contact.ref ? 'réf. ' + v.contact.ref : ''].filter(Boolean).join(' · '));
    const liens = v.liens.map(x => '<a class="btn btn-g btn-sm" href="' + esc(x.url) + '" target="_blank" rel="noopener">↗ ' + (x.site || 'annonce') + '</a>').join('');
    const box = document.createElement('div');
    box.className = 'detail-section vl-detail';
    box.innerHTML = '<h4>📡 Veille Melo</h4>' + rows.join('') +
      '<p class="vl-note">Lecture automatique du texte de l\'annonce : à confirmer avec les baux et les quittances avant toute offre.</p>' +
      '<div class="vl-acts">' + liens + '<button type="button" class="btn btn-g btn-sm" data-vl="suivie">★ Suivre</button><button type="button" class="btn btn-g btn-sm" data-vl="ecartee">Écarter</button></div>';
    box.addEventListener('click', e => { const act = e.target.closest('[data-vl]'); if (act) setStatut(l.meloUuid, act.dataset.vl); });
    body.insertBefore(box, body.firstChild);
    updateBadge();
  }

  function wrapRender() {
    if (typeof window.renderListings === 'function' && !window.renderListings._veille) {
      const o = window.renderListings;
      const w = function () { const r = o.apply(this, arguments); try { decorateCards(); } catch (e) { console.warn(e); } return r; };
      w._veille = true; window.renderListings = w;
    }
    if (typeof window.openDetail === 'function' && !window.openDetail._veille) {
      const o = window.openDetail;
      const w = function (id) { const r = o.apply(this, arguments); try { decorateDetail(id); } catch (e) { console.warn(e); } return r; };
      w._veille = true; window.openDetail = w;
    }
  }

  /* ───────────── Réglages ───────────── */
  let pendingUuid = null;
  function openCfg(msg, uuid) {
    pendingUuid = uuid || pendingUuid;
    let m = $('veilleModal');
    if (!m) {
      m = document.createElement('div');
      m.className = 'vl-overlay'; m.id = 'veilleModal';
      m.innerHTML = '<div class="vl-box" role="dialog" aria-modal="true" aria-labelledby="vlTitle"><h2 id="vlTitle">📡 Veille Melo <button class="vl-x" type="button" data-x aria-label="Fermer">×</button></h2>' +
        '<p class="vl-note" id="vlMsg"></p>' +
        '<div class="field"><label for="vlUrl">Adresse du Worker</label><input id="vlUrl" type="url" placeholder="https://immosim-veille.xxx.workers.dev" autocomplete="off"/></div>' +
        '<div class="field"><label for="vlKey">Clé de lecture (READ_KEY)</label><input id="vlKey" type="password" autocomplete="off"/></div>' +
        '<div class="field"><label for="vlMin">Rafraîchissement automatique</label><select id="vlMin"><option value="0">Désactivé</option><option value="2">Toutes les 2 min</option><option value="5">Toutes les 5 min</option><option value="15">Toutes les 15 min</option></select></div>' +
        '<p class="vl-note" id="vlStatus"></p>' +
        '<div class="vl-acts"><button type="button" class="btn btn-g" data-test>Tester</button><button type="button" class="btn btn-g" data-full>Recharger tout l\'historique</button><button type="button" class="btn btn-p" data-save>Enregistrer</button></div></div>';
      document.body.appendChild(m);
      const read = () => ({ url: $('vlUrl').value.trim(), key: $('vlKey').value.trim(), minutes: parseInt($('vlMin').value, 10) });
      const status = (t, ok) => { const s = $('vlStatus'); s.textContent = t; s.style.color = ok ? 'var(--em)' : 'var(--ru)'; };
      m.addEventListener('click', async e => {
        if (e.target === m || e.target.hasAttribute('data-x')) m.classList.remove('open');
        if (e.target.hasAttribute('data-test')) {
          const prev = cfg; cfg = Object.assign({}, cfg, read());
          try { const d = await api('/annonces?since=' + (Date.now() - 7 * 864e5) + '&limit=500'); status('Connexion OK — ' + d.count + ' annonce(s) reçue(s) ces 7 derniers jours.', true); }
          catch (err) { status('Échec : ' + err.message + '. Vérifie l\'adresse, la clé et ALLOWED_ORIGINS.', false); }
          cfg = prev;
        }
        if (e.target.hasAttribute('data-save') || e.target.hasAttribute('data-full')) {
          cfg = Object.assign({}, cfg, read()); save(LS_CFG, cfg); schedule();
          m.classList.remove('open');
          await sync({ full: e.target.hasAttribute('data-full') });
          if (pendingUuid) { const u = pendingUuid; pendingUuid = null; window.history.replaceState(null, '', location.pathname + '?melo=' + u); handleDeepLink(); }
        }
      });
    }
    if (!m._esc) { m._esc = true; document.addEventListener('keydown', e => { if (e.key === 'Escape') m.classList.remove('open'); }); }
    $('vlUrl').value = cfg.url; $('vlKey').value = cfg.key; $('vlMin').value = String(cfg.minutes ?? 5);
    $('vlMsg').textContent = msg || 'Les annonces reçues par Melo arrivent ici en plus de Telegram.';
    $('vlStatus').textContent = '';
    m.classList.add('open');
  }

  function schedule() {
    clearInterval(timer);
    if (!cfg.minutes) return;
    timer = setInterval(() => { if (document.visibilityState === 'visible') sync({ silent: true }); }, cfg.minutes * 60000);
  }

  function injectCSS() {
    if ($('vlCSS')) return;
    const s = document.createElement('style'); s.id = 'vlCSS';
    s.textContent = [
      '.vl-badge{background:var(--ru);color:#fff;border-radius:10px;font-size:.6rem;padding:1px 6px;margin-left:2px;font-weight:700}',
      '.vl-strip{border-top:1px dashed var(--bd2);margin:8px 0 6px;padding-top:8px;font-size:.66rem;color:var(--ink2)}',
      '.vl-flags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}',
      '.vl-flag{border:1px solid var(--bd2);border-radius:4px;padding:1px 6px;color:var(--ink2)}',
      '.vl-new{border-color:var(--gold);color:var(--gold)}.vl-drop{border-color:var(--em);color:var(--em)}.vl-com{border-color:var(--ru);color:var(--ru)}',
      '.vl-line{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      '.vl-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
      '.vl-note{font-size:.7rem;color:var(--ink3);line-height:1.5;margin:6px 0}',
      '.vl-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:16px}',
      '.vl-overlay.open{display:flex}',
      '.vl-box{background:var(--bg1,#16130f);color:var(--ink,#eee);border:1px solid var(--bd2,#333);border-radius:12px;padding:20px 22px;width:100%;max-width:460px;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.45)}',
      '.vl-box h2{display:flex;justify-content:space-between;align-items:center;font-size:1.05rem;margin:0 0 6px;color:var(--gold)}',
      '.vl-x{background:none;border:none;color:var(--ink3);font-size:1.3rem;cursor:pointer;line-height:1}',
      '#veilleModal .field{margin-bottom:10px}#veilleModal input,#veilleModal select{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid var(--bd2);background:var(--bg2);color:var(--ink)}',
      '.vl-detail{border:1px solid var(--gold-b);border-radius:8px;padding:10px 12px;margin-bottom:12px}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ───────────── Démarrage (attend app.js et les autres modules) ───────────── */
  function boot(tries = 0) {
    if (!hasApp() || !document.querySelector('#view-search')) { if (tries < 50) setTimeout(() => boot(tries + 1), 200); return; }
    injectCSS(); wrapAnalyze(); wrapRender(); injectUI(); updateBadge(); schedule();
    // Ré-injection si une autre partie de l'app reconstruit la barre d'actions
    new MutationObserver(() => { if (!$('veilleBtn')) injectUI(); }).observe($('view-search'), { childList: true, subtree: true });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastSync > 60000) sync({ silent: true }); });
    handleDeepLink().then(() => { if (configured()) sync({ silent: true }); });
    window.ImmoSimVeille = { sync, openCfg, setStatut, config: () => ({ ...cfg, key: cfg.key ? '••••' : '' }) };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot()); else boot();
})();
