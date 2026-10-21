import { test, expect } from "@playwright/test";
import { connecterAdmin, creerClient, lire } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// OPT-a : options dans le panier et les commandes (docs/user-stories.md).

test.describe("OPT-a · DoD spécifique", () => {
  let produit = null;

  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();
  });

  test("DoD : les lignes de commande conservent les options et le prix au moment de la commande @ecriture", async ({
    page,
  }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [
      { valeur: "Bleu", stock: 5, prix: 20 },
      { valeur: "Rouge", stock: 5, prix: 25 },
    ]);
    let [bleu, rouge] = produit.variantes;

    await creerClient(page);
    let { corps } = await commander(page, [
      { variantId: bleu.id, quantite: 1 },
      { variantId: rouge.id, quantite: 2 },
    ]);
    let numero = corps.commande.numero;

    // Le produit disparaît du catalogue : la commande garde nom, options et prix.
    await supprimerProduitTest(page, produit);
    let nom = produit.nom;
    produit = null;

    let { commande } = await lire(page, `admin/commande?numero=${numero}`);
    expect(commande.lignes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nom, options: expect.stringContaining("Bleu"), prix_unitaire: 20, quantite: 1 }),
        expect.objectContaining({ nom, options: expect.stringContaining("Rouge"), prix_unitaire: 25, quantite: 2 }),
      ]),
    );
    expect(commande.total).toBe(70);
  });
});

testerDodCommune("OPT-a", {
  pages: [
    { chemin: "/panier", panier: [{ variantId: 5, quantite: 1 }, { variantId: 17, quantite: 1 }] },
    { chemin: "/commande", connexion: "client", panier: [{ variantId: 5, quantite: 1 }] },
  ],
});
