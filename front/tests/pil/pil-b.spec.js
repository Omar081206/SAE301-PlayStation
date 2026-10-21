import { test, expect } from "@playwright/test";
import { CLIENT_TEST, connecterAdmin, creerClient, envoyer, lire } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { ouvrir, testerDodCommune } from "../outils/dod-commune.js";

// PIL-b : gestion des commandes (docs/user-stories.md).

// Client des commandes créées par les tests @ecriture, tel que l'affiche le back-office.
const NOM_CLIENT_TEST = `${CLIENT_TEST.prenom} ${CLIENT_TEST.nom}`;

/**
 * Commandes du back-office, sans celles des tests @ecriture lancés en même
 * temps (supprimées à la fin de leur test).
 *
 * @param {import("@playwright/test").Page} page  avec une session admin
 */
async function commandesReelles(page) {
  let { commandes } = await lire(page, "admin/commandes");
  return commandes.filter((commande) => commande.client !== NOM_CLIENT_TEST);
}

test.describe("PIL-b · DoD spécifique", () => {
  let produit = null;

  test.afterEach(async ({ page }) => {
    // Le test @lecture du fichier ne crée rien : rien à nettoyer.
    if (produit === null) {
      return;
    }
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();
  });

  test("DoD : confirmation demandée avant toute annulation @lecture", async ({ page }) => {
    await ouvrir(page, { chemin: "/admin/commandes", connexion: "admin" });
    let cible = (await commandesReelles(page)).find((commande) => commande.suivants.includes("annulee"));
    test.skip(cible === undefined, "aucune commande annulable");

    // On ouvre la confirmation, puis on garde la commande : rien ne change.
    await page.getByRole("button", { name: `Annuler la commande ${cible.numero}` }).filter({ visible: true }).click();
    let dialogue = page.getByRole("dialog");
    await expect(dialogue).toBeVisible();
    await expect(dialogue.getByRole("button", { name: "Confirmer l’annulation" })).toBeVisible();
    await dialogue.getByRole("button", { name: "Garder la commande" }).click();
    await expect(dialogue).toBeHidden();

    let { commande } = await lire(page, `admin/commande?numero=${cible.numero}`);
    expect(commande.statut, "statut inchangé").toBe(cible.statut);
  });

  test("DoD : journal des modifications effectuées par les administrateurs @ecriture", async ({ page }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 5, prix: 10 }]);
    await creerClient(page);
    let { corps } = await commander(page, [{ variantId: produit.variantes[0].id, quantite: 1 }]);
    let numero = corps.commande.numero;

    let { statut } = await envoyer(page, "admin/commande/statut", { numero, statut: "disponible" });
    expect(statut).toBe(200);

    let { commande } = await lire(page, `admin/commande?numero=${numero}`);
    expect(commande.historique).toEqual([
      expect.objectContaining({ ancien: "en_cours", nouveau: "disponible", par: expect.any(String) }),
    ]);

    await page.goto(`admin/commandes/${numero}`);
    let journal = page.getByRole("heading", { name: "Journal des modifications" }).locator("..");
    await expect(journal).toContainText(/disponible/i);
  });
});

testerDodCommune("PIL-b", {
  pages: [
    { chemin: "/admin/commandes", connexion: "admin" },
    { chemin: async (page) => `/admin/commandes/${(await commandesReelles(page))[0].numero}`, connexion: "admin" },
  ],
  reservees: [{ chemin: "/admin/commandes", droit: "admin", api: "admin/commandes" }],
});
