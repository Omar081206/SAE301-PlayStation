import { test, expect } from "@playwright/test";
import { formaterPrix } from "../../src/lib/format.js";
import { PREFIXE, lire } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// OPT-c : choix des options (docs/user-stories.md).

/**
 * Fiches complètes des produits du catalogue. Les produits des tests
 * @ecriture lancés en même temps (e2e-…) peuvent disparaître : écartés.
 *
 * @param {import("@playwright/test").Page} page
 */
async function fiches(page) {
  let { produits } = await lire(page, "produits");
  let catalogue = produits.filter((element) => !element.slug.startsWith(`${PREFIXE}-`));
  return Promise.all(catalogue.map(async (resume) => (await lire(page, `produit?slug=${resume.slug}`)).produit));
}

test.describe("OPT-c · DoD spécifique", () => {
  test("DoD : modélisation des options en base de données (options définies par produit) @lecture", async ({
    page,
  }) => {
    let produits = await fiches(page);
    let avecOptions = produits.filter((produit) => produit.options.length > 0);
    let sansOption = produits.filter((produit) => produit.options.length === 0);

    // Le sujet demande des options pour chaque produit.
    expect(sansOption.map((produit) => produit.nom), "produits sans option").toEqual([]);

    // Des options différentes selon le produit (Coloris, Édition…).
    let noms = new Set(avecOptions.flatMap((produit) => produit.options.map((option) => option.nom)));
    expect(noms.size, "noms d'options différents").toBeGreaterThan(1);

    await page.goto(`produit/${avecOptions[0].slug}`);
    await expect(page.getByRole("group", { name: new RegExp(avecOptions[0].options[0].nom) })).toBeVisible();
  });

  test("DoD : interface dynamique (JavaScript) @lecture", async ({ page }) => {
    let produits = await fiches(page);
    // Un produit dont les variantes disponibles n'ont pas toutes le même prix.
    let produit = produits.find((element) => {
      let prix = element.variantes.filter((v) => v.etat_stock !== "epuise").map((v) => v.prix);
      return new Set(prix).size > 1 && element.options.length === 1;
    });
    test.skip(produit === undefined, "aucun produit à prix variable");

    let defaut = produit.variantes.find((v) => v.id === produit.variante_id);
    let autre = produit.variantes.find((v) => v.etat_stock !== "epuise" && v.prix !== defaut.prix);
    let valeur = produit.options[0].valeurs.find((element) => element.id === autre.valeurs[0]);

    await page.goto(`produit/${produit.slug}`);
    await expect(page.getByText(formaterPrix(defaut.prix), { exact: true })).toBeVisible();
    await page.evaluate(() => (window.sansRechargement = true));

    // Le bouton radio est masqué (sr-only) : on clique son libellé, comme l'utilisateur.
    await page.getByText(valeur.valeur, { exact: true }).click();
    await expect(page.getByRole("radio", { name: valeur.valeur })).toBeChecked();
    await expect(page.getByText(formaterPrix(autre.prix), { exact: true }), "prix mis à jour").toBeVisible();
    await expect(page.getByRole("group", { name: new RegExp(valeur.valeur) })).toBeVisible();
    expect(await page.evaluate(() => window.sansRechargement), "sans rechargement de la page").toBe(true);
  });
});

testerDodCommune("OPT-c", {
  pages: [{ chemin: "/produit/grand-theft-auto-vi" }],
});
