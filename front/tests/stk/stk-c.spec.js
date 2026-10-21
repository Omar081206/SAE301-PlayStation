import { test, expect } from "@playwright/test";
import { connecterAdmin, creerClient, envoyer, lire, lirePanier, preparerPanier } from "../outils/api.js";
import {
  commander,
  creerProduitTest,
  modifierProduitTest,
  nettoyerClientsTest,
  supprimerProduitTest,
} from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// STK-c : contraintes de stock (docs/user-stories.md).

test.describe("STK-c · DoD spécifique", () => {
  test("DoD : vérification côté client et côté serveur @lecture", async ({ page }) => {
    let { produits } = await lire(page, "produits");
    let produit = produits.find((element) => element.etat_stock === "en_stock");

    // Serveur : une quantité au-delà du stock est ramenée au stock.
    let { statut, corps } = await envoyer(page, "panier", { lignes: [{ variantId: produit.variante_id, quantite: 99 }] });
    expect(statut).toBe(200);
    let [ligne] = corps.lignes;
    expect(ligne.quantite, "quantité ramenée au stock").toBe(ligne.quantiteMax);
    test.skip(ligne.quantiteMax >= 99, "stock supérieur au plafond du panier : pas de dépassement à provoquer");
    expect(corps.ajustements).toContainEqual(expect.objectContaining({ variantId: produit.variante_id, demandee: 99 }));

    // Client : au maximum du stock, « + » est désactivé.
    await preparerPanier(page, [{ variantId: produit.variante_id, quantite: ligne.quantiteMax }]);
    await page.goto("panier");
    await expect(page.getByRole("button", { name: `Ajouter un exemplaire de ${produit.nom}` })).toBeDisabled();

    // Une variante épuisée ne peut pas être ajoutée depuis sa fiche.
    let epuise = produits.find((element) => element.etat_stock === "epuise");
    test.skip(epuise === undefined, "aucun produit épuisé dans le catalogue");
    await page.goto(`produit/${epuise.slug}`);
    await expect(page.getByRole("button", { name: "Épuisé" })).toBeDisabled();
  });

  test.describe("scénarios de stock", () => {
    let produit = null;

    test.afterEach(async ({ page }) => {
      await supprimerProduitTest(page, produit);
      produit = null;
      nettoyerClientsTest();
    });

    test("DoD : gestion des cas limites (stock modifié pendant la session) @ecriture", async ({ page }) => {
      await connecterAdmin(page);
      produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 3, prix: 10 }]);
      let variante = produit.variantes[0];

      await preparerPanier(page, [{ variantId: variante.id, quantite: 3 }]);
      await page.goto("panier");
      await expect(page.getByText("Quantité : 3")).toBeVisible();

      // Le stock baisse pendant que le client navigue.
      produit = await modifierProduitTest(page, produit, { [variante.id]: { stock: 1 } });

      await page.reload();
      await expect(page.getByRole("status").filter({ hasText: produit.nom }), "message d'ajustement").toBeVisible();
      await expect.poll(() => lirePanier(page), "panier ajusté").toEqual([{ variantId: variante.id, quantite: 1 }]);

      // La validation de la commande revérifie : 3 demandés, 1 en stock.
      await creerClient(page);
      let { statut } = await commander(page, [{ variantId: variante.id, quantite: 3 }]);
      expect(statut, "commande au-delà du stock").toBe(409);
    });

    test("DoD : tests avec différents scénarios de stock @ecriture", async ({ page }) => {
      await connecterAdmin(page);
      produit = await creerProduitTest(page, [
        { valeur: "Épuisée", stock: 0, prix: 10 },
        { valeur: "Deux", stock: 2, prix: 10 },
      ]);
      let [epuisee, deux] = produit.variantes;

      // Variante épuisée : non sélectionnable sur la fiche.
      await page.goto(`produit/${produit.slug}`);
      await expect(page.getByRole("radio", { name: /Épuisée/ })).toBeDisabled();

      // Quantité égale au stock : accordée ; stock + 1 : ramenée au stock.
      let exacte = await envoyer(page, "panier", { lignes: [{ variantId: deux.id, quantite: 2 }] });
      expect(exacte.corps.ajustements).toEqual([]);
      let depassement = await envoyer(page, "panier", { lignes: [{ variantId: deux.id, quantite: 3 }] });
      expect(depassement.corps.ajustements).toContainEqual(expect.objectContaining({ variantId: deux.id, accordee: 2 }));
      let rien = await envoyer(page, "panier", { lignes: [{ variantId: epuisee.id, quantite: 1 }] });
      expect(rien.corps.ajustements).toContainEqual(expect.objectContaining({ variantId: epuisee.id, accordee: 0 }));

      // Commande au-delà du stock : refusée avec un message.
      await creerClient(page);
      let { statut, corps } = await commander(page, [{ variantId: deux.id, quantite: 3 }]);
      expect(statut).toBe(409);
      expect(corps.erreur).toMatch(/stock|épuisé/i);
    });
  });
});

testerDodCommune("STK-c", {
  pages: [{ chemin: "/panier", panier: [{ variantId: 1, quantite: 99 }] }, { chemin: "/produit/ps5-pro" }],
});
