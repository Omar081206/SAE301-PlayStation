# SAE301 — PlayStation Click & Collect

Boutique click & collect PlayStation (consoles, manettes, jeux, accessoires). Projet individuel, BUT2 MMI.
Le dépôt part d'un **starter** (catalogue de films) dont on a gardé l'architecture et les conventions ;
seul le domaine a changé (film → produit). Maquettes : @docs/maquettes.md. User stories : @docs/user-stories.md.
Ordre de réalisation : @docs/ordre-us.md.

## Comment marche l'application

Une API PHP en trois couches (routage / contrôleur / modèle) au-dessus de MySQL, et une SPA en JavaScript
vanilla (Vite + Tailwind CSS 4) organisée en layouts, pages et composants, avec un routeur côté client.
Le code est écrit **directement sur le serveur** (Remote SSH) : le back PHP est servi tel quel depuis ce dossier,
toute modification PHP est donc **en ligne immédiatement**.

```
.htaccess              /api/... → back/index.php ; images/produits/u-* → uploads/produits/ ; le reste → front/dist/
sql/import.sql         schéma complet + seeds, rejouable (DROP TABLE IF EXISTS puis CREATE) — ne pas l'exécuter
uploads/produits/      images téléversées depuis le back-office (données, non versionnées)
back/                  API PHP 8, ne renvoie que du JSON
├── index.php          point d'entrée : autoload, session, assemble modèles → contrôleurs, appelle le routeur
├── config/config.php  identifiants de la base, chemin du projet (cookies), debug
└── src/
    ├── Core/          Request (parametre(), corps()), Response (json(), erreur() : terminent le script),
    │                  Router (adresse exacte, pas de paramètre dans le chemin), Database (PDO)
    ├── routes.php     table 'MÉTHODE /api/chemin' => [Contrôleur::class, 'méthode']
    ├── Controller/    valide l'entrée, vérifie les droits, appelle les modèles, répond
    └── Model/         requêtes SQL préparées, renvoie des tableaux, ne décide de rien
front/
├── index.html         page unique
├── vite.config.js     BASE (chemin du projet), proxy /api → mmi.unilim.fr en développement
├── public/images/     images produits de départ (front/public/images/produits/<slug>.webp)
└── src/
    ├── main.js        déclaration des layouts et des routes, lit la session avant router.start()
    ├── global.css     Tailwind 4 : tokens (:root), @theme, @utility
    ├── layouts/       root (header + page + footer) et admin (navigation du back-office + page)
    ├── pages/<nom>/   une page par route : page.js (M / C / V) + template.html
    ├── ui/<nom>/      composants réutilisables : index.js (<Nom>View) + template.html (+ ligne.html, vide.html)
    ├── data/          un module <Nom>Data par ressource : appels API, panier en localStorage
    └── lib/           router.js, utils.js (genericRenderer, htmlToFragment), api-request.js (getRequest,
                       postRequest, ErreurApi.statut), format.js (formaterPrix…), navigation.js (naviguer, parametre)
```

### Parcours d'une requête

1. Le navigateur charge `front/dist/index.html` ; `main.js` demande la session (`AuthData.fetchSession()`),
   puis le routeur choisit le layout (plus long préfixe : `/` ou `/admin`) et la page de l'adresse.
