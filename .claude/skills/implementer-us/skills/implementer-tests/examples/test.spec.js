import { test, expect } from "@playwright/test";
import { formaterPrix } from "../../src/lib/format.js";
import { connecterAdmin, creerClient, lire, preparerPanier } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// XXX-a : titre de l'US (docs/user-stories.md).

test.describe("XXX-a · DoD spécifique", () => {
  // Lecture seule : rien à nettoyer.
  test("DoD : texte exact du premier point @lecture", async ({ page }) => {
    let { produits } = await lire(page, "produits");
    let produit = produits.find((element) => element.etat_stock === "en_stock");

    await preparerPanier(page, [{ variantId: produit.variante_id, quantite: 1 }]);
    await page.goto("panier");
    await expect(page.getByRole("complementary"), "total du panier").toContainText(formaterPrix(produit.prix));
  });

  test.describe("avec écriture", () => {
    let produit = null;

    test.afterEach(async ({ page }) => {
      await supprimerProduitTest(page, produit);
      produit = null;
      nettoyerClientsTest();
    });

    test("DoD : texte exact du second point @ecriture", async ({ page }) => {
      await connecterAdmin(page);
      produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 5, prix: 10 }]);

      await creerClient(page);
      let { statut } = await commander(page, [{ variantId: produit.variantes[0].id, quantite: 1 }]);
      expect(statut).toBe(201);
    });
  });
});

test.describe("XXX-a · critères d'acceptation", () => {
  test("Critère : texte exact du critère @lecture", async ({ page }) => {
    await page.goto("");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

testerDodCommune("XXX-a", {
  pages: [{ chemin: "/panier" }, { chemin: "/compte", connexion: "client" }],
  formulaires: [
    {
      chemin: "/compte/profil",
      connexion: "client",
      bouton: "Enregistrer les modifications",
      api: { chemin: "compte/profil", corps: { prenom: "", nom: "", email: "" } },
    },
  ],
  reservees: [{ chemin: "/compte", droit: "client", api: "compte" }],
});
