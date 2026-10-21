---
name: implementer-tests
description: Écrit les tests Playwright d'une US (front/tests/<epic>/<us>.spec.js) — un test par point de DoD spécifique, un par critère d'acceptation, et les six points de la DoD commune — puis les lance une première fois. À utiliser après l'implémentation d'une US (depuis implementer-us), ou seul pour écrire les tests d'une US déjà faite.
---

# Écrire les tests d'une US

Gabarit : `examples/test.spec.js`. Configuration : `front/playwright.config.js`. Outils partagés : `front/tests/outils/`.
Références dans le code : `tests/cmd/cmd-b.spec.js` (lecture seule, panier), `tests/cmd/cmd-c.spec.js` (session,
requête SQL de contrôle, formulaires), `tests/cmd/cmd-a.spec.js` (écriture et parcours de bout en bout),
`tests/dec/dec-c.spec.js` (données lues dans l'API).

## Ce que contient le fichier

Un fichier par US, rangé dans le dossier de son epic : `front/tests/<epic>/<us>.spec.js` (en minuscules,
ex. `tests/cmd/cmd-a.spec.js`), dans l’ordre :

1. `test.describe("<US> · DoD spécifique")` : **un test par point** de la DoD spécifique de `docs/user-stories.md`,
   titré `DoD : <texte exact du point>`.
2. `test.describe("<US> · critères d'acceptation")` : **un test par critère**, titré `Critère : <texte exact>`.
   Un critère non vérifié par un test n'est pas couvert : l'US n'est pas terminée.
3. `testerDodCommune("<US>", { pages, formulaires, reservees })` : les six points de la DoD commune, sur les
   pages, formulaires et routes réservées **que l'US ajoute ou modifie**. `formulaires` et `reservees` vides : les
   tests correspondants sont marqués « sans objet » (ignorés, avec la raison).

Chaque titre finit par une étiquette :
- `@lecture` : le test ne modifie pas la base (lectures, `localStorage`, saisies refusées, confirmation annulée) ;
- `@ecriture` : il crée ou modifie des lignes. Il ne travaille que sur **ses propres données** (`outils/donnees.js`) :
  produit `creerProduitTest`, client `creerClient`, commandes de ce client, tout supprimé dans `afterEach`
  (`supprimerProduitTest`, `nettoyerClientsTest`). Jamais sur un produit, un compte ou une commande existants.

## Outils (`front/tests/outils/`)

| Fichier | Fonctions |
|---|---|
| `api.js` | `lire` (GET, 200 attendu), `envoyer` (POST → `{ statut, corps }`), `connecterClient`, `connecterAdmin`, `creerClient`, `lirePanier`, `preparerPanier`, `COMPTES`, `PREFIXE` |
| `donnees.js` | `creerProduitTest`, `modifierProduitTest`, `supprimerProduitTest`, `nettoyerClientsTest`, `commander` |
| `dod-commune.js` | `testerDodCommune`, `ouvrir` (session, panier, chemin calculé, geste `avant`) |
| `serveur.js` | `requeteBase` (SQL : seulement ce qu'aucune route n'expose, et le nettoyage), `git` |
| `w3c.js` | `erreursHtml`, `erreursCss` : validateurs du W3C par `fetch` (Cloudflare refuse `page.request`), envois espacés et mis en cache |

Un besoin que ces outils ne couvrent pas : ajoute la fonction à l'outil concerné (JSDoc, même forme), pas dans le
fichier de l'US, et signale-le dans le compte rendu.

## Étapes

1. **Lire l'US** dans `docs/user-stories.md` : DoD spécifique, critères d'acceptation. Lister les pages, formulaires,
   routes réservées de l'US (plan validé, `front/src/main.js`, `back/src/routes.php`).
2. **Lire le code de l'US** pour viser juste : libellés et `aria-label` des templates, messages des contrôleurs,
   forme des réponses (PHPDoc). Vérifier une réponse avec `curl` en cas de doute.
3. **Écrire le fichier** à partir du gabarit :
   - cibler comme l'utilisateur : `getByRole` + nom accessible, `getByLabel`, `getByText` ; jamais une classe CSS ;
   - données lues dans l'API (`lire(page, "produits")`) plutôt que des slugs en dur, sauf pour les pages de la
     DoD commune (seeds de `sql/import.sql`) ;
   - prix comparés avec `formaterPrix` (`../src/lib/format.js`), comme les affiche l'application ;
   - un `expect` porte un message quand l'échec serait ambigu (`expect(x, "panier ajusté")`).
4. **Lancer** les tests de l'US, sans les `@ecriture` sauf accord (voir `verifier-tests`) :
   `cd front && npx playwright test tests/<epic>/<us>.spec.js --grep-invert @ecriture`.
5. **Trier chaque échec** (trace : `npx playwright show-trace <chemin>`) :
   - erreur du test (sélecteur, attente) : corriger le test ;
   - écart de l'application avec la DoD ou un critère : **corriger le code de l'US** si le fichier est dans le plan
     validé, sinon s'arrêter et demander. Ne jamais affaiblir un test pour le faire passer.

## Compte rendu

Tableau point de DoD / critère → test → réussi, échoué (pourquoi), ignoré (raison), non lancé (`@ecriture`) ;
corrections faites dans le code de l'US ; fonctions ajoutées aux outils ; bugs trouvés hors de l'US.

## Contraintes

- Aucune donnée existante modifiée ; aucun identifiant dans le fichier (comptes : `COMPTES`, variables d'environnement).
- Pas de `waitForTimeout` : les `expect` attendent d'eux-mêmes.
- Code et commentaires en français, JSDoc sur chaque fonction, comme le reste du dépôt.
