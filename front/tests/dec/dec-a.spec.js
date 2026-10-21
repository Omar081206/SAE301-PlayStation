import { test, expect } from "@playwright/test";
import { lire } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// DEC-a : navigation par catégories (docs/user-stories.md).

/**
 * Lien d'une catégorie dans le menu « Catégories ».
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} nom
 */
function lienCategorie(page, nom) {
  return page.getByRole("navigation", { name: "Catégories" }).getByRole("link").filter({ hasText: nom });
}

test.describe("DEC-a · DoD spécifique", () => {
  test("DoD : filtrage fonctionnel (en JavaScript ou par rechargement de la page) @lecture", async ({ page }) => {
    let { categories, total } = await lire(page, "categories");
    let categorie = categories[0];

    await page.goto("");
    await expect(page.getByRole("article")).toHaveCount(total);

    await lienCategorie(page, categorie.nom).click();
    await expect(page.getByRole("article"), `produits de ${categorie.nom}`).toHaveCount(categorie.nombre);

    await lienCategorie(page, "Tous les produits").click();
    await expect(page.getByRole("article"), "filtre réinitialisé").toHaveCount(total);
  });

  test("DoD : URLs propres (/categorie/nom-categorie) @lecture", async ({ page }) => {
    let { categories } = await lire(page, "categories");
    let categorie = categories[0];

    await page.goto("");
    await lienCategorie(page, categorie.nom).click();
    await expect(page).toHaveURL(new RegExp(`/categorie/${categorie.slug}$`));

    // L'adresse ouverte directement donne le même filtre.
    await page.goto(`categorie/${categorie.slug}`);
    await expect(page.getByRole("article")).toHaveCount(categorie.nombre);
  });

  test("DoD : fil d'Ariane ou indication visuelle de la catégorie active @lecture", async ({ page }) => {
    let { categories } = await lire(page, "categories");
    let categorie = categories[0];

    await page.goto(`categorie/${categorie.slug}`);
    await expect(lienCategorie(page, categorie.nom)).toHaveAttribute("aria-current", "page");
    await expect(lienCategorie(page, "Tous les produits")).not.toHaveAttribute("aria-current", "page");
  });
});

testerDodCommune("DEC-a", {
  pages: [{ chemin: "/" }, { chemin: "/categorie/manettes" }],
});
