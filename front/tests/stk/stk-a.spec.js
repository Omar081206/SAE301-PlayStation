import { test, expect } from "@playwright/test";
import { connecterAdmin, creerClient, envoyer, lire } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";
import { requeteBase } from "../outils/serveur.js";

// STK-a : mise à jour automatique des stocks (docs/user-stories.md).

/**
 * Stock de chaque variante d'un produit, lu par le back-office.
 *
 * @param {import("@playwright/test").Page} page  avec une session admin
 * @param {number} id
 * @returns {Promise<number[]>}
 */
async function stocks(page, id) {
  let { produit } = await lire(page, `admin/produit?id=${id}`);
  return produit.variantes.map((variante) => variante.stock);
}

test.describe("STK-a · DoD spécifique", () => {
  let produit = null;

  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();
  });

  test("DoD : transactions en base de données, avec annulation (rollback) en cas d'erreur @ecriture", async ({
    page,
  }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [
      { valeur: "Cinq", stock: 5, prix: 10 },
      { valeur: "Une", stock: 1, prix: 10 },
    ]);
    let [cinq, une] = produit.variantes;

    // La seconde ligne dépasse le stock : toute la commande est refusée.
    await creerClient(page);
    let { statut } = await commander(page, [
      { variantId: cinq.id, quantite: 2 },
      { variantId: une.id, quantite: 3 },
    ]);
    expect(statut).toBe(409);
    expect(await stocks(page, produit.id), "aucune variante décrémentée").toEqual([5, 1]);
  });

  test("DoD : journal complet des mouvements de stock @ecriture", async ({ page }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [{ valeur: "Cinq", stock: 5, prix: 10 }]);
    let variante = produit.variantes[0];

    await creerClient(page);
    let { corps } = await commander(page, [{ variantId: variante.id, quantite: 2 }]);
    let numero = corps.commande.numero;
    let annulation = await envoyer(page, "admin/commande/statut", { numero, statut: "annulee" });
    expect(annulation.statut).toBe(200);

    let mouvements = requeteBase(
      `SELECT m.motif, m.quantite, m.stock_avant, m.stock_apres FROM mouvement_stock m
       JOIN commande c ON c.id = m.commande_id
       WHERE c.numero = '${numero}' AND m.variante_id = ${Number(variante.id)} ORDER BY m.id`,
    );
    expect(mouvements).toEqual([
      expect.objectContaining({ motif: "commande", stock_avant: "5", stock_apres: "3" }),
      expect.objectContaining({ motif: "annulation", stock_avant: "3", stock_apres: "5" }),
    ]);
    expect(await stocks(page, produit.id)).toEqual([5]);
  });

  test("DoD : test de concurrence (deux commandes simultanées sur la dernière unité) @ecriture", async ({
    page,
    browser,
  }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [{ valeur: "Dernière", stock: 1, prix: 10 }]);
    let ligne = [{ variantId: produit.variantes[0].id, quantite: 1 }];

    // Deux clients, deux sessions : PHP sérialiserait les requêtes d'une même session.
    let baseURL = test.info().project.use.baseURL;
    let clients = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
    let pages = await Promise.all(clients.map((contexte) => contexte.newPage()));
    for (let client of pages) {
      await creerClient(client);
    }

    let reponses = await Promise.all(pages.map((client) => commander(client, ligne)));
    expect(reponses.map((reponse) => reponse.statut).sort()).toEqual([201, 409]);
    expect(await stocks(page, produit.id), "stock jamais négatif").toEqual([0]);

    for (let contexte of clients) {
      await contexte.close();
    }
  });
});

testerDodCommune("STK-a", {
  pages: [{ chemin: "/produit/saros" }],
});