2. La page (`C.init`) appelle un module `data/`, qui appelle `getRequest` / `postRequest` (`lib/api-request.js`,
   seul endroit où l'on appelle `fetch`). Une erreur HTTP devient une `ErreurApi` avec `statut`.
3. `/api/...` arrive dans `back/index.php` → `routes.php` → méthode du contrôleur → modèle(s) → `Response::json`.
4. La page range la réponse dans `M`, puis `V` reconstruit toute la page depuis `M` ; les composants `ui/`
   reçoivent leurs données et signalent les actions de l'utilisateur par `actions.surXxx(...)`.

### Domaine

- **Catalogue** : `categorie` → `produit` → `variante` (prix, stock). Options génériques : `option_produit`,
  `valeur_option`, `variante_valeur` (ex. Coloris : Noir). Images : `image` (par produit, ou par variante).
  Variante par défaut d'un produit = la première en stock. Le stock n'est jamais envoyé : seulement `etat_stock`
  (`en_stock` / `bientot_epuise` / `epuise`, seuil dans `parametre`).
- **Panier** : uniquement dans le `localStorage` (`data/panier.js`, clé `panier`, lignes `{ variantId, quantite }`,
  sans prix). `POST /api/panier` recalcule prix, totaux et ramène les quantités au stock.
- **Commande** : `commande` + `ligne_commande` (nom, options et prix unitaire figés). Statuts
  `en_cours` → `disponible` → `retiree`, ou `annulee`. Le stock est décrémenté dans la transaction de commande
  et journalisé dans `mouvement_stock` ; les actions admin sont journalisées dans `journal_admin`.
- **Comptes** : table `utilisateur` (rôle `client` | `admin`). Deux sessions **séparées** : `$_SESSION['id']` (+ `utilisateur`,
  `prenom`, `nom`, `role` ; site client, `/api/login`) et `$_SESSION['admin']` (back-office, `/api/admin/login`).

### API (par domaine)

| Domaine | Routes |
|---|---|
| Catalogue | `GET /api/produits`, `GET /api/produit?slug=`, `GET /api/categories` |
| Panier, commande | `POST /api/panier`, `POST /api/commande`, `GET /api/commande?numero=` |
| Compte client | `POST /api/login`, `/api/logout`, `/api/inscription`, `GET /api/session`, `GET /api/compte`, `GET /api/compte/commandes`, `POST /api/compte/profil` |
| Back-office | `/api/admin/login`, `logout`, `session`, `tableau-de-bord`, `commandes`, `commande`, `commande(s)/statut`, `produits`, `produit/...`, `categories`, `categorie/...`, `parametre/seuil` |

La liste exacte est dans `back/src/routes.php`. Codes d'erreur : **403** non connecté ou non autorisé,
**422** saisie invalide (et identifiants faux), **404** introuvable, **409** conflit (stock, doublon). **Jamais 401.**

## Règles générales

### Communes

- **Ne modifie aucun code existant sans le demander.** Un fichier existant ne se modifie que s'il figure dans un plan
  que j'ai validé ; sinon, arrête-toi et demande. C'est d'autant plus vrai pour les briques du starter : `front/src/lib/`,
  `back/src/Core/`, `back/index.php` (hors enregistrement d'un contrôleur), `.htaccess`, `README.md` (jamais modifié).
- **Git** : branche d'abord, commit seulement après mon accord, jamais de push (voir la section Git).
- Aucune nouvelle dépendance (npm, composer, CDN) sans accord. Pas de Sass : Tailwind 4 uniquement.
- Aucun secret ni identifiant réel dans le dépôt.
- Tout HTML et tout CSS produits doivent passer le validateur W3C.
- Toute fonction ou méthode est documentée (JSDoc / PHPDoc), dans la forme du fichier de référence.
  Les commentaires expliquent une intention, pas le code. Code et commentaires en français.
- **Le code existant fait foi pour la forme.** Avant d'écrire un fichier, ouvre son équivalent le plus proche et
  reproduis sa structure (mêmes noms de méthodes, même ordre, même forme de commentaires), en ne changeant que le domaine.
  Références : page `pages/catalogue`, composants `ui/carte-produit`, `ui/grille-produits`, `ui/message`,
  data `data/categorie.js` (et `data/panier.js` pour le stockage), contrôleur `CategorieController.php`
  (`AdminCategorieController.php` pour une route admin), modèle `CategorieModel.php`.
  - aucune constante, aucune logique, aucun cas particulier que la référence n'a pas sans le signaler ;
  - en cas de conflit avec une règle de `.claude/` ou un gabarit, **le code de référence l'emporte** (s'il fait la même
    chose dans le même contexte) ;
  - si deux architectures se défendent, ou si la maquette / l'US impose un écart, arrête-toi et demande ;
  - signale dans le compte rendu tout écart restant avec la référence.
  Le dossier voisin `SAE301-Starter-main/` n'est pas une référence.
- Le front ne fait jamais foi : prix, stock, rôle et quantités sont revalidés côté serveur.

### Front (`front/`)

- Détail : règle `.claude/rules/front-mvc.md` (pages, composants, data, routes) et
  `.claude/rules/integration-ui.md` (maquette, Tailwind, accessibilité, W3C).
- Pages en M / C / V ; composants sans logique métier ; seul `data/` appelle l'API, seul `lib/api-request.js` appelle `fetch`.
- Persistance navigateur : `localStorage` dans `data/` uniquement, accès protégés par `try/catch`, jamais de prix stocké.
- Le routeur compare l'adresse et **perd la query string des liens `data-link`** : passe les paramètres dans le chemin
  (`/produit/:slug/options/:variante`). Redirection par le code : `naviguer()` de `lib/navigation.js`.
- `lib/api-request.js` ne fait que GET et POST (JSON) : un envoi de fichier passe en data URL dans du JSON.
- Points de rupture : base = 375 px (mobile), `md:` = 768 px, `lg:` = **1024 px** (Tailwind par défaut) ;
  la maquette Desktop 1440 s'applique à partir de `lg:`.
- Vérification : skill `verifier-front`.

### Back (`back/`, `sql/`)

- Détail : règle `.claude/rules/back-php.md`.
- Une route = une ligne dans `routes.php` + l'instance du contrôleur dans `$controleurs` de `back/index.php`.
  Pas de paramètre dans le chemin : `GET /api/produit?slug=...`. Écritures en `POST /api/<ressource>/<action>`.
- Droits : client → `$_SESSION['id']`, admin → `$_SESSION['admin']` ; absent → **403** (jamais 401 :
  tout `~hadj-zekri1/` est derrière l'authentification HTTP d'Apache, un 401 ferait redemander les identifiants IUT).
- **Base de données** : ne jamais exécuter `sql/import.sql` ni vider une table sans mon accord (il efface mes comptes et
  commandes de test). Un changement de schéma = `ALTER` ciblé sur la base vivante, après sauvegarde (`mysqldump` des
  tables touchées), **et** la même modification reportée dans `import.sql`. Pas de fichier de migration séparé.
- Données de test : crée et supprime tes propres lignes ; ne touche pas aux comptes et commandes existants.
- Vérification : skill `verifier-back`.

## Git

Méthode pour tout travail qui modifie le dépôt (US, correctif, nettoyage, outillage) :

1. **Créer une branche** avant la première modification, depuis `main` à jour et propre (`git status` vide ;
   sinon, demande) : `git switch -c <type>/<nom>`.
   - `us/<us>-<nom>` pour une US (`us/pil-a-statistiques`) ;
   - `correctif/<nom>` pour une correction (`correctif/galerie-hauteur`) ;
   - `chore/<nom>` pour l'outillage, la doc, le nettoyage (`chore/methode-git`).
   Ne travaille jamais directement sur `main`.
2. **Travailler et vérifier** sur la branche (skills `verifier-front` / `verifier-back`).
3. **Proposer le commit**, sans le faire : liste des fichiers (`git status --short`) et message proposé, puis attendre
   mon accord. Message en français : `(<US>): <résumé>` pour une US (`(GOF-a): gestion des produits`),
   `(UI): …` pour une retouche d'interface, `chore: …` pour l'outillage ; corps en liste à tirets si utile.
4. **Après mon accord** : `git add` des seuls fichiers concernés (pas de `git add -A` à l'aveugle), commit, puis
   fusion dans `main` : `git switch main && git merge --no-ff <branche> -m "merge: <résumé>"`.
   La branche est gardée.
5. **Ne jamais pousser** (`git push`) : je pousse moi-même. À la fin, rappelle combien de commits de `main`
   attendent un push.

Jamais sans demande explicite : `push`, `rebase`, `reset --hard`, `commit --amend` sur un commit fusionné,
suppression de branche, réécriture d'historique.

## Demander une US

Exemple : « Implémente CMD-b depuis la maquette » → le skill `implementer-us` s'applique. Il lit l'US et la maquette
Figma, propose un plan qui dit **quels sous-skills** il utilisera (`implementer-sql`, `implementer-api`,
`implementer-data`, `implementer-composant`, `implementer-page`), **attend ma validation**, puis n'utilise que ceux-là
et lance la vérification (`verifier-back`, `verifier-front`). « go » ou « US suivante » veut dire « présente le plan
de l'US suivante », pas « implémente sans confirmer ».

Ne commence pas une US dont une dépendance bloquante n'est pas terminée (voir `docs/ordre-us.md`), sauf demande explicite.

Tout l'outillage de l'agent est dans `.claude/` : `rules/` (chargées selon les fichiers touchés), `skills/`, `scripts/`.
Les sous-skills vivent dans `.claude/skills/implementer-us/skills/` ; un lien par sous-skill dans `.claude/skills/`
les rend appelables seuls.
