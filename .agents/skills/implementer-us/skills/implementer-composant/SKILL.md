---
name: implementer-composant
description: Crée ou modifie un composant front/src/ui/<nom>/ (index.js + template.html) et les tokens Tailwind nécessaires, à partir d'un bloc de la maquette Figma. À utiliser seul ou depuis implementer-us, après validation du plan.
---

# Implémenter un composant d'une US

Règles de détail : `.agents/rules/front-mvc.md` (section Composant) et `.agents/rules/integration-ui.md`.
Gabarits : `examples/index.js`, `examples/template.html`, `examples/ligne.html`, `examples/vide.html`.
Références dans le code : `ui/carte-produit` (élément avec actions), `ui/grille-produits` (liste + état vide),
`ui/message` (messages `role="status"`), `ui/modale` (dialogue).

## Étapes

1. **Chercher d'abord dans `ui/`** un composant à réutiliser ou à étendre. Un bloc du cadre « Composants » de Figma
   = un dossier `ui/<nom>/`. Modifier un composant existant n'est permis que s'il est dans le plan validé.
2. **Lire le bloc** dans Figma (`get_design_context`, `get_variable_defs`) aux trois formats.
3. **Tokens** : une variable Figma sans équivalent dans `front/src/global.css` → ajoute le token (primitive dans
   `:root`, exposée dans `@theme inline`) et note-le pour le compte rendu.
4. **Template** : HTML sémantique, classes Tailwind écrites en entier, mobile d'abord (`md:` 768, `lg:` 1024),
   `{{cle}}` pour le texte, `<slot name="…">` pour un sous-composant. Ni boucle ni condition :
   une liste = un template par élément, un état vide = `vide.html`.
5. **index.js** : `let <Nom>View = { html, dom }` ; valeurs mises en forme avant le template (`lib/format.js`) ;
   états (désactivé, choisi, `aria-*`) réglés en JS après `htmlToFragment` ; écouteurs posés sur le fragment,
   qui appellent `actions.surXxx(...)`.

## Contraintes

- Le composant ne décide de rien : ni `fetch`, ni import de `data/`, ni référence à `M` / `C` / `V`.
- Pas d'`id` dans un template (instancié plusieurs fois) : `class` ou `data-*`.
- Signature et JSDoc de `dom` comme le composant de référence utilisé dans le même contexte : `@param` seulement si
  `dom` reçoit des `actions` ou construit le rendu à partir de données structurées (voir `front-mvc`).
