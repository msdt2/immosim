/**
 * ImmoSim — Système de délégation d'événements
 *
 * Objectif : remplacer progressivement les `onclick="maFonction()"` inline
 * par des `data-action="maFonction"`, sans tout casser d'un coup.
 *
 * Comment migrer un bouton :
 *   AVANT :  <button onclick="exportPDF()">PDF</button>
 *   APRÈS :  <button data-action="exportPDF">PDF</button>
 *
 * Pour passer un argument :
 *   AVANT :  <button onclick="deleteItem(42)">Supprimer</button>
 *   APRÈS :  <button data-action="deleteItem" data-args="42">Supprimer</button>
 *
 * Pour plusieurs arguments séparés par des virgules :
 *   <button data-action="moveItem" data-args="42,up">↑</button>
 *
 * Les `onclick` non migrés continuent de fonctionner normalement.
 */
(function () {
  'use strict';

  // Liste blanche : seules les fonctions globales déclarées dans app.js peuvent être appelées.
  // (Sécurité : empêche d'invoquer arbitrairement n'importe quoi via data-action.)
  // Tu peux ajouter ici les noms au fur et à mesure que tu migres.
  const ALLOWED_GLOBAL_FUNCTIONS = new Set([
    // === Navigation ===
    'showView', 'toggleTheme', 'closeModal', 'openModal',

    // === Simulation ===
    'runSim', 'resetSim', 'saveSim', 'loadSim',

    // === Capacité ===
    'calcCapacity', 'applyCapacityToFilters',

    // === Exports ===
    'exportPDF', 'exportCSV', 'exportJSON',

    // === Shortlist ===
    'addToShortlist', 'removeFromShortlist', 'shareShortlist', 'clearShortlist',

    // === Portfolio / Pipeline ===
    'addToPortfolio', 'removeFromPortfolio', 'addToPipeline', 'removeFromPipeline',

    // === IA / Import ===
    'analyzeWithIA', 'importListing',

    // ⚠️ Ajoute ici les noms des fonctions que tu migres depuis tes onclick
    // Tu peux retrouver la liste avec : grep -oE 'onclick="[^"]+' index.html | sort -u
  ]);

  function resolveFn(name) {
    // 1. Liste blanche (recommandé)
    if (ALLOWED_GLOBAL_FUNCTIONS.has(name) && typeof window[name] === 'function') {
      return window[name];
    }
    // 2. Mode "permissif" : si la fonction existe dans window et est explicitement marquée safe
    //    Tu peux passer en mode permissif si tu en as marre de maintenir la liste blanche :
    //    décommente la ligne suivante (moins sécurisé mais plus simple) :
    // if (typeof window[name] === 'function') return window[name];
    return null;
  }

  function parseArgs(raw) {
    if (!raw) return [];
    return raw.split(',').map((s) => {
      const v = s.trim();
      if (v === 'true') return true;
      if (v === 'false') return false;
      if (v === 'null') return null;
      if (v !== '' && !isNaN(v)) return Number(v);
      return v;
    });
  }

  function handleEvent(event, attrName) {
    const target = event.target.closest(`[${attrName}]`);
    if (!target) return;

    const name = target.getAttribute(attrName);
    const fn = resolveFn(name);
    if (!fn) {
      console.warn(`[event-handlers] Fonction non autorisée ou inexistante : ${name}`);
      return;
    }

    const args = parseArgs(target.getAttribute('data-args'));

    // Empêche la propagation si l'élément est un bouton dans un formulaire sans type
    if (target.tagName === 'BUTTON' && !target.type) {
      event.preventDefault();
    }

    try {
      fn.apply(target, args);
    } catch (e) {
      console.error(`[event-handlers] Erreur dans ${name}() :`, e);
    }
  }

  document.addEventListener('click', (e) => handleEvent(e, 'data-action'));
  document.addEventListener('change', (e) => handleEvent(e, 'data-action-change'));
  document.addEventListener('submit', (e) => handleEvent(e, 'data-action-submit'));

  // Helper exposé pour les développeurs : liste les onclick restants
  window.__listInlineOnclicks = function () {
    const els = document.querySelectorAll('[onclick]');
    const map = new Map();
    els.forEach((el) => {
      const code = el.getAttribute('onclick');
      map.set(code, (map.get(code) || 0) + 1);
    });
    console.table([...map.entries()].map(([code, count]) => ({ code, count })));
    console.log(`Total : ${els.length} onclick inline restants.`);
    return els.length;
  };
})();
