import { test, expect } from "@playwright/test";
import { connecterAdmin, creerClient } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// SUI-c : historique des commandes (docs/user-stories.md).

// Commandes par page de l'historique (CompteController::PAR_PAGE).
const PAR_PAGE = 10;

test.describe("SUI-c · DoD spécifique", () => {
  let produit = null;

  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();
  });

  test("DoD : pagination si nécessaire @ecriture", async ({ page }) => {
    await connecterAdmin(page);
    // Juste le stock des commandes du test : un stock plus grand pourrait le mettre en promotion (PRO-c).
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: PAR_PAGE + 1, prix: 10 }]);

    // Une commande de plus qu'une page.
    await creerClient(page);
    for (let i = 0; i <= PAR_PAGE; i++) {
      let { statut } = await commander(page, [{ variantId: produit.variantes[0].id, quantite: 1 }]);
      expect(statut).toBe(201);
    }

    await page.goto("compte/commandes");
    let pages = page.getByRole("navigation", { name: "Pages" });
    await expect(pages).toBeVisible();
    let details = page.getByRole("link", { name: /Voir le détail de la commande/ }).filter({ visible: true });
    await expect(details).toHaveCount(PAR_PAGE);

    await pages.getByRole("button", { name: "Suivante ›" }).click();
    await expect(details, "deuxième page").toHaveCount(1);

    await pages.getByRole("button", { name: "‹ Précédente" }).click();
    await expect(details, "retour à la première page").toHaveCount(PAR_PAGE);
  });
});

testerDodCommune("SUI-c", {
  pages: [{ chemin: "/compte/commandes", connexion: "client" }],
  reservees: [{ chemin: "/compte/commandes", droit: "client", api: "compte/commandes" }],
});
