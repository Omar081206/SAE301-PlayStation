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

/**
 * La liste que la page va demander à l'API (GET /api/produits, tout le
 * catalogue ou une catégorie), à attendre avant le geste qui la déclenche.
 * La page est comparée à ses propres données : les tests @ecriture lancés en
 * même temps créent et suppriment des produits.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string | null} [categorie]  slug, ou null pour tout le catalogue
 * @returns {Promise<Array<Object>>} les produits reçus par la page
 */
async function produitsDemandes(page, categorie = null) {
  let reponse = await page.waitForResponse((element) => {
    let adresse = new URL(element.url());
    return adresse.pathname.endsWith("/api/produits") && adresse.searchParams.get("categorie") === categorie;
  });
  return (await reponse.json()).produits;
}

test.describe("DEC-a · DoD spécifique", () => {
  test("DoD : filtrage fonctionnel (en JavaScript ou par rechargement de la page) @lecture", async ({ page }) => {
    let { categories } = await lire(page, "categories");
    let categorie = categories[0];

    let catalogue = produitsDemandes(page);
    await page.goto("");
    let tous = await catalogue;
    await expect(page.getByRole("article")).toHaveCount(tous.length);

    // Seulement les produits de la catégorie, tous affichés.
    let filtre = produitsDemandes(page, categorie.slug);
    await lienCategorie(page, categorie.nom).click();
    let filtres = await filtre;
    expect(filtres.length, `produits de ${categorie.nom}`).toBeGreaterThan(0);
    expect(filtres.length, "moins de produits que le catalogue").toBeLessThan(tous.length);
    expect(filtres.every((produit) => produit.categorie_slug === categorie.slug), "aucun produit d'une autre catégorie").toBe(true);
    await expect(page.getByRole("article"), `produits de ${categorie.nom}`).toHaveCount(filtres.length);

    let retour = produitsDemandes(page);
    await lienCategorie(page, "Tous les produits").click();
    await expect(page.getByRole("article"), "filtre réinitialisé").toHaveCount((await retour).length);
  });

  test("DoD : URLs propres (/categorie/nom-categorie) @lecture", async ({ page }) => {
    let { categories } = await lire(page, "categories");
    let categorie = categories[0];

    await page.goto("");
    // Le clic charge déjà les produits de la catégorie : on attend cette
    // réponse, pour que l'attente suivante ne la confonde pas avec celle de
    // l'adresse ouverte directement.
    let clic = produitsDemandes(page, categorie.slug);
    await lienCategorie(page, categorie.nom).click();
    await expect(page).toHaveURL(new RegExp(`/categorie/${categorie.slug}$`));
    await clic;

    // L'adresse ouverte directement donne le même filtre.
    let filtre = produitsDemandes(page, categorie.slug);
    await page.goto(`categorie/${categorie.slug}`);
    let filtres = await filtre;
    expect(filtres.every((produit) => produit.categorie_slug === categorie.slug), "aucun produit d'une autre catégorie").toBe(true);
    await expect(page.getByRole("article")).toHaveCount(filtres.length);
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
