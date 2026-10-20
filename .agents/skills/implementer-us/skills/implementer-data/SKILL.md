---
name: implementer-data
description: Ajoute ou modifie un module front/src/data/ (appel d'une route de l'API, ou stockage navigateur comme le panier) pour une US. À utiliser seul ou depuis implementer-us, après validation du plan.
---

# Implémenter la partie data d'une US

Règle de détail : `.agents/rules/front-mvc.md` (section Data). Gabarit : `examples/data.js`.
Références dans le code : `data/categorie.js` (lecture), `data/compte.js` (lecture + écriture),
`data/panier.js` (localStorage).

## Étapes

1. Ajoute la fonction au module de la ressource s'il existe (`data/produit.js`…), sinon crée `data/<nom>.js`
   calqué sur `data/categorie.js`.
2. `<Nom>Data.fetchXxx = async function (...)` renvoie `getRequest(...)` ou `postRequest(...)`
   (`lib/api-request.js`) ; `encodeURIComponent` sur toute valeur placée dans l'URL.
3. JSDoc au-dessus : route appelée et forme de la réponse (reprise du PHPDoc du contrôleur).
4. Stockage navigateur : `localStorage`, `try/catch` sur chaque lecture et écriture, `JSON.parse` protégé,
   données relues validées, jamais de prix stocké. Un changement à signaler au layout passe par un rappel
   (`PanierData.surChangement`), pas par le DOM.

## Contraintes

- Ni DOM, ni `fetch` direct, ni logique d'affichage. Les erreurs remontent telles quelles (`ErreurApi.statut`) :
  c'est la page qui choisit le message.
