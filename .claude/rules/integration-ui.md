---
paths:
  - "front/src/**/*.html"
  - "front/src/**/*.css"
  - "front/index.html"
---

# Intégration de maquette : Tailwind, responsive, accessibilité, W3C

Modèles : `ui/*/template.html`, `global.css`, `index.html`.

- **Source de vérité = la maquette Figma** (`docs/maquettes.md`). Couleurs, typo (SST, Inter en secours), espacements : lis les variables
  Figma (`get_variable_defs`) ; ne devine jamais une valeur depuis une image.
- **Tokens** dans `front/src/global.css`, une seule fois : primitives dans `:root` (`--clr-…`), sémantiques qui les
  référencent, exposés à Tailwind par `@theme inline { --color-…: var(--clr-…); }`. Aucun `#hex`, `rgb()` ni `px` arbitraire
  répété dans un template : utilise les classes issues des tokens. Variable Figma sans équivalent → ajoute le token
  et signale-le dans le compte rendu.
- **Tailwind 4, mobile first** : classes de base = 375 px, puis `md:` (768 px) et `lg:` (1024 px, points de rupture
  par défaut) ; la maquette Desktop 1440 s'applique à partir de `lg:`, avec un conteneur limité en largeur. Classes écrites en entier
  (`"text-red-700"`, jamais `"text-" + x`). Pas de thème sombre : aucune variante `dark:`.
  Pas de CSS hors `global.css` (`@utility` pour un motif répété, comme `bandeau-titre`).
- **Composants d'abord** : cherche dans `ui/` avant de créer ; un bloc du cadre « Composants » de Figma = un dossier `ui/<nom>/`.
- **Vérification visuelle** : compare à `get_screenshot` à 375, 768 et 1440 px ; aucun débordement horizontal.
- **Accessibilité** : un seul `<h1>` par page ; landmarks (`header`, `nav`, `main`, `footer`) ; `<label>` associé à chaque champ ;
  `button type="button"` hors formulaire ; `aria-current` posé par le routeur sur l'adresse exacte seulement (un menu
  qui marque une section le pose lui-même, comme `ui/filtre-categories`) ; focus visible (règle déjà dans `global.css`) ;
  contraste ≥ 4,5:1 ; images : `alt` utile (ou `alt=""` si décorative), `width`/`height` ou ratio, `loading="lazy"` sous la ligne de flottaison ;
  états loading, vide, erreur, succès, stock épuisé visibles (`role="status"` pour les messages, comme `ui/message`).
- **W3C** : balises fermées et correctement imbriquées, pas d'`id` dupliqué (les templates sont instanciés plusieurs fois :
  préfère `class` / `data-*` à `id`), pas d'attribut obsolète, `lang="fr"`. Un template est un fragment : valide le DOM rendu
  (voir skill `verifier-front`).
