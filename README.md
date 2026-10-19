# SAE301 — PlayStation Click & Collect

Boutique click & collect PlayStation (consoles, manettes, casques et
accessoires, jeux) : une API PHP en trois couches (routage / contrôleur /
modèle) au-dessus de MySQL, et un front en JavaScript organisé en layouts,
pages et composants, avec un routeur côté client. Construite sur le starter
« catalogue de films » du module, dont elle garde l'architecture.

- catalogue filtrable par catégorie, fiche produit avec galerie ;
- panier conservé dans le navigateur (`localStorage`), prix recalculés par le
  serveur ;
- comptes clients (mots de passe en bcrypt, session PHP), validation de
  commande avec numéro unique ;
- back-office `/admin` (tableau de bord), avec sa propre connexion réservée aux comptes `admin`.

## Arborescence

```
.htaccess            /api/... vers le back, tout le reste vers front/dist/
sql/import.sql       tables de la boutique (+ film et genre pour /admin)
back/                API PHP, ne renvoie que du JSON
├── index.php        point d'entrée : assemble les dépendances, délègue
├── config/          identifiants de la base, chemin du projet
└── src/             Core/ (Request, Response, Router, Database),
                     Controller/, Model/, routes.php
front/               sources du front (Vite + Tailwind)
├── index.html       page unique de l'application
├── vite.config.js   chemin du projet, proxy de développement
├── src/
│   ├── main.js      déclaration des routes et des layouts
│   ├── global.css   Tailwind, tokens de la maquette Figma
│   ├── layouts/     structures de page (en-tête + slot de la page)
│   ├── pages/       une page par route : page.js + template.html
│   ├── ui/          composants réutilisables : index.js + template.html
│   ├── data/        appels à l'API, un module par ressource
│   └── lib/         routeur, rendu des templates, requêtes, utilitaires
└── dist/            résultat de npm run build (non versionné)
```

## Installation

1. Importez `sql/import.sql` dans votre base depuis phpMyAdmin. Il crée les
   tables de la boutique, des produits et des comptes de test. **Toute table
   existante de même nom est remplacée : comptes et commandes sont perdus.**
2. Dans `back/config/config.php`, renseignez les identifiants de la base et
   le chemin du projet (`/~votre_login/SAE301/`).
3. Dans `front/vite.config.js`, donnez à `BASE` **exactement** le même chemin.
4. Dans `front/`, installez les dépendances :

```bash
npm install
```

Le chemin du projet apparaît donc à deux endroits, et seulement là :
`config.php` pour le back (chemin des cookies), `vite.config.js` pour le front
(adresses des fichiers et des pages).

## Développer

```bash
npm run dev
```

Le front est servi par Vite à `http://localhost:5173/~votre_login/SAE301/`, avec
rechargement à chaque modification. Les requêtes `/~votre_login/SAE301/api/...`
sont relayées par Vite vers l'API déployée sur `mmi.unilim.fr` : le back doit
donc être en place sur le serveur (voir Déployer).

Ce relais (le proxy de `vite.config.js`) fait croire au navigateur que front
et API sont sur le même site, sous le même chemin qu'en production. Les
cookies posés par l'API (préférences, session) sont donc acceptés et renvoyés
normalement. Sans lui, le front sur `localhost` appellerait directement
`mmi.unilim.fr` : deux sites différents, et le navigateur refuserait d'envoyer
les cookies.

Utilisez Chrome ou Firefox : les cookies de l'API sont `Secure`, et Safari
peut les refuser sur `http://localhost`.

## Déployer

```bash
npm run build
```

Le front compilé est produit dans `front/dist/`. Déposez ensuite dans votre
espace web, dans le dossier `SAE301/` : `.htaccess`, `back/` et `front/dist/`
(en gardant ce chemin). Inutile de déposer `front/node_modules/`.

L'application est alors à `https://mmi.unilim.fr/~votre_login/SAE301/`. Le
`.htaccess` sert les fichiers de `front/dist/`, et répond par
`front/dist/index.html` à toute autre adresse (`/admin`…) : c'est le routeur
du front qui affiche la bonne page, ou la page 404.

## Architecture du front

### Routeur (`lib/router.js`)

Déclaré dans `main.js`, sur le modèle de `react-router` :

```js
router.addLayout("/", RootLayout);
router.addRoute("/", CataloguePage);
router.addRoute("/admin", AdminPage);
router.addRoute("/produit/:slug", ProduitPage);   // params.slug dans la page
router.addRoute("*", The404Page);          // toujours en dernier
```

- Un lien interne porte `data-link` et un chemin de route, sans le chemin du
  projet : `<a href="/admin" data-link>`. Le routeur intercepte le clic,
  change l'adresse sans recharger, et complète lui-même le `href` avec le
  chemin du projet (comme `basename` dans `react-router`).
- Le lien de la page affichée reçoit `aria-current="page"`, que Tailwind
  cible avec `aria-[current=page]:…`.
