---
name: implementer-page
description: Crée ou modifie une page front/src/pages/<nom>/ (page.js en M / C / V + template.html) et sa route dans main.js pour une US. À utiliser seul ou depuis implementer-us, après validation du plan.
---

# Implémenter une page d'une US

Règle de détail : `.agents/rules/front-mvc.md` (sections Page et Routes). Gabarits : `examples/page.js`,
`examples/template.html`. Références dans le code : `pages/catalogue` (lecture + action),
`pages/commande` (page réservée, redirection), `pages/admin-categories` (back-office, modale).

## Étapes

1. **Route** dans `front/src/main.js`, avant `"*"` : `router.addRoute("/chemin/:param", NomPage)`. Les paramètres
   passent dans le chemin, pas dans la query string (le routeur la perd sur les liens `data-link`).
   Une route `/admin/...` prend le layout admin automatiquement.
2. **template.html** : la structure de l'écran et un `<slot name="…">` par composant ; un seul `<h1>`.
3. **page.js**, dans l'ordre imports → commentaire de page → `M` → `C` → `V` → `export function NomPage(params)` :
   - `M` : l'état (réponse de l'API, `message`, saisie à conserver) ;
   - `C.charger` / `C.handler_<action>` / `C.init` : appellent `data/`, rangent dans `M`, puis `V.rafraichir()` ;
     403 sur une page réservée → message, ou `naviguer("/connexion?retour=…")` / `naviguer("/admin")` ;
   - `V.init`, `V.rafraichir` (reconstruit toute la page), `V.createPageFragment` (remplace chaque slot par
     `XxxView.dom(données, { surXxx: C.handler_xxx })`, retire le slot si la donnée est `null`).
4. **Navigation** : lien dans le header, la navigation du compte ou `ui/navigation-admin` si l'écran en a un
   (seulement si c'est dans le plan).

## Contraintes

- `C` ne touche pas au DOM (sauf `window.scrollTo`) ; `V` n'appelle pas `data/` et ne modifie pas `M`.
- La page affiche ce que décide le serveur : aucune protection côté client seulement.
- États visibles : chargement si utile, vide, erreur, succès.
