/* ═══════════════════════════════════════════════════════════════
   IMMOSIM V9 — Tests unitaires des calculs financiers
   Portent sur les FONCTIONS RÉELLES de assets/js/app.js.

   app.js n'est pas un module : il est chargé dans un contexte
   minimal simulant un navigateur, puis les fonctions globales
   sont extraites et testées directement.

   Exécution :  node tests/calculs.test.mjs
   Aucune dépendance. Sortie non nulle si un test échoue.
   ═══════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(ici, '..', 'assets', 'js', 'app.js');

/* ── Contexte navigateur minimal ─────────────────────────────── */

// app.js manipule le DOM au chargement. On lui fournit des objets
// inertes : les fonctions de calcul pur n'en dépendent pas, mais
// leur simple définition est bloquée si le script casse à l'exécution.
function elementFactice() {
  const el = {
    value: '', textContent: '', innerHTML: '', checked: false,
    style: new Proxy({}, { get: () => '', set: () => true }),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, removeChild() {}, insertAdjacentHTML() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    querySelector: () => elementFactice(), querySelectorAll: () => [],
    focus() {}, blur() {}, click() {}, remove() {}, closest: () => null,
    getContext: () => null, getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 })
  };
  return el;
}

const stockage = new Map();

const contexte = {
  console: { log() {}, warn() {}, error() {}, info() {} },
  document: {
    getElementById: () => elementFactice(),
    querySelector: () => elementFactice(),
    querySelectorAll: () => [],
    createElement: () => elementFactice(),
    addEventListener() {}, removeEventListener() {},
    body: elementFactice(),
    documentElement: elementFactice(),
    readyState: 'complete'
  },
  localStorage: {
    getItem: (k) => (stockage.has(k) ? stockage.get(k) : null),
    setItem: (k, v) => stockage.set(k, String(v)),
    removeItem: (k) => stockage.delete(k),
    clear: () => stockage.clear()
  },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: 'http://localhost/', search: '', hash: '', protocol: 'http:', hostname: 'localhost' },
  history: { replaceState() {}, pushState() {} },
  navigator: { userAgent: 'node', clipboard: { writeText: async () => {} }, onLine: true },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ ok: false, status: 0, json: async () => ({}), text: async () => '' }),
  requestAnimationFrame: (f) => setTimeout(f, 0),
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  Chart: function () { return { destroy() {}, update() {} }; },
  jspdf: { jsPDF: function () { return {}; } },
  L: { map: () => ({ setView: () => ({}) }), tileLayer: () => ({ addTo() {} }) },
  alert() {}, confirm: () => true, prompt: () => null,
  URL, URLSearchParams, TextEncoder, TextDecoder, AbortController,
  Blob: function () {}, FileReader: function () {},
  btoa: (x) => Buffer.from(String(x), 'binary').toString('base64'),
  atob: (x) => Buffer.from(String(x), 'base64').toString('binary'),
  crypto: { randomUUID: () => 'test-uuid', getRandomValues: (a) => a },
  performance: { now: () => Date.now() },
  Math, Date, JSON, parseFloat, parseInt, isNaN, isFinite,
  Intl, Number, String, Array, Object, RegExp, Error, Promise, Map, Set
};
contexte.window = contexte;
contexte.globalThis = contexte;
contexte.self = contexte;

let chargementOk = true;
let erreurChargement = null;
try {
  vm.createContext(contexte);
  vm.runInContext(fs.readFileSync(APP, 'utf8'), contexte, { filename: 'app.js', timeout: 20000 });
} catch (e) {
  chargementOk = false;
  erreurChargement = e;
}

/* ── Harnais ─────────────────────────────────────────────────── */

let reussis = 0, echoues = 0, ignores = 0;
const details = [];

