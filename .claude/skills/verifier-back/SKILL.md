---
name: verifier-back
description: Vérifie le back (back/src, sql/import.sql) : conventions PHP (contrôleur / modèle, typage, PHPDoc), syntaxe, réponses de l'API et codes d'erreur, sécurité (droits, requêtes préparées) et cohérence du schéma. À utiliser avant de conclure toute modification de back/ ou sql/, ou pour relire du code PHP.
---

# Vérifier le back

Script partagé : `.claude/scripts/check-conventions.mjs` (depuis la racine du projet).

## Étapes

1. **Syntaxe.** `php -l` sur chaque fichier PHP modifié : le back est servi en direct, une erreur casse le site.
2. **Conventions.** `node .claude/scripts/check-conventions.mjs --back` (fichiers modifiés selon git ;
   `--all` pour tout le back). Corriger chaque erreur, relancer jusqu'à « OK ».
   Avertissements « variable insérée dans du SQL » : vérifier à la main que la variable est une liste de marqueurs
   `?` liés ou un identifiant d'une liste blanche ; sinon, corriger.
3. **Réponses de l'API**, avec `curl` sur `https://mmi.unilim.fr/~hadj-zekri1/SAE301/api/...` (cookie de session
   dans un fichier `-c` / `-b` du scratchpad) pour chaque route ajoutée ou modifiée :
   - cas nominal : statut 200 / 201 et forme du JSON conforme au PHPDoc et au module `data/` ;
   - sans session ou avec la mauvaise session (client sur une route admin) : **403**, jamais 401 ;
   - saisie invalide : 422 avec un message en français ; ressource absente : 404 ; conflit (stock, doublon) : 409 ;
   - une valeur envoyée par le client (prix, rôle, quantité au-delà du stock) n'est jamais reprise telle quelle.
   Utilise un compte de test à toi ; supprime ensuite les données créées.
4. **Écritures concurrentes** (commande, stock) : la transaction verrouille (`FOR UPDATE`) et annule (`rollBack`)
   en cas d'erreur ; le stock ne passe jamais sous zéro.
5. **Schéma.** Si `sql/import.sql` a changé : `SHOW CREATE TABLE` sur la base vivante identique au script pour les
   tables touchées ; script toujours rejouable (vérifié par le script de conventions), **sans l'exécuter**.
6. **Relecture** : aucune requête hors du modèle, aucune décision dans le modèle, aucun `$_GET` / `$_POST` direct,
   PHPDoc à jour, messages d'erreur en français.

## Compte rendu

Violations trouvées et corrigées ; routes testées avec statut obtenu / attendu ; modifications de la base ;
points non vérifiés (et pourquoi).

## Contraintes

- Ne modifie pas le script pour faire passer la vérification.
- N'exécute jamais `sql/import.sql` et ne touche pas aux comptes et commandes existants.
