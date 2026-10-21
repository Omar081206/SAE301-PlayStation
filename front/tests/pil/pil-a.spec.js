import { test, expect } from "@playwright/test";
import { connecterAdmin, creerClient, lire } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { ouvrir, testerDodCommune } from "../outils/dod-commune.js";

// PIL-a : tableaux de bord statistiques (docs/user-stories.md).

test.describe("PIL-a · DoD spécifique", () => {
  let produit = null;

  test.afterEach(async ({ page }) => {
    // Le test @lecture du fichier ne crée rien : rien à nettoyer.
    if (produit === null) {
      return;
    }
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();
  });

  test("DoD : données à jour à chaque consultation @ecriture", async ({ page }) => {
    // Les autres tests créent et suppriment des commandes en même temps : on suit
    // le stock du produit de ce test, pas les totaux de la boutique.
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 5, prix: 10 }]);
    let ligne = async () => (await lire(page, "admin/statistiques")).stocks.find((element) => element.nom === produit.nom);
    expect(await ligne(), "produit dans le stock par produit").toEqual(expect.objectContaining({ stock: 5 }));

    await creerClient(page);
    let { statut } = await commander(page, [{ variantId: produit.variantes[0].id, quantite: 2 }]);
    expect(statut).toBe(201);
    expect(await ligne(), "stock relu après la commande").toEqual(expect.objectContaining({ stock: 3 }));

    // La page relit le serveur à chaque visite.
    await page.goto("admin/statistiques");
    await expect(page.getByRole("heading", { name: "Stock par produit" }).locator("..")).toContainText(produit.nom);
  });

  test("DoD : export des statistiques @lecture", async ({ page }) => {
    await ouvrir(page, { chemin: "/admin/statistiques", connexion: "admin" });

    let telechargement = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter (CSV)" }).click();
    let fichier = await telechargement;

    expect(fichier.suggestedFilename()).toMatch(/^statistiques-.*\.csv$/);
    let texte = (await fichier.createReadStream()).toArray();
    let contenu = Buffer.concat(await texte).toString("utf8");
    expect(contenu.split("\n").filter(Boolean).length, "lignes du fichier").toBeGreaterThan(5);
  });
});

testerDodCommune("PIL-a", {
  pages: [{ chemin: "/admin/statistiques", connexion: "admin" }],
  reservees: [{ chemin: "/admin/statistiques", droit: "admin", api: "admin/statistiques" }],
});
