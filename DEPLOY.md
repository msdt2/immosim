# 🚀 Guide rapide — Déployer ImmoSim sur GitHub

## Étape 1 — Créer le repo de l'application

1. Allez sur **https://github.com/new**
2. Nom du repo : `immosim` (ou ce que vous voulez)
3. Visibilité : **Public** (pour avoir GitHub Pages gratuit) ou **Private** (Pages réservé aux comptes Pro)
4. Cochez "Add a README file"
5. Cliquez **Create repository**

## Étape 2 — Uploader les fichiers

### Méthode A — Via l'interface web (le plus simple)

1. Sur la page de votre repo : cliquez **"Add file" → "Upload files"**
2. Glissez-déposez :
   - `index.html`
   - `README.md`
   - `LICENSE`
   - `.gitignore`
   - Le dossier `.github/workflows/deploy.yml`
3. Commit message : "Initial deploy"
4. Cliquez **Commit changes**

### Méthode B — Via Git en ligne de commande

```bash
git clone https://github.com/VOTRE_USER/immosim.git
cd immosim
# copier tous les fichiers du zip ici
git add .
git commit -m "Initial deploy"
git push
```

## Étape 3 — Activer GitHub Pages

1. Sur votre repo : **Settings → Pages** (menu gauche)
2. Source : **GitHub Actions** (recommandé)
   - OU : "Deploy from branch" → `main` / `/ (root)`
3. Cliquez **Save**
4. Attendez ~2 minutes
5. Votre app est en ligne sur : **`https://VOTRE_USER.github.io/immosim/`**

## Étape 4 — Créer le repo de données (privé)

1. **https://github.com/new** → nouveau repo
2. Nom : `immosim-data`
3. **Private** ✓ (très important !)
4. Cochez "Add a README"
5. Create

## Étape 5 — Générer un token d'accès

1. Allez sur **https://github.com/settings/tokens/new?scopes=repo&description=ImmoSim**
2. Note : `ImmoSim Sync`
3. Expiration : **No expiration** (ou 1 an)
4. Scopes : **`repo`** doit être coché (full control)
5. Cliquez **Generate token**
6. **⚠ COPIEZ LE TOKEN MAINTENANT** (commence par `ghp_...`) — il ne sera plus jamais affiché

## Étape 6 — Configurer ImmoSim

1. Ouvrez **`https://VOTRE_USER.github.io/immosim/`**
2. Topbar → **🐙 GitHub**
3. Remplissez :
   - **Utilisateur GitHub** : votre pseudo
   - **Nom du repo** : `immosim-data`
   - **Personal Access Token** : `ghp_...` (celui que vous venez de copier)
   - **Branche** : `main`
4. Cliquez **🧪 Tester la connexion** → doit afficher "✓ Connexion OK"
5. Cliquez **⬆ Sauvegarder maintenant** → vos données partent sur GitHub
6. **Cochez "Synchronisation automatique"** → sauvegarde à chaque modif (debounce 5s)
7. **Cochez "Chargement automatique au démarrage"** → récupère vos données partout

## ✅ C'est fait !

Vous avez maintenant :
- ImmoSim accessible depuis n'importe quel appareil via votre URL GitHub Pages
- Vos données privées synchronisées entre tous vos appareils
- Sauvegarde automatique à chaque modification

## 🔄 Sur un autre appareil

1. Ouvrez `https://VOTRE_USER.github.io/immosim/` sur le nouvel appareil
2. Topbar → **🐙 GitHub**
3. Mêmes infos (user, repo, **même token**)
4. Cliquez **⬇ Charger depuis GitHub**
5. Toutes vos données sont là 🎉

## 🆘 Problèmes courants

**"Bad credentials"**
→ Token expiré ou mal copié. Régénérez-en un nouveau.

**"Not Found"**
→ Le repo n'existe pas, ou il est privé et le token n'a pas le scope `repo`.

**Le token est-il sécurisé ?**
→ Oui : il reste dans le localStorage de votre navigateur uniquement. Vous pouvez le révoquer à tout moment sur GitHub.

**Comment révoquer un token ?**
→ https://github.com/settings/tokens → cliquez sur le token → Delete

**Mon site GitHub Pages ne s'affiche pas**
→ Settings → Pages → vérifiez que c'est bien activé. Attendez 5 minutes après le push.
→ Vérifiez que `index.html` est à la racine du repo (pas dans un sous-dossier).
