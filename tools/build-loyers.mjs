#!/usr/bin/env node
/* ============================================================
   ImmoSim — génération du référentiel de loyers
   Transforme la « Carte des loyers » (DHUP / MEF, data.gouv.fr)
   en un JSON compact indexé par code INSEE, chargé à la demande
   par lq-data.js.

   Usage :
     node tools/build-loyers.mjs <fichier.csv | url> [autre.csv …]
     node tools/build-loyers.mjs ~/Downloads/loyers-appartements.csv ~/Downloads/loyers-maisons.csv

   Où trouver les fichiers :
     https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2023/
     Téléchargez les fichiers « appartements » et « maisons » du
     dernier millésime, puis passez-les en arguments.

   Sortie : assets/data/loyers.json
     { "44109": [12.6, 11.2, 12.4], "_millesime": "2023" }
       [0] loyer m²/mois appartement
       [1] loyer m²/mois maison
       [2] loyer m²/mois toutes typologies
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'assets', 'data', 'loyers.json');

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage : node tools/build-loyers.mjs <fichier.csv | url> [...]');
  process.exit(1);
}

/* ---------- Lecture ---------- */

async function lire(source) {
  if (/^https?:\/\//.test(source)) {
    process.stdout.write('  téléchargement ' + source + '\n');
    const r = await fetch(source);
    if (!r.ok) throw new Error('HTTP ' + r.status + ' sur ' + source);
    return await r.text();
  }
  return fs.readFileSync(source, 'utf8');
}

/* ---------- Parsing CSV tolérant ---------- */

function detecterSeparateur(entete) {
  const candidats = [';', ',', '\t'];
  return candidats.sort((a, b) => entete.split(b).length - entete.split(a).length)[0];
}

function parser(texte) {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim());
  if (!lignes.length) return { colonnes: [], data: [] };
  const sep = detecterSeparateur(lignes[0]);
  const colonnes = lignes[0].split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
  const data = lignes.slice(1).map((l) => {
    const cells = l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    const o = {};
    colonnes.forEach((c, i) => { o[c] = cells[i]; });
    return o;
  });
  return { colonnes, data };
}

/** Retrouve une colonne parmi plusieurs graphies possibles. */
function trouver(colonnes, motifs) {
  for (const m of motifs) {
    const hit = colonnes.find((c) => new RegExp(m, 'i').test(c));
    if (hit) return hit;
  }
  return null;
}

function typeDepuisNom(nom) {
  if (/appart|appt/i.test(nom)) return 0;
  if (/maison/i.test(nom)) return 1;
  return 2;
}

/* ---------- Traitement ---------- */

const base = {};
let millesime = null;
let total = 0;

for (const source of args) {
  const texte = await lire(source);
  const { colonnes, data } = parser(texte);

  const colInsee = trouver(colonnes, ['^insee', 'code_?insee', '^INSEE_C$', 'depcom', 'codgeo']);
  const colLoyer = trouver(colonnes, ['loypredm2', 'loyer.*m2', 'pred.*loyer', '^loyer']);
  const colType = trouver(colonnes, ['^typpred$', 'type.*bien', '^type$']);

  if (!colInsee || !colLoyer) {
    console.error('  ✗ ' + path.basename(source) + ' : colonnes non reconnues.');
    console.error('    Colonnes vues : ' + colonnes.slice(0, 12).join(', '));
    continue;
  }

  const millCol = trouver(colonnes, ['millesime', 'annee', '^an$']);
  const idxParDefaut = typeDepuisNom(source);
  let n = 0;

  for (const row of data) {
    const insee = String(row[colInsee] || '').padStart(5, '0');
    if (!/^\d{5}$|^\d[AB]\d{3}$/.test(insee)) continue;

    const v = parseFloat(String(row[colLoyer]).replace(',', '.'));
    if (!v || v <= 0 || v > 90) continue;

    const idx = colType ? typeDepuisNom(String(row[colType])) : idxParDefaut;
    if (!base[insee]) base[insee] = [null, null, null];
    base[insee][idx] = Math.round(v * 10) / 10;

    if (millCol && !millesime) millesime = String(row[millCol]);
    n++;
  }

  console.log('  ✓ ' + path.basename(source) + ' : ' + n + ' communes (colonne ' + colLoyer + ')');
  total += n;
}

/* ---------- Complétion ---------- */

// Quand une typologie manque, on retombe sur la valeur « toutes typologies ».
let complets = 0;
for (const k of Object.keys(base)) {
  const r = base[k];
  const ref = r[2] ?? r[0] ?? r[1];
  if (r[0] == null) r[0] = ref;
  if (r[1] == null) r[1] = ref;
  if (r[2] == null) r[2] = ref;
  if (r[0] != null) complets++;
}

base._millesime = millesime || new Date().getFullYear().toString();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(base));

const ko = Math.round(fs.statSync(OUT).size / 1024);
console.log('');
console.log('  → ' + OUT);
console.log('  ' + complets + ' communes, ' + ko + ' Ko (millésime ' + base._millesime + ')');
console.log('');
console.log('  Le fichier est chargé à la demande par lq-data.js.');
console.log('  Pensez à activer la compression gzip/brotli sur votre hébergement :');
console.log('  GitHub Pages le fait automatiquement (~4x plus petit sur le réseau).');
console.log('');
