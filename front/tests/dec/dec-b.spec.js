import { test, expect } from "@playwright/test";
import { lire } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// DEC-b : catalogue de produits (docs/user-stories.md).

test.describe("DEC-b · DoD spécifique", () => {
  test("DoD : base de données initialisée avec les produits de test (au moins 3 catégories de 4 produits) @lecture", async ({
    page,
  }) => {
    let { categories } = await lire(page, "categories");
    let { produits } = await lire(page, "produits");

    let garnies = categories.filter(
      (categorie) => produits.filter((produit) => produit.categorie_slug === categorie.slug).length >= 4,
    );
    expect(garnies.length, "catégories d'au moins 4 produits").toBeGreaterThanOrEqual(3);
  });
});

testerDodCommune("DEC-b", {
  pages: [{ chemin: "/" }],
});
