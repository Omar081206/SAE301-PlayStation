---
name: verifier-conventions
description: Vérifie que le code front et back respecte les conventions du starter (pages M/C/V, composants, data, PHP) et que le HTML et le CSS sont valides W3C. À utiliser avant de conclure toute modification, ou pour relire, contrôler ou valider du code.
---

# Vérifier les conventions du starter

## Étapes

1. Consulter d'abord `node scripts/check-conventions.mjs --help`.
2. Lancer `node scripts/check-conventions.mjs` (fichiers modifiés selon git, sinon tous) ou `--all`.
3. Corriger chaque violation signalée (le message dit le fichier, la ligne, la règle), puis relancer jusqu'à « OK ».
4. **W3C.**
   - HTML : lancer `npm run dev`, ouvrir chaque page modifiée à 375 et 1440 px, copier le DOM rendu
     (`document.documentElement.outerHTML`) et le soumettre au validateur <https://validator.w3.org/nu/> (saisie directe).
     Corriger toutes les erreurs ; les avertissements sont à lire.
   - CSS : `npm run build`, puis valider `front/dist/assets/*.css` sur <https://jigsaw.w3.org/css-validator/>.
     Tailwind 4 produit du CSS récent (`@layer`, `@property`, `oklch`) : une alerte de ce type est à lister dans le
     compte rendu, pas à ignorer en silence.
   - Si le validateur n'est pas joignable, dis-le : ne déclare jamais « valide » sans l'avoir exécuté.
5. Relire à la main ce que le script ne voit pas : logique métier dans `V`, accès DOM dans `C`, prix / stock / rôle
   jamais lus côté client, texte utilisateur toujours passé par `{{…}}` (échappé).
6. Compte rendu : violations trouvées et corrigées, résultat W3C, points non vérifiés.

## Contraintes

- Ne modifie pas le script pour faire passer la vérification.
