# ImmoSim

Application web statique pour analyser un investissement immobilier : recherche d'annonces, simulation de rentabilité, fiscalité, capacité d'emprunt, portefeuille, pipeline, shortlist, comparaison et exports PDF/CSV/JSON.

**🟢 Mode hors-ligne** • **📱 Installable PWA** • **🔒 Proxy IA sécurisé** • **🧪 Tests automatisés**

## Structure du projet

```text
.
├── index.html                       # Page principale (SEO enrichi, PWA, schema.org)
├── 404.html                         # Redirection douce
├── manifest.webmanifest             # Manifest PWA avec icônes et shortcuts
├── service-worker.js                # Cache offline et stratégies réseau
├── robots.txt                       # SEO
├── sitemap.xml                      # SEO
├── assets/
│   ├── css/styles.css
│   ├── icons/                       # Favicons SVG + PNG, icônes PWA
│   └── js/
│       ├── app.js                   # Logique principale (à découper progressivement)
│       ├── sw-register.js           # Enregistrement Service Worker
│       ├── event-handlers.js        # Délégation onclick → data-action
│       └── modules/
│           └── storage.js           # Façade localStorage (premier module extrait)
├── cloudflare-worker/
│   ├── worker.js                    # Proxy IA serverless (Anthropic)
│   └── README.md                    # Procédure de déploiement
├── tests/                           # Tests Playwright
├── docs/
│   ├── deploiement-github.md
│   └── audit-technique.md
├── .github/workflows/
│   ├── pages.yml                    # Déploiement auto
│   └── tests.yml                    # CI tests
├── playwright.config.js
├── package.json
└── README.md
```

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir [http://localhost:8000](http://localhost:8000).

## Publier sur GitHub Pages

Procédure détaillée dans [`docs/deploiement-github.md`](docs/deploiement-github.md).

1. Créer un dépôt GitHub `immosim`
2. Y uploader le contenu de ce dossier (en respectant la structure ci-dessus)
3. Settings → Pages → Source : **GitHub Actions**
4. Le workflow `.github/workflows/pages.yml` publie automatiquement à chaque push

⚠️ **Avant publication**, remplace `VOTRE-PSEUDO` par ton pseudo GitHub dans :
- `robots.txt`
- `sitemap.xml`
- `index.html` (balises canonical, og:url, og:image, données structurées)
- `cloudflare-worker/worker.js` (ALLOWED_ORIGINS)

## Tests automatisés

```bash
npm install
npx playwright install
npm test
```

Les tests vérifient : chargement, présence du Service Worker, manifest PWA valide, navigation entre vues, accessibilité de base, module storage fonctionnel.

## Proxy IA (Cloudflare Workers)

Pour ne pas exposer ta clé API Anthropic au navigateur des visiteurs, déploie le proxy serverless gratuit fourni dans `cloudflare-worker/`. Procédure complète dans son README. Le proxy reste gratuit jusqu'à 100 000 requêtes/jour.

## Sécurité

- ❌ Ne jamais publier de fichier `.env` ou de clé API
- ✅ Utiliser le proxy Cloudflare pour les appels IA en production
- ✅ Les données restent dans le navigateur (localStorage) ; pour les synchroniser entre appareils, prévoir un backend dédié
- ⚠️ Les calculs sont indicatifs et ne remplacent pas l'avis d'un courtier, expert-comptable, notaire ou conseiller patrimonial

## Améliorations apportées dans cette version

### Sécurité et architecture

- ✅ Proxy Cloudflare Workers pour cacher la clé API Anthropic
- ✅ Module `storage.js` extrait (façade typée autour de localStorage)
- ✅ Système de délégation d'événements (`data-action`) pour migrer progressivement les 224 `onclick` inline restants

### PWA et offline

- ✅ Manifest PWA enrichi (shortcuts, icônes maskable, catégories)
- ✅ Service Worker avec stratégies adaptées (network-first / cache-first / stale-while-revalidate)
- ✅ Bannière de mise à jour automatique
- ✅ Indicateur hors-ligne en temps réel
- ✅ Icônes favicon SVG + PNG (32, 180, 192, 512)

### SEO

- ✅ Balise canonical, robots, googlebot
- ✅ Open Graph complet + Twitter Card
- ✅ Données structurées Schema.org (`WebApplication`)
- ✅ `robots.txt` + `sitemap.xml`
- ✅ Préchargements DNS

### Tests

- ✅ Configuration Playwright multi-navigateurs (Chrome, Firefox, mobile)
- ✅ Tests de smoke, navigation, accessibilité, module storage
- ✅ CI GitHub Actions

## Travail restant (recommandé)

### À faire progressivement

- 🔄 Migrer les 224 `onclick` inline vers `data-action` (utilise `window.__listInlineOnclicks()` dans la console pour suivre la progression)
- 🔄 Découper `app.js` en modules supplémentaires : `simulation.js`, `fiscalite.js`, `ui.js`, `exports.js`, `ia.js`
- 🔄 Ajouter le `AI_PROXY_URL` dans `app.js` et migrer les deux appels Anthropic

### Pour aller plus loin

- Ajouter des tests fonctionnels sur la simulation complète
- Synchronisation cloud des portefeuilles via un backend dédié
- Internationalisation (anglais, espagnol)

## Licence

À définir avant publication publique.