- Une page renvoie une chaîne HTML (page statique) ou un fragment, ou une
  promesse de l'un des deux (page qui charge des données).
- Le layout est choisi par le plus long préfixe d'adresse. La page prend la
  place de son `<slot>` sans nom.

### Composants (`ui/`)

Un dossier par composant : le HTML et les classes Tailwind dans
`template.html`, le JavaScript dans `index.js`. Le composant expose
`html(data)` (chaîne) et/ou `dom(data, actions)` (fragment).

- `{{cle}}` dans un template est remplacé par la valeur correspondante,
  **échappée** : un placeholder ne produit jamais que du texte. Pour insérer
  un autre composant, on utilise un `<slot name="…">`, que le JavaScript
  remplace (`slot.replaceWith(Composant.dom(…))`).
- Un template n'a ni boucle ni condition : une liste se construit avec un
  template par élément (`ui/statistiques/ligne-genre.html`), et un état
  (option choisie, bouton désactivé) se règle en JavaScript après
  `htmlToFragment`.
- Un composant ne décide de rien : il reçoit ses données, et signale les
  actions de l'utilisateur par les fonctions de `actions`
  (`surTri`, `surPage`…), comme les props `onChange` de React.
- Tailwind ne génère que les classes écrites en entier dans le code :
  `"text-red-700"`, jamais `"text-" + couleur`.

### Pages (`pages/`)

Une page dynamique suit le découpage Modèle / Contrôleur / Vue :

- `M` contient l'état de la page (réponse de l'API, message affiché…) ;
- `C` contient les traitements : chargement des données, réactions aux
  actions de l'utilisateur ;
- `V` construit la page à partir de `M`. Après chaque changement, toute la
  page est reconstruite et remplace l'ancienne (`V.rafraichir()`) :
  l'affichage se déduit de l'état, on ne le retouche pas morceau par morceau.

## L'API

| Route | Effet |
|---|---|
| `GET /api/produits?categorie=manettes` | le catalogue, entier ou d'une catégorie |
| `GET /api/produit?slug=…` | la fiche d'un produit et ses images |
| `GET /api/categories` | les catégories et leur nombre de produits |
| `POST /api/panier` | détail du panier, corps `{"lignes": [{"variantId", "quantite"}]}` : prix et totaux calculés par le serveur |
| `POST /api/inscription` | création de compte, corps `{"email", "mdp"}` |
| `POST /api/login` | connexion, corps `{"email", "mdp"}` |
| `POST /api/logout` | déconnexion |
| `GET /api/session` | l'utilisateur connecté, s'il y en a un |
| `POST /api/commande` | validation de commande (client connecté), corps `{"lignes"}` |
| `GET /api/commande?numero=…` | une commande du client connecté |
| `POST /api/admin/login` · `POST /api/admin/logout` · `GET /api/admin/session` | connexion au back-office, séparée de celle des clients (comptes `admin` uniquement) |
| `GET /api/admin/tableau-de-bord` | indicateurs du back-office (admin) |
| `POST /api/admin/commande/statut` | changement de statut d'une commande (rôle `admin`), corps `{"numero", "statut"}` ; l'annulation recrédite le stock |

L'API ne répond jamais 401 : sur mmi.unilim.fr, l'espace web est déjà protégé
par l'authentification HTTP d'Apache, et un 401 ferait redemander au
navigateur les identifiants de l'IUT. Non connecté : 403 ; identifiants
incorrects : 422.

Tests (curl, sans dépendance) : `tests/commande.sh`, `tests/stock.sh` et
`tests/mouvements-stock.sh`, avec l'URL du projet en argument. Le dernier écrit
en base (commandes annulées, journal) et vérifie la concurrence sur la dernière
unité : avec `php -S`, lancer le serveur avec `PHP_CLI_SERVER_WORKERS=6`.

## Comptes

Comptes de test créés par `sql/import.sql` (mots de passe stockés en bcrypt) :

| Adresse e-mail | Mot de passe | Rôle |
|---|---|---|
| `client@playstation.test` | `client1234` | `client` |
| `admin@playstation.test` | `admin1234` | `admin` |

Un visiteur peut aussi créer son compte depuis la page `/connexion`. Le compte
admin se connecte uniquement par `/admin` : les deux connexions sont séparées.

## Si ça ne marche pas

| Symptôme | Cause probable |
|---|---|
| Un listing de dossiers, ou une erreur 404 sur la racine | le `.htaccess` n'a pas été déposé, ou `front/dist/` est absent (lancer `npm run build`) |
| Page blanche, fichiers `assets/…` en 404 | `BASE` de `vite.config.js` ne correspond pas au dossier de dépôt |
| « Impossible de charger le catalogue » | identifiants de `config.php`, ou tables non importées |
| Les réglages ne sont jamais retenus, la connexion ne tient pas | `chemin` de `config.php` ne correspond pas au dossier de dépôt |
| En développement, l'API répond 404 | le back n'est pas déployé sur le serveur, ou `BASE` est faux |
