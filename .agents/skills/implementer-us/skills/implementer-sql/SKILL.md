---
name: implementer-sql
description: Crée ou modifie le schéma et les seeds MySQL d'une US (table, colonne, index, données de départ), sur la base vivante par ALTER et dans sql/import.sql. À utiliser seul ou depuis implementer-us, après validation du plan.
---

# Implémenter la partie SQL d'une US

Règle de détail : `.agents/rules/back-php.md` (section SQL). Référence : `sql/import.sql` (tables existantes).

## Étapes

1. **Lire l'existant** : les `CREATE TABLE` concernés de `sql/import.sql` et leurs clés étrangères. Réutilise une
   table ou une colonne existante avant d'en créer une.
2. **Sauvegarder** les tables touchées : `mysqldump … <tables> > ~/sauvegarde-<us>-<table>.sql` (hors du dépôt).
3. **Modifier la base vivante** par des requêtes ciblées (`CREATE TABLE`, `ALTER TABLE`, `INSERT`), jamais en
   rejouant `import.sql`, jamais en vidant une table. Les lignes existantes (comptes, commandes) doivent survivre :
   prévois une valeur par défaut ou une migration des données dans le même `ALTER` / `UPDATE`.
4. **Reporter la même modification dans `sql/import.sql`**, au bon endroit :
   - `DROP TABLE IF EXISTS` en tête, dans l'ordre inverse des clés étrangères ;
   - `ENGINE=InnoDB`, `utf8mb4_unicode_ci`, clés étrangères explicites (`ON DELETE` choisi et justifié en commentaire) ;
   - index sur les colonnes triées ou filtrées ;
   - seeds réalistes (vrais produits PlayStation) dès que l'écran en a besoin.
5. Vérifier que le schéma de la base vivante et celui d'`import.sql` sont identiques pour les tables touchées
   (`SHOW CREATE TABLE`).

## Contraintes

- Pas de fichier de migration séparé : tout le schéma vit dans `import.sql`.
- Stock porté par la variante, lignes de panier et de commande identifiées par `variantId`, prix et options
  figés dans la ligne de commande.
- Toute suppression de données existantes : demande d'abord.
