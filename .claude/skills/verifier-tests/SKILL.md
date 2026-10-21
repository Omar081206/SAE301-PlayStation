---
name: verifier-tests
description: Lance les tests Playwright (front/tests) : ceux d'une US, puis toute la suite pour la non-régression, et rend un tableau point de DoD / critère → réussi, échoué, ignoré. À utiliser à la fin de chaque US (depuis implementer-us), ou seul pour « lancer les tests ».
---

# Lancer les tests

Configuration : `front/playwright.config.js` (lance lui-même `vite` sur le port 5273 ; l'API est celle du serveur).
Écrire ou compléter des tests : skill `implementer-tests`.

## Étapes

Depuis `front/` :

1. **Tests de l'US** : `npx playwright test tests/<epic>/<us>.spec.js --grep-invert @ecriture` (ou toute une epic : `tests/cmd`).
2. **Toute la suite** (non-régression des US précédentes) : `npm test` (= `playwright test --grep-invert @ecriture`).
3. **Tests `@ecriture`** (commandes, stock, back-office) : seulement s'ils sont prévus dans le plan validé de l'US,
   ou si je l'ai demandé pour ce lancement :
   `npm run test:ecriture`. Ils créent puis suppriment leurs propres données (préfixe `e2e`) ; vérifier ensuite
   qu'il n'en reste aucune : `SELECT COUNT(*) FROM utilisateur WHERE email LIKE 'e2e-%'`, idem `produit.nom LIKE 'e2e %'`.
4. **Lire chaque échec** : message, capture et trace (`npx playwright show-trace test-results/<dossier>/trace.zip`,
   ou `npm run test:rapport`). Le classer : bug de l'application (DoD ou critère non respecté), erreur du test,
   instabilité (réseau, validateur W3C injoignable). Relancer une seule fois un test instable pour le confirmer.
5. **W3C** : le HTML et le CSS sont validés dans le premier navigateur seulement (même code partout), un envoi
   toutes les 3 s au plus. Un 429 persistant se signale comme « validateur injoignable », jamais comme valide.
6. **Navigateurs** : Chromium et Firefox par défaut. WebKit (`E2E_NAVIGATEURS=chromium,firefox,webkit`) ne démarre
   pas sur le serveur de l'IUT (bibliothèques système absentes) : le test « testé sur 3 navigateurs » le note
   « non vérifié ». Le dire dans le compte rendu, ne jamais le présenter comme vérifié.

## Compte rendu

- Commande(s) lancée(s) et résultat brut (réussis / échoués / ignorés, par navigateur).
- Tableau de l'US : point de DoD ou critère → réussi / échoué (cause) / ignoré (raison) / non lancé (`@ecriture`).
- Régressions : tests d'autres US qui échouent, avec la cause.
- Annotations à reporter : alertes CSS dues à Tailwind 4, « à faire à la main » (comparaison Figma), « non vérifié ».

## Contraintes

- Ne modifie pas un test pour le faire passer, et ne désactive aucun test (`skip`, `fixme`) sans mon accord.
- Ne déclare jamais un test réussi sans l'avoir exécuté ; un lancement interrompu se dit tel quel.
- Aucun test `@ecriture` hors du plan validé ou d'une demande explicite ; jamais `sql/import.sql`.
