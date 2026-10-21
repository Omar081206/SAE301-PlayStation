import { test, expect } from "@playwright/test";
import { PREFIXE, connecterAdmin, envoyer, lire } from "../outils/api.js";
import { creerProduitTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// GOF-c : gestion des catégories (docs/user-stories.md).

/**
 * Catégorie du back-office qui porte ce nom, ou undefined.
 *
 * @param {import("@playwright/test").Page} page  avec une session admin
 * @param {string} nom
 */
async function categorieNommee(page, nom) {
  let { categories } = await lire(page, "admin/categories");
  return categories.find((categorie) => categorie.nom === nom);
}

test.describe("GOF-c · DoD spécifique", () => {
  let produit = null;
  let nomsCrees = [];

  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
    for (let nom of nomsCrees) {
      let categorie = await categorieNommee(page, nom);
      if (categorie !== undefined) {
        await envoyer(page, "admin/categorie/supprimer", { id: categorie.id, destination: null });
      }
    }
    nomsCrees = [];
  });

  test("DoD : CRUD complet des catégories @ecriture", async ({ page }) => {
    await connecterAdmin(page);
    let nom = `${PREFIXE} cat ${Date.now() % 100000}`;
    let renomme = `${nom} bis`;
    nomsCrees.push(nom, renomme);

    // Création depuis le formulaire.
    await page.goto("admin/categories");
    await page.getByLabel(/nom/i).first().fill(nom);
    await page.getByLabel(/description/i).first().fill("Catégorie créée par les tests automatisés.");
    await page.getByRole("button", { name: "Créer la catégorie" }).click();
    await expect(page.getByText(nom, { exact: true }).first()).toBeVisible();

    // Modification.
    await page.getByRole("button", { name: `Modifier ${nom}` }).first().click();
    await page.getByLabel(/nom/i).first().fill(renomme);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText(renomme, { exact: true }).first()).toBeVisible();

    // Suppression, après confirmation.
    await page.getByRole("button", { name: `Supprimer ${renomme}` }).first().click();
    let dialogue = page.getByRole("dialog");
    await expect(dialogue).toBeVisible();
    await dialogue.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByText(renomme, { exact: true })).toHaveCount(0);
    expect(await categorieNommee(page, renomme)).toBeUndefined();
  });

  test("DoD : règle explicite pour les produits d'une catégorie supprimée (réaffectation ou blocage) @ecriture", async ({
    page,
  }) => {
    await connecterAdmin(page);
    let nom = `${PREFIXE} cat ${Date.now() % 100000}`;
    nomsCrees.push(nom);
    let creation = await envoyer(page, "admin/categorie/creer", { nom, description: "Catégorie des tests." });
    expect(creation.statut).toBe(201);
    let categorie = await categorieNommee(page, nom);

    // Un produit dans la catégorie.
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 1, prix: 10 }]);
    let { categories } = await lire(page, "admin/categories");
    let destination = categories.find((element) => element.id !== categorie.id);
    let deplacement = await envoyer(page, "admin/produit/enregistrer", {
      id: produit.id,
      nom: produit.nom,
      categorie_id: categorie.id,
      description: produit.description,
      options: produit.options.map((o) => ({ id: o.id, nom: o.nom, valeurs: o.valeurs.map((v) => ({ id: v.id, cle: String(v.id), valeur: v.valeur })) })),
      variantes: produit.variantes.map((v) => ({ id: v.id, valeurs: v.valeurs.map(String), prix: v.prix, stock: v.stock })),
    });
    expect(deplacement.statut).toBe(200);

    // Sans destination : blocage. Avec destination : réaffectation, puis suppression.
    let refus = await envoyer(page, "admin/categorie/supprimer", { id: categorie.id, destination: null });
    expect(refus.statut).toBe(409);
    expect(refus.corps.erreur).toMatch(/choisissez la catégorie/i);

    let accord = await envoyer(page, "admin/categorie/supprimer", { id: categorie.id, destination: destination.id });
    expect(accord.statut).toBe(200);
    let { produit: relu } = await lire(page, `admin/produit?id=${produit.id}`);
    expect(relu.categorie_id, "produit réaffecté").toBe(destination.id);
  });
});

testerDodCommune("GOF-c", {
  pages: [{ chemin: "/admin/categories", connexion: "admin" }],
  formulaires: [
    {
      chemin: "/admin/categories",
      connexion: "admin",
      bouton: "Créer la catégorie",
      api: { chemin: "admin/categorie/creer", corps: { nom: "", description: "" } },
    },
  ],
  reservees: [{ chemin: "/admin/categories", droit: "admin", api: "admin/categories" }],
});
