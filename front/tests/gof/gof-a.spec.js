import { test, expect } from "@playwright/test";
import { PREFIXE, connecterAdmin, envoyer, lire } from "../outils/api.js";
import { creerProduitTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// GOF-a : gestion des produits (docs/user-stories.md).

// Adresse publique des images téléversées (.htaccess : images/produits/u-* →
// uploads/produits/) : le serveur de développement ne relaie que /api.
const IMAGES = "https://mmi.unilim.fr/~hadj-zekri1/SAE301/images/produits/";

test.describe("GOF-a · DoD spécifique", () => {
  let produit = null;

  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
  });

  test("DoD : CRUD complet des produits @ecriture", async ({ page }) => {
    await connecterAdmin(page);

    // Création, puis lecture dans la liste et dans le formulaire.
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 4, prix: 12.5 }]);
    await page.goto("admin/produits");
    await expect(page.getByRole("cell", { name: produit.nom }).or(page.getByText(produit.nom)).first()).toBeVisible();

    await page.goto(`admin/produits/${produit.id}`);
    await expect(page.getByLabel(/nom/i).first()).toHaveValue(produit.nom);

    // Modification.
    let nom = `${PREFIXE} renommé ${Date.now()}`;
    let { statut } = await envoyer(page, "admin/produit/enregistrer", {
      id: produit.id,
      nom,
      categorie_id: produit.categorie_id,
      description: produit.description,
      options: produit.options.map((option) => ({
        id: option.id,
        nom: option.nom,
        valeurs: option.valeurs.map((valeur) => ({ id: valeur.id, cle: String(valeur.id), valeur: valeur.valeur })),
      })),
      variantes: produit.variantes.map((v) => ({ id: v.id, valeurs: v.valeurs.map(String), prix: 15, stock: 6 })),
    });
    expect(statut).toBe(200);
    let { produit: relu } = await lire(page, `admin/produit?id=${produit.id}`);
    expect(relu.nom).toBe(nom);
    expect(relu.variantes[0]).toEqual(expect.objectContaining({ prix: 15, stock: 6 }));

    // Suppression depuis la liste, après confirmation.
    await page.goto("admin/produits");
    await page.getByRole("button", { name: `Supprimer ${nom}` }).first().click();
    let dialogue = page.getByRole("dialog");
    await expect(dialogue).toBeVisible();
    await dialogue.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(`Le produit « ${nom} » est supprimé.`);
    await expect(page.getByRole("button", { name: `Supprimer ${nom}` }), "plus dans la liste").toHaveCount(0);
    expect((await page.request.get(`api/admin/produit?id=${produit.id}`)).status()).toBe(404);
    produit = null;
  });

  test("DoD : gestion des images (téléversement, redimensionnement) @ecriture", async ({ page }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 1, prix: 10 }]);

    // Une image de 3000 × 2000 px, dessinée dans le navigateur.
    await page.goto("admin");
    let contenu = await page.evaluate(() => {
      let toile = document.createElement("canvas");
      toile.width = 3000;
      toile.height = 2000;
      let dessin = toile.getContext("2d");
      dessin.fillStyle = "#0070d1";
      dessin.fillRect(0, 0, 3000, 2000);
      return toile.toDataURL("image/png");
    });

    let { statut, corps } = await envoyer(page, "admin/produit/image", { id: produit.id, contenu });
    expect(statut, corps?.erreur).toBe(201);
    let { produit: relu } = await lire(page, `admin/produit?id=${produit.id}`);
    let image = relu.images.at(-1);
    expect(image.fichier).toMatch(/^u-.*\.webp$/);

    // Réduite : 1200 px au plus sur le grand côté, proportions gardées.
    let taille = await page.evaluate(async (adresse) => {
      let element = new Image();
      element.src = adresse;
      await element.decode();
      return { largeur: element.naturalWidth, hauteur: element.naturalHeight };
    }, IMAGES + image.fichier);
    expect(taille).toEqual({ largeur: 1200, hauteur: 800 });
  });
});

testerDodCommune("GOF-a", {
  pages: [
    { chemin: "/admin/produits", connexion: "admin" },
    { chemin: "/admin/produits/1", connexion: "admin" },
    { chemin: "/admin/produits/nouveau", connexion: "admin" },
  ],
  formulaires: [
    {
      chemin: "/admin/produits",
      connexion: "admin",
      bouton: "Enregistrer",
      api: { chemin: "admin/parametre/seuil", corps: { seuil: -1 } },
    },
  ],
  reservees: [
    { chemin: "/admin/produits", droit: "admin", api: "admin/produits" },
    { chemin: "/admin/produits/1", droit: "admin", api: "admin/produit?id=1" },
  ],
});