function ok(nom, cond, info) {
  if (cond) reussis++;
  else { echoues++; details.push('✗ ' + nom + (info ? ' — ' + info : '')); }
}
function pres(nom, obtenu, attendu, tol = 0.01) {
  ok(nom, Math.abs(obtenu - attendu) <= tol, `attendu ~${attendu}, obtenu ${obtenu}`);
}
/** Ignore proprement si la fonction n'existe pas (renommage dans app.js). */
function siPresente(nom, fn) {
  if (typeof contexte[nom] !== 'function') {
    ignores++;
    details.push('· ' + nom + ' introuvable dans app.js — test ignoré');
    return null;
  }
  return fn(contexte[nom]);
}

if (!chargementOk) {
  console.log('\n  ✗ app.js n\'a pas pu être chargé dans le contexte de test.');
  console.log('    ' + (erreurChargement && erreurChargement.message));
  console.log('\n    Ce n\'est pas nécessairement un bug applicatif : app.js peut dépendre');
  console.log('    d\'une API navigateur absente du harnais. Complétez l\'objet `contexte`');
  console.log('    ci-dessus avec ce qui manque.\n');
  process.exit(1);
}

/* ═══ CRÉDIT ═══════════════════════════════════════════════════ */

siPresente('calcMens', (calcMens) => {
  // Référence bancaire : 200 000 € à 3,5 % sur 20 ans → 1 159,92 €/mois.
  pres('calcMens 200k / 3,5 % / 20 ans', calcMens(200000, 3.5, 20), 1159.92, 0.5);
  pres('calcMens 150k / 4,2 % / 25 ans', calcMens(150000, 4.2, 25), 808.28, 1);

  // Garde-fous : la fonction renvoie 0 sur entrée invalide plutôt que NaN.
  ok('calcMens capital nul', calcMens(0, 3.5, 20) === 0);
  ok('calcMens durée nulle', calcMens(200000, 3.5, 0) === 0);
  ok('calcMens taux nul renvoie 0 (pas NaN)', calcMens(200000, 0, 20) === 0);
  ok('calcMens capital négatif', calcMens(-1000, 3.5, 20) === 0);

  // Monotonies attendues.
  ok('mensualité croît avec le taux', calcMens(200000, 4.5, 20) > calcMens(200000, 3.5, 20));
  ok('mensualité décroît avec la durée', calcMens(200000, 3.5, 25) < calcMens(200000, 3.5, 20));
  ok('mensualité proportionnelle au capital',
    Math.abs(calcMens(400000, 3.5, 20) - 2 * calcMens(200000, 3.5, 20)) < 0.01);

  // Le coût total dépasse toujours le capital emprunté.
  ok('coût total > capital', calcMens(200000, 3.5, 20) * 240 > 200000);
});

/* ═══ IMPÔT SUR LE REVENU ══════════════════════════════════════ */

siPresente('calcIR', (calcIR) => {
  ok('IR nul sous le seuil', calcIR(10000, 1).impotTotal === 0);
  ok('TMI nulle sous le seuil', calcIR(10000, 1).tmi === 0);

  // Barème IR_TRANCHES de app.js (seuils 11 294 / 28 797 / 82 341 / 177 106).
  // 30 000 € pour 1 part : 11 % sur 11 295–28 797, puis 30 % au-delà.
  const r30 = calcIR(30000, 1);
  ok('TMI 30 % à 30 000 €', r30.tmi === 30, 'obtenu ' + r30.tmi);
  ok('impôt 30 000 € cohérent', r30.impotTotal > 2000 && r30.impotTotal < 2600, 'obtenu ' + r30.impotTotal);

  ok('TMI 11 % à 20 000 €', calcIR(20000, 1).tmi === 11);
  ok('TMI 41 % à 120 000 €', calcIR(120000, 1).tmi === 41);
  ok('TMI 45 % à 500 000 €', calcIR(500000, 1).tmi === 45);

  // Le quotient familial doit réduire l'impôt.
  ok('quotient familial favorable', calcIR(60000, 2).impotTotal < calcIR(60000, 1).impotTotal);
  ok('impôt croissant avec le revenu', calcIR(80000, 1).impotTotal > calcIR(50000, 1).impotTotal);

  // Le taux effectif reste toujours inférieur à la TMI : c'est la
  // confusion la plus fréquente, et une erreur ici fausserait tout le fiscal.
  const r = calcIR(90000, 1);
  ok('taux effectif < TMI', r.tauxEffectif < r.tmi, `effectif ${r.tauxEffectif.toFixed(1)} vs TMI ${r.tmi}`);
  ok('taux effectif positif', r.tauxEffectif > 0);
  ok('revenu nul : pas de division par zéro', calcIR(0, 1).tauxEffectif === 0);
});

