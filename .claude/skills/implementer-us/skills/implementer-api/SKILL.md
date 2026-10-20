---
name: implementer-api
description: Ajoute ou modifie une route de l'API PHP (routes.php, enregistrement dans index.php, contrôleur, modèle) pour une US. À utiliser seul ou depuis implementer-us, après validation du plan.
---

# Implémenter la partie API d'une US

Règle de détail : `.claude/rules/back-php.md`. Gabarits : `examples/Controller.php`, `examples/Model.php`.
Références dans le code : `CategorieController.php` + `CategorieModel.php` (lecture publique),
`AdminCategorieController.php` (route admin, validation, 409), `CommandeModel.php` (transaction, `FOR UPDATE`).

## Étapes

1. **Choisir la route** : `GET /api/<ressource>?cle=` pour lire, `POST /api/<ressource>/<action>` pour écrire
   (le routeur compare l'adresse exacte, pas de paramètre dans le chemin). Vérifie dans `routes.php` qu'elle n'existe pas.
2. **Modèle** (`back/src/Model/`) : nouvelle méthode dans le modèle de la ressource s'il existe, sinon nouveau
   `<Nom>Model` calqué sur `CategorieModel`. Requêtes préparées, conversion des nombres, aucune décision.
3. **Contrôleur** (`back/src/Controller/`) : méthode `nom(Request $requete): void` qui vérifie les droits
   (403), valide l'entrée (422), appelle le modèle, répond par `Response::json` ou `Response::erreur`.
4. **Enregistrer** : une ligne dans `back/src/routes.php` ; pour un nouveau contrôleur, son instance avec ses
   modèles dans `$controleurs` de `back/index.php` (seule modification permise de ce fichier).
5. **Documenter** la forme de la réponse dans le PHPDoc de la méthode : c'est ce que reprendra `implementer-data`.

## Contraintes

- Le back est en ligne dès l'enregistrement du fichier : une erreur de syntaxe casse tout le site.
  Lance `php -l <fichier>` après chaque modification.
- Prix, stock, rôle et quantités sont relus en base, jamais pris dans la requête.
- Codes : 403 / 404 / 409 / 422, **jamais 401**.
