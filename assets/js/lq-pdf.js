/* ════════════════════════════════════════════════════════════════════════════
   ImmoSim — MOTEUR PDF ÉDITORIAL (V10)
   ────────────────────────────────────────────────────────────────────────────
   Fichier ADDITIF. Ne modifie ni app.js ni styles.css.
   À charger APRÈS app.js :  <script src="assets/js/lq-pdf.js"></script>

   Il redéfinit window.exportPDF() avec une identité graphique complète :
     · papier ivoire, filets fins, aucune boîte grise superflue
     · Times (serif natif jsPDF) pour titres et chiffres — Helvetica pour libellés
     · une seule couleur d'accent (or) + vert institutionnel
     · graphiques vectoriels (aucune capture bitmap)
     · grille typographique stricte, pagination et rappels de section

   Le contenu (sections, calculs, formules) est intégralement conservé.
   L'ancienne fonction reste accessible via window.exportPDF_legacy().
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof window.exportPDF === 'function' && !window.exportPDF_legacy) {
    window.exportPDF_legacy = window.exportPDF;
  }

  /* ── Accès tolérant aux globales définies dans app.js ───────────────────── */
  const G = (name, fallback) => {
    try { const v = eval(name); return (v === undefined ? fallback : v); }
    catch (e) { return fallback; }
  };
  const _vn = (id) => { try { return vn(id); } catch (e) { const el = document.getElementById(id); const n = parseFloat(el && el.value); return isNaN(n) ? 0 : n; } };
  const _tx = (id) => { try { return tx(id); } catch (e) { const el = document.getElementById(id); return ((el && el.value) || '').trim(); } };
  const _el = (id) => document.getElementById(id);
  const _toast = (m, t) => { try { toast(m, t); } catch (e) { console.log('[ImmoSim]', m); } };

  /* ══════════════════════════════════════════════════════════════════════════
     DESIGN SYSTEM
     ══════════════════════════════════════════════════════════════════════════ */
  /* Palette de référence de l'identité éditoriale.
     Chaque jeton est pilotable depuis l'onglet « Couleurs PDF » de l'application. */
  const THEME_DEFAULTS = {
    accent:    '#B4874B',   // or : numéros de section, chiffres, filets d'accent
    accent2:   '#8F6834',   // or foncé : totaux, pagination
    structure: '#0F3D33',   // vert institutionnel : intertitres, en-têtes de tableau
    title:     '#12211C',   // titres (couverture, sections)
    ink1:      '#12211C',   // texte principal
    ink2:      '#3A4A44',   // texte courant
    ink3:      '#7C8A84',   // notes, légendes
    rule:      '#D6CFC2',   // filets et séparateurs
    band:      '#FAF8F4',   // aplat de couverture
    fill:      '#F5F2EB',   // fond des jauges
    pos:       '#1F6F4A',
    neg:       '#A32F2F',
    warn:      '#9A6B15',
    cool:      '#34556E'
  };

  const T = {
    paper: [255, 255, 255], white: [255, 255, 255],
    ivory: [250, 248, 244], ivory2: [245, 242, 235],
    ink: [18, 33, 28], ink2: [58, 74, 68], ink3: [124, 138, 132], ink4: [162, 173, 168],
    title: [18, 33, 28],
    green: [15, 61, 51], gold: [180, 135, 75], gold2: [143, 104, 52],
    rule: [214, 207, 194], rule2: [235, 230, 220],
    pos: [31, 111, 74], neg: [163, 47, 47], warn: [154, 107, 21], cool: [52, 85, 110]
  };
  const tint = (c, w) => c.map(v => Math.round(v + (255 - v) * w));

  /* ── Résolution du thème ────────────────────────────────────────────────
     Ordre de priorité :
       1. window.IMMOSIM_PDF_THEME          (surcharge programmatique)
       2. localStorage immoV10_pdfTheme     (jeu de couleurs V10)
       3. getPDFColors() de l'application   (onglet « Couleurs PDF »)
       4. THEME_DEFAULTS                    (identité éditoriale)
     Des garde-fous de luminance empêchent tout réglage de rendre un texte
     illisible ou un aplat trop sombre pour l'impression.
     ──────────────────────────────────────────────────────────────────── */
  const hex2rgb = (h) => {
    if (typeof h !== 'string') return null;
    h = h.trim();
    if (/^#?[0-9a-f]{3}$/i.test(h)) { h = h.replace('#', ''); h = '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  };
  const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const darken = (c, k) => c.map(v => Math.round(v * k));
  const ensureDark = (c, maxL) => { let g = c, n = 0; while (lum(g) > maxL && n++ < 12) g = darken(g, 0.86); return g; };
  const ensureLight = (c, minL) => { let g = c, n = 0; while (lum(g) < minL && n++ < 12) g = tint(g, 0.22); return g; };

  function readThemeSource() {
    const src = {};
    // 3. couleurs de l'application (mappées sur les jetons V10)
    try {
      if (typeof getPDFColors === 'function') {
        const c = getPDFColors() || {};
        const map = {
          accent: 'pdf_accent', accent2: 'pdf_accent2', title: 'pdf_title',
          ink1: 'pdf_ink1', ink2: 'pdf_ink2', ink3: 'pdf_ink3',
          pos: 'pdf_pos', neg: 'pdf_neg', warn: 'pdf_warn', cool: 'pdf_info',
          band: 'pdf_header_bg', fill: 'pdf_row1',
          structure: 'pdf_v10_structure', rule: 'pdf_v10_rule'
        };
        Object.keys(map).forEach(k => { if (c[map[k]]) src[k] = c[map[k]]; });
      }
    } catch (err) {}
    // 2. jeu de couleurs propre au moteur V10
    try { Object.assign(src, JSON.parse(localStorage.getItem('immoV10_pdfTheme') || '{}')); } catch (err) {}
    // 1. surcharge programmatique
    if (window.IMMOSIM_PDF_THEME && typeof window.IMMOSIM_PDF_THEME === 'object') Object.assign(src, window.IMMOSIM_PDF_THEME);
    return src;
  }

  function applyTheme() {
    const src = readThemeSource();
    const get = (k) => hex2rgb(src[k]) || hex2rgb(THEME_DEFAULTS[k]);
    // Encres : toujours suffisamment sombres pour rester lisibles sur blanc
    T.title = ensureDark(get('title'), 0.40);
    T.ink = ensureDark(get('ink1'), 0.40);
    T.ink2 = ensureDark(get('ink2'), 0.58);
    T.ink3 = ensureDark(get('ink3'), 0.68);
    T.ink4 = tint(T.ink3, 0.34);
    // Structure et accents : lisibles en petit corps
    T.green = ensureDark(get('structure'), 0.48);
    T.gold = ensureDark(get('accent'), 0.62);
    T.gold2 = ensureDark(get('accent2'), 0.50);
    // Sémantique
    T.pos = ensureDark(get('pos'), 0.62);
    T.neg = ensureDark(get('neg'), 0.62);
    T.warn = ensureDark(get('warn'), 0.66);
    T.cool = ensureDark(get('cool'), 0.62);
    // Aplats : toujours assez clairs pour ne pas noircir la page
    T.ivory = ensureLight(get('band'), 0.90);
    T.ivory2 = ensureLight(get('fill'), 0.88);
    T.rule = get('rule');
    T.rule2 = tint(T.rule, 0.55);
    T.paper = [255, 255, 255];
    T.white = [255, 255, 255];
    return T;
  }

  /* Géométrie page */
  const PW = 210, PH = 297;
  const M = 18, RR = 192, CW = RR - M;   // 174 mm de contenu
  const TOP = 30, BOT = 271;             // zone de flux

  /* ══════════════════════════════════════════════════════════════════════════
     EXPORT
     ══════════════════════════════════════════════════════════════════════════ */
  function exportPDFEditorial() {
    const r = G('R', null);
    if (!r) { _toast('Calculez d\'abord un bien.', 'err'); return; }
    if (typeof window.jspdf === 'undefined') { _toast('jsPDF non disponible.', 'err'); return; }

    try {
      applyTheme();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const TOTAL = '{total_pages_count_string}';

      if (doc.setProperties) doc.setProperties({
        title: 'ImmoSim — Dossier d\'analyse patrimoniale',
        subject: 'Analyse d\'investissement locatif',
        author: (G('getIdentity', () => ({}))().cabinet) || 'ImmoSim',
        keywords: 'immobilier, investissement, rentabilité, cash-flow, fiscalité',
        creator: 'ImmoSim'
      });

      /* ── Sécurisation des primitives jsPDF ─────────────────────────────── */
      const _text = doc.text.bind(doc);
      doc.text = function (t, x, y, o) {
        if (Array.isArray(t)) t = t.map(v => String(v == null ? '' : v));
        else t = String(t == null ? '—' : t);
        if (typeof x !== 'number' || isNaN(x)) x = 0;
        if (typeof y !== 'number' || isNaN(y)) y = 0;
        return _text(t, x, y, o);
      };
      const _cs = doc.setCharSpace ? doc.setCharSpace.bind(doc) : function () {};
      doc.setCharSpace = function (v) { try { _cs(v); } catch (e) {} };
      const cap = (v) => { try { if (doc.setLineCap) doc.setLineCap(v); } catch (e) {} };
      const dash = (a, ph) => { try { if (doc.setLineDashPattern) doc.setLineDashPattern(a, ph || 0); } catch (e) {} };

      /* ── Formatage ─────────────────────────────────────────────────────── */
      const fmt = (n, d = 0) => (+n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[\u00A0\u202F]/g, ' ');
      const e = (n, d = 0) => (isNaN(n) || n === null || n === undefined) ? '—' : fmt(n, d) + ' \u20AC';
      const p = (n, d = 2) => (isNaN(n) || !isFinite(n)) ? '—' : fmt(n, d) + ' %';
      const n0 = (v) => (isNaN(+v) || !v) ? 0 : +v;
      const first = (s) => String(s || '').split(/[—-]{1,2}/)[0].trim();

      /* ── État de flux ──────────────────────────────────────────────────── */
      let y = TOP, page = 0;

      /* ══════ PRIMITIVES TYPOGRAPHIQUES ══════════════════════════════════ */

      // Serif (titres, chiffres) / Sans (libellés, tableaux)
      const serif = (style, size) => { doc.setFont('times', style || 'normal'); doc.setFontSize(size); };
      const sans  = (style, size) => { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); };
      const col   = (c) => doc.setTextColor(c[0], c[1], c[2]);

      function hair(yy, x1, x2, c, w) {
        doc.setDrawColor(...(c || T.rule2));
        doc.setLineWidth(w || 0.15);
        dash([], 0);
        doc.line(x1 === undefined ? M : x1, yy, x2 === undefined ? RR : x2, yy);
      }

      // Filet pointillé discret (séparateurs internes)
      function hairDot(yy, x1, x2) {
        doc.setDrawColor(...T.rule);
        doc.setLineWidth(0.12);
        dash([0.6, 1.1], 0);
        doc.line(x1 === undefined ? M : x1, yy, x2 === undefined ? RR : x2, yy);
        dash([], 0);
      }

      // Petites capitales espacées (eyebrow / labels de structure)
      function caps(txt, x, yy, size, c, style, space, align) {
        const sp = (space === undefined ? 0.9 : space);
        const up = String(txt).toUpperCase();
        sans(style || 'bold', size || 6);
        col(c || T.ink3);
        doc.setCharSpace(sp);
        // jsPDF ignore l'inter-lettrage dans le calcul de largeur : on compense.
        let cx2 = x;
        if (align === 'right') cx2 = x - sp * Math.max(0, up.length - 1);
        else if (align === 'center') cx2 = x - sp * Math.max(0, up.length - 1) / 2;
        doc.text(up, cx2, yy, align ? { align } : undefined);
        doc.setCharSpace(0);
      }

      /* ══════ PAGE ════════════════════════════════════════════════════════ */
      function header() {
        // filet haut + micro-bandeau or
        doc.setFillColor(...T.gold); doc.rect(M, 14, 16, 0.9, 'F');
        caps('ImmoSim', M + 19, 15.6, 6, T.green, 'bold', 1.4);
        caps('Dossier d\'analyse patrimoniale', M + 45, 15.6, 5.6, T.ink4, 'normal', 0.8);
        const ttl = [(r.typeBien || ''), (r.ville || '')].filter(Boolean).join(' · ');
        if (ttl) caps(ttl, RR, 15.6, 5.6, T.ink4, 'normal', 0.6, 'right');
        hair(19.5, M, RR, T.rule, 0.2);
      }

      const pageSections = {};
      function footer(num) {
        const runningSection = pageSections[num] || '';
        hair(276, M, RR, T.rule2, 0.15);
        sans('normal', 5.8); col(T.ink4);
        const d = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.text('Édité le ' + d + '  ·  Estimations indicatives, non contractuelles', M, 280);
        if (runningSection) {
          const rs = runningSection.length > 34 ? runningSection.slice(0, 33).trim() + '…' : runningSection;
          caps(rs, PW / 2 + 6, 280, 5.4, T.ink4, 'normal', 0.7, 'center');
        }
        serif('normal', 8); col(T.gold2);
        doc.text(String(num) + ' / ' + TOTAL, RR, 280.3, { align: 'right' });
      }

      function newPage() {
        doc.addPage(); page++;
        doc.setFillColor(...T.paper); doc.rect(0, 0, PW, PH, 'F');
        header();
        y = TOP;
      }
      // Les pieds de page sont tracés en fin de génération, une fois connu
      // le titre de section réellement présent sur chaque page.
      function paintFooters() {
        const n = doc.getNumberOfPages();
        for (let i = 2; i <= n; i++) { doc.setPage(i); footer(i); }
        doc.setPage(n);
      }

      function need(h) { if (y + h > BOT) newPage(); }

      /* ══════ BLOCS ═══════════════════════════════════════════════════════ */

      // Titre de section : numéro or en serif + libellé + filet
      function section(num, label, opts) {
        opts = opts || {};
        need(opts.keep ? opts.keep + 18 : 34);
        if (opts.break) newPage();
        if (!pageSections[page]) pageSections[page] = label;
        y += 2;
        let off = M;
        if (num !== undefined && num !== null && String(num).trim() !== '') {
          serif('normal', 15); col(T.gold);
          doc.text(String(num), M, y + 4);
          off = M + doc.getTextWidth(String(num)) + 5;
        }
        serif('bold', 12.5); col(T.title);
        doc.text(label, off, y + 4);
        y += 7;
        hair(y, M, RR, T.rule, 0.3);
        y += 6.5;
        if (opts.note) {
          serif('italic', 8.2); col(T.ink3);
          const L = doc.splitTextToSize(opts.note, CW);
          doc.text(L, M, y); y += L.length * 4 + 3;
        }
      }

      function subTitle(label, keep) {
        need(keep || 26);
        y += 1.5;
        caps(label, M, y, 6.2, T.green, 'bold', 1.1);
        y += 2.4;
        hair(y, M, RR, T.rule2, 0.15);
        y += 5.5;
      }

      // Ligne clé/valeur : libellé sans-serif, valeur serif alignée à droite
      function kv(label, value, o) {
        o = (o || {});
        need(8);
        const c = o.color || T.ink;
        const strong = !!o.strong;
        sans(strong ? 'bold' : 'normal', 7.6);
        col(strong ? T.ink : T.ink2);
        doc.text(label, M + (o.indent || 0), y);
        serif(strong ? 'bold' : 'normal', strong ? 10 : 9);
        col(c);
        doc.text(String(value), RR, y + (strong ? 0.3 : 0), { align: 'right' });
        y += o.tight ? 5.9 : 6.6;
        if (o.rule !== false) { hairDot(y - 2.4); }
      }

      function kvTotal(label, value, c) {
        need(11);
        y += 1.2;
        hair(y - 1.5, M, RR, T.rule, 0.3);
        y += 3.4;
        caps(label, M, y, 7, T.ink, 'bold', 0.9);
        serif('bold', 12); col(c || T.gold2);
        doc.text(String(value), RR, y + 0.8, { align: 'right' });
        y += 5.5;
        hair(y - 1.2, M, RR, T.rule, 0.3);
        y += 4;
      }

      // Tableau : en-tête en petites capitales, filets fins, pas de zébrures
      let COLS = [];
      function tHead(cols, keep) {
        COLS = cols;
        need(keep || 26);
        hair(y - 3.2, M, RR, T.rule, 0.3);
        cols.forEach(c => caps(c.label, c.x, y, 5.6, T.green, 'bold', 0.6, c.align || 'left'));
        y += 2.6;
        hair(y, M, RR, T.rule, 0.25);
        y += 5;
      }
      function tRow(vals, o) {
        o = o || {};
        need(7);
        vals.forEach((v, i) => {
          const cd = COLS[i] || {};
          const c = (o.colors && o.colors[i]) || cd.color || T.ink2;
          const isNum = (cd.align === 'right');
          if (isNum) { serif(o.strong ? 'bold' : 'normal', o.strong ? 8.6 : 8.4); }
          else { sans(o.strong ? 'bold' : 'normal', 7.3); }
          col(o.strong && !isNum ? T.ink : c);
          doc.text(String(v === undefined || v === null ? '—' : v), cd.x, y, { align: cd.align || 'left' });
        });
        y += 5.9;
        if (o.rule !== false) hairDot(y - 2.1);
      }
      function tTotal(vals) {
        need(16);
        y += 0.6;
        hair(y - 2.4, M, RR, T.rule, 0.3);
        vals.forEach((v, i) => {
          const cd = COLS[i] || {};
          if (cd.align === 'right') { serif('bold', 9); col(cd.tcolor || T.gold2); }
          else { caps(String(v), cd.x, y + 0.6, 6.2, T.ink, 'bold', 0.7, cd.align || 'left'); return; }
          doc.text(String(v), cd.x, y + 0.8, { align: 'right' });
        });
        y += 5.4;
        hair(y - 1.4, M, RR, T.rule, 0.3);
        y += 4;
      }

      // Encadré léger : aplat très clair + filet vertical coloré, aucune bordure
      function callout(title, body, c, o) {
        o = o || {};
        c = c || T.green;
        const bodyLines = body ? doc.splitTextToSize(String(body), CW - 14) : [];
        const h = 8 + (title ? 5 : 0) + bodyLines.length * 4.1;
        // o.fitBottom : tolère la marge basse (jusqu'au filet de pied de page)
        // plutôt que de renvoyer un bloc de conclusion seul sur la page suivante.
        if (!(o.fitBottom && y + h <= 274)) need(h + 6);
        doc.setFillColor(...tint(c, 0.93));
        doc.rect(M, y, CW, h, 'F');
        doc.setFillColor(...c);
        doc.rect(M, y, 1.4, h, 'F');
        let iy = y + 5.6;
        if (title) { caps(title, M + 7, iy, 6.4, c, 'bold', 0.8); iy += 5.2; }
        if (bodyLines.length) {
          serif('normal', 8.3); col(T.ink2);
          doc.text(bodyLines, M + 7, iy, { lineHeightFactor: 1.28 });
        }
        y += h + 6;
      }

      // Liste à puces éditoriale
      function bullets(items, c, glyph) {
        items.forEach(s => {
          const L = doc.splitTextToSize(String(s), CW - 7);
          need(L.length * 4.2 + 3);
          doc.setFillColor(...(c || T.ink3));
          if (glyph === 'check') { doc.rect(M + 0.4, y - 1.9, 1.8, 1.8, 'F'); }
          else { doc.circle(M + 1.2, y - 1.1, 0.7, 'F'); }
          serif('normal', 8.4); col(T.ink2);
          doc.text(L, M + 5.5, y, { lineHeightFactor: 1.3 });
          y += L.length * 4.2 + 2.6;
        });
        y += 2;
      }

      // Jauge horizontale fine
      function gauge(x, yy, w, h, ratio, c) {
        doc.setFillColor(...T.ivory2); doc.rect(x, yy, w, h, 'F');
        const fw = Math.max(0.8, Math.min(w, w * (isFinite(ratio) ? ratio : 0)));
        doc.setFillColor(...c); doc.rect(x, yy, fw, h, 'F');
      }

      // Arc (cadran de score)
      function arc(cx, cy, rad, a0, a1, c, w) {
        doc.setDrawColor(...c); doc.setLineWidth(w); cap('round'); dash([], 0);
        const steps = Math.max(3, Math.round(Math.abs(a1 - a0) / 3));
        let px = cx + rad * Math.cos(a0 * Math.PI / 180), py = cy + rad * Math.sin(a0 * Math.PI / 180);
        for (let i = 1; i <= steps; i++) {
          const a = a0 + (a1 - a0) * i / steps;
          const nx = cx + rad * Math.cos(a * Math.PI / 180), ny = cy + rad * Math.sin(a * Math.PI / 180);
          doc.line(px, py, nx, ny); px = nx; py = ny;
        }
        cap('butt');
      }

      // Bloc chiffre-clé sans boîte : valeur serif + libellé capitales + filet
      function stat(x, yy, w, value, label, c, size) {
        doc.setFillColor(...(c || T.gold)); doc.rect(x, yy, 7, 0.7, 'F');
        serif('bold', size || 15); col(c || T.ink);
        doc.text(String(value), x, yy + 9.5);
        caps(label, x, yy + 14.5, 5.5, T.ink3, 'normal', 0.8);
      }

      /* ══════════════════════════════════════════════════════════════════════
         DONNÉES DÉRIVÉES
         ══════════════════════════════════════════════════════════════════════ */
      const identity = (G('getIdentity', () => ({})))() || {};
      const city = G('_selectedCity', null);
      const DEPT = G('DEPT_DATA', {});
      const PHOTOS_ = G('PHOTOS', []);
      const TRI = (() => { try { return computeTRI(r); } catch (err) { return null; } })();

      const scC = r.score >= 70 ? T.pos : r.score >= 45 ? T.warn : T.neg;
      const scLbl = r.score >= 70 ? 'Excellent' : r.score >= 60 ? 'Bon' : r.score >= 45 ? 'Moyen' : r.score >= 30 ? 'Faible' : 'Risque';
      const scDesc = r.score >= 70 ? 'Paramètres excellents — investissement solide.'
        : r.score >= 60 ? 'Bons paramètres — quelques points à surveiller.'
          : r.score >= 45 ? 'Paramètres moyens — risques à évaluer soigneusement.'
            : 'Paramètres insuffisants — revoir la stratégie.';

      const assM = n0(_vn('assurEmpr')) * ((_el('periodeAss') && _el('periodeAss').value === 'a') ? 1 / 12 : 1);
      const totalRemb = r.mensFin * r.dureePret * 12;
      const totalInt = totalRemb - r.emp;
      const tauxM = (r.tauxPret / 100) / 12;
      const dpeRisk = ['F', 'G'].includes(r.dpe);
      const cfStress70 = (r.loyerM * 0.70) - r.mensFin - r.charges / 12;
      const debtRatio = _vn('revenusMenage') > 0 ? ((r.mensFin + _vn('autresCredits')) / _vn('revenusMenage')) * 100 : null;

      // Projection patrimoniale
      const proj = [];
      {
        let capR = r.emp, cum = 0, ti = 0;
        for (let an = 1; an <= r.horizon; an++) {
          let iAn = 0;
          if (an <= r.dureePret) for (let m = 0; m < 12; m++) { const i = Math.max(0, capR) * tauxM; iAn += i; capR -= r.mensHAss - i; }
          ti += iAn;
          const loyer = r.loyerAn * Math.pow(1 + r.irlTaux / 100, an - 1);
          const charges = r.charges * Math.pow(1 + r.inflCharges / 100, an - 1);
          const mens = an <= r.dureePret ? r.mensFin * 12 : 0;
          const cfAn = loyer - charges - mens;
          cum += cfAn;
          const valBien = r.pa * Math.pow(1 + r.revalBien / 100, an);
          const cr = Math.max(0, capR);
          proj.push({ an, iAn, loyer, charges, mens, cfAn, cumCF: cum, valBien, capR: cr, patriNet: valBien - cr + cum });
        }
        proj.totalInt = ti;
      }
      const last = proj[proj.length - 1] || { valBien: 0, capR: 0, cumCF: 0, patriNet: 0 };

      // Revente
      const prixRev = r.prixRevente || r.pa * Math.pow(1 + r.revalBien / 100, r.horizon);
      const pv = prixRev - r.pa;
      const abatt = r.horizon >= 30 ? 1 : r.horizon >= 6 ? Math.min(1, (r.horizon - 5) * 0.06) : 0;
      const pvImp = Math.max(0, pv * (1 - abatt));
      const impotPV = pvImp * (0.19 + 0.172);
      const fraisVente = prixRev * 0.06;
      const gainNet = pv - impotPV - fraisVente + last.cumCF;

      /* ══════════════════════════════════════════════════════════════════════
         PAGE 1 — COUVERTURE
         ══════════════════════════════════════════════════════════════════════ */
      page = 1;
      doc.setFillColor(...T.ivory); doc.rect(0, 0, PW, PH, 'F');
      // Réserve blanche pour la zone de données (contraste papier)
      doc.setFillColor(...T.paper); doc.rect(0, 118, PW, PH - 118, 'F');
      // Filet or vertical de marge
      doc.setFillColor(...T.gold); doc.rect(M, 22, 22, 1.1, 'F');

      // ── Émetteur ──
      let cy = 30;
      if (identity.logo) {
        try { doc.addImage(identity.logo, 'PNG', M, cy - 4, 18, 14, 'logo', 'MEDIUM'); } catch (err) {}
      }
      const brandX = identity.logo ? M + 23 : M;
      serif('bold', 12); col(T.green);
      doc.text(identity.cabinet || identity.conseiller || 'ImmoSim', brandX, cy + 3);
      cy += 7;
      if (identity.conseiller && identity.cabinet) {
        sans('normal', 7.4); col(T.ink3);
        doc.text(identity.conseiller + (identity.titre ? ' — ' + identity.titre : ''), brandX, cy); cy += 4.2;
      }
      const contacts = [identity.tel, identity.email, identity.web].filter(Boolean).join('   ·   ');
      if (contacts) { sans('normal', 6.8); col(T.ink4); doc.text(contacts, brandX, cy); }

      caps('Dossier d\'analyse', RR, 32, 6.2, T.ink3, 'bold', 1.2, 'right');
      caps('patrimoniale', RR, 36.5, 6.2, T.ink3, 'normal', 1.2, 'right');

      hair(46, M, RR, T.rule, 0.25);

      // ── Titre ──
      serif('bold', 34); col(T.title);
      doc.text(String(r.typeBien || 'Bien immobilier').toUpperCase(), M, 68);
      if (r.ville) { serif('italic', 19); col(T.gold2); doc.text(r.ville, M, 79); }

      const meta = [];
      if (r.surface) meta.push(r.surface + ' m²');
      if (r.dpe) meta.push('DPE ' + r.dpe);
      if (r.pa) meta.push(e(r.pa));
      if (r.surface && r.pa) meta.push(fmt(r.pa / r.surface) + ' \u20AC/m²');
      // NB : l'inter-lettrage jsPDF altère les glyphes étendus (m²) — on s'en passe ici.
      sans('normal', 8.4); col(T.ink3);
      doc.text(meta.join('     ·     '), M, 88);

      // ── Cadran de score ──
      {
        const cx = RR - 21, cyy = 72, rad = 17;
        arc(cx, cyy, rad, 130, 410, tint(T.ink3, 0.72), 2.6);
        const ratio = Math.max(0, Math.min(1, (r.score || 0) / 100));
        arc(cx, cyy, rad, 130, 130 + 280 * ratio, scC, 2.6);
        serif('bold', 21); col(T.ink);
        doc.text(String(Math.round(r.score)), cx, cyy + 2, { align: 'center' });
        caps('/ 100', cx, cyy + 7.5, 5.2, T.ink4, 'normal', 0.8, 'center');
        caps(scLbl, cx, cyy + 25, 6.2, scC, 'bold', 1, 'center');
      }

      // ── Description ──
      const descTxt = _tx('description');
      if (descTxt) {
        doc.setFillColor(...T.gold); doc.rect(M, 96, 0.8, 12, 'F');
        serif('italic', 9.4); col(T.ink2);
        doc.text(doc.splitTextToSize('« ' + descTxt + ' »', CW - 40).slice(0, 3), M + 5, 100.5, { lineHeightFactor: 1.3 });
      }

      // ── Chiffres clés (grille 3×2, filets seulement) ──
      {
        const cells = [
          { v: e(r.coutTotal), l: 'Coût total du projet', c: T.ink },
          { v: p(r.rentBrute), l: 'Rentabilité brute', c: T.ink },
          { v: p(r.rentNette), l: 'Rentabilité nette', c: T.ink },
          { v: e(r.cfApres) + ' /mois', l: 'Cash-flow après impôt', c: r.cfApres >= 0 ? T.pos : T.neg },
          { v: e(r.mensFin) + ' /mois', l: 'Mensualité totale', c: T.ink },
          { v: TRI !== null ? p(TRI) : '—', l: 'TRI sur ' + r.horizon + ' ans', c: T.ink }
        ];
        const gx = CW / 3, gy = 26, y0 = 130;
        hair(y0 - 8, M, RR, T.rule, 0.3);
        cells.forEach((cl, i) => {
          const cx = M + (i % 3) * gx, cyy = y0 + Math.floor(i / 3) * gy;
          serif('bold', 14); col(cl.c);
          doc.text(cl.v, cx, cyy);
          caps(cl.l, cx, cyy + 6, 5.4, T.ink3, 'normal', 0.7);
          if (i % 3 !== 0) { doc.setDrawColor(...T.rule2); doc.setLineWidth(0.15); doc.line(cx - 5, cyy - 8, cx - 5, cyy + 9); }
        });
        hair(y0 + gy - 9, M, RR, T.rule2, 0.15);
        hair(y0 + gy + 13, M, RR, T.rule, 0.3);
      }

      // ── Recommandation fiscale ──
      {
        const regRec = first((r.bestReg && r.bestReg.res && r.bestReg.res.desc) || '');
        y = 188;
        doc.setFillColor(...tint(T.green, 0.94)); doc.rect(M, y, CW, 24, 'F');
        doc.setFillColor(...T.green); doc.rect(M, y, 1.4, 24, 'F');
        caps('Régime fiscal optimal', M + 7, y + 7, 5.8, T.green, 'bold', 1);
        serif('bold', 12.5); col(T.ink);
        doc.text(regRec.toUpperCase() || '—', M + 7, y + 15);
        sans('normal', 7); col(T.ink2);
        doc.text('Cash-flow après impôt ' + e(r.bestReg ? r.bestReg.res.cfApres : 0) + '/mois   ·   Impôt estimé ' + e(r.bestReg ? r.bestReg.res.impot : 0) + '/an', M + 7, y + 20.5);
      }

      // ── Verdict de couverture ──
      {
        const decision = (r.score >= 70 && r.cfApres >= 0 && !dpeRisk) ? 'GO sous réserve de vérifications terrain'
          : r.score >= 45 ? 'À négocier / sécuriser avant offre'
            : 'À écarter sauf forte décote ou stratégie travaux';
        y = 222;
        caps('Décision proposée', M, y, 5.8, T.ink3, 'bold', 1);
        serif('bold', 12); col(scC);
        doc.text(decision, M, y + 8.5);
      }

      // ── Repères de bas de page ──
      {
        y = 245;
        hair(y, M, RR, T.rule, 0.25);
        const rep_ = [
          ['Apport engagé', e(r.apport)],
          ['Capital emprunté', e(r.emp)],
          ['Patrimoine net à ' + r.horizon + ' ans', e(last.patriNet)]
        ];
        const gx3 = CW / 3;
        rep_.forEach((it, i) => {
          const x = M + i * gx3;
          if (i) { doc.setDrawColor(...T.rule2); doc.setLineWidth(0.15); doc.line(x - 5, y + 4, x - 5, y + 18); }
          caps(it[0], x, y + 8, 5.2, T.ink3, 'normal', 0.7);
          serif('bold', 11.5); col(T.ink);
          doc.text(it[1], x, y + 16);
        });
        hair(y + 22, M, RR, T.rule2, 0.15);
      }

      // ── Pied de couverture ──
      hair(272, M, RR, T.rule, 0.25);
      sans('normal', 6.2); col(T.ink4);
      const dCover = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.text('Dossier édité le ' + dCover + '  ·  Document indicatif, non contractuel', M, 276.5);
      serif('normal', 8); col(T.gold2);
      doc.text('1 / ' + TOTAL, RR, 276.8, { align: 'right' });

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — SOMMAIRE & LECTURE EXPRESS
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('I', 'Sommaire du dossier', {
        note: 'La première partie sert à décider rapidement : score, cash-flow, financement et risques. Les pages suivantes détaillent les hypothèses, la fiscalité, le crédit, les projections et les points de vérification avant offre.'
      });

      tHead([
        { label: '', x: M, align: 'left' },
        { label: 'Contenu', x: M + 12, align: 'left' },
        { label: 'Utilité', x: M + 78, align: 'left' }
      ]);
      [
        ['01', 'Synthèse investisseur', 'Score, rentabilité, cash-flow, financement, scénarios.'],
        ['02', 'Identification et acquisition', 'Prix, frais, travaux, ville, DPE et description.'],
        ['03', 'Exploitation locative', 'Loyers, vacance, impayés, charges, rentabilité.'],
        ['04', 'Cash-flow et calendrier', 'Flux mensuels, bilan annuel, saisonnalité des charges.'],
        ['05', 'Fiscalité et régimes', 'Micro, réel, LMNP, SCI IR et SCI IS comparés.'],
        ['06', 'Capacité bancaire', 'Stress loyer retenu, HCSF et méthode différentielle.'],
        ['07', 'Projection long terme', 'Amortissement, flux annuels, patrimoine et revente.'],
        ['08', 'Décision investisseur', 'Points forts, alertes, checklist et négociation.'],
        ['09', 'Score et synthèse', 'Grille de notation détaillée et récapitulatif.']
      ].forEach(t => tRow(t, { colors: [T.gold2, T.ink, T.ink3] }));
      y += 6;

      section('II', 'Lecture express en 60 secondes');
      {
        const items = [
          { l: 'Cash-flow après impôt', v: e(r.cfApres) + '/mois', ok: r.cfApres >= 0, warn: r.cfApres > -150, n: 'Indicateur central : le bien s\'autofinance-t-il réellement ?' },
          { l: 'Rentabilité nette', v: p(r.rentNette), ok: r.rentNette >= 5.5, warn: r.rentNette >= 3.5, n: 'À comparer au secteur, au risque locatif et à l\'effort d\'épargne accepté.' },
          { l: 'Performance énergétique', v: r.dpe ? 'Classe ' + r.dpe : 'Non renseigné', ok: ['A', 'B', 'C', 'D'].includes(r.dpe), warn: r.dpe === 'E', n: 'DPE F/G : risque réglementaire, travaux et vacance plus élevés.' },
          { l: 'Effet de levier', v: r.apport > 0 ? p(r.cfAvant * 12 / r.apport * 100) : 'Apport nul', ok: r.apport > 0 && (r.cfAvant > 0), warn: r.cfAvant > -100, n: 'Rendement du cash réellement immobilisé.' },
          { l: 'Résistance au stress bancaire', v: e(cfStress70) + '/mois', ok: cfStress70 >= 0, warn: cfStress70 > -150, n: 'Cash-flow si la banque ne retient que 70 % du loyer.' },
          { l: 'Régime fiscal conseillé', v: first(r.bestReg && r.bestReg.res ? r.bestReg.res.desc : '—'), ok: true, n: 'À confirmer avec un expert-comptable si le dossier passe en offre.' }
        ];
        items.forEach(it => {
          const c = it.ok ? T.pos : (it.warn ? T.warn : T.neg);
          need(15);
          doc.setFillColor(...c); doc.rect(M, y - 2.6, 1.6, 8.6, 'F');
          sans('bold', 8); col(T.ink);
          doc.text(it.l, M + 5.5, y + 0.6);
          serif('bold', 10); col(c);
          doc.text(it.v, RR, y + 1, { align: 'right' });
          serif('italic', 7.6); col(T.ink3);
          doc.text(it.n, M + 5.5, y + 5.4);
          y += 11.5;
          hairDot(y - 3);
        });
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — SYNTHÈSE INVESTISSEUR
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('01', 'Synthèse investisseur');

      // Chiffres clés
      {
        const cells = [
          { v: p(r.rentBrute), l: 'Rentabilité brute', c: T.ink },
          { v: p(r.rentNette), l: 'Rentabilité nette', c: T.ink },
          { v: e(r.cfApres), l: 'Cash-flow / mois', c: r.cfApres >= 0 ? T.pos : T.neg },
          { v: Math.round(r.score) + '/100', l: 'Score global', c: scC }
        ];
        const gx = CW / 4;
        cells.forEach((cl, i) => stat(M + i * gx, y, gx, cl.v, cl.l, cl.c, 13.5));
        y += 20;
        hair(y, M, RR, T.rule2, 0.15); y += 7;
      }

      // Répartition du financement
      subTitle('Répartition du financement');
      {
        const ratio = r.coutTotal > 0 ? r.apport / r.coutTotal : 0;
        const bw = CW, bh = 7;
        doc.setFillColor(...T.green); doc.rect(M, y, bw * ratio, bh, 'F');
        doc.setFillColor(...tint(T.gold, 0.35)); doc.rect(M + bw * ratio, y, bw * (1 - ratio), bh, 'F');
        if (ratio > 0.10) { caps('Apport ' + p(ratio * 100, 1), M + 3, y + 4.6, 5.4, T.white, 'bold', 0.6); }
        caps('Emprunt ' + p((1 - ratio) * 100, 1), M + bw * ratio + 3, y + 4.6, 5.4, T.gold2, 'bold', 0.6);
        y += bh + 6;
        const leg = [
          { c: T.green, t: 'Apport ' + e(r.apport) },
          { c: tint(T.gold, 0.35), t: 'Emprunt ' + e(r.emp) },
          { c: T.neg, t: 'Intérêts totaux ' + e(totalInt) }
        ];
        let lx = M;
        leg.forEach(l => {
          doc.setFillColor(...l.c); doc.rect(lx, y - 2.2, 2.4, 2.4, 'F');
          sans('normal', 7); col(T.ink2); doc.text(l.t, lx + 4, y);
          lx += doc.getTextWidth(l.t) + 16;
        });
        y += 9;
      }

      // Décomposition du cash-flow
      subTitle('Décomposition du cash-flow mensuel');
      {
        const items = [
          { l: 'Loyer', v: r.loyerM, c: T.pos },
          { l: 'Crédit', v: -r.mensFin, c: T.neg },
          { l: 'Charges', v: -r.charges / 12, c: T.neg },
          { l: 'Impôt', v: -r.impot / 12, c: T.neg },
          { l: 'Cash-flow net', v: r.cfApres, c: r.cfApres >= 0 ? T.pos : T.neg }
        ];
        const maxV = Math.max(...items.map(i => Math.abs(i.v)), 1);
        const zone = 19, gapc = 10, bw = (CW - gapc * 4) / 5;
        need(zone * 2 + 24);
        const zeroY = y + zone + 5;
        hairDot(zeroY);
        items.forEach((it, i) => {
          const x = M + i * (bw + gapc);
          const h = Math.min(zone, (Math.abs(it.v) / maxV) * zone);
          const top = it.v >= 0 ? zeroY - h : zeroY;
          doc.setFillColor(...(i === 4 ? it.c : tint(it.c, 0.28)));
          doc.rect(x, top, bw, Math.max(0.6, h), 'F');
          serif('bold', 8.2); col(it.c);
          doc.text(e(it.v), x + bw / 2, it.v >= 0 ? top - 2.4 : top + h + 4.2, { align: 'center' });
          caps(it.l, x + bw / 2, zeroY + zone + 10, 5.3, T.ink3, 'normal', 0.6, 'center');
        });
        y = zeroY + zone + 15;
      }

      // Détail du score
      subTitle('Grille de notation');
      {
        const vac = _vn('vacance');
        const ratioML = r.mensFin / Math.max(1, r.loyerM);
        const crit = [
          { l: 'Rentabilité brute', pts: r.rentBrute >= 8 ? 25 : r.rentBrute >= 6 ? 17 : r.rentBrute >= 4 ? 8 : 2, max: 25 },
          { l: 'Cash-flow avant impôt', pts: r.cfAvant > 200 ? 20 : r.cfAvant > 0 ? 12 : r.cfAvant > -200 ? 4 : 0, max: 20 },
          { l: 'Performance énergétique', pts: ({ A: 15, B: 13, C: 10, D: 7, E: 4, F: 1, G: 0 }[r.dpe] || 5), max: 15 },
          { l: 'Vacance locative', pts: vac <= 3 ? 12 : vac <= 7 ? 8 : vac <= 12 ? 4 : 0, max: 12 },
          { l: 'Ratio mensualité / loyer', pts: ratioML < 0.6 ? 13 : ratioML < 0.8 ? 8 : ratioML < 1 ? 4 : 0, max: 13 }
        ];
        if (city && city._attrScore) {
          const a = city._attrScore;
          crit.push({ l: 'Attractivité de la ville', pts: a >= 75 ? 15 : a >= 60 ? 10 : a >= 45 ? 5 : 1, max: 15 });
        }
        crit.forEach(c => {
          const ratio = c.pts / c.max;
          const cc = ratio >= 0.7 ? T.pos : ratio >= 0.4 ? T.warn : T.neg;
          need(9);
          sans('normal', 7.4); col(T.ink2);
          doc.text(c.l, M, y);
          gauge(M + 62, y - 2.4, CW - 82, 2.8, ratio, cc);
          serif('bold', 8.2); col(cc);
          doc.text(c.pts + ' / ' + c.max, RR, y, { align: 'right' });
          y += 7.2;
        });
        y += 2;
      }

      // Scénarios
      if (typeof G('calcMens', null) === 'function') {
        subTitle('Scénarios de sensibilité', 42);
        const scens = [
          { name: 'Optimiste', lm: 1.05, vm: 0.5, td: -0.3, c: T.pos },
          { name: 'Réaliste', lm: 1, vm: 1, td: 0, c: T.gold2 },
          { name: 'Pessimiste', lm: 0.9, vm: 2, td: 0.5, c: T.neg }
        ];
        const gw = CW / 3;
        need(34);
        const y0 = y;
        scens.forEach((sc, i) => {
          const x = M + i * gw;
          const ly = r.loyerM * sc.lm;
          const adjT = Math.max(0.1, r.tauxPret + sc.td);
          const adjM = calcMens(r.emp, adjT, r.dureePret);
          const mm = (_el('mensManuelle') && _el('mensManuelle').value.trim()) ? _vn('mensManuelle') : adjM + assM;
          const vac = _vn('vacance') * sc.vm;
          const revN = ly * 12 * (1 - vac / 100 - (_vn('impayes') || 0) / 100);
          const cf = (revN - r.charges) / 12 - mm;
          if (i > 0) { doc.setDrawColor(...T.rule2); doc.setLineWidth(0.15); doc.line(x - 4, y0 - 2, x - 4, y0 + 28); }
          doc.setFillColor(...sc.c); doc.rect(x, y0 - 1, 6, 0.7, 'F');
          caps(sc.name, x, y0 + 3.5, 6, sc.c, 'bold', 1);
          const rows = [['Loyer', e(ly)], ['Taux', p(adjT)], ['Mensualité', e(mm)]];
          rows.forEach((rw, j) => {
            sans('normal', 6.8); col(T.ink3); doc.text(rw[0], x, y0 + 10 + j * 4.8);
            serif('normal', 8); col(T.ink2); doc.text(rw[1], x + gw - 8, y0 + 10 + j * 4.8, { align: 'right' });
          });
          hairDot(y0 + 22.5, x, x + gw - 8);
          sans('bold', 6.8); col(T.ink); doc.text('Cash-flow', x, y0 + 27);
          serif('bold', 10); col(cf >= 0 ? T.pos : T.neg);
          doc.text(e(cf), x + gw - 8, y0 + 27.5, { align: 'right' });
        });
        y = y0 + 33;
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — PHOTOS
         ══════════════════════════════════════════════════════════════════════ */
      if (PHOTOS_ && PHOTOS_.length) {
        newPage();
        section('—', 'Photographies du bien');
        const pw = (CW - 6) / 2, ph = 52;
        let px = M, py = y;
        PHOTOS_.forEach((p_, i) => {
          if (py + ph + 8 > BOT) { newPage(); py = y; px = M; }
          try {
            doc.addImage('data:' + p_.mime + ';base64,' + p_.b64, (p_.mime || '').includes('png') ? 'PNG' : 'JPEG', px, py, pw, ph, undefined, 'MEDIUM');
            doc.setDrawColor(...T.rule); doc.setLineWidth(0.2); doc.rect(px, py, pw, ph, 'S');
            caps(String(p_.name || '').substring(0, 30), px, py + ph + 4, 5.2, T.ink4, 'normal', 0.6);
          } catch (err) { console.warn('Photo ignorée', err); }
          if (i % 2 === 1) { py += ph + 12; px = M; } else { px = M + pw + 6; }
        });
        y = py + (PHOTOS_.length % 2 === 1 ? ph + 12 : 0) + 4;
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — IDENTIFICATION & ACQUISITION
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('02', 'Identification du bien');
      kv('Type de bien', r.typeBien || '—');
      kv('Ville', r.ville || '—');
      if (_tx('codePostal')) kv('Code postal', _tx('codePostal'));
      kv('Surface habitable', r.surface ? r.surface + ' m²' : '—');
      kv('Diagnostic de performance énergétique', r.dpe ? 'Classe ' + r.dpe : '—',
        { color: ['A', 'B', 'C'].includes(r.dpe) ? T.pos : ['E', 'F', 'G'].includes(r.dpe) ? T.neg : T.ink });
      kv('Type de location', { nue: 'Location nue (longue durée)', meublee: 'Location meublée (LMNP)', courte: 'Location courte durée' }[r.isCD ? 'courte' : (_tx('typeLoc') || 'nue')] || '—');
      kv('Ancienneté', _tx('anciennete') === 'neuf' ? 'Neuf / VEFA' : 'Ancien (> 5 ans)');

      if (city) {
        const dCode = (city.departement && city.departement.code) || '';
        const d = DEPT[dCode] || null;
        if (city.population) kv('Population de la commune', fmt(city.population) + ' hab.');
        if (d) {
          kv('Taux de chômage (département)', d[0] + ' %', { color: d[0] < 7 ? T.pos : d[0] < 10 ? T.warn : T.neg });
          kv('Part d\'étudiants (département)', d[1] + ' %');
          kv('Revenu médian (département)', e(d[2]) + '/an');
          kv('Prix moyen au m² (département)', e(d[3]) + '/m²', { color: T.cool });
          kv('Tendance des prix', (d[4] > 0 ? '+' : '') + d[4] + ' %/an', { color: d[4] > 1 ? T.pos : d[4] >= 0 ? T.warn : T.neg });
        }
        if (city._attrScore) {
          const a = city._attrScore;
          kv('Score d\'attractivité', a + '/100 — ' + (a >= 75 ? 'Excellent' : a >= 60 ? 'Attractif' : a >= 45 ? 'Correct' : 'Peu attractif'),
            { color: a >= 70 ? T.pos : a >= 45 ? T.warn : T.neg, strong: true });
        }
      }
      if (descTxt) { y += 2; callout('Notes du dossier', descTxt, T.gold); }

      /* ── Composition de l'immeuble (mode multi-lots) ────────────────── */
      if (Array.isArray(r.lots) && r.lots.length) {
        const L = r.lots;
        const tot = L.reduce((a, l) => ({
          surf: a.surf + (+l.surf || 0),
          loyer: a.loyer + (+l.loyer || 0),
          cc: a.cc + (+l.cc || 0),
          trav: a.trav + (+l.travaux || 0)
        }), { surf: 0, loyer: 0, cc: 0, trav: 0 });
        const loues = L.filter(l => !l.statut || l.statut === 'Loué').length;
        const detaille = L.some(l => l.etage || l.statut || l.cc);

        section('', 'Composition de l\'immeuble', {
          keep: 40 + L.length * 6,
          note: L.length + ' lots. Les charges CC sont des provisions récupérables sur les locataires : '
            + 'elles ne constituent pas un revenu et n\'entrent pas dans le calcul de rentabilité.'
        });
        tHead([
          { label: 'Lot', x: M, align: 'left' },
          { label: detaille ? 'Étage' : '', x: M + 42, align: 'left' },
          { label: 'Type', x: M + 62, align: 'left' },
          { label: 'Surface', x: M + 108, align: 'right' },
          { label: 'Loyer HC', x: M + 138, align: 'right' },
          { label: detaille ? 'Statut' : 'Vacance', x: RR, align: 'right' }
        ], 22 + L.length * 6);
        L.forEach(l => {
          const vacant = l.statut === 'Vacant';
          tRow([
            l.nom || '\u2014',
            detaille ? (l.etage || '\u2014') : '',
            (l.type || '\u2014') + (l.dpe ? '  ·  DPE ' + l.dpe : ''),
            (+l.surf ? l.surf + ' m²' : '\u2014'),
            e(+l.loyer || 0),
            detaille ? (l.statut || '\u2014') : p(+l.vacance || 0, 0)
          ], { colors: [T.ink, T.ink4, T.ink2, T.ink2, T.pos, vacant ? T.neg : T.ink3] });
        });
        COLS[4].tcolor = T.pos;
        tTotal(['Total', '', L.length + ' lots', tot.surf ? tot.surf + ' m²' : '\u2014', e(tot.loyer), '']);

        kv('Loyer annuel hors charges', e(tot.loyer * 12), { color: T.pos });
        if (tot.cc > 0) kv('Provisions pour charges encaissées', e(tot.cc) + '/mois', { color: T.ink3 });
        if (tot.surf > 0) kv('Loyer moyen au mètre carré', fmt(tot.loyer / tot.surf, 2) + ' \u20AC', { color: T.gold2 });
        kv('Lots occupés', loues + ' sur ' + L.length + '  (' + p(loues / L.length * 100, 0) + ')',
          { color: loues === L.length ? T.pos : loues / L.length >= 0.8 ? T.warn : T.neg });
        if (tot.trav > 0) kv('Travaux identifiés par lot', e(tot.trav), { color: T.warn });
        y += 4;

        const vacants = L.filter(l => l.statut === 'Vacant');
        if (vacants.length) {
          callout('Lots vacants',
            vacants.length + ' lot(s) sans locataire : ' + vacants.map(l => l.nom).join(', ')
            + '. Le loyer retenu au dossier suppose leur relocation. Faire préciser au vendeur '
            + 'depuis quand ils sont vides et pourquoi : une vacance longue signale un problème de prix, d\'état ou d\'emplacement.',
            T.warn);
        }
        const notes = L.filter(l => l.note);
        if (notes.length) {
          subTitle('Observations par lot', 14 + notes.length * 8);
          notes.forEach(l => {
            const nl = doc.splitTextToSize(l.note, CW - 40);
            need(nl.length * 4 + 4);
            sans('bold', 7.2); col(T.ink);
            doc.text(l.nom, M, y);
            serif('italic', 7.6); col(T.ink2);
            doc.text(nl, M + 36, y, { lineHeightFactor: 1.25 });
            y += Math.max(6, nl.length * 4 + 2.5);
            hairDot(y - 2.4);
          });
          y += 4;
        }
      }

      section('', 'Coût d\'acquisition');
      if (r.negoPct > 0) {
        kv('Prix affiché', e(r.prixAffiche));
        kv('Négociation obtenue (' + r.negoPct + ' %)', '- ' + e(r.prixAffiche - r.pa), { color: T.pos });
      }
      kv('Prix d\'achat retenu', e(r.pa), { color: T.ink, strong: true });
      kv('Frais de notaire (' + (_tx('anciennete') === 'neuf' ? '≈ 3 % neuf' : '≈ 8,5 % ancien') + ')', e(r.notaire || (G('getNotaire', () => 0))()));
      kv('Frais d\'agence', e(r.fa));
      if (r.tr > 0) kv('Travaux', e(r.tr));
      if (r.am > 0) kv('Ameublement et équipement', e(r.am));
      if (r.af > 0) kv('Autres frais', e(r.af));
      kvTotal('Coût total du projet', e(r.coutTotal));

      section('', 'Plan de financement');
      kv('Apport personnel', e(r.apport), { color: T.green });
      kv('Montant emprunté', e(r.emp));
      kv('Taux d\'intérêt annuel', p(r.tauxPret));
      kv('Durée du prêt', r.dureePret + ' ans');
      kv('Assurance emprunteur', e(assM) + '/mois');
      kv('Mensualité hors assurance', e(r.mensHAss) + '/mois');
      kvTotal('Mensualité totale', e(r.mensFin) + ' /mois', T.ink);
      kv('Coût total du crédit (capital + intérêts)', e(totalRemb));
      kv('Total des intérêts payés', e(totalInt), { color: T.neg });
      kv('Couverture de la mensualité par le loyer', r.loyerM > 0 ? p(r.loyerM / r.mensFin * 100, 1) : '—',
        { color: r.loyerM / Math.max(1, r.mensFin) >= 1.2 ? T.pos : r.loyerM >= r.mensFin ? T.warn : T.neg, rule: false });

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — EXPLOITATION LOCATIVE
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('03', 'Revenus locatifs');
      if (!r.isCD) {
        kv('Loyer mensuel hors charges', e(r.loyerM) + '/mois');
        kv('Loyer annuel brut', e(r.loyerAn));
        kv('Taux de vacance locative', p(_vn('vacance')));
        kv('Taux d\'impayés provisionné', p(_vn('impayes')));
        kv('Revalorisation annuelle du loyer (IRL)', p(r.irlTaux));
        kvTotal('Revenus effectifs annuels', e(r.loyerAn * (1 - _vn('vacance') / 100 - _vn('impayes') / 100)), T.pos);
      } else {
        kv('Mode d\'exploitation', 'Courte durée (saisonnière)');
        kv('Prix à la nuitée', e(_vn('prixNuit')));
        kv('Taux d\'occupation', p(_vn('occup')));
        kv('Commission plateforme', p(_vn('commPlat')));
        kv('Frais de ménage par séjour', e(_vn('fraisMenage')));
        kv('Séjours estimés par mois', String(_vn('nbSejours')));
        kv('Conciergerie', e(_vn('concierge')) + '/mois');
        kvTotal('Revenu net mensuel estimé', e(r.loyerM) + ' /mois', T.pos);
      }

      section('', 'Charges annuelles');
      [
        ['Taxe foncière', _vn('taxeFonc')],
        ['Assurance propriétaire non occupant', _vn('assurPNO')],
        ['Charges de copropriété non récupérables', _vn('chargesCopro')],
        ['Frais de gestion locative', _vn('fraisGestion')],
        ['Entretien et réparations', _vn('entretien')],
        ['Comptabilité / expert-comptable', _vn('compta')],
        ['Autres charges', _vn('autresCharges')]
      ].forEach(c => { if (c[1] > 0) kv(c[0], e(c[1])); });
      kvTotal('Total des charges annuelles', e(r.charges), T.neg);
      kv('Soit mensualisées', e(r.charges / 12) + '/mois', { color: T.neg, rule: false });
      y += 4;

      section('', 'Résultats de rentabilité');
      kv('Revenu locatif annuel brut', e(r.loyerAn));
      kv('Revenus nets après vacance et impayés', e(r.loyerAn * (1 - (r.isCD ? 0 : _vn('vacance') / 100 + _vn('impayes') / 100))));
      kv('Revenus nets après charges', e(r.revNC));
      kvTotal('Rentabilité brute', p(r.rentBrute));
      if (r.rentBruteBase) {
        kv('Base de calcul retenue', r.rentBruteBase, { color: T.ink3, tight: true });
        if (r.rentBruteCoutTotal !== undefined) {
          kv('Pour mémoire, rapportée au coût total', p(r.rentBruteCoutTotal), { color: T.ink3, tight: true });
        }
      }
      kv('Rentabilité nette (hors impôts)', p(r.rentNette), { color: T.ink, strong: true, rule: false });
      y += 6;

      // Échelle de rentabilité
      {
        need(30);
        const avis = r.rentBrute >= 8 ? 'Excellent' : r.rentBrute >= 6 ? 'Bon' : r.rentBrute >= 4 ? 'Correct' : 'Faible';
        const ac = r.rentBrute >= 6 ? T.pos : r.rentBrute >= 4 ? T.warn : T.neg;
        caps('Positionnement de la rentabilité brute', M, y, 5.8, T.green, 'bold', 1);
        serif('bold', 10); col(ac);
        doc.text(avis, RR, y + 0.5, { align: 'right' });
        y += 7;
        const marks = [3, 4, 5, 6, 7, 8, 10];
        const lo = 3, hi = 10, bw = CW;
        doc.setFillColor(...T.ivory2); doc.rect(M, y, bw, 4, 'F');
        const pos = Math.max(0, Math.min(1, (r.rentBrute - lo) / (hi - lo)));
        doc.setFillColor(...tint(T.gold, 0.35)); doc.rect(M, y, bw * pos, 4, 'F');
        marks.forEach(m => {
          const x = M + bw * ((m - lo) / (hi - lo));
          doc.setDrawColor(...T.rule); doc.setLineWidth(0.15); doc.line(x, y, x, y + 4);
          caps(m + ' %', x, y + 8, 5.2, T.ink4, 'normal', 0.5, 'center');
        });
        // curseur
        const cxr = M + bw * pos;
        doc.setFillColor(...T.ink); doc.rect(cxr - 0.5, y - 2.5, 1, 9, 'F');
        serif('bold', 9.5); col(T.ink);
        doc.text(p(r.rentBrute), Math.min(RR - 12, Math.max(M + 8, cxr)), y - 4.5, { align: 'center' });
        y += 15;
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — CASH-FLOW
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('04', 'Cash-flow mensuel');
      kv('Loyer mensuel effectif', e(r.loyerM) + '/mois', { color: T.pos });
      kv('Mensualité de crédit (capital + intérêts)', '- ' + e(r.mensHAss) + '/mois', { color: T.neg });
      kv('Assurance emprunteur', '- ' + e(assM) + '/mois', { color: T.neg });
      kv('Charges mensualisées', '- ' + e(r.charges / 12) + '/mois', { color: T.neg });
      kvTotal('Cash-flow avant impôt', e(r.cfAvant) + ' /mois', r.cfAvant >= 0 ? T.pos : T.neg);
      kv('Impôt mensuel estimé (' + first(r.desc) + ')', '- ' + e(r.impot / 12) + '/mois', { color: T.neg });
      kvTotal('Cash-flow après impôt', e(r.cfApres) + ' /mois', r.cfApres >= 0 ? T.pos : T.neg);

      section('', 'Bilan annuel');
      kv('Loyer annuel encaissé', e(r.loyerAn), { color: T.pos });
      kv('Charges totales annuelles', '- ' + e(r.charges), { color: T.neg });
      kv('Remboursement du crédit', '- ' + e(r.mensFin * 12), { color: T.neg });
      kv('Impôt estimé', '- ' + e(r.impot), { color: T.neg });
      kvTotal('Résultat net annuel', e(r.cfApres * 12), r.cfApres >= 0 ? T.pos : T.neg);

      section('', 'Calendrier des flux sur 12 mois', {
        note: 'Répartition réelle des décaissements : les charges ponctuelles (taxe foncière, assurance, comptabilité) ne sont pas lissées.'
      });
      {
        const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const ponct = { 0: _vn('assurPNO'), 3: 200, 9: _vn('taxeFonc'), 11: _vn('compta') };
        const chMens = (r.charges - _vn('taxeFonc') - _vn('assurPNO') - _vn('compta')) / 12;
        tHead([
          { label: 'Mois', x: M, align: 'left' },
          { label: 'Loyer', x: M + 52, align: 'right' },
          { label: 'Crédit', x: M + 82, align: 'right' },
          { label: 'Charges', x: M + 112, align: 'right' },
          { label: 'Ponctuelles', x: M + 143, align: 'right' },
          { label: 'Solde', x: RR, align: 'right' }
        ], 108);   // 12 lignes + total : bloc insécable
        let tp = 0;
        MOIS.forEach((mn, i) => {
          const po = ponct[i] || 0; tp += po;
          const solde = r.loyerM - r.mensFin - chMens - po;
          tRow([mn, e(r.loyerM), '- ' + e(r.mensFin), '- ' + e(chMens), po > 0 ? '- ' + e(po) : '—', e(solde)],
            { colors: [T.ink2, T.pos, T.neg, T.ink3, po > 0 ? T.warn : T.ink4, solde >= 0 ? T.pos : T.neg] });
        });
        COLS[5].tcolor = (r.loyerM * 12 - r.mensFin * 12 - r.charges) >= 0 ? T.pos : T.neg;
        tTotal(['Total annuel', e(r.loyerM * 12), '- ' + e(r.mensFin * 12), '- ' + e(chMens * 12), '- ' + e(tp), e(r.loyerM * 12 - r.mensFin * 12 - r.charges)]);
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — FISCALITÉ
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('05', 'Paramètres fiscaux');
      kv('Tranche marginale d\'imposition', r.tmi + ' %');
      kv('Prélèvements sociaux', r.ps + ' %');
      kv('Taux global sur les revenus locatifs', (r.tmi + r.ps).toFixed(1) + ' %', { color: T.warn, strong: true });
      if (r.interets > 0) kv('Intérêts d\'emprunt déductibles', e(r.interets) + '/an');
      if (r.assurDed > 0) kv('Assurance emprunteur déductible', e(r.assurDed) + '/an');
      if (r.amort > 0) {
        kv('Amortissement de l\'immeuble', e(_vn('amortImm')) + '/an');
        kv('Amortissement du mobilier', e(_vn('amortMob')) + '/an');
        kv('Amortissement des travaux', e(_vn('amortTrav')) + '/an');
        kvTotal('Total des amortissements', e(r.amort) + ' /an', T.green);
      }

      section('', 'Comparatif des régimes fiscaux', {
        note: 'Simulation à données constantes. Le régime optimal est celui qui maximise le cash-flow après impôt.'
      });
      {
        tHead([
          { label: 'Régime fiscal', x: M, align: 'left' },
          { label: 'Revenu imposable', x: M + 96, align: 'right' },
          { label: 'Impôt annuel', x: M + 132, align: 'right' },
          { label: 'CF après impôt', x: RR, align: 'right' }
        ]);
        (r.allRes || []).forEach(x => {
          const isBest = r.bestReg && x.r === r.bestReg.r;
          const isCur = x.r === r.regime;
          const label = first(x.res.desc) + (isBest ? '   — régime optimal' : (isCur ? '   — régime actuel' : ''));
          tRow([label, e(x.res.revImp), e(x.res.impot), e(x.res.cfApres) + '/mois'], {
            strong: isBest,
            colors: [isBest ? T.gold2 : isCur ? T.cool : T.ink2, T.ink2, T.neg, x.res.cfApres >= 0 ? T.pos : T.neg]
          });
        });
        y += 5;
      }

      section('', 'Régime retenu : ' + first(r.desc));
      kv('Revenu locatif brut annuel', e(r.loyerAn));
      kv('Revenu imposable annuel', e(r.revImp));
      kv('Impôt estimé annuel', e(r.impot), { color: T.neg });
      kv('Impôt estimé mensuel', e(r.impot / 12), { color: T.neg });
      kvTotal('Cash-flow après impôt', e(r.cfApres) + ' /mois', r.cfApres >= 0 ? T.pos : T.neg);

      if (['reel-foncier', 'sci-ir'].includes(r.regime)) {
        const base = r.loyerAn - r.charges - r.interets - (r.assurDed || 0) - (r.autresDed || 0);
        if (base < 0) {
          callout('Déficit foncier détecté',
            'Déficit de ' + e(Math.abs(base)) + '/an. Imputable sur le revenu global à hauteur de 10 700 € par an, le solde étant reportable sur les revenus fonciers des dix années suivantes.',
            T.warn);
        }
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — CAPACITÉ BANCAIRE
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('06', 'Résistance au loyer retenu par la banque', {
        note: 'Les établissements ne retiennent généralement qu\'une fraction du loyer dans le calcul de la capacité d\'emprunt. Simulation à 100, 90, 80 et 70 %.'
      });
      {
        tHead([
          { label: 'Scénario', x: M, align: 'left' },
          { label: 'Loyer retenu', x: M + 92, align: 'right' },
          { label: 'CF avant impôt', x: M + 134, align: 'right' },
          { label: 'Situation', x: RR, align: 'right' }
        ]);
        [['Loyer intégral (référence)', 1], ['Loyer retenu à 90 %', 0.9], ['Loyer retenu à 80 %', 0.8], ['Loyer retenu à 70 %', 0.7]].forEach(sc => {
          const lr = r.loyerM * sc[1];
          const cf = lr - r.mensFin - r.charges / 12;
          const sit = cf > 0 ? 'Positif' : cf > -200 ? 'Sous surveillance' : 'Négatif';
          const c = cf > 0 ? T.pos : cf > -200 ? T.warn : T.neg;
          tRow([sc[0], e(lr) + '/mois', e(cf) + '/mois', sit], { strong: sc[1] === 1, colors: [T.ink2, T.cool, c, c] });
        });
        y += 6;
      }

      section('', 'Taux d\'endettement — HCSF et méthode différentielle');
      {
        const _v = id => parseFloat((_el(id) || {}).value) || 0;
        const decote = (() => {
          const rd = document.getElementsByName('simEnd_decote');
          for (let i = 0; i < rd.length; i++) if (rd[i].checked) return parseFloat(rd[i].value) / 100;
          return 0.70;
        })();
        const sal = _v('revenusMenage'), creds = _v('autresCredits');
        const primes = _v('simEnd_primes'), autres = _v('simEnd_autres');
        const mens = r.mensFin, loyer = r.loyerM;
        const dShow = Math.round(decote * 100);

        if (sal <= 0 || mens <= 0 || loyer <= 0) {
          callout('Données incomplètes',
            'Renseignez vos revenus nets mensuels dans le simulateur (section « Revenus du ménage ») pour générer l\'analyse comparative HCSF / différentielle.',
            T.ink3);
        } else {
          const revPrimes = (primes / 12) * 0.70, revAutres = autres * 0.70;
          const revTotal = sal + revPrimes + revAutres;
          const loyerNet = loyer * decote;
          const revHCSF = revTotal + loyerNet;
          const chargesHCSF = creds + mens;
          const tauxHCSF = revHCSF > 0 ? (chargesHCSF / revHCSF) * 100 : 0;
          const diff = Math.max(0, mens - loyerNet);
          const chargesDiff = creds + diff;
          const tauxDiff = revTotal > 0 ? (chargesDiff / revTotal) * 100 : 0;
          const st = t => t <= 33 ? { c: T.pos, l: 'Excellent' } : t <= 35 ? { c: T.pos, l: 'Conforme HCSF' } : t <= 39 ? { c: T.warn, l: 'Limite haute' } : { c: T.neg, l: 'Hors normes' };
          const sH = st(tauxHCSF), sD = st(tauxDiff);

          sans('normal', 7.2); col(T.ink3);
          doc.text('Décote bancaire appliquée : ' + (100 - dShow) + ' %  ·  loyer retenu ' + dShow + ' % × ' + e(loyer) + ' = ' + e(loyerNet) + '/mois', M, y);
          y += 8;

          // Deux cadrans comparés
          need(46);
          const gw = CW / 2, y0 = y;
          [[sH, tauxHCSF, 'Méthode HCSF', 'Obligatoire depuis janvier 2022'],
           [sD, tauxDiff, 'Méthode différentielle', 'Dérogatoire — moins de 4 % des dossiers']].forEach((m, i) => {
            const x = M + i * gw;
            if (i) { doc.setDrawColor(...T.rule2); doc.setLineWidth(0.15); doc.line(x - 6, y0 - 2, x - 6, y0 + 36); }
            caps(m[2], x, y0 + 3, 6, T.green, 'bold', 1);
            serif('italic', 7); col(T.ink4); doc.text(m[3], x, y0 + 8);
            serif('bold', 24); col(m[0].c);
            doc.text(fmt(m[1], 1) + ' %', x, y0 + 22);
            caps(m[0].l, x, y0 + 27.5, 6, m[0].c, 'bold', 0.9);
            // jauge avec repères 35 / 39
            const gwid = gw - 14;
            gauge(x, y0 + 31, gwid, 2.4, Math.min(m[1] / 50, 1), m[0].c);
            [[35, T.ink3], [39, T.neg]].forEach(mk => {
              const mx = x + gwid * (mk[0] / 50);
              doc.setDrawColor(...mk[1]); doc.setLineWidth(0.3); doc.line(mx, y0 + 30, mx, y0 + 34);
              caps(mk[0] + ' %', mx, y0 + 37.5, 4.8, mk[1], 'normal', 0.4, 'center');
            });
          });
          y = y0 + 44;

          // Détail ligne à ligne
          subTitle('Détail du calcul');
          tHead([
            { label: 'Poste', x: M, align: 'left' },
            { label: 'HCSF', x: M + 122, align: 'right' },
            { label: 'Différentielle', x: RR, align: 'right' }
          ]);
          tRow(['Salaires nets', e(sal), e(sal)]);
          if (primes > 0) tRow(['Primes et variable (× 70 % / 12)', e(revPrimes), e(revPrimes)]);
          if (autres > 0) tRow(['Autres revenus stables (× 70 %)', e(revAutres), e(revAutres)]);
          tRow(['Revenus de base retenus', e(revTotal), e(revTotal)], { strong: true });
          tRow(['Loyer net retenu (× ' + dShow + ' %)', '+ ' + e(loyerNet), e(diff) + ' en différentiel'], { colors: [T.ink2, T.pos, T.cool] });
          tRow(['Revenus servant au calcul', e(revHCSF), e(revTotal)], { strong: true, colors: [T.ink, T.gold2, T.gold2] });
          tRow(['Crédits en cours', '- ' + e(creds), '- ' + e(creds)], { colors: [T.ink2, T.neg, T.neg] });
          tRow(['Nouvelle mensualité (assurance incluse)', '- ' + e(mens), '- ' + e(mens)], { colors: [T.ink2, T.neg, T.neg] });
          tRow(['Compensation par le loyer', '—', '+ ' + e(Math.min(loyerNet, mens))], { colors: [T.ink2, T.ink4, T.pos] });
          tRow(['Total des charges retenues', e(chargesHCSF), e(chargesDiff)], { strong: true, colors: [T.ink, T.neg, T.neg] });
          COLS[1].tcolor = sH.c; COLS[2].tcolor = sD.c;
          tTotal(['Taux d\'endettement', fmt(tauxHCSF, 1) + ' %', fmt(tauxDiff, 1) + ' %']);

          const ok = tauxHCSF <= 35, aok = tauxHCSF <= 39;
          callout(
            ok ? 'Dossier conforme HCSF' : aok ? 'Dossier limite — entre 35 et 39 %' : 'Taux hors normes — refus probable',
            ok ? 'Le taux d\'endettement respecte la règle des 35 %. La méthode différentielle ressort à ' + tauxDiff.toFixed(1) + ' %, favorable aux investisseurs expérimentés en cas de dérogation.'
              : aok ? 'Le taux dépasse 35 %. Une dérogation bancaire est nécessaire — elle est accordée sur une minorité de dossiers, aux profils les plus solides. Méthode différentielle : ' + tauxDiff.toFixed(1) + ' %.'
                : 'Au-delà de 39 %, la plupart des établissements refuseront le financement. Leviers : augmenter l\'apport, réduire le capital emprunté, allonger la durée ou renforcer les revenus. Méthode différentielle : ' + tauxDiff.toFixed(1) + ' %.',
            ok ? T.pos : aok ? T.warn : T.neg);

          need(10);
          serif('italic', 7.2); col(T.ink3);
          doc.text('Écart entre les deux méthodes : ' + fmt(Math.abs(tauxHCSF - tauxDiff), 1) + ' points' + (tauxDiff < tauxHCSF ? ' — la méthode différentielle vous est favorable.' : ' — résultats comparables.'), M, y);
          y += 6;
        }
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — PROJECTIONS
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('07', 'Hypothèses de projection');
      kv('Durée de projection', r.horizon + ' ans');
      kv('Revalorisation annuelle du bien', p(r.revalBien));
      kv('Revalorisation annuelle du loyer (IRL)', p(r.irlTaux));
      kv('Inflation annuelle des charges', p(r.inflCharges));
      kv('Prix de revente estimé (an ' + r.horizon + ')', e(prixRev), { color: T.ink, strong: true, rule: false });
      y += 5;

      section('', 'Amortissement du crédit');
      {
        const maxY = Math.min(r.dureePret, 30);
        tHead([
          { label: 'Année', x: M, align: 'left' },
          { label: 'Intérêts', x: M + 62, align: 'right' },
          { label: 'Capital remboursé', x: M + 104, align: 'right' },
          { label: 'Capital restant dû', x: M + 146, align: 'right' },
          { label: 'CF / mois', x: RR, align: 'right' }
        ]);
        let capA = r.emp;
        const Y0 = new Date().getFullYear();
        for (let an = 1; an <= maxY; an++) {
          let iAn = 0, cAn = 0;
          for (let m = 0; m < 12; m++) { const i = Math.max(0, capA) * tauxM; iAn += i; cAn += r.mensHAss - i; capA -= r.mensHAss - i; }
          const loyer = r.loyerAn * Math.pow(1 + r.irlTaux / 100, an - 1);
          const charges = r.charges * Math.pow(1 + r.inflCharges / 100, an - 1);
          const cf = (loyer - charges) / 12 - r.mensFin;
          if (an > 1 && (an - 1) % 5 === 0) { need(8); hair(y - 3.4, M, RR, T.rule, 0.25); }
          tRow(['An ' + an + '  ·  ' + (Y0 + an - 1), e(iAn), e(cAn), e(Math.max(0, capA)), e(cf)],
            { colors: [T.ink2, T.neg, T.pos, T.cool, cf >= 0 ? T.pos : T.neg] });
        }
        y += 5;
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — FLUX ANNUELS
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('', 'Flux annuels sur ' + r.horizon + ' ans');
      {
        tHead([
          { label: 'Année', x: M, align: 'left' },
          { label: 'Loyer', x: M + 62, align: 'right' },
          { label: 'Charges', x: M + 98, align: 'right' },
          { label: 'Mensualités', x: M + 136, align: 'right' },
          { label: 'CF annuel', x: RR, align: 'right' }
        ]);
        const Y0 = new Date().getFullYear();
        proj.forEach(pr => {
          const cfAn = pr.loyer - pr.charges - r.impot - pr.mens;
          if (pr.an > 1 && (pr.an - 1) % 5 === 0) { need(8); hair(y - 3.4, M, RR, T.rule, 0.25); }
          tRow(['An ' + pr.an + '  ·  ' + (Y0 + pr.an - 1), e(pr.loyer), '- ' + e(pr.charges), '- ' + e(pr.mens), e(cfAn)],
            { colors: [T.ink2, T.pos, T.neg, T.cool, cfAn >= 0 ? T.pos : T.neg] });
        });
        y += 6;
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — GRAPHIQUES VECTORIELS
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('', 'Trajectoire patrimoniale', { note: 'Valeur du bien, capital restant dû et patrimoine net (valeur - dette + cash-flow cumulé).' });
      {
        const gx = M, gw = CW, gh = 62;
        need(gh + 24);
        const gy = y;
        const series = [
          { key: 'valBien', c: tint(T.gold, 0.25), label: 'Valeur du bien' },
          { key: 'patriNet', c: T.green, label: 'Patrimoine net' },
          { key: 'capR', c: tint(T.cool, 0.35), label: 'Capital restant dû' }
        ];
        let vmax = 0, vmin = 0;
        proj.forEach(pt => series.forEach(s => { vmax = Math.max(vmax, pt[s.key]); vmin = Math.min(vmin, pt[s.key]); }));
        vmax = vmax * 1.06 || 1;
        const sx = (i) => gx + (gw * i) / Math.max(1, proj.length - 1);
        const sy = (v) => gy + gh - ((v - vmin) / (vmax - vmin)) * gh;

        // grille
        for (let i = 0; i <= 4; i++) {
          const gv = vmin + (vmax - vmin) * i / 4;
          const yy = sy(gv);
          hair(yy, gx, gx + gw, T.rule2, 0.12);
          caps(fmt(Math.round(gv / 1000)) + ' k', gx - 2, yy + 1.2, 5, T.ink4, 'normal', 0.4, 'right');
        }
        // courbes
        series.forEach(s => {
          doc.setDrawColor(...s.c); doc.setLineWidth(s.key === 'patriNet' ? 0.9 : 0.5); cap('round');
          for (let i = 1; i < proj.length; i++) doc.line(sx(i - 1), sy(proj[i - 1][s.key]), sx(i), sy(proj[i][s.key]));
          cap('butt');
        });
        // axes X
        [1, Math.round(r.horizon / 2), r.horizon].forEach(an => {
          const i = an - 1; if (!proj[i]) return;
          caps('An ' + an, sx(i), gy + gh + 5, 5, T.ink4, 'normal', 0.4, 'center');
        });
        y = gy + gh + 10;
        // légende
        let lx = M;
        series.forEach(s => {
          doc.setFillColor(...s.c); doc.rect(lx, y - 1.8, 5, 1.2, 'F');
          sans('normal', 6.6); col(T.ink3); doc.text(s.label, lx + 7, y);
          lx += doc.getTextWidth(s.label) + 18;
        });
        y += 12;
      }

      subTitle('Cash-flow annuel');
      {
        const gx = M, gw = CW, gh = 40;
        need(gh + 16);
        const gy = y;
        const vals = proj.map(pt => pt.cfAn);
        const vhi = Math.max(0, ...vals), vlo = Math.min(0, ...vals);
        const span = (vhi - vlo) || 1;
        const zero = gy + gh * (vhi / span);          // ligne du zéro, proportionnelle
        const bw = Math.max(1.2, (gw / proj.length) * 0.6), step = gw / proj.length;
        proj.forEach((pt, i) => {
          const h = (Math.abs(pt.cfAn) / span) * gh;
          const x = gx + i * step + (step - bw) / 2;
          doc.setFillColor(...(pt.cfAn >= 0 ? tint(T.pos, 0.28) : tint(T.neg, 0.32)));
          doc.rect(x, pt.cfAn >= 0 ? zero - h : zero, bw, Math.max(0.5, h), 'F');
        });
        hairDot(zero);
        sans('normal', 5.6); col(T.ink4);
        if (vhi > 0) doc.text(e(vhi), gx - 2, gy + 1.6, { align: 'right' });
        doc.text('0', gx - 2, zero + 1.2, { align: 'right' });
        if (vlo < 0) doc.text(e(vlo), gx - 2, gy + gh + 1.2, { align: 'right' });
        // repères d'années
        [1, Math.round(r.horizon / 2), r.horizon].forEach(an => {
          const i = an - 1; if (!proj[i]) return;
          caps('An ' + an, gx + i * step + step / 2, gy + gh + 6, 5, T.ink4, 'normal', 0.4, 'center');
        });
        y = gy + gh + 12;
        serif('italic', 7.4); col(T.ink3);
        doc.text('Cash-flow annuel avant impôt sur la durée de projection — chaque barre représente une année.', M, y);
        y += 8;
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — PATRIMOINE, REVENTE, LEVIER
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('', 'Projection patrimoniale à ' + r.horizon + ' ans');
      kv('Valeur estimée du bien', e(last.valBien));
      kv('Capital restant dû', e(last.capR), { color: r.dureePret <= r.horizon ? T.pos : T.neg });
      kv('Cash-flow cumulé sur la période', e(last.cumCF), { color: last.cumCF >= 0 ? T.pos : T.neg });
      kvTotal('Patrimoine net estimé', e(last.patriNet));
      kv('Plus-value latente brute', e(last.valBien - r.pa), { color: T.ink });
      kv('Total des intérêts payés', e(proj.totalInt), { color: T.neg, rule: false });
      y += 5;

      section('', 'Jalons clés');
      {
        tHead([
          { label: 'Horizon', x: M, align: 'left' },
          { label: 'Valeur du bien', x: M + 60, align: 'right' },
          { label: 'Capital restant', x: M + 102, align: 'right' },
          { label: 'CF cumulé', x: M + 140, align: 'right' },
          { label: 'Patrimoine net', x: RR, align: 'right' }
        ]);
        [1, 3, 5, 10, 15, 20, 25, 30].filter(j => j <= r.horizon).forEach(j => {
          const pj = proj[j - 1]; if (!pj) return;
          tRow(['An ' + pj.an, e(pj.valBien), e(pj.capR), e(pj.cumCF), e(pj.patriNet)],
            { colors: [T.ink2, T.ink2, T.cool, pj.cumCF >= 0 ? T.pos : T.neg, T.gold2] });
        });
        y += 6;
      }

      section('', 'Simulation de revente');
      kv('Prix d\'achat initial', e(r.pa));
      kv('Prix de revente estimé (an ' + r.horizon + ')', e(prixRev));
      kv('Plus-value brute', e(pv), { color: pv >= 0 ? T.pos : T.neg });
      kv('Abattement pour durée de détention', p(abatt * 100) + (r.horizon >= 30 ? ' — exonération totale' : ''));
      kv('Plus-value imposable', e(pvImp));
      kv('Impôt sur la plus-value (19 % + 17,2 %)', '- ' + e(impotPV), { color: T.neg });
      kv('Frais de vente estimés (6 %)', '- ' + e(fraisVente), { color: T.neg });
      kv('Cash-flow cumulé sur la période', e(last.cumCF), { color: last.cumCF >= 0 ? T.pos : T.neg });
      kvTotal('Gain net total de l\'opération', e(gainNet), gainNet >= 0 ? T.pos : T.neg);

      section('', 'Effet de levier');
      {
        const cfComptant = (r.loyerAn - r.charges) / 12;
        const rendComptant = r.coutTotal > 0 ? (r.loyerAn - r.charges) / r.coutTotal * 100 : 0;
        const rendCredit = r.apport > 0 ? (r.cfAvant * 12 / r.apport) * 100 : 0;
        kv('Rendement en achat comptant', p(rendComptant));
        kv('Cash-flow mensuel en comptant', e(cfComptant));
        kv('Rendement à crédit (sur apport)', p(rendCredit), { color: rendCredit > rendComptant ? T.pos : T.warn });
        kv('Cash-flow mensuel à crédit', e(r.cfAvant), { color: r.cfAvant >= 0 ? T.pos : T.neg });
        kv('Liquidités préservées par le levier', e(r.coutTotal - r.apport), { color: T.cool });
        y += 2;
        callout(rendCredit > rendComptant ? 'Effet de levier positif' : 'Effet de levier négatif',
          rendCredit > rendComptant
            ? 'Le recours au crédit améliore le rendement des fonds propres tout en préservant ' + e(r.coutTotal - r.apport) + ' de liquidités.'
            : 'Au prix et au taux retenus, l\'acquisition comptant offre un meilleur rendement sur capitaux investis. Le crédit conserve toutefois l\'avantage de préserver ' + e(r.coutTotal - r.apport) + ' de liquidités mobilisables ailleurs.',
          rendCredit > rendComptant ? T.pos : T.warn);
      }

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — DÉCISION INVESTISSEUR
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('08', 'Décision investisseur');
      {
        const decision = (r.score >= 70 && r.cfApres >= 0 && !dpeRisk) ? 'GO sous réserve de vérifications terrain'
          : r.score >= 45 ? 'À négocier / sécuriser avant offre'
            : 'À écarter sauf forte décote ou stratégie travaux';
        callout(decision,
          'Recommandation automatique fondée sur le score, le cash-flow, le DPE, l\'effet de levier et la résistance du dossier à un loyer bancaire retenu à 70 %.',
          r.score >= 70 ? T.pos : r.score >= 45 ? T.warn : T.neg);
      }

      {
        const strengths = [], alerts = [];
        if (r.cfApres >= 0) strengths.push('Cash-flow après impôt positif : ' + e(r.cfApres) + '/mois.'); else alerts.push('Cash-flow après impôt négatif : ' + e(r.cfApres) + '/mois.');
        if (r.rentBrute >= 7) strengths.push('Rentabilité brute attractive : ' + p(r.rentBrute) + '.'); else alerts.push('Rentabilité brute à challenger : ' + p(r.rentBrute) + '.');
        if (r.rentNette >= 5) strengths.push('Rentabilité nette correcte : ' + p(r.rentNette) + '.'); else alerts.push('Rentabilité nette limitée après charges : ' + p(r.rentNette) + '.');
        if (r.bestReg && r.bestReg.res && r.bestReg.res.cfApres > r.cfApres + 20) alerts.push('Optimisation fiscale possible : le régime optimal améliore le cash-flow.');
        else strengths.push('Régime fiscal actuel proche de l\'optimum calculé.');
        if (dpeRisk) alerts.push('DPE ' + r.dpe + ' : risque réglementaire et travaux à anticiper.');
        else if (r.dpe) strengths.push('DPE ' + r.dpe + ' : risque énergétique modéré selon les données saisies.');
        if (debtRatio !== null) {
          if (debtRatio <= 35) strengths.push('Taux d\'endettement indicatif sous 35 % : ' + p(debtRatio, 1) + '.');
          else alerts.push('Taux d\'endettement indicatif au-dessus de 35 % : ' + p(debtRatio, 1) + '.');
        }
        if (cfStress70 >= 0) strengths.push('Stress bancaire à 70 % du loyer encore positif : ' + e(cfStress70) + '/mois.');
        else alerts.push('Stress bancaire à 70 % du loyer négatif : ' + e(cfStress70) + '/mois.');

        subTitle('Points forts');
        bullets((strengths.length ? strengths : ['Aucun point fort automatique détecté avec les données saisies.']).slice(0, 6), T.pos, 'check');
        subTitle('Alertes à traiter');
        bullets((alerts.length ? alerts : ['Aucune alerte majeure automatique détectée.']).slice(0, 6), T.neg);
      }

      section('', 'Checklist avant offre');
      {
        const items = [
          { l: 'Vérifier les loyers comparables', v: 'À faire', warn: true, n: 'Comparer 5 à 10 annonces louées similaires dans le même secteur.' },
          { l: 'Confirmer charges et taxe foncière', v: 'À faire', warn: true, n: 'Demander les trois derniers PV d\'AG, appels de charges, taxe foncière et sinistres.' },
          { l: 'Chiffrer travaux et DPE', v: dpeRisk ? 'Prioritaire' : 'Recommandé', warn: true, n: 'Obtenir des devis écrits, en particulier si DPE E, F ou G.' },
          { l: 'Contrôler le financement', v: debtRatio === null ? 'À simuler' : p(debtRatio, 1), ok: debtRatio !== null && debtRatio <= 35, warn: debtRatio === null || debtRatio <= 40, n: 'Vérifier assurance, différé, apport, frais annexes et loyer retenu par la banque.' },
          { l: 'Préparer l\'offre', v: r.negoPct ? 'Négociation saisie : ' + p(r.negoPct, 1) : 'À construire', warn: true, n: 'Appuyer la discussion sur les travaux, le DPE, la vacance, le prix au mètre carré et les comparables DVF.' }
        ];
        items.forEach(it => {
          const c = it.ok ? T.pos : it.warn ? T.warn : T.neg;
          const nl = doc.splitTextToSize(it.n, CW - 8);
          need(nl.length * 4 + 10);
          doc.setDrawColor(...c); doc.setLineWidth(0.35);
          doc.rect(M, y - 2.8, 3, 3, 'S');
          sans('bold', 7.8); col(T.ink);
          doc.text(it.l, M + 7, y);
          sans('bold', 7); col(c);
          doc.text(it.v, RR, y, { align: 'right' });
          serif('italic', 7.4); col(T.ink3);
          doc.text(nl, M + 7, y + 4.4, { lineHeightFactor: 1.25 });
          y += nl.length * 4 + 7;
          hairDot(y - 3.4);
        });
        y += 4;
      }

      /* ── Prix cible par objectif de rentabilité (module additif) ──────── */
      if (window.ImmoSimObjectif && typeof window.ImmoSimObjectif.compute === 'function') {
        const oj = window.ImmoSimObjectif.compute(r);
        if (oj && oj.rows && oj.rows.length) {
          section('', 'Prix cible par objectif de rentabilité', {
            keep: 62 + oj.rows.length * 6,   // titre, hypothèses et tableau restent groupés
            note: 'Rentabilité brute calculée hors frais de notaire, sur la base « prix d\'achat + travaux ». '
              + 'Frais d\'agence, ameublement et autres frais sont exclus du dénominateur.'
          });
          kv('Loyer annuel brut retenu', e(oj.loyerAn));
          kv('Travaux intégrés à la base', e(oj.travaux));
          kv('Prix affiché servant d\'ancrage', e(oj.prixRef));
          kv('Rentabilité brute actuelle (hors notaire)', p(oj.rentActuelle), { color: T.gold2, strong: true });
          y += 3;
          tHead([
            { label: 'Objectif', x: M, align: 'left' },
            { label: 'Prix d\'achat cible', x: M + 74, align: 'right' },
            { label: 'Décote à obtenir', x: M + 118, align: 'right' },
            { label: 'Négociation', x: M + 152, align: 'right' },
            { label: 'Statut', x: RR, align: 'right' }
          ], 20 + oj.rows.length * 6);
          oj.rows.forEach(row => {
            let statut, c;
            if (!row.faisable) { statut = 'Hors d\'atteinte'; c = T.neg; }
            else if (row.atteint) { statut = 'Atteint'; c = T.pos; }
            else if (row.negoPct > 25) { statut = 'Très exigeant'; c = T.neg; }
            else if (row.negoPct > 12) { statut = 'Exigeant'; c = T.warn; }
            else { statut = 'Négociable'; c = T.cool; }
            tRow([
              p(row.cible, 2) + ' brut',
              row.faisable ? e(row.prixCible) : '\u2014',
              row.atteint ? 'aucune' : (row.faisable ? e(row.decote) : '\u2014'),
              row.faisable && !row.atteint ? p(row.negoPct, 1) : '\u2014',
              statut
            ], { colors: [T.ink, T.gold2, T.neg, T.ink2, c] });
          });
          y += 4;
          const best = oj.rows.filter(x => x.faisable && !x.atteint).sort((a, b) => a.negoPct - b.negoPct)[0];
          if (best) {
            callout('Seuil de décision',
              'Atteindre ' + p(best.cible, 2) + ' de rentabilité brute suppose un prix d\'achat de ' + e(best.prixCible)
              + ', soit ' + p(best.negoPct, 1) + ' de négociation sur le prix affiché. Au-delà de ce prix, '
              + 'l\'objectif de rendement n\'est pas tenu, quelles que soient les conditions de financement.',
              best.negoPct > 25 ? T.neg : best.negoPct > 12 ? T.warn : T.pos);
          } else if (oj.rows.every(x => x.atteint)) {
            callout('Objectifs atteints',
              'Le prix retenu permet déjà d\'atteindre l\'ensemble des objectifs de rentabilité fixés.', T.pos);
          }
        }
      }

      /* ══════════════════════════════════════════════════════════════════
         PAGE — ARGUMENTAIRE DE NÉGOCIATION
         Page autonome, conçue pour être détachée du dossier et présentée
         au vendeur ou à l'agent. Elle croise trois sources : le prix plafond
         issu de l'objectif de rentabilité, les défauts chiffrés relevés en
         visite, et les faiblesses structurelles du bien.
         ══════════════════════════════════════════════════════════════════ */
      /* Données de l'argumentaire : calculées ici pour savoir si l'ancienne
         liste d'arguments doit être conservée ; la page est tracée en fin de
         dossier, en dernière position. */
      const arguData = (function () {
        if (window.IMMOSIM_PDF_OPTIONS && window.IMMOSIM_PDF_OPTIONS.argumentaire === false) return null;

        function visitFindings() {
          const V = window.ImmoSimVisite;
          if (!V || typeof V.state !== 'function' || !V.COMMUN) return null;
          const st = V.state();
          if (!st || !st.items) return null;
          const out = { pb: [], vig: [], cost: 0, done: 0 };
          const scan = (defs, store, scope) => defs.forEach(g => g.items.forEach(it => {
            const c = store[g.cat + '|' + it.t];
            if (!c || !c.s) return;
            out.done++;
            const entry = { label: it.t, scope: scope || 'Immeuble', note: c.n || '', cost: +c.c || 0 };
            out.cost += entry.cost;
            if (c.s === 3) out.pb.push(entry);
            else if (c.s === 2) out.vig.push(entry);
          }));
          scan(V.COMMUN, st.items, 'Immeuble');
          (st.units || []).forEach(u => scan(V.LOGEMENT, u.items || {}, u.name));
          return out.done ? out : null;
        }

        const vf = visitFindings();
        const oj = (window.ImmoSimObjectif && typeof window.ImmoSimObjectif.compute === 'function')
          ? window.ImmoSimObjectif.compute(r) : null;
        const cible = oj ? oj.rows.filter(x => x.faisable && !x.atteint).sort((a, b) => a.negoPct - b.negoPct)[0] : null;

        /* Deux catégories distinctes :
           - « opposable » : montant chiffré, devis à l'appui, qui se déduit du prix ;
           - « à provisionner » : ordre de grandeur qui s'argumente mais ne se
             déduit pas, sous peine d'aboutir à une offre invendable.
           Le DPE relève de la seconde : déduire une rénovation énergétique
           complète du prix ferait doublon avec les travaux déjà saisis et
           produirait une décote qu'aucun vendeur n'accepterait. */
        const chiffres = [];
        if (r.tr > 0) chiffres.push({ l: 'Travaux annoncés au dossier', m: r.tr, src: 'Estimation acquéreur — devis à produire', op: true });
        if (vf && vf.cost > 0) chiffres.push({ l: 'Désordres chiffrés lors de la visite', m: vf.cost, src: vf.pb.length + ' problème(s), ' + vf.vig.length + ' point(s) de vigilance', op: true });
        if (dpeRisk) {
          const brut = (r.surface || 50) * 550;
          // Ce qui excède les travaux déjà chiffrés, plafonné pour rester crédible
          const reste = Math.max(0, brut - n0(r.tr) - (vf ? vf.cost : 0));
          const estim = Math.round(Math.min(reste, (r.prixAffiche || r.pa) * 0.15) / 100) * 100;
          if (estim > 0) chiffres.push({
            l: 'Rénovation énergétique (DPE ' + r.dpe + ')', m: estim,
            src: 'À provisionner — ordre de grandeur, hors travaux déjà chiffrés', op: false
          });
        }
        const totalChiffre = chiffres.filter(c => c.op).reduce((n, c) => n + c.m, 0);
        const totalProvision = chiffres.filter(c => !c.op).reduce((n, c) => n + c.m, 0);
        const prixRef = oj ? oj.prixRef : (r.prixAffiche || r.pa);
        const offreChiffree = Math.max(0, prixRef - totalChiffre);
        const offrePlafond = cible ? cible.prixCible : null;
        const offre = offrePlafond !== null ? Math.min(offrePlafond, offreChiffree) : offreChiffree;

        if (!chiffres.length && !cible && !vf) return null;
        return { vf, oj, cible, chiffres, totalChiffre, totalProvision, prixRef, offreChiffree, offrePlafond, offre };
      })();

      if (!arguData) {
      section('', 'Arguments de négociation', { note: 'Éléments factuels issus du dossier, à opposer au vendeur. Aucun pourcentage de décote n\'est proposé : la discussion doit rester ancrée sur les faits.' });
      {
        const args = [];
        if (r.tr > 0) args.push('Travaux chiffrés à ' + e(r.tr) + ' — exiger des devis opposables et les intégrer à la discussion.');
        if (dpeRisk) args.push('DPE ' + r.dpe + ' : coût de rénovation énergétique et risque locatif réglementaire à valoriser.');
        if (r.cfApres < 0) args.push('Au prix affiché, l\'opération ne s\'autofinance pas — viser un prix permettant au moins l\'équilibre.');
        if (r.rentBrute < 6) args.push('Rentabilité brute de ' + p(r.rentBrute) + ', inférieure aux standards du marché locatif.');
        if (_vn('vacance') > 6) args.push('Vacance provisionnée à ' + p(_vn('vacance')) + ' : tension locative à documenter.');
        if (city && city._attrScore && city._attrScore < 50) args.push('Attractivité de la commune mesurée à ' + city._attrScore + '/100 — argument de liquidité à la revente.');
        try {
          if (window.ImmoSimObjectif) {
            const oj2 = window.ImmoSimObjectif.compute(r);
            const b2 = oj2 && oj2.rows.filter(x => x.faisable && !x.atteint).sort((a, b) => a.negoPct - b.negoPct)[0];
            if (b2) args.push('Objectif de ' + p(b2.cible, 2) + ' de rentabilité brute hors notaire : prix d\'achat maximal ' + e(b2.prixCible) + '.');
          }
        } catch (err) {}
        if (!args.length) args.push('Dossier solide : la négociation peut porter sur les délais, le mobilier, les frais ou les petites réparations plutôt que sur le prix.');
        bullets(args, T.gold);
      }
      }   // fin de : if (!arguData)

      /* ══════════════════════════════════════════════════════════════════════
         PAGE — SCORE & SYNTHÈSE
         ══════════════════════════════════════════════════════════════════════ */
      newPage();
      section('09', 'Score d\'investissement');
      {
        need(40);
        const cx = M + 20, cyy = y + 16;
        arc(cx, cyy, 15, 130, 410, tint(T.ink3, 0.75), 2.4);
        arc(cx, cyy, 15, 130, 130 + 280 * Math.max(0, Math.min(1, r.score / 100)), scC, 2.4);
        serif('bold', 19); col(T.ink);
        doc.text(String(Math.round(r.score)), cx, cyy + 2, { align: 'center' });
        caps('/ 100', cx, cyy + 7, 5, T.ink4, 'normal', 0.7, 'center');
        serif('bold', 15); col(scC);
        doc.text(scLbl, M + 46, y + 12);
        serif('normal', 9); col(T.ink2);
        doc.text(scDesc, M + 46, y + 19);
        gauge(M + 46, y + 23, CW - 46, 2.4, r.score / 100, scC);
        y += 40;
      }
      {
        const vac = _vn('vacance');
        const ratioML = r.mensFin / Math.max(1, r.loyerM);
        const crit = [
          { l: 'Rentabilité brute', v: p(r.rentBrute), pts: r.rentBrute >= 8 ? 25 : r.rentBrute >= 6 ? 17 : r.rentBrute >= 4 ? 8 : 2, max: 25, ok: r.rentBrute >= 6, w: r.rentBrute >= 4 },
          { l: 'Cash-flow avant impôt', v: e(r.cfAvant) + '/mois', pts: r.cfAvant > 200 ? 20 : r.cfAvant > 0 ? 12 : r.cfAvant > -200 ? 4 : 0, max: 20, ok: r.cfAvant > 0, w: r.cfAvant > -200 },
          { l: 'Performance énergétique', v: r.dpe ? 'Classe ' + r.dpe : '—', pts: ({ A: 15, B: 13, C: 10, D: 7, E: 4, F: 1, G: 0 }[r.dpe] || 5), max: 15, ok: ['A', 'B', 'C'].includes(r.dpe), w: r.dpe === 'D' },
          { l: 'Vacance locative', v: p(vac), pts: vac <= 3 ? 12 : vac <= 7 ? 8 : vac <= 12 ? 4 : 0, max: 12, ok: vac <= 5, w: vac <= 10 },
          { l: 'Ratio mensualité / loyer', v: r.loyerM > 0 ? p(ratioML * 100) : '—', pts: ratioML < 0.6 ? 13 : ratioML < 0.8 ? 8 : ratioML < 1 ? 4 : 0, max: 13, ok: ratioML < 0.7, w: ratioML < 0.85 }
        ];
        if (city && city._attrScore) {
          const a = city._attrScore;
          crit.push({ l: 'Attractivité de la ville', v: a + '/100', pts: a >= 75 ? 15 : a >= 60 ? 10 : a >= 45 ? 5 : 1, max: 15, ok: a >= 60, w: a >= 45 });
        }
        tHead([
          { label: 'Critère', x: M, align: 'left' },
          { label: 'Valeur', x: M + 108, align: 'right' },
          { label: 'Points', x: M + 138, align: 'right' },
          { label: 'Évaluation', x: RR, align: 'right' }
        ]);
        crit.forEach(c => tRow([c.l, c.v, c.pts + ' / ' + c.max, c.ok ? 'Bon' : c.w ? 'Moyen' : 'Risque'],
          { colors: [T.ink2, T.ink2, T.cool, c.ok ? T.pos : c.w ? T.warn : T.neg] }));
        y += 6;
      }

      section('', 'Synthèse exécutive');
      {
        const synth = [
          ['Bien', (r.typeBien && r.ville) ? r.typeBien + ' — ' + r.ville : (r.typeBien || r.ville || '—'), 0],
          ['Coût total du projet', e(r.coutTotal), 0],
          ['Apport personnel', e(r.apport) + '  (' + p(r.apport / Math.max(1, r.coutTotal) * 100) + ')', 0],
          ['Mensualité', e(r.mensFin) + '/mois', 0],
          ['Loyer mensuel', e(r.loyerM) + '/mois', 0],
          ['Rentabilité brute' + (r.rentBruteBase ? ' (prix + travaux)' : ''), p(r.rentBrute), 0],
          ['Rentabilité nette', p(r.rentNette), 0],
          ['Cash-flow avant impôt', e(r.cfAvant) + '/mois', 1],
          ['Régime fiscal optimal', first(r.bestReg && r.bestReg.res ? r.bestReg.res.desc : '—'), 0],
          ['Cash-flow après impôt', e(r.bestReg ? r.bestReg.res.cfApres : r.cfApres) + '/mois', 1],
          ['Score d\'investissement', Math.round(r.score) + '/100 — ' + scLbl, 1],
          ['Patrimoine net estimé (an ' + r.horizon + ')', e(last.patriNet), 1],
          ['Taux de rendement interne', TRI !== null ? p(TRI) : 'Non calculable', 1],
          ['Gain net total de l\'opération', e(gainNet), 0]
        ];
        synth.forEach(s => kv(s[0], s[1], { strong: !!s[2], color: s[2] ? T.gold2 : T.ink, tight: true }));
        y += 4;
      }

      // Avertissement
      {
        need(32);
        y += 2;
        hair(y, M, RR, T.rule, 0.3); y += 5.5;
        caps('Avertissement', M, y, 6, T.ink3, 'bold', 1.1);
        y += 5;
        serif('normal', 7.3); col(T.ink3);
        const av = 'Ce document est produit à titre indicatif par ImmoSim sur la base des données saisies par l\'utilisateur. '
          + 'Les calculs fiscaux sont simplifiés et ne tiennent pas compte de l\'ensemble des spécificités de votre situation personnelle. '
          + 'Les projections long terme reposent sur des hypothèses de marché et ne constituent en aucun cas une garantie de performance. '
          + 'Ce document ne remplace pas le conseil d\'un professionnel qualifié : notaire, expert-comptable ou conseiller en gestion de patrimoine.';
        const L = doc.splitTextToSize(av, CW);
        doc.text(L, M, y, { lineHeightFactor: 1.3 });
        y += L.length * 4 + 4;
      }

      /* ══════════════════════════════════════════════════════════════════
         DERNIÈRES PAGES — ARGUMENTAIRE ET SCORE AU PRIX NÉGOCIÉ
         ══════════════════════════════════════════════════════════════════ */
      if (arguData) {
        const vf = arguData.vf, cible = arguData.cible, chiffres = arguData.chiffres;
        const totalChiffre = arguData.totalChiffre, totalProvision = arguData.totalProvision, prixRef = arguData.prixRef;
        const offreChiffree = arguData.offreChiffree, offrePlafond = arguData.offrePlafond;
        const offre = arguData.offre;

        section('10', 'Argumentaire de négociation', {
          break: true,
          note: 'Page conçue pour être détachée du dossier. Elle ne présente que des éléments '
            + 'opposables : montants chiffrés, écarts mesurés et constats de visite.'
        });

        /* ── En-tête : prix affiché → offre, avec cadran de décote ── */
        {
          const dec = prixRef - offre;
          const decPct = prixRef > 0 ? (dec / prixRef) * 100 : 0;
          const dc = decPct > 25 ? T.neg : decPct > 12 ? T.warn : T.pos;

          need(46);
          const cx = M + 20, cyy = y + 16;
          arc(cx, cyy, 15, 130, 410, tint(T.ink3, 0.75), 2.4);
          arc(cx, cyy, 15, 130, 130 + 280 * Math.max(0, Math.min(1, decPct / 50)), dc, 2.4);
          serif('bold', 16); col(T.ink);
          doc.text(fmt(decPct, 1) + '%', cx, cyy + 2, { align: 'center' });
          caps('décote', cx, cyy + 7, 4.8, T.ink4, 'normal', 0.7, 'center');

          const bx = M + 46;
          caps('Prix affiché', bx, y + 4, 5.6, T.ink3, 'bold', 1);
          serif('normal', 15); col(T.ink3);
          doc.text(e(prixRef), bx, y + 13);
          caps('Offre argumentée', bx + 62, y + 4, 5.6, T.gold2, 'bold', 1);
          serif('bold', 17); col(T.ink);
          doc.text(e(offre), bx + 62, y + 13.5);
          sans('normal', 7.2); col(dc);
          doc.text('Écart de ' + e(dec) + ' — ' + fmt(decPct, 1) + ' % du prix affiché', bx, y + 20);
          if (decPct > 30) {
            sans('normal', 6.6); col(T.neg);
            doc.text('Décote très supérieure aux usages : à défendre par des devis, ou à revoir à la hausse.', bx, y + 24);
          }
          hair(y + 25, bx, RR, T.rule2, 0.15);
          sans('normal', 6.8); col(T.ink4);
          doc.text('Retenue : la plus basse des deux bornes ci-dessous.', bx, y + 30);
          y += 35;
        }

        /* ── Proposition, énoncée avant ses justifications ── */
        callout('Proposition',
          'Offre à ' + e(offre) + ' net vendeur, soit ' + e(prixRef - offre) + ' sous le prix affiché'
          + (totalChiffre > 0 ? ', dont ' + e(totalChiffre) + ' de travaux et désordres justifiés poste par poste' : '')
          + (offrePlafond !== null ? '. Ce prix est aussi le plafond permettant d\'atteindre ' + p(cible.cible, 2) + ' de rentabilité brute' : '')
          + '. Sous réserve des diagnostics et de l\'accord de financement.',
          T.green);

        /* ── Les deux bornes de prix ── */
        subTitle('Sur quoi repose ce prix', 34);
        {
          const bornes = [];
          if (offrePlafond !== null) bornes.push({
            l: 'Plafond de rentabilité',
            v: e(offrePlafond),
            d: 'Prix au-delà duquel l\'objectif de ' + p(cible.cible, 2) + ' de rentabilité brute '
              + '(hors frais de notaire, travaux inclus) n\'est plus atteint.'
          });
          bornes.push({
            l: 'Décote justifiée par les faits',
            v: e(offreChiffree),
            d: totalChiffre > 0
              ? 'Prix affiché diminué des ' + e(totalChiffre) + ' de travaux et désordres chiffrés, devis à l\'appui.'
              : 'Aucun montant chiffré à déduire à ce stade : la discussion porte sur le rendement.'
          });
          bornes.forEach((b, i) => {
            need(16);
            doc.setFillColor(...T.gold); doc.rect(M, y - 2.6, 1.4, 10, 'F');
            sans('bold', 7.8); col(T.ink);
            doc.text(b.l, M + 5.5, y);
            serif('bold', 11); col(T.gold2);
            doc.text(b.v, RR, y + 0.5, { align: 'right' });
            serif('italic', 7.5); col(T.ink3);
            const dl = doc.splitTextToSize(b.d, CW - 46);
            doc.text(dl, M + 5.5, y + 4.6, { lineHeightFactor: 1.25 });
            y += 5 + dl.length * 3.9 + 3.5;
          });
          y += 1;
        }

        /* ── Arguments non chiffrables ── */
        {
          const qual = [];
          if (r.cfApres < 0) qual.push('Au prix affiché, l\'opération ne s\'autofinance pas : effort d\'épargne de ' + e(Math.abs(r.cfApres)) + ' par mois.');
          if (r.rentBrute < 6) qual.push('Rentabilité brute de ' + p(r.rentBrute) + ', en deçà des standards attendus sur ce type de bien.');
          if (cfStress70 < 0) qual.push('Un établissement retenant 70 % du loyer aboutit à un flux négatif de ' + e(cfStress70) + ' par mois, ce qui pèse sur le financement.');
          if (dpeRisk) qual.push('DPE ' + r.dpe + ' : calendrier réglementaire d\'interdiction de location et travaux à programmer.');
          if (_vn('vacance') > 6) qual.push('Vacance provisionnée à ' + p(_vn('vacance')) + ' : la tension locative du secteur reste à démontrer.');
          if (city && city._attrScore && city._attrScore < 50) qual.push('Attractivité de la commune mesurée à ' + city._attrScore + '/100, ce qui pèse sur la liquidité à la revente.');
          if (qual.length) {
            subTitle('Arguments qualitatifs', 18);
            bullets(qual.slice(0, 3), T.gold);
            y -= 3;
          }
        }

        /* ── Montants opposables ── */
        if (chiffres.length) {
          subTitle('Montants opposables', 30);
          tHead([
            { label: 'Poste', x: M, align: 'left' },
            { label: 'Origine', x: M + 74, align: 'left' },
            { label: 'Montant', x: RR, align: 'right' }
          ], 20 + chiffres.length * 6);
          chiffres.forEach(c => tRow([c.l, c.src, e(c.m)],
            { colors: [c.op ? T.ink2 : T.ink4, T.ink4, c.op ? T.neg : T.ink3] }));
          COLS[2].tcolor = T.neg;
          tTotal(['Total déduit du prix', '', e(totalChiffre)]);
          if (totalProvision > 0) {
            serif('italic', 7.4); col(T.ink3);
            const lp = doc.splitTextToSize(
              'S\'y ajoutent ' + e(totalProvision) + ' à provisionner pour la mise aux normes énergétiques. '
              + 'Ce montant s\'argumente en discussion mais ne se déduit pas du prix : il recoupe en partie '
              + 'les travaux déjà chiffrés et ne constitue pas une charge opposable au vendeur.', CW);
            need(lp.length * 4 + 4);
            doc.text(lp, M, y, { lineHeightFactor: 1.3 });
            y += lp.length * 4 + 5;
          }
        }

        /* ── Constats de visite ── */
        if (vf && (vf.pb.length || vf.vig.length)) {
          const lignes = vf.pb.slice(0, 5).concat(vf.vig.slice(0, 2));
          // Le sous-titre réserve la hauteur du tableau : jamais de titre orphelin.
          subTitle('Constats relevés en visite', 34 + lignes.length * 6);
          tHead([
            { label: 'Constat', x: M, align: 'left' },
            { label: 'Localisation', x: M + 84, align: 'left' },
            { label: 'Chiffrage', x: RR, align: 'right' }
          ], 20 + lignes.length * 6);
          vf.pb.slice(0, 5).forEach(a => tRow(
            [a.label + (a.note ? ' — ' + a.note : ''), a.scope, a.cost ? e(a.cost) : '\u2014'],
            { colors: [T.neg, T.ink4, a.cost ? T.neg : T.ink4] }));
          vf.vig.slice(0, 2).forEach(a => tRow(
            [a.label + (a.note ? ' — ' + a.note : ''), a.scope, a.cost ? e(a.cost) : '\u2014'],
            { colors: [T.warn, T.ink4, a.cost ? T.warn : T.ink4] }));
          y += 3;
          serif('italic', 7.2); col(T.ink3);
          doc.text('Rouge : désordre constaté. Ambre : point de vigilance à documenter avant offre.', M, y);
          y += 4;
        }


        /* ══════════════════════════════════════════════════════════════════
           PAGE — SCORE D'INVESTISSEMENT AU PRIX NÉGOCIÉ
           Rejoue la grille de notation en supposant l'offre acceptée : le prix
           baisse, donc l'emprunt, la mensualité et le cash-flow suivent.
           Apport, loyer, charges et fiscalité sont inchangés.
           ══════════════════════════════════════════════════════════════════ */
        (function scoreNegocie() {
          const mensFn = G('calcMens', null);
          if (typeof mensFn !== 'function' || !(offre > 0) || !(r.pa > 0)) return;

          const tauxNot = r.notaire > 0 ? r.notaire / r.pa : 0.085;
          const notaire2 = offre * tauxNot;
          const coutTotal2 = offre + notaire2 + n0(r.fa) + n0(r.tr) + n0(r.am) + n0(r.af);
          const emp2 = Math.max(0, coutTotal2 - n0(r.apport));
          const mens2 = mensFn(emp2, r.tauxPret, r.dureePret) + assM;
          const rentBrute2 = coutTotal2 > 0 ? (r.loyerAn / coutTotal2) * 100 : 0;
          const rentNette2 = coutTotal2 > 0 ? (r.revNC / coutTotal2) * 100 : 0;
          const cfAvant2 = r.loyerM - mens2 - r.charges / 12;
          const cfApres2 = cfAvant2 - r.impot / 12;
          const ratio2 = r.loyerM > 0 ? mens2 / r.loyerM : 9;
          const brutHN = (offre + n0(r.tr)) > 0 ? (r.loyerAn / (offre + n0(r.tr))) * 100 : 0;

          const vac = _vn('vacance');
          const ratio1 = r.mensFin / Math.max(1, r.loyerM);
          const grille = (rb, cf, ra) => {
            const c = [
              { l: 'Rentabilité brute', pts: rb >= 8 ? 25 : rb >= 6 ? 17 : rb >= 4 ? 8 : 2, max: 25 },
              { l: 'Cash-flow avant impôt', pts: cf > 200 ? 20 : cf > 0 ? 12 : cf > -200 ? 4 : 0, max: 20 },
              { l: 'Performance énergétique', pts: ({ A: 15, B: 13, C: 10, D: 7, E: 4, F: 1, G: 0 }[r.dpe] || 5), max: 15 },
              { l: 'Vacance locative', pts: vac <= 3 ? 12 : vac <= 7 ? 8 : vac <= 12 ? 4 : 0, max: 12 },
              { l: 'Ratio mensualité / loyer', pts: ra < 0.6 ? 13 : ra < 0.8 ? 8 : ra < 1 ? 4 : 0, max: 13 }
            ];
            if (city && city._attrScore) {
              const a = city._attrScore;
              c.push({ l: 'Attractivité de la ville', pts: a >= 75 ? 15 : a >= 60 ? 10 : a >= 45 ? 5 : 1, max: 15 });
            }
            return c;
          };
          const g1 = grille(r.rentBrute, r.cfAvant, ratio1);
          const g2 = grille(rentBrute2, cfAvant2, ratio2);
          const somme = (g) => g.reduce((n, c) => n + c.pts, 0);
          const total = g1.reduce((n, c) => n + c.max, 0);
          const s1 = Math.round(r.score);   // score officiel du dossier
          const ecartPts = (somme(g2) - somme(g1)) / total * 100;
          const s2 = Math.max(0, Math.min(100, Math.round(s1 + ecartPts)));
          const lbl = (sc) => sc >= 70 ? 'Excellent' : sc >= 60 ? 'Bon' : sc >= 45 ? 'Moyen' : sc >= 30 ? 'Faible' : 'Risque';
          const cc = (sc) => sc >= 70 ? T.pos : sc >= 45 ? T.warn : T.neg;

          section('11', 'Score d\'investissement au prix négocié', {
            break: true,
            note: 'Grille de notation rejouée en supposant l\'offre acceptée. Le prix d\'achat baisse, '
              + 'donc l\'emprunt, la mensualité et le cash-flow suivent. Apport, loyer, charges et régime fiscal sont inchangés.'
          });

          /* ── Deux cadrans comparés ── */
          {
            need(48);
            const y0 = y, gw = CW / 2;
            [[s1, 'Au prix affiché', e(r.pa)], [s2, 'Au prix négocié', e(offre)]].forEach((m, i) => {
              const x = M + i * gw;
              if (i) { doc.setDrawColor(...T.rule2); doc.setLineWidth(0.15); doc.line(x - 6, y0 - 2, x - 6, y0 + 38); }
              caps(m[1], x, y0 + 3, 6, i ? T.gold2 : T.ink3, 'bold', 1);
              const cx = x + 17, cyy = y0 + 22;
              arc(cx, cyy, 14, 130, 410, tint(T.ink3, 0.75), 2.4);
              arc(cx, cyy, 14, 130, 130 + 280 * Math.max(0, Math.min(1, m[0] / 100)), cc(m[0]), 2.4);
              serif('bold', 18); col(T.ink);
              doc.text(String(m[0]), cx, cyy + 2, { align: 'center' });
              caps('/ 100', cx, cyy + 7, 4.8, T.ink4, 'normal', 0.7, 'center');
              serif('bold', 12); col(cc(m[0]));
              doc.text(lbl(m[0]), cx + 24, cyy - 3);
              sans('normal', 7.2); col(T.ink3);
              doc.text('Prix retenu ' + m[2], cx + 24, cyy + 3);
            });
            y = y0 + 46;
            const delta = s2 - s1;
            doc.setFillColor(...tint(delta > 0 ? T.pos : T.ink3, 0.93));
            doc.rect(M, y - 5, CW, 12, 'F');
            doc.setFillColor(...(delta > 0 ? T.pos : T.ink3)); doc.rect(M, y - 5, 1.4, 12, 'F');
            sans('bold', 8.4); col(delta > 0 ? T.pos : T.ink2);
            doc.text((delta > 0 ? '+ ' + delta + ' points' : delta === 0 ? 'Score inchangé' : delta + ' points')
              + '  ·  de « ' + lbl(s1) + ' » à « ' + lbl(s2) + ' »', M + 7, y + 2);
            y += 15;
          }

          /* ── Indicateurs recalculés ── */
          subTitle('Ce que change la négociation', 62);
          tHead([
            { label: 'Indicateur', x: M, align: 'left' },
            { label: 'Prix affiché', x: M + 104, align: 'right' },
            { label: 'Prix négocié', x: M + 146, align: 'right' },
            { label: 'Écart', x: RR, align: 'right' }
          ], 60);
          const cmp = (l, a, b, f, mieuxSiPlus) => {
            const d = b - a;
            const bon = mieuxSiPlus ? d > 0 : d < 0;
            tRow([l, f(a), f(b), (d > 0 ? '+' : '') + f(d)],
              { colors: [T.ink2, T.ink3, T.ink, Math.abs(d) < 1e-9 ? T.ink4 : (bon ? T.pos : T.neg)] });
          };
          cmp('Prix d\'achat', r.pa, offre, e, false);
          cmp('Frais de notaire', r.notaire || r.pa * tauxNot, notaire2, e, false);
          cmp('Coût total du projet', r.coutTotal, coutTotal2, e, false);
          cmp('Montant emprunté', r.emp, emp2, e, false);
          cmp('Mensualité', r.mensFin, mens2, e, false);
          cmp('Cash-flow avant impôt', r.cfAvant, cfAvant2, e, true);
          cmp('Cash-flow après impôt', r.cfApres, cfApres2, e, true);
          cmp('Rentabilité brute', r.rentBrute, rentBrute2, (v) => p(v), true);
          cmp('Rentabilité nette', r.rentNette, rentNette2, (v) => p(v), true);
          cmp('Ratio mensualité / loyer', ratio1 * 100, ratio2 * 100, (v) => p(v, 1), false);
          y += 5;

          /* ── Détail de la notation ── */
          subTitle('Détail de la notation', 30 + g1.length * 7);
          g1.forEach((c1, i) => {
            const c2 = g2[i];
            const gain = c2.pts - c1.pts;
            need(9);
            sans('normal', 7.4); col(T.ink2);
            doc.text(c1.l, M, y);
            gauge(M + 66, y - 2.4, CW - 96, 2.8, c1.pts / c1.max, tint(T.ink3, 0.5));
            gauge(M + 66, y - 2.4, (CW - 96) * (c2.pts / c2.max), 2.8, 1, gain > 0 ? T.pos : T.gold);
            serif('normal', 7.8); col(T.ink3);
            doc.text('(' + c1.pts + ')', RR - 15, y, { align: 'right' });
            serif('bold', 8.4); col(gain > 0 ? T.pos : T.ink);
            doc.text(c2.pts + ' / ' + c2.max, RR, y, { align: 'right' });
            y += 7.4;
          });
          y += 3;

          /* ── Conclusion ── */
          callout(
            s2 >= 60 ? 'Le prix négocié rend l\'opération solide'
              : s2 >= 45 ? 'Le prix négocié améliore le dossier sans le transformer'
                : 'Même négocié, le dossier reste fragile',
            'Au prix de ' + e(offre) + ', la rentabilité brute passe à ' + p(rentBrute2)
            + ' sur le coût total, soit ' + p(brutHN) + ' hors frais de notaire, '
            + 'et le cash-flow avant impôt à ' + e(cfAvant2) + ' par mois. '
            + (s2 >= 60
              ? 'Le score atteint ' + s2 + '/100 : l\'opération devient défendable au regard des critères retenus.'
              : s2 >= 45
                ? 'Le score atteint ' + s2 + '/100 : l\'écart avec le prix affiché est réel, mais les points faibles structurels demeurent.'
                : 'Le score plafonne à ' + s2 + '/100 : la négociation ne suffit pas à compenser les faiblesses du dossier.'),
            cc(s2), { fitBottom: true });
        })();
      }

      /* ── Enregistrement ────────────────────────────────────────────────── */
      paintFooters();
      if (doc.putTotalPages) doc.putTotalPages(TOTAL);
      const safe = String(r.ville || 'bien').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'bien';
      doc.save('ImmoSim_Dossier_' + safe + '_' + new Date().toISOString().slice(0, 10) + '.pdf');
      _toast('Dossier PDF · ' + doc.getNumberOfPages() + ' pages', 'ok');

    } catch (err) {
      console.error('[ImmoSim PDF]', err, err && err.stack);
      _toast('Erreur PDF : ' + (err && err.message ? err.message : err), 'err');
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PERSONNALISATION DES COULEURS
     Le moteur s'intègre à l'onglet « Couleurs PDF » déjà présent dans l'app :
     on enrichit PDF_COLOR_DEFS (deux jetons manquants), on réaligne les
     libellés sur le nouveau design et on ajoute des jeux de couleurs.
     ══════════════════════════════════════════════════════════════════════════ */

  const V10_PRESETS = {
    editorial: {
      pdf_accent: '#B4874B', pdf_accent2: '#8F6834', pdf_title: '#12211C', pdf_header_bg: '#FAF8F4',
      pdf_pos: '#1F6F4A', pdf_neg: '#A32F2F', pdf_info: '#34556E', pdf_warn: '#9A6B15',
      pdf_ink1: '#12211C', pdf_ink2: '#3A4A44', pdf_ink3: '#7C8A84',
      pdf_row1: '#F5F2EB', pdf_row2: '#FFFFFF', pdf_th_bg: '#EDE8DE',
      pdf_v10_structure: '#0F3D33', pdf_v10_rule: '#D6CFC2'
    },
    notarial: {
      pdf_accent: '#9A7B3F', pdf_accent2: '#6F5726', pdf_title: '#101A2C', pdf_header_bg: '#F7F8FB',
      pdf_pos: '#1E6B4F', pdf_neg: '#963232', pdf_info: '#2C4B7C', pdf_warn: '#8C6414',
      pdf_ink1: '#101A2C', pdf_ink2: '#3A4557', pdf_ink3: '#7B8598',
      pdf_row1: '#F2F4F8', pdf_row2: '#FFFFFF', pdf_th_bg: '#E6EAF2',
      pdf_v10_structure: '#1B3055', pdf_v10_rule: '#CFD6E2'
    },
    ardoise: {
      pdf_accent: '#A8552F', pdf_accent2: '#7E3D20', pdf_title: '#1C1C1B', pdf_header_bg: '#F7F5F2',
      pdf_pos: '#2F6B4C', pdf_neg: '#9B3226', pdf_info: '#4A5A63', pdf_warn: '#8E6212',
      pdf_ink1: '#1C1C1B', pdf_ink2: '#43443F', pdf_ink3: '#83857E',
      pdf_row1: '#F4F2EE', pdf_row2: '#FFFFFF', pdf_th_bg: '#E8E5DE',
      pdf_v10_structure: '#2E3330', pdf_v10_rule: '#D4D0C8'
    }
  };

  function registerThemeSystem() {
    try {
      if (typeof PDF_COLOR_DEFS === 'undefined' || !Array.isArray(PDF_COLOR_DEFS)) return false;

      // Deux jetons propres au moteur V10, absents de l'ancien système
      const extra = [
        { id: 'pdf_v10_structure', label: 'Couleur de structure', sub: 'Intertitres, en-têtes de tableau, barre d\'apport', cat: 'primary', def: '#0F3D33' },
        { id: 'pdf_v10_rule', label: 'Filets et séparateurs', sub: 'Traits de séparation, lignes de conduite', cat: 'bg', def: '#D6CFC2' }
      ];
      extra.forEach(d => { if (!PDF_COLOR_DEFS.some(x => x.id === d.id)) PDF_COLOR_DEFS.push(d); });

      // Libellés et valeurs par défaut réalignés sur le nouveau design
      const relabel = {
        pdf_accent:    ['Couleur d\'accent (or)', 'Numéros de section, chiffres clés, repères', '#B4874B'],
        pdf_accent2:   ['Accent foncé', 'Totaux, pagination, soulignements', '#8F6834'],
        pdf_title:     ['Couleur des titres', 'Titre de couverture et titres de section', '#12211C'],
        pdf_header_bg: ['Aplat de couverture', 'Bandeau haut de la première page', '#FAF8F4'],
        pdf_pos:       ['Couleur positive', 'Cash-flow positif, points forts', '#1F6F4A'],
        pdf_neg:       ['Couleur négative', 'Cash-flow négatif, alertes', '#A32F2F'],
        pdf_info:      ['Couleur financement', 'Capital, mensualités, dette', '#34556E'],
        pdf_warn:      ['Couleur avertissement', 'Points de vigilance, seuils limites', '#9A6B15'],
        pdf_ink1:      ['Texte principal', 'Valeurs, libellés forts', '#12211C'],
        pdf_ink2:      ['Texte courant', 'Libellés de lignes et de tableaux', '#3A4A44'],
        pdf_ink3:      ['Texte discret', 'Notes, légendes, pieds de page', '#7C8A84'],
        pdf_row1:      ['Fond des jauges', 'Arrière-plan des barres de progression', '#F5F2EB'],
        pdf_row2:      ['Fond de page', 'Non utilisé par le rendu éditorial', '#FFFFFF'],
        pdf_th_bg:     ['Fond secondaire', 'Réserve, aplats légers', '#EDE8DE']
      };
      PDF_COLOR_DEFS.forEach(d => {
        const rl = relabel[d.id];
        if (rl) { d.label = rl[0]; d.sub = rl[1]; d.def = rl[2]; }
      });

      // Jeux de couleurs supplémentaires
      if (typeof PDF_PRESETS !== 'undefined' && PDF_PRESETS) {
        Object.assign(PDF_PRESETS, V10_PRESETS);
        // Les anciens presets reçoivent les deux nouveaux jetons pour rester cohérents
        if (PDF_PRESETS.pro)  { PDF_PRESETS.pro.pdf_v10_structure  = '#3F3121'; PDF_PRESETS.pro.pdf_v10_rule  = '#DDD6C7'; }
        if (PDF_PRESETS.bleu) { PDF_PRESETS.bleu.pdf_v10_structure = '#1E3A8A'; PDF_PRESETS.bleu.pdf_v10_rule = '#D3DCEC'; }
        if (PDF_PRESETS.vert) { PDF_PRESETS.vert.pdf_v10_structure = '#14532D'; PDF_PRESETS.vert.pdf_v10_rule = '#CFE0D2'; }
      }
      return true;
    } catch (err) { console.warn('[ImmoSim PDF] thème non enregistré', err); return false; }
  }

  /* Boutons de jeux de couleurs ajoutés à l'onglet existant, sans toucher au HTML */
  function injectPresetButtons() {
    const pane = document.getElementById('tab-colors');
    if (!pane || pane.querySelector('#v10PresetRow')) return;
    const row = document.createElement('div');
    row.id = 'v10PresetRow';
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    row.innerHTML =
      '<button class="btn btn-p btn-sm" data-v10preset="editorial">Identité éditoriale</button>' +
      '<button class="btn btn-g btn-sm" data-v10preset="notarial">Notarial (bleu)</button>' +
      '<button class="btn btn-g btn-sm" data-v10preset="ardoise">Ardoise (terre)</button>';
    row.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-v10preset]');
      if (!b) return;
      try { applyColorPreset(b.getAttribute('data-v10preset')); } catch (err) {}
    });
    const note = document.createElement('p');
    note.style.cssText = 'font-size:.68rem;color:var(--ink3);margin-top:10px;line-height:1.45';
    note.textContent = 'Les couleurs sont appliquées au dossier PDF avec un contrôle automatique de lisibilité : '
      + 'un texte trop clair est assombri et un aplat trop sombre est éclairci, pour rester imprimable.';
    const target = pane.querySelector('div[style*="display:flex"]:last-of-type') || pane;
    target.parentNode.insertBefore(row, target.nextSibling);
    row.parentNode.insertBefore(note, row.nextSibling);
  }

  function hookColorPanel() {
    if (typeof window.buildColorRows !== 'function') return;
    const orig = window.buildColorRows;
    window.buildColorRows = function () {
      const out = orig.apply(this, arguments);
      try { injectPresetButtons(); } catch (err) {}
      return out;
    };
  }

  /* ── API programmatique ─────────────────────────────────────────────────── */
  window.ImmoSimPDFTheme = {
    defaults: THEME_DEFAULTS,
    presets: V10_PRESETS,
    /* Couleurs effectivement appliquées au dernier rendu (RVB) */
    current: () => JSON.parse(JSON.stringify(applyTheme())),
    /* Surcharge durable : ImmoSimPDFTheme.set({ accent:'#8A5A2B', structure:'#1B3055' }) */
    set: (obj) => {
      try {
        const cur = JSON.parse(localStorage.getItem('immoV10_pdfTheme') || '{}');
        localStorage.setItem('immoV10_pdfTheme', JSON.stringify(Object.assign(cur, obj || {})));
      } catch (err) {
        // Stockage indisponible : on retombe sur une surcharge en mémoire.
        window.IMMOSIM_PDF_THEME = Object.assign(window.IMMOSIM_PDF_THEME || {}, obj || {});
      }
      return applyTheme();
    },
    reset: () => {
      try { localStorage.removeItem('immoV10_pdfTheme'); } catch (err) {}
      delete window.IMMOSIM_PDF_THEME;
      return applyTheme();
    },
    apply: (name) => {
      const pr = V10_PRESETS[name];
      if (!pr) return false;
      try {
        Object.entries(pr).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
        localStorage.setItem('immoV8_pdfColors', JSON.stringify(Object.assign(
          JSON.parse(localStorage.getItem('immoV8_pdfColors') || '{}'), pr)));
        localStorage.removeItem('immoV10_pdfTheme');
        if (typeof updateColorPreview === 'function') updateColorPreview();
      } catch (err) {}
      return true;
    }
  };

  /* ── Exposition ─────────────────────────────────────────────────────────── */
  window.exportPDF = exportPDFEditorial;
  window.exportPDFEditorial = exportPDFEditorial;

  const boot = () => { registerThemeSystem(); hookColorPanel(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.info('[ImmoSim] Moteur PDF éditorial V10 actif — couleurs personnalisables via ImmoSimPDFTheme ; exportPDF_legacy() reste disponible.');
})();
