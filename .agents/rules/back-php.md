---
trigger: glob
globs: "{back/**/*.php,sql/**/*.sql}"
---

# Back PHP et SQL (conventions du starter)

Modèles : `Controller/CategorieController.php`, `Controller/AdminCategorieController.php` (route admin),
`Model/CategorieModel.php`, `Model/CommandeModel.php` (transaction), `routes.php`, `index.php`.
Gabarits : `.agents/skills/implementer-us/skills/implementer-api/examples/`.

- Chaque fichier : `<?php` + `declare(strict_types=1);`, `namespace App\Controller|App\Model`, `final class`,
  propriétés / paramètres / retours typés, PHPDoc en français.
- **Contrôleur** : reçoit son modèle (et `$chemin` si besoin) par le constructeur ; méthode publique
  `nom(Request $requete): void` ; valide l'entrée (liste blanche en `private const`, bornes, types) ;
  lit via `$requete->parametre('cle')` / `$requete->corps()` ; répond par `Response::json([...], statut)`
  ou `Response::erreur('message en français', statut)` (qui terminent le script : rien après).
- **Modèle** : reçoit `PDO` par le constructeur, ne décide de rien, renvoie des tableaux. Requêtes préparées
  (`bindValue` + `PDO::PARAM_INT`) ; un identifiant SQL (`ORDER BY`, colonne) ne vient que d'une liste blanche
  du contrôleur. Convertis les nombres (MySQL renvoie des chaînes) avant le JSON.
- **Ajouter une route** : 1) ligne dans `routes.php` (`'GET  /api/produits' => [ProduitController::class, 'index']`) ;
  2) instance dans le tableau `$controleurs` de `index.php` avec son modèle. Écritures : `POST /api/<ressource>/<action>`. Le routeur compare l'adresse **exacte** :
  pas de `/api/produit/12`, utilise `GET /api/produit?slug=...` (ne modifie pas `Core/Router.php` sans accord).
- **Droits** : client connecté = `$_SESSION['id']` ; administrateur = `$_SESSION['admin']` (session séparée, voir
  `AdminCategorieController::verifierAdmin`). Absent → **403**, jamais 401 (l'espace web est derrière l'authentification
  HTTP d'Apache : un 401 ferait redemander les identifiants IUT). Identifiants faux → 422. `session_regenerate_id(true)` à la
  connexion ; mots de passe avec `password_hash` / `password_verify` ; aucun rôle, prix ou statut lu depuis le client.
- Écritures de commande / stock : transaction PDO (`beginTransaction`, `commit`, `rollBack` dans un `catch`),
  stock vérifié et décrémenté dans la même transaction (`SELECT … FOR UPDATE`).
- Le panier vit dans le `localStorage` du navigateur : pas de table ni de session panier. Les endpoints reçoivent les lignes
  (`variantId`, `quantite`) et **recalculent** prix, stock et totaux depuis la base ; ils ne font jamais confiance au client.
- API : JSON uniquement. Lignes = colonnes SQL en snake_case (`etat_stock`), enveloppe et réglages en camelCase (`pagesTotal`).
- Base : **ne jamais exécuter `sql/import.sql`** ni vider une table sans accord. Changement de schéma = sauvegarde,
  `ALTER` ciblé sur la base vivante, et même modification reportée dans `import.sql` (voir skill `implementer-sql`).
- SQL (`sql/import.sql`) : reste rejouable (`DROP TABLE IF EXISTS` dans l'ordre inverse des clés étrangères, `SET NAMES utf8mb4`),
  `InnoDB`, `utf8mb4_unicode_ci`, index sur les colonnes triées / filtrées, seeds dès la première US qui lit des données.
  Décisions de modélisation : une variante par défaut dès le départ, stock porté par la variante,
  panier et lignes de commande identifiés par `variantId`, prix unitaire figé dans la ligne de commande.
