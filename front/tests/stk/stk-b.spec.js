import { test, expect } from "@playwright/test";
import { connecterAdmin, lire } from "../outils/api.js";
import { creerProduitTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// STK-b : affichage des stocks (docs/user-stories.md).

const ETATS = ["en_stock", "bientot_epuise", "epuise"];

test.describe("STK-b · DoD spécifique", () => {
  test("DoD : champs de stock ajoutés à la base de données @lecture", async ({ page }) => {
    let { produits } = await lire(page, "produits");

    for (let resume of produits) {
      expect(ETATS, `état de ${resume.slug}`).toContain(resume.etat_stock);
      expect(resume, "le stock lui-même n'est jamais envoyé").not.toHaveProperty("stock");
    }

    let { produit } = await lire(page, `produit?slug=${produits[0].slug}`);
    for (let variante of produit.variantes) {
      expect(ETATS).toContain(variante.etat_stock);
      expect(variante).not.toHaveProperty("stock");
    }
  });

  test.describe("niveaux de stock", () => {
    let crees = [];

    test.afterEach(async ({ page }) => {
      for (let produit of crees) {
        await supprimerProduitTest(page, produit);
      }
      crees = [];
    });

    test("DoD : tests avec différents niveaux de stock @ecriture", async ({ page }) => {
      await connecterAdmin(page);
      let { seuil } = await lire(page, "admin/produits");

      // Un produit par niveau : au-dessus du seuil, au seuil, à zéro.
      let niveaux = [
        { stock: seuil + 5, libelle: "En stock" },
        { stock: seuil, libelle: "Bientôt épuisé" },
        { stock: 0, libelle: "Épuisé" },
      ];
      let couleurs = new Set();

      for (let niveau of niveaux) {
        let produit = await creerProduitTest(page, [{ valeur: "Unique", stock: niveau.stock, prix: 10 }]);
        crees.push(produit);

        await page.goto(`produit/${produit.slug}`);
        let badge = page.getByRole("heading", { level: 1 }).locator("xpath=preceding-sibling::p[1]/span");
        await expect(badge, `stock ${niveau.stock}`).toHaveText(niveau.libelle);
        couleurs.add(await badge.evaluate((element) => getComputedStyle(element).backgroundColor));
      }

      expect(couleurs.size, "un style par état").toBe(3);
    });
  });
});

testerDodCommune("STK-b", {
  pages: [{ chemin: "/" }, { chemin: "/produit/saros" }],
});
