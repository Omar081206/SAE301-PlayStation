---
trigger: glob
globs: "front/src/**/*.js"
---

# Front : pages, composants, data (conventions du starter)

Modèles à calquer : page `pages/catalogue/page.js` et `pages/admin/page.js` · composant `ui/barre-outils`,
`ui/grille-films`, `ui/statistiques` · data `data/film.js` · routes `main.js`. Copie leur forme exacte.
Gabarits prêts à remplir : `.agents/skills/implementer-us/examples/`.

## Page (`pages/<nom>/page.js` + `template.html`)

Ordre fixe du fichier : imports → commentaire de page → `let M` → `let C` → `let V` → `export function <Nom>Page`.

- **M** : `let M = { ... }`, un objet d'état sans fonction (réponse de l'API, `message: null`, saisie à conserver).
  Pas de DOM, pas de référence à `C` ni `V`.
- **C** : `let C = {}`. Seul à appeler `data/`. Méthodes :
  - `C.charger = async function (...)` : `try` appelle `XxxData`, range le résultat dans `M`, `M.message = null` ;
    `catch` met `M.<donnée> = null` et `M.message = { type: "erreur", texte }` (`erreur.statut` pour 401 / 403) ;
  - `C.handler_<action> = async function (...)` : modifie `M` (directement ou via `C.charger`), puis `V.rafraichir()` ;
  - `C.init = async function (...)` : remet `M.message = null`, charge, `return V.init();`.
  Pas d'accès au DOM (seul `window.scrollTo` est toléré, comme dans le starter).
- **V** : `let V = {}` avec `V.racine = null`, `V.init` (construit le fragment, mémorise `V.racine`),
  `V.rafraichir` (reconstruit **toute** la page depuis `M` et `V.racine.replaceWith(fragment)`),
  `V.createPageFragment` (`htmlToFragment(template)`, puis chaque `<slot name="...">` est remplacé par
  `XxxView.dom(donnees, { surXxx: C.handler_xxx })` ; si la donnée est `null`, le slot est retiré).
  V lit `M` et passe les `C.handler_*` en actions. Aucun `fetch`, aucun calcul métier, aucune retouche DOM ponctuelle.
- Fin de fichier : `export function <Nom>Page(params) { return C.init(); }`. Les paramètres d'URL (`/produit/:slug`)
  arrivent dans `params.slug` et sont passés à `C.init`.
- Page statique (404) : renvoie directement son template.

## Composant (`ui/<nom>/index.js` + `template.html`)

- `let <Nom>View = { html: function (data), dom: function (data, actions) }` puis `export { <Nom>View }`.
  `html` renvoie `genericRenderer(template, valeurs)` ; `dom` renvoie `htmlToFragment(...)`.
- Les valeurs sont mises en forme **avant** le template (`formaterNote`, …, `lib/format.js`). `{{cle}}` est échappé.
- Pas de boucle ni de condition dans un template : liste = un template par élément (`ligne-genre.html`) puis
  `slot.replaceWith(...elements)` ; état vide = `vide.html` ; état (option choisie, bouton désactivé) = JS après `htmlToFragment`.
- Un composant imbriqué prend la place d'un `<slot name="...">`.
- Le composant ne décide de rien : ni `fetch`, ni import de `data/`, ni référence à `M` / `C` / `V`.
  Il appelle `actions.surXxx(...)` ; les écouteurs se posent sur les éléments du fragment.
- JSDoc de `dom` avec `@param {{...}} data` et `@param {{surXxx: (...) => void}} actions`.

## Data (`data/<nom>.js`)

`let XxxData = {}` ; `XxxData.fetchXxx = async function (...)` renvoie `getRequest(...)` / `postRequest(...)` de
`lib/api-request.js` (seul module autorisé à appeler `fetch`). `encodeURIComponent` sur toute valeur d'URL.
JSDoc : route appelée + forme de la réponse. Stockage navigateur : `localStorage` par défaut (panier : `data/panier.js`, clé `panier`, lignes `{ variantId, quantite }`), jamais de prix stocké ;
`try/catch` à chaque lecture / écriture et `JSON.parse` protégé, comme `data/panier.js` : la page doit fonctionner storage vide ou indisponible.
Calcul pur réutilisable (totaux, formats) : fonction exportée dans `lib/`, sur le modèle de `lib/format.js`.

## Routes (`main.js`)

`router.addRoute("/categorie/:slug", CategoriePage)` avant la route `"*"`. URLs imposées : `/categorie/nom-categorie`,
`/produit/nom-produit`. Lien interne : `<a href="/chemin" data-link>` sans le chemin du projet.
Page réservée : la page appelle l'API, le serveur décide (401 / 403), la page affiche ; ne jamais protéger côté client seulement.

## Nommage (langue du starter)

Domaine, composants et actions en **français** (`CarteFilmView`, `surTri`, `charger`, `rafraichir`) ;
mécanismes techniques en **anglais** (`createPageFragment`, `handler_`, `fetchPage`, `genericRenderer`).
Un équivalent existe dans le starter → reprends son nom, adapté au domaine (`CarteFilmView` → `CarteProduitView`).
