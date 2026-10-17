# SAE301 — PlayStation Click & Collect

Boutique click & collect PlayStation (consoles, manettes, jeux, accessoires). Projet individuel, BUT2 MMI.
Le dépôt part d'un **starter** (catalogue de films) dont on garde l'architecture et les conventions à l'identique ;
seul le domaine change (film → produit). Maquettes : @docs/maquettes.md. User stories : @docs/user-stories.md.

## Pile et carte du code

| Zone | Contenu |
|---|---|
| `front/` | SPA Vite + Tailwind CSS 4, JS vanilla (modules ES), sans framework |
| `front/src/` | `main.js` (routes) · `layouts/` · `pages/<nom>/{page.js,template.html}` · `ui/<nom>/{index.js,template.html}` · `data/` (appels API) · `lib/` (routeur, utils, format, api-request) |
| `back/` | API PHP 8 en JSON : `index.php` (entrée unique) · `src/{Core,Controller,Model}` · `src/routes.php` · `config/config.php` |
| `sql/import.sql` | schéma + seeds, rejouable (`DROP TABLE IF EXISTS` puis `CREATE`) |
| `.htaccess` | `/api/...` → `back/index.php`, le reste → `front/dist/` |

## Commandes

- Le code s'écrit **directement sur le serveur distant** (Remote SSH), dans `/~hadj-zekri1/SAE301/`.
- Tester : `cd front && npm run dev`, puis ouvrir `http://localhost:5173/~hadj-zekri1/SAE301/`
  (le proxy de `vite.config.js` relaie `/api` vers `mmi.unilim.fr`).
- Déployer le front : `npm run build` dans `front/`. Le back PHP est servi tel quel.
- Vérifier les conventions : `node .agents/skills/verifier-conventions/scripts/check-conventions.mjs --help`.
V
## Règles générales

- **Ne jamais committer ni pousser** : l'humain relit et committe.
- Ne modifie pas `front/src/lib/`, `back/src/Core/`, `back/index.php` (hors enregistrement d'un contrôleur) ni `.htaccess`
  sans le demander : ce sont les briques du starter.
- Aucune nouvelle dépendance (npm, composer, CDN) sans accord. Pas de Sass : Tailwind 4 uniquement.
- Aucun secret ni identifiant réel dans le dépôt.
- Tout HTML et tout CSS produits doivent passer le validateur W3C.
- Toute fonction ou méthode est documentée (JSDoc / PHPDoc). Les commentaires expliquent une intention, pas le code.
- **Calque toujours un fichier existant du starter** (même structure, mêmes noms de méthodes, même ordre) avant d'inventer.
  Si le starter n'a pas d'équivalent, ou si deux architectures se défendent, arrête-toi et demande.
- **Règle primordiale : le starter films de ce dépôt fait foi pour la forme du code.** Avant d'écrire un fichier, ouvre son
  équivalent et reproduis-le ligne à ligne, en ne changeant que le domaine. Références : fichiers d'origine encore présents
  (`ui/message`, `ui/statistiques`, `ui/formulaire-connexion`, `pages/admin`, `data/auth.js`, `data/stats.js`,
  `FilmModel.php`, `AuthController.php`, `StatsController.php`) et leurs transpositions fidèles faites en DEC-b
  (`ui/carte-produit` ← carte-film, `ui/grille-produits` ← grille-films, `pages/catalogue`, `data/produit.js`,
  `ProduitController.php` ← CatalogueController, `ProduitModel.php`) :
  - mêmes signatures (`dom(produit)`, `dom(produits)` : pas de paramètre en plus), même forme de commentaires
    (commentaire d'une ligne au-dessus de l'objet, pas de bloc `@param` / `@returns` là où le starter n'en met pas) ;
  - aucune constante, aucune logique, aucun cas particulier que le fichier calqué n'a pas ;
  - en cas de conflit entre le starter et une règle de `.agents/` ou un gabarit de `examples/`, **le starter l'emporte** ;
    si l'écart semble nécessaire (exigence de la maquette ou de l'US), arrête-toi et demande avant de l'écrire ;
  - signale dans le compte rendu tout écart restant avec le fichier calqué.
  Le dossier voisin `SAE301-Starter-main/` n'est pas une référence.
- **Persistance côté navigateur par défaut : `localStorage`**, sauf demande contraire. C'est le cas du panier :
  module `data/panier.js`, clé `panier`, lignes `{ variantId, quantite }` sans prix, accès protégés par `try/catch`.
- Le front ne fait jamais foi : prix, stock, rôle et quantités sont revalidés côté serveur.

## Demander une US

Exemple : « Implémente CMD-b depuis la maquette » → le skill `implementer-us` s'applique. Il lit l'US, la maquette
Figma (MCP), propose un plan **et attend ma validation**, puis implémente uniquement cette US et lance la vérification.

Ordre de réalisation et dépendances : section « Analyse » du `README.md`. Ne commence pas une US dont une dépendance
bloquante n'est pas terminée, sauf demande explicite.

## Pour aller plus loin

- Pages, composants, data (JS) : règle `front-mvc`. Maquette, Tailwind, accessibilité : règle `integration-ui`.
- PHP et SQL : règle `back-php`.
- Vérification : skill `verifier-conventions`.