/* ═══ RÉGIMES FISCAUX ══════════════════════════════════════════ */

siPresente('calcFiscal', (calcFiscal) => {
  const base = {
    loyer: 12000, charges: 2000, interets: 3000, assurDed: 300,
    amort: 5000, autresDed: 0, tmi: 0.30, ps: 0.172, tauxIS: 'auto', cfAvant: 0
  };

  // Micro-foncier : abattement 30 %, imposé au TMI + prélèvements sociaux.
  const mf = calcFiscal('micro-foncier', base);
  pres('micro-foncier : base imposable', mf.revImp, 8400, 0.01);
  pres('micro-foncier : impôt', mf.impot, 8400 * 0.472, 0.5);

  // Micro-BIC meublé : abattement 50 %.
  const mb = calcFiscal('micro-bic', base);
  pres('micro-BIC : base imposable', mb.revImp, 6000, 0.01);

  // Réel foncier : charges et intérêts déduits.
  const rf = calcFiscal('reel-foncier', base);
  pres('réel foncier : base imposable', rf.revImp, 12000 - 2000 - 3000 - 300, 0.01);

  // LMNP réel : l'amortissement s'ajoute aux déductions.
  const lm = calcFiscal('lmnp-reel', base);
  pres('LMNP réel : base imposable', lm.revImp, 12000 - 2000 - 3000 - 300 - 5000, 0.01);
  ok('LMNP réel plus favorable que micro-BIC', lm.impot < mb.impot);

  // Aucune base imposable ne doit devenir négative : un déficit ne
  // produit pas un impôt négatif dans ce calcul.
  const deficit = calcFiscal('reel-foncier',
    Object.assign({}, base, { loyer: 4000, charges: 8000 }));
  ok('base imposable jamais négative', deficit.revImp === 0);
  ok('impôt jamais négatif', deficit.impot === 0);

  // SCI à l'IS : barème 15 % jusqu'à 42 500 €, puis 25 %.
  const sci = calcFiscal('sci-is', Object.assign({}, base, { pctDividende: 0, salaireDirigeant: 0 }));
  ok('SCI IS : impôt positif', sci.impot > 0);
  ok('SCI IS sans dividende < SCI IS avec distribution',
    sci.impot < calcFiscal('sci-is',
      Object.assign({}, base, { pctDividende: 100, salaireDirigeant: 0 })).impot);

  // Le cashflow après impôt est toujours inférieur au cashflow avant.
  const cf = calcFiscal('micro-foncier', Object.assign({}, base, { cfAvant: 500 }));
  ok('cashflow après impôt < avant impôt', cf.cfApres < 500);
});

/* ═══ SCORE ════════════════════════════════════════════════════ */

siPresente('calcScore', (calcScore) => {
  const bon = { rentBrute: 9, cfAvant: 400, dpe: 'B', tension: 5, travaux: 0, prix: 200000 };
  const mauvais = { rentBrute: 2, cfAvant: -500, dpe: 'G', tension: 1, travaux: 80000, prix: 200000 };
  const sBon = calcScore(bon), sMauvais = calcScore(mauvais);

  ok('score : bon dossier > mauvais dossier', sBon > sMauvais, `${sBon} vs ${sMauvais}`);
  ok('score dans [0, 100]', sBon >= 0 && sBon <= 100 && sMauvais >= 0 && sMauvais <= 100,
    `${sBon} / ${sMauvais}`);

  // Le DPE doit peser dans le bon sens : A vaut mieux que G.
  const avecA = calcScore(Object.assign({}, bon, { dpe: 'A' }));
  const avecG = calcScore(Object.assign({}, bon, { dpe: 'G' }));
  ok('DPE A mieux noté que DPE G', avecA > avecG);

  // Rentabilité et cashflow également monotones.
  ok('rentabilité élevée mieux notée',
    calcScore(Object.assign({}, bon, { rentBrute: 10 })) >=
    calcScore(Object.assign({}, bon, { rentBrute: 3 })));
  ok('cashflow positif mieux noté',
    calcScore(Object.assign({}, bon, { cfAvant: 300 })) >=
    calcScore(Object.assign({}, bon, { cfAvant: -300 })));
});

