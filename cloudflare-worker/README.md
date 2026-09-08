# Cloudflare Worker — Proxy IA ImmoSim

Ce dossier contient un proxy serverless gratuit qui cache ta clé API Anthropic du côté serveur.

## Pourquoi en a-t-on besoin ?

Sans proxy, ta clé API doit être saisie par chaque visiteur **ou** mise en dur dans le code source — ce qui est très dangereux car n'importe qui peut alors la copier et l'utiliser à tes frais.

Avec ce proxy, la clé reste sur Cloudflare. Le navigateur n'envoie qu'un message texte au proxy, qui ajoute lui-même la clé secrète avant d'appeler Anthropic.

## Quotas gratuits Cloudflare Workers

- 100 000 requêtes/jour
- 10 ms CPU par requête
- Largement suffisant pour ImmoSim

## Déploiement pas à pas

### 1. Créer un compte Cloudflare

Va sur [dash.cloudflare.com](https://dash.cloudflare.com), inscris-toi (gratuit, pas de carte bancaire requise).

### 2. Créer un Worker

1. Menu de gauche : **Workers & Pages**
2. Bouton **Create** → **Create Worker**
3. Donne-lui le nom `immosim-ai-proxy`
4. Clique **Deploy** (avec le code par défaut, on le remplacera juste après)

### 3. Coller le code du proxy

1. Clique **Edit Code** sur ton Worker
2. Efface le code par défaut
3. Colle le contenu de `worker.js`
4. ⚠️ Modifie la liste `ALLOWED_ORIGINS` en haut du fichier pour mettre **ton vrai domaine GitHub Pages**
5. Clique **Deploy**

### 4. Ajouter ta clé API en variable secrète

1. Sur la page du Worker, va dans l'onglet **Settings**
2. Section **Variables and Secrets** → **Add variable**
3. Type : **Secret** (et non Plaintext)
4. Nom : `ANTHROPIC_API_KEY`
5. Valeur : ta vraie clé `sk-ant-api03-…`
6. **Deploy**

### 5. Récupérer l'URL du Worker

Dans l'onglet **Settings → Triggers**, tu vois ton URL publique, par exemple :

```
https://immosim-ai-proxy.tonpseudo.workers.dev
```

### 6. Modifier app.js

Ouvre `assets/js/app.js`. En haut du fichier, ajoute :

```js
const AI_PROXY_URL = 'https://immosim-ai-proxy.tonpseudo.workers.dev';
```

Puis cherche les deux occurrences de `https://api.anthropic.com/v1/messages` (environ lignes 1723 et 2848) et remplace les blocs `fetch(...)` selon les instructions en bas de `worker.js`.

## Tester

```bash
curl -X POST https://immosim-ai-proxy.tonpseudo.workers.dev \
  -H "Origin: https://VOTRE-PSEUDO.github.io" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role":"user","content":"Dis bonjour"}]
  }'
```

Tu devrais recevoir une vraie réponse de Claude.

## Coût

**0 €** tant que tu restes sous 100 000 requêtes/jour. Au-delà, Cloudflare facture 0,30$/million de requêtes.

À titre indicatif : une analyse d'annonce avec Claude Sonnet 4 coûte environ 0,001 à 0,003 € à toi (côté Anthropic), pas à Cloudflare.

## Garde-fous inclus

- **CORS** : seul ton domaine GitHub Pages peut appeler le Worker.
- **Rate limit** : 30 requêtes par minute et par IP.
- **Filtre modèles** : on n'autorise que les modèles Claude listés (empêche un visiteur de forcer un modèle plus cher).
- **Plafond max_tokens** : limité à 4 000 même si le client demande plus.
