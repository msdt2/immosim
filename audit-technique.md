# Audit technique — ImmoSim

## État de départ

Le fichier initial était un HTML monolithique très complet, avec CSS et JavaScript intégrés dans un seul fichier. C'est pratique pour tester vite, mais difficile à maintenir sur GitHub.

## Corrections faites

### Structure

- Extraction du CSS vers `assets/css/styles.css`.
- Extraction du JavaScript vers `assets/js/app.js`.
- Conservation d'un `index.html` léger, plus lisible et plus adapté à GitHub Pages.
- Ajout d'un `404.html` identique pour améliorer les liens partagés contenant des paramètres.

### HTML / SEO

- Ajout d'une description.
- Ajout de `theme-color`.
- Ajout de métadonnées Open Graph.
- Ajout d'un manifeste PWA minimal.

### Accessibilité

- Ajout d'un lien d'accès rapide.
- Ajout d'un état `focus-visible`.
- Respect partiel de `prefers-reduced-motion`.

### Bugs corrigés

- `capacityResult` était présent deux fois dans le DOM. Le bloc interne au simulateur a été renommé `simCapacityResult`.
- `shareShortlist()` était défini deux fois. La première version a été renommée `shareShortlistLegacy()` pour éviter l'écrasement silencieux.
- Le bouton `applyCapacityToFilters()` était appelé dans le HTML mais la fonction n'existait pas. Elle a été ajoutée.
- La page **Capacité d'emprunt** utilisait des champs `cap_*`, mais la fonction `calcCapacity()` lisait uniquement les champs du simulateur. La fonction a été consolidée pour gérer les deux contextes.

## Points à traiter ensuite

### Priorité haute

1. Remplacer l'utilisation directe des clés API dans le navigateur par un backend/proxy.
2. Ajouter des tests automatisés simples avec Playwright :
   - ouverture de la page ;
   - navigation entre les vues ;
   - calcul d'une simulation ;
   - génération d'une capacité d'emprunt ;
   - ajout/retrait shortlist.
3. Diviser encore `app.js` en modules : `storage`, `simulation`, `fiscalite`, `ui`, `exports`, `ia`.

### Priorité moyenne

1. Ajouter une vraie gestion d'erreurs pour les appels réseau.
2. Éviter les fonctions globales à long terme.
3. Remplacer progressivement les `onclick` inline par des `addEventListener`.
4. Ajouter des validations de formulaire plus homogènes.

### Priorité basse

1. Ajouter une icône/favicone.
2. Ajouter une page de présentation publique plus commerciale.
3. Ajouter une documentation utilisateur avec captures d'écran.

## Mise à jour PDF export — 2026-04-27

Améliorations appliquées à `exportPDF()` :

- passage des libellés PDF internes en ImmoSim V9 ;
- ajout des métadonnées PDF : titre, sujet, auteur, mots-clés, créateur ;
- ajout d'une pagination complète de type `page / total` ;
- ajout d'une page `Sommaire du dossier` ;
- ajout d'un bloc `Lecture express en 60 secondes` ;
- ajout d'une page `Décision investisseur — action plan` ;
- ajout automatique des points forts, alertes et arguments de négociation ;
- ajout d'une checklist avant offre ;
- nom de fichier PDF assaini : `ImmoSim_V9_Dossier_<ville>_<date>.pdf` ;
- meilleure gestion du format des photos PNG/JPEG dans le PDF.

Vérifications effectuées :

- `node --check assets/js/app.js` : OK ;
- contrôle des `id` HTML dupliqués : aucun ;
- contrôle des fonctions JavaScript dupliquées : aucune.

## Correctif PDF export — lisibilité des encadrés

Corrections complémentaires appliquées après test visuel du PDF :

- les cartes `Lecture express en 60 secondes` et `Checklist avant offre` sont maintenant à hauteur automatique ;
- les titres longs sont renvoyés à la ligne dans leur zone gauche ;
- les notes explicatives sont renvoyées à la ligne et restent dans la carte ;
- la valeur de droite garde une colonne réservée afin d'éviter les chevauchements ;
- la palette de l'export PDF est verrouillée sur une gamme professionnelle imprimable pour éviter les aplats cyan/bleu vif issus de couleurs sauvegardées en localStorage ;
- les contours des cartes ont été adoucis pour améliorer le rendu à l'impression.
