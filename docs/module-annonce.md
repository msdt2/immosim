# ImmoSim V9 — Module « Analyse d'annonce »

Travail réalisé sur vos vrais fichiers, en respectant votre architecture et votre design system.

## Fichiers

| Fichier | Action |
|---|---|
| `index.html` | **Remplace** |
| `service-worker.js` | **Remplace** (version bumpée, nouveaux fichiers précachés) |
| `package.json` | **Remplace** (scripts de test) |
| `assets/css/annonce.css` | Nouveau |
| `assets/js/modules/annonce.js` | Nouveau — moteur d'analyse |
| `assets/js/modules/annonce-store.js` | Nouveau — persistance |
| `assets/js/modules/donnees-publiques.js` | Nouveau — BAN, DVF, ADEME, DHUP |
| `assets/js/modules/localisation.js` | Nouveau — triangulation ADEME |
| `assets/js/modules/localisation-ui.js` | Nouveau — interface candidats |
| `tests/calculs.test.mjs` | Nouveau — 99 tests |
| `tools/build-loyers.mjs` | Nouveau — référentiel de loyers |

**`assets/css/styles.css` et `assets/js/app.js` sont bit-à-bit identiques à vos originaux.** Vérifié par `diff`. Vos 1 347 lignes de design system et vos 8 663 lignes d'application ne sont pas touchées.

À ne pas oublier au moment de copier : `sw-register.js`, `event-handlers.js` et `modules/storage.js` restent les vôtres.

---

## 1. Modules retirés

Accueil, Recherche et Shortlist ont disparu de la barre de navigation et du tiroir mobile. La vue `#view-annonce` les remplace.

Deux mécanismes de compatibilité, parce qu'`app.js` référence encore ces modules :

- **`#legacy-stubs`** : bloc masqué conservant les 55 identifiants qu'`app.js` manipule au chargement (`aggGrid`, `shortlistContent`, `sVille`…). Sans lui, `app.js` lèverait une exception sur un `null` avant même d'initialiser le simulateur.
- **Enveloppe de `gv()` et `gvM()`** : `gv('dashboard')`, `gv('search')` et `gv('shortlist')` sont redirigés vers `annonce`. Vos fonctions d'origine sont conservées et appelées, jamais remplacées.

Le jour du nettoyage définitif : supprimez les stubs **et** les fonctions correspondantes dans `app.js`, dans cet ordre.

---

## 2. La vue Analyse d'annonce

Construite avec vos classes existantes — `.card`, `.fg`, `.field`, `.btn`, `.ph`, `.sec`, `.page`, `.computed-row`, `.hint`, `.ico`. Le CSS ajouté n'emploie **que vos variables** (`--gold`, `--em`, `--am`, `--ru`, `--bg2`, `--ink2`, `--r`, `--sh`, `--t`), donc le module suit automatiquement votre thème sombre et votre thème clair, y compris via le bouton de bascule.

Contenu : barre URL et barre adresse, formulaire en quatre cartes, verdict avec indice de levier, quatre cartes de résultats, arguments copiables, checklist de visite en 27 points, historique des biens analysés, méthodologie.

### Alignement sur app.js

Trois points de cohérence méritaient attention :

- **Frais de notaire à 8,5 %**, et non 7,5 %. C'est la valeur de votre `getNotaire()` dans l'ancien. Un module qui aurait gardé 7,5 % aurait affiché un coût d'acquisition différent de celui du simulateur pour le même bien — incohérence visible et destructrice de confiance.
- **`calcMens()` est appelée**, pas réimplémentée. Le calcul de mensualité du business plan locatif est donc exactement celui du simulateur.
- **`anToSim()` remplit vos vrais identifiants** : `prixAffiche`, `prixAchat`, `surface`, `ville`, `loyerMensuel`, `dpe`, `taxeFonc`, `travaux`, puis déclenche `lv()` et `calc()`.

---

## 3. Données publiques

| Source | Remplit | Clé | Serveur |
|---|---|---|---|
| BAN | Coordonnées, commune, code INSEE | non | non |
| DVF (`api.cquest.org`) | Prix médian réel, fourchette, échantillon | non | non |
| ADEME | DPE officiel : étiquette, GES, date, surface, coût | non | non |
| DHUP | Loyer médian au m² | non | non |

Chaque source échoue indépendamment : une panne n'empêche jamais l'analyse, les champs restent saisissables.

