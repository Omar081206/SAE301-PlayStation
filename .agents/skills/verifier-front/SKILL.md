---
name: verifier-front
description: Vérifie le front (front/src) : conventions pages M/C/V, composants et data, HTML et CSS valides W3C, rendu conforme à la maquette à 375, 768 et 1440 px. À utiliser avant de conclure toute modification de front/, ou pour relire, contrôler ou valider du code front.
---

# Vérifier le front

Script partagé : `.agents/scripts/check-conventions.mjs` (depuis la racine du projet).

## Étapes

1. **Conventions.** `node .agents/scripts/check-conventions.mjs --front` (fichiers modifiés selon git ;
   `--all` pour tout le front). Corriger chaque erreur (fichier, ligne, règle), relancer jusqu'à « OK ».
   Les avertissements se lisent un par un : corrigés, ou justifiés dans le compte rendu.
2. **Build.** `cd front && npm run build` sans erreur ni avertissement nouveau.
3. **Parcours.** `cd front && npm run dev`, puis `http://localhost:5173/~hadj-zekri1/SAE301/` (Chrome ou Firefox ;
   le proxy relaie `/api` vers mmi.unilim.fr). Pour chaque critère d'acceptation : le parcours nominal, puis
   les cas vide, erreur serveur, non connecté (403), stock épuisé si concerné.
4. **Maquette.** Comparer chaque écran modifié à `get_screenshot` (Figma) à 375, 768 et 1440 px ;
   aucun débordement horizontal, focus visible au clavier.
5. **W3C HTML.** Pour chaque page modifiée, récupérer le DOM rendu (`document.documentElement.outerHTML`)
   et le soumettre au validateur : `curl -s -H "Content-Type: text/html; charset=utf-8" --data-binary @page.html
   "https://validator.w3.org/nu/?out=json"`. Corriger toutes les erreurs ; lire les avertissements.
6. **W3C CSS.** Valider `front/dist/assets/*.css` sur <https://jigsaw.w3.org/css-validator/>
   (`?profile=css3svg&output=json`). Les alertes propres à Tailwind 4 (`@layer`, `@property`, `oklch`) sont listées
   dans le compte rendu, pas ignorées en silence.
7. **Relecture** de ce que le script ne voit pas : logique métier dans `V` ou dans un composant, prix / stock / rôle
   décidés côté client, texte utilisateur hors `{{…}}`, classes Tailwind assemblées, `lg:` supposé à 1440 px.

## Compte rendu

Violations trouvées et corrigées ; résultat du build ; critères parcourus ; écarts avec la maquette ;
résultats W3C HTML et CSS ; points non vérifiés (et pourquoi).

## Contraintes

- Ne modifie pas le script pour faire passer la vérification.
- Validateur injoignable ou navigateur indisponible : dis-le. Ne déclare jamais « valide » sans l'avoir exécuté.
