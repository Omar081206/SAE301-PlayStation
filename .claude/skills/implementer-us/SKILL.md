---
name: implementer-us
description: Implémente une user story (CMD-b, DEC-a…) à partir de sa maquette Figma, en ne chargeant que les sous-skills dont elle a besoin (sql, api, data, composant, page). À utiliser quand on demande d'implémenter, intégrer ou coder une US ou un écran, ou quand la demande contient un lien figma.com.
---

# Implémenter une US (orchestrateur)

Ce skill cadre l'US, fait valider un plan, puis délègue chaque couche à un sous-skill. Il n'écrit pas de code lui-même.

Référentiels : `docs/user-stories.md` (critères + DoD) · `docs/maquettes.md` (comment trouver un écran) ·
`docs/ordre-us.md` (ordre et dépendances) · `AGENTS.md` (fonctionnement de l'app, règles front / back).

## Sous-skills

Dans `skills/` (aussi appelables seuls par leur nom, via `.claude/skills/`) :

| Sous-skill | Quand l'utiliser | Produit |
|---|---|---|
| `implementer-sql` | l'US crée ou modifie une table, une colonne, des seeds | `ALTER` sur la base + `sql/import.sql` |
| `implementer-api` | l'US a besoin d'une route, ou modifie une réponse de l'API | `routes.php`, `index.php`, `Controller/`, `Model/` |
| `implementer-data` | le front appelle une route nouvelle ou modifiée, ou stocke côté navigateur | `front/src/data/` |
| `implementer-composant` | un bloc de la maquette n'existe pas encore dans `ui/`, ou change | `front/src/ui/<nom>/`, tokens `global.css` |
| `implementer-page` | l'US ajoute un écran, ou change le comportement d'une page | `front/src/pages/<nom>/`, `main.js`, layouts |

Une US n'utilise souvent qu'une partie d'entre eux (une US purement back n'a pas de composant ; une retouche
d'affichage n'a pas d'API). **N'en charge aucun qui ne soit pas dans le plan validé.**

## Étapes

1. **Cadrer.** Lis l'US dans `docs/user-stories.md` (critères + DoD). Vérifie ses dépendances dans `docs/ordre-us.md`
   et `git branch --merged main` ; si une dépendance bloquante n'est pas fusionnée, arrête-toi et dis laquelle.
2. **Lire la maquette.** Retrouve l'écran avec la méthode de `docs/maquettes.md` (ou le lien donné), puis, avec le
   MCP Figma : `get_design_context` en Desktop 1440, Tablette 768 et Mobile 375, `get_variable_defs`, `get_screenshot`.
   C'est une **référence**, pas du code à coller. Pas d'écran trouvé ou MCP Figma indisponible : arrête-toi et demande.
3. **Inventorier.** Cherche ce qui existe déjà : composants `ui/`, tokens `global.css`, routes `routes.php`,
   modules `data/`, tables `sql/import.sql`. Réutilise avant de créer.
4. **Plan, puis attendre ma validation.** Présente :
   - les **sous-skills retenus** (et pourquoi les autres ne servent pas) ;
   - un tableau fichier par fichier, dans l'ordre SQL → API → data → composants → page, avec « créé » ou
     « modifié » : **tout fichier existant à modifier doit y figurer** ;
   - pour chaque critère d'acceptation, le fichier qui le couvre ;
   - les changements de schéma (la base vivante sera modifiée par `ALTER`) ;
   - les questions ouvertes (écran ou état manquant dans la maquette, écart avec le code de référence).
   **N'écris rien (code, base, branche) avant le feu vert.** « go » ne vaut pas validation d'un plan non présenté.
5. **Implémenter**, uniquement cette US, en appelant chaque sous-skill retenu dans l'ordre du plan
   (outil Skill avec son nom, ou lecture de `skills/<nom>/SKILL.md`). Un besoin hors plan apparaît (fichier,
   table, route) : arrête-toi et demande avant de l'ajouter.
6. **Vérifier** : `verifier-back` si le plan touche `back/` ou `sql/`, `verifier-front` s'il touche `front/`.
7. **Compte rendu** : fichiers créés / modifiés ; sous-skills utilisés ; tableau critère → couvert / non couvert /
   non vérifié ; écarts avec la maquette et avec le code de référence ; tokens ajoutés ; modifications de la base ;
   résultats des vérifications ; prochaine US (ordre de `docs/ordre-us.md`).

## Contraintes

- Ne committe pas sans demande (voir AGENTS.md, Git). Ne touche pas aux autres US, même proches.
- Pas d'écran inventé : si la maquette manque un état (vide, erreur, chargement), propose-le dans le plan.
- Si un test révèle un bug, signale-le au lieu d'affaiblir le test ou le critère.