Trois précautions codées : un DPE n'est retenu que si la surface concorde à ±15 % et si l'adresse est géocodée au numéro (sinon vous récupérez le diagnostic du voisin) ; DVF est nettoyé de ses aberrations avec un indicateur de fiabilité affiché ; un diagnostic antérieur au 1ᵉʳ janvier 2026 est signalé, le coefficient électricité ayant changé.

**Action requise pour les loyers :**

```bash
node tools/build-loyers.mjs ~/Downloads/loyers-appartements.csv ~/Downloads/loyers-maisons.csv
```

Fichiers sur [data.gouv.fr — Carte des loyers](https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2023/). Sortie : `assets/data/loyers.json`. Tant qu'il est absent, le champ reste manuel.

---

## 4. Retrouver l'adresse

La requête ADEME est inversée : au lieu de chercher un DPE depuis une adresse, on cherche des adresses depuis un profil (commune, surface, étiquette, type, années de construction).

Le module **n'affiche jamais une réponse unique**. Il classe des candidats et affiche un niveau de confiance qui dépend autant de l'écart entre le premier et le deuxième que du score absolu — deux candidats à 80 points signifient qu'on ne sait pas trancher, et c'est dit. Valider exige une confirmation explicite.

Ce n'est pas de la prudence de façade : une adresse fausse contaminerait le DPE, le prix DVF et tous vos arguments, sans qu'aucun signal ne vous alerte.

**Mapillary** (jeton gratuit, licence CC-BY-SA) affiche trois photos de rue par candidat pour la confirmation visuelle. Sans jeton, la recherche fonctionne, seules les images manquent.

**Le piège de la surface** : les annonces affichent la surface Carrez, l'ADEME la surface habitable. Un écart de 2 à 5 m² est normal, d'où la tolérance de 4 %.

---

## 5. Tests

```bash
npm run test:unit     # 99 tests, ~2 s, aucune dépendance
npm test              # unitaires + Playwright
```

Contrairement à ce que je vous avais livré précédemment, ces tests portent sur **vos vraies fonctions**. `app.js` est chargé dans un contexte `vm` avec un DOM factice, puis `calcMens`, `calcIR`, `calcFiscal`, `calcScore` et `calcTRI` sont testées directement. Si vous modifiez une formule, le test le voit.

Ce qui est vérifié, au-delà des valeurs de référence :

- **Garde-fous** : `calcMens` renvoie 0 sur capital nul, durée nulle, taux nul ou capital négatif — jamais `NaN`.
- **Monotonies** : mensualité croissante avec le taux, décroissante avec la durée, proportionnelle au capital.
- **Taux effectif inférieur à la TMI.** C'est la confusion fiscale la plus fréquente ; une inversion ici fausserait tout le module fiscal sans lever d'erreur.
- **Bases imposables jamais négatives** : un déficit ne doit pas produire un impôt négatif.
- **Cohérence entre modules et app.js** : aucun module ne redéfinit une fonction globale d'`app.js`, tous sont encapsulés, et les constantes réglementaires (8,5 %, calendrier DPE 2025/2028/2034) concordent.
- **Absence de pourcentage de remise** dans le code du module — le parti pris est vérifié automatiquement.

Le harnais utilise `siPresente()` : si vous renommez une fonction dans `app.js`, le test est signalé comme ignoré plutôt que de faire échouer la suite pour une mauvaise raison.

---

## 6. Reste ouvert

- **La clé Anthropic** est toujours en `localStorage` (`app.js` ligne 2848, avec l'en-tête `anthropic-dangerous-direct-browser-access`). Vous avez déjà un `cloudflare-worker/worker.js` : il suffit de basculer le `fetch` vers son URL et de retirer le champ de saisie. Si le site est public, révoquez la clé actuelle.
- **Découpage d'`app.js`** : vous avez commencé avec `modules/storage.js`. Les candidats suivants les plus rentables sont les calculs financiers (`calcMens`, `calcIR`, `calcFiscal`, `calcScore`, `calcTRI`) — maintenant couverts par des tests, donc extractibles sans risque.
- **Lecture du contenu des annonces** : bloquée par CORS et contraire aux CGU des portails. La saisie de trois champs reste la bonne réponse.

---

## Vérifications au premier chargement

1. Console ouverte : si `app.js` réclame un identifiant absent de `#legacy-stubs`, ajoutez-le.
2. `npm run test:unit` doit afficher 99 réussites.
3. Testez « Ouvrir dans le simulateur complet » : le simulateur doit se remplir et calculer.
4. Basculez le thème clair/sombre sur la nouvelle vue : elle doit suivre sans intervention.