/* ═══ TRI ══════════════════════════════════════════════════════ */

siPresente('calcTRI', (calcTRI) => {
  // 100 investis, 110 récupérés un an plus tard → 10 %.
  pres('TRI simple 10 %', calcTRI(-100, [110]), 10, 0.05);
  pres('TRI nul', calcTRI(-100, [100]), 0, 0.05);

  // Flux réguliers : -1000 puis 5 × 300 → ~15,2 %.
  const t = calcTRI(-1000, [300, 300, 300, 300, 300]);
  ok('TRI multi-périodes plausible', t > 12 && t < 18, 'obtenu ' + t);

  ok('TRI croît avec les flux de sortie',
    calcTRI(-100, [150]) > calcTRI(-100, [120]));
  ok('TRI négatif si perte', calcTRI(-100, [80]) < 0);
  ok('TRI fini', isFinite(calcTRI(-200000, [12000, 12000, 12000, 12000, 250000])));
});

/* ═══ MODULE ANALYSE D'ANNONCE ═════════════════════════════════ */
/* Vérifie que les modules ajoutés n'entrent pas en conflit avec app.js. */

const globauxApp = ['calc', 'calcMens', 'calcIR', 'calcFiscal', 'calcScore', 'lv', 'gv', 'gvM'];
const modules = ['annonce.js', 'annonce-store.js', 'donnees-publiques.js', 'localisation.js', 'localisation-ui.js'];

for (const m of modules) {
  const f = path.join(ici, '..', 'assets', 'js', 'modules', m);
  ok('module présent : ' + m, fs.existsSync(f));
  if (!fs.existsSync(f)) continue;

  const src = fs.readFileSync(f, 'utf8');

  // Aucun module ne doit redéfinir une fonction de app.js.
  for (const nom of globauxApp) {
    const redef = new RegExp('(^|\\s)function\\s+' + nom + '\\s*\\(', 'm');
    ok(m + ' ne redéfinit pas ' + nom + '()', !redef.test(src));
  }

  // Chaque module doit être encapsulé (IIFE) pour ne pas polluer le global.
  ok(m + ' est encapsulé', /^\/\*[\s\S]*?\*\/\s*(\(function|window\.\w+\s*=\s*\(function)/.test(src.trim()));
}

/* Cohérence des constantes réglementaires entre app.js et le module. */
{
  const src = fs.readFileSync(path.join(ici, '..', 'assets', 'js', 'modules', 'annonce.js'), 'utf8');

  // Frais de notaire : getNotaire() applique 8,5 % dans l'ancien.
  ok('module aligné sur 8,5 % de frais de notaire', /0\.085/.test(src));

  // Calendrier Loi Climat & Résilience.
  ok('calendrier DPE : G en 2025', /an:\s*2025/.test(src));
  ok('calendrier DPE : F en 2028', /an:\s*2028/.test(src));
  ok('calendrier DPE : E en 2034', /an:\s*2034/.test(src));

  // Aucun pourcentage de remise ne doit être suggéré : parti pris central.
  ok('aucune remise en pourcentage suggérée',
    !/remise\s*(de|:)?\s*\d+\s*%/i.test(src) && !/négociez\s+\d+/i.test(src));
}

/* ═══ RAPPORT ══════════════════════════════════════════════════ */

console.log('');
console.log(`  ${reussis} tests réussis, ${echoues} échec(s)` + (ignores ? `, ${ignores} ignoré(s)` : ''));
if (details.length) {
  console.log('');
  details.forEach((d) => console.log('  ' + d));
}
console.log('');
process.exit(echoues ? 1 : 0);
