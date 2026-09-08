/**
 * ImmoSim — Proxy Cloudflare Worker pour l'API Anthropic
 *
 * Pourquoi ce fichier :
 *   - Aujourd'hui, ton app.js appelle directement api.anthropic.com avec la clé
 *     stockée dans localStorage côté navigateur. Si tu publiais ta propre clé
 *     en dur dans le code, n'importe qui pourrait la voler et l'utiliser.
 *   - Ce Worker tourne sur l'infra Cloudflare (gratuit jusqu'à 100 000 requêtes/jour),
 *     reçoit la requête du navigateur, et ajoute la clé secrète côté serveur.
 *   - Le navigateur n'a jamais accès à la clé.
 *
 * Déploiement (5 minutes) :
 *   1. Crée un compte gratuit sur https://dash.cloudflare.com
 *   2. Va dans Workers & Pages → Create → Create Worker
 *   3. Donne-lui un nom (ex: "immosim-ai-proxy")
 *   4. Colle le contenu de ce fichier dans l'éditeur en ligne
 *   5. Va dans Settings → Variables → Add variable (Secret) :
 *      - Nom    : ANTHROPIC_API_KEY
 *      - Valeur : ta vraie clé sk-ant-api03-...
 *      - Coche bien "Encrypt" pour en faire un secret
 *   6. Dans Settings → Triggers, note l'URL publique du Worker
 *      (ex: https://immosim-ai-proxy.tonpseudo.workers.dev)
 *   7. Dans ton app.js, remplace les appels directs à api.anthropic.com
 *      par cette URL (voir snippet en bas du fichier)
 *
 * Sécurité ajoutée :
 *   - Limite l'origine autorisée (CORS) à ton domaine GitHub Pages.
 *   - Rate-limiting basique par IP.
 *   - Filtre les modèles autorisés.
 */

// ⚠️ Adapte cette liste à ton domaine GitHub Pages
const ALLOWED_ORIGINS = [
  'https://VOTRE-PSEUDO.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

const ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-6',
];

// Limite simple par IP (en mémoire, reset au redémarrage du Worker)
const rateLimits = new Map();
const RATE_LIMIT_MAX = 30;        // 30 requêtes
const RATE_LIMIT_WINDOW = 60_000; // par minute

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + RATE_LIMIT_WINDOW;
  }
  entry.count++;
  rateLimits.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Méthode non autorisée', { status: 405, headers: cors });
    }

    // Vérifie l'origine
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Origine non autorisée', { status: 403, headers: cors });
    }

    // Rate limit
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: 'Trop de requêtes, réessayez dans une minute.' }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Vérifie la présence du secret côté Worker
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'Clé API non configurée côté serveur.' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'JSON invalide.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Filtre les modèles autorisés (évite qu'un utilisateur force un modèle cher)
    if (payload.model && !ALLOWED_MODELS.includes(payload.model)) {
      return new Response(JSON.stringify({ error: `Modèle non autorisé : ${payload.model}` }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Limite max_tokens pour éviter les abus
    if (typeof payload.max_tokens === 'number' && payload.max_tokens > 4000) {
      payload.max_tokens = 4000;
    }

    // Appel réel à Anthropic
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Erreur réseau vers Anthropic.', detail: e.message }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};

/* =================================================================
   COMMENT ADAPTER app.js POUR UTILISER LE PROXY
   =================================================================

   1. Définis l'URL du proxy en haut de app.js :

        const AI_PROXY_URL = 'https://immosim-ai-proxy.TONPSEUDO.workers.dev';

   2. Remplace les blocs fetch('https://api.anthropic.com/v1/messages', ...)
      par des appels au proxy SANS la clé API ni les headers Anthropic :

      AVANT :
        await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cle,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({...})
        });

      APRÈS :
        await fetch(AI_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({...})
        });

   3. Tu peux retirer le champ "clé API" du formulaire IA dans l'interface,
      ou le garder en option pour un mode "ma propre clé".
   ================================================================= */
