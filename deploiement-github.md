# Déploiement sur GitHub Pages

## 1. Créer le dépôt

Sur GitHub :

1. Cliquez sur **New repository**.
2. Nom conseillé : `immosim`.
3. Choisissez **Public** si vous voulez un site GitHub Pages gratuit accessible publiquement, ou **Private** si vous préférez limiter l'accès.
4. Ne cochez pas forcément README si vous envoyez directement ce dossier.

## 2. Envoyer les fichiers

Dans un terminal, depuis le dossier du projet :

```bash
git init
git add .
git commit -m "Initialisation ImmoSim"
git branch -M main
git remote add origin https://github.com/VOTRE-PSEUDO/immosim.git
git push -u origin main
```

Remplacez `VOTRE-PSEUDO` par votre pseudo GitHub.

## 3. Activer GitHub Pages

Dans le dépôt GitHub :

1. Ouvrir **Settings**.
2. Aller dans **Pages**.
3. Dans **Build and deployment**, choisir **GitHub Actions**.
4. Relancer le workflow si besoin dans l'onglet **Actions**.

Le site sera ensuite disponible à une adresse du type :

```text
https://VOTRE-PSEUDO.github.io/immosim/
```

## 4. À vérifier après publication

- La page d'accueil s'affiche.
- Les onglets fonctionnent.
- Le thème clair/sombre fonctionne.
- Les données se sauvegardent bien dans le navigateur.
- Les exports PDF/CSV/JSON fonctionnent.
- La page **Capacité** affiche bien un résultat.
- La shortlist peut être partagée.

## 5. Très important pour les clés API

Ne mettez pas de clé API personnelle dans le dépôt GitHub.

Pour une version vraiment publique avec IA, il faudra ensuite créer un backend/proxy afin que la clé reste côté serveur.
