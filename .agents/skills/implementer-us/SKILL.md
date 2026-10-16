---
name: implementer-us
description: Implémente une user story (CMD-b, DEC-a…) de bout en bout, SQL, API PHP, data, composants et page, à partir de sa maquette Figma. À utiliser quand on demande d'implémenter, intégrer ou coder une US ou un écran, ou quand la demande contient un lien figma.com.
---

# Implémenter une US depuis la maquette

Référentiels : @docs/user-stories.md (critères) · @docs/maquettes.md (écran → nodeId) · `README.md` section Analyse (ordre).
Gabarits : `examples/`. Règles : `front-mvc`, `back-php`, `integration-ui`.

## Étapes

1. **Cadrer.** Retrouve l'US dans `docs/user-stories.md` (critères + DoD). Vérifie ses dépendances bloquantes dans le
   README ; si l'une n'est pas terminée, arrête-toi et dis laquelle.
2. **Lire la maquette.** Prends les `nodeId` de l'écran dans `docs/maquettes.md` (ou le lien donné). Avec le MCP Figma :
   `get_design_context` en Desktop (1440) puis Tablette (768) et Mobile (375), `get_variable_defs`, `get_screenshot`.
   Le résultat est une **référence**, pas du code à coller : réécris en suivant les conventions du starter.
   Pas d'écran pour l'US, ou MCP Figma indisponible (serveur local `http://127.0.0.1:3845/mcp`, app Figma ouverte en
   Dev Mode) : arrête-toi et demande.
3. **Inventorier.** Cherche ce qui existe déjà : composants de `ui/`, tokens de `global.css`, routes, tables SQL.
   Réutilise avant de créer. Liste les variables Figma sans token.
4. **Plan, puis attendre ma validation.** Présente un tableau fichier par fichier (créé / modifié) : SQL → back (route,
   contrôleur, modèle) → data → tokens → `ui/` → page (M / C / V) → `main.js` / header. Pour chaque critère
   d'acceptation, indique le fichier qui le couvre. Liste les questions ouvertes. **N'écris rien avant le feu vert.**
5. **Implémenter**, uniquement cette US, dans l'ordre du plan, en calquant `examples/` :
   `page.js` + `page-template.html` · `ui-index.js` + `ui-template.html`, `ui-ligne.html`, `ui-vide.html` ·
   `data.js` · `Controller.php`, `Model.php`. Seeds SQL réalistes (noms de produits PlayStation) pour débloquer l'écran.
6. **Vérifier** (voir skill `verifier-conventions`) :
   - `node .agents/skills/verifier-conventions/scripts/check-conventions.mjs` jusqu'à « OK » ;
   - `npm run dev`, parcours complet de chaque critère, cas d'erreur (401, 403, vide, serveur indisponible) ;
   - comparaison avec `get_screenshot` à 375, 768 et 1440 px ;
   - validation W3C du DOM rendu.
7. **Compte rendu** : fichiers créés / modifiés (chemins) ; tableau critère d'acceptation → couvert / non couvert / non vérifié ;
   écarts avec la maquette ; tokens ajoutés ; résultat W3C ; prochaine US recommandée (ordre du README).

## Contraintes

- Ne committe pas. Ne touche pas aux autres US, même proches.
- Pas d'écran inventé : si la maquette manque un état (vide, erreur, chargement), propose-le dans le plan.
- Si un test révèle un bug, signale-le au lieu d'affaiblir le test ou le critère.
