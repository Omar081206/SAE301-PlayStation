import { test, expect } from "@playwright/test";
import { lire } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// DEC-c : détail d'un produit (docs/user-stories.md).

/**
 * Premier produit du catalogue qui a au moins deux images.
 *
 * @param {import("@playwright/test").Page} page
 */
async function produitAGalerie(page) {
  let { produits } = await lire(page, "produits");
  for (let resume of produits) {
    let { produit } = await lire(page, `produit?slug=${resume.slug}`);
    if (produit.images.length >= 2) {
      return produit;
    }
  }
  throw new Error("aucun produit à plusieurs images");
}

test.describe("DEC-c · DoD spécifique", () => {
  test("DoD : URL propre pour chaque produit (/produit/nom-produit) @lecture", async ({ page }) => {
    let { produits } = await lire(page, "produits");

    await page.goto("");
    await page.getByRole("article").first().getByRole("link", { name: produits[0].nom }).click();
    await expect(page).toHaveURL(new RegExp(`/produit/${produits[0].slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(produits[0].nom);

    // L'adresse ouverte directement affiche la même fiche.
    await page.goto(`produit/${produits[1].slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(produits[1].nom);
  });

  test("DoD : galerie d'images fonctionnelle (navigation entre les images) @lecture", async ({ page }) => {
    let produit = await produitAGalerie(page);
    await page.goto(`produit/${produit.slug}`);

    let suivante = page.getByRole("button", { name: "Image suivante" });
    let principale = suivante.locator("..").locator("img");
    let premiere = await principale.getAttribute("src");

    await suivante.click();
    await expect(principale, "image suivante").not.toHaveAttribute("src", premiere);

    await page.getByRole("button", { name: "Image précédente" }).click();
    await expect(principale, "retour à la première image").toHaveAttribute("src", premiere);

    await page.getByRole("button", { name: "Afficher l'image 2" }).click();
    await expect(page.getByRole("button", { name: "Afficher l'image 2" })).toHaveAttribute("aria-current", "true");
    await expect(principale, "miniature choisie").not.toHaveAttribute("src", premiere);
  });

  test("DoD : métadonnées pour le SEO @lecture", async ({ page }) => {
    let { produits } = await lire(page, "produits");
    let { produit } = await lire(page, `produit?slug=${produits[0].slug}`);

    await page.goto(`produit/${produit.slug}`);
    await expect(page).toHaveTitle(new RegExp(produit.nom));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", produit.description);
  });

  test("DoD : retour vers la catégorie d'origine @lecture", async ({ page }) => {
    let { categories } = await lire(page, "categories");
    let categorie = categories[1];

    await page.goto(`categorie/${categorie.slug}`);
    await page.getByRole("article").first().getByRole("heading").getByRole("link").click();
    await expect(page).toHaveURL(/\/produit\//);

    await page.getByRole("link", { name: `‹ Retour à ${categorie.nom}` }).click();
    await expect(page).toHaveURL(new RegExp(`/categorie/${categorie.slug}$`));
  });
});

testerDodCommune("DEC-c", {
  pages: [{ chemin: "/produit/manette-sans-fil-dualsense" }],
});
