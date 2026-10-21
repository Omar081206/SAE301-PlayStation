import { test, expect } from "@playwright/test";
import { formaterPrix } from "../../src/lib/format.js";
import { lire, lirePanier, preparerPanier } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// CMD-b : panier d'achat (docs/user-stories.md).

/**
 * Produits en stock du catalogue (variante par défaut disponible).
 *
 * @param {import("@playwright/test").Page} page
 */
async function produitsEnStock(page) {
  let { produits } = await lire(page, "produits");
  return produits.filter((produit) => produit.etat_stock === "en_stock");
}

test.describe("CMD-b · DoD spécifique", () => {
  test("DoD : panier persistant en local (stockage du navigateur) @lecture", async ({ page }) => {
    let [produit] = await produitsEnStock(page);

    await page.goto("");
    await page.getByRole("button", { name: `Ajouter ${produit.nom} au panier` }).click();
    await expect(page.getByRole("link", { name: "Panier, 1 article" })).toBeVisible();

    // Le navigateur ne garde que la variante et la quantité, jamais le prix.
    expect(await lirePanier(page)).toEqual([{ variantId: produit.variante_id, quantite: 1 }]);

    // Restauré d'une visite à l'autre : nouvel onglet, même navigateur.
    let autre = await page.context().newPage();
    await autre.goto("panier");
    await expect(autre.getByRole("link", { name: produit.nom, exact: true })).toBeVisible();
    await expect(autre.getByRole("link", { name: "Panier, 1 article" })).toBeVisible();
  });

  test("DoD : totaux recalculés à chaque modification du panier @lecture", async ({ page }) => {
    let [premier, second] = await produitsEnStock(page);
    // Un faux prix glissé dans le stockage est ignoré : le total vient du serveur.
    await preparerPanier(page, [
      { variantId: premier.variante_id, quantite: 1, prix: 0.01 },
      { variantId: second.variante_id, quantite: 1, prix: 0.01 },
    ]);

    await page.goto("panier");
    let resume = page.getByRole("complementary");
    await expect(resume).toContainText(formaterPrix(premier.prix + second.prix));

    await page.getByRole("button", { name: `Ajouter un exemplaire de ${premier.nom}` }).click();
    await expect(resume, "après +1").toContainText(formaterPrix(2 * premier.prix + second.prix));

    await page.getByRole("button", { name: `Supprimer ${second.nom} du panier` }).click();
    await expect(resume, "après suppression").toContainText(formaterPrix(2 * premier.prix));

    expect(await lirePanier(page)).toEqual([expect.objectContaining({ variantId: premier.variante_id, quantite: 2 })]);
  });
});

testerDodCommune("CMD-b", {
  pages: [{ chemin: "/panier", panier: [{ variantId: 1, quantite: 1 }] }, { chemin: "/panier" }],
});
