import { test, expect } from "@playwright/test";
import { connecterAdmin, creerClient, lire, lirePanier } from "../outils/api.js";
import {
  commander,
  creerProduitTest,
  modifierProduitTest,
  nettoyerClientsTest,
  supprimerProduitTest,
} from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// SUI-a : réutilisation des commandes (docs/user-stories.md).

test.describe("SUI-a · DoD spécifique", () => {
  let produits = [];

  test.afterEach(async ({ page }) => {
    for (let produit of produits) {
      await supprimerProduitTest(page, produit);
    }
    produits = [];
    nettoyerClientsTest();
  });

  test("DoD : gestion des produits supprimés ou modifiés depuis la commande @ecriture", async ({ page }) => {
    await connecterAdmin(page);
    let garde = await creerProduitTest(page, [{ valeur: "Garde", stock: 5, prix: 10 }]);
    let epuise = await creerProduitTest(page, [{ valeur: "Épuisé", stock: 5, prix: 10 }]);
    let supprime = await creerProduitTest(page, [{ valeur: "Supprimé", stock: 5, prix: 10 }]);
    // Tous nettoyés en fin de test, même celui que le test supprime lui-même (s'il échoue avant).
    produits.push(garde, epuise, supprime);

    await creerClient(page);
    let { corps } = await commander(page, [
      { variantId: garde.variantes[0].id, quantite: 1 },
      { variantId: epuise.variantes[0].id, quantite: 1 },
      { variantId: supprime.variantes[0].id, quantite: 1 },
    ]);
    let numero = corps.commande.numero;

    // Depuis la commande : un produit épuisé, un autre retiré de la vente.
    await modifierProduitTest(page, epuise, { [epuise.variantes[0].id]: { stock: 0 } });
    await supprimerProduitTest(page, supprime);

    await page.goto(`compte/commandes/${numero}`);
    await page.getByRole("button", { name: "Commander à nouveau" }).click();

    let messages = page.getByRole("status");
    await expect(messages.filter({ hasText: epuise.nom }), "produit épuisé signalé").toContainText(/épuisé/);
    await expect(messages.filter({ hasText: supprime.nom }), "produit supprimé signalé").toContainText(/plus vendu/);
    await expect.poll(() => lirePanier(page), "seul le produit disponible est transféré").toEqual([
      { variantId: garde.variantes[0].id, quantite: 1 },
    ]);
  });
});

testerDodCommune("SUI-a", {
  pages: [
    {
      chemin: async (page) => `/compte/commandes/${(await lire(page, "compte")).commandes[0].numero}`,
      connexion: "client",
    },
  ],
  reservees: [{ chemin: "/compte/commandes/PS-00000000-0000", droit: "client", api: "commande?numero=PS-00000000-0000" }],
});
