import { test, expect } from "@playwright/test";
import { formaterPrix } from "../../src/lib/format.js";
import { PREFIXE, connecterAdmin, envoyer, lire } from "../outils/api.js";
import { ouvrir, testerDodCommune } from "../outils/dod-commune.js";

// PRO-a : codes promotionnels (docs/user-stories.md). Pas de DoD spécifique :
// les critères d'acceptation et la DoD commune. Appliquer un code ne fait que
// le vérifier (POST /api/panier) : rien n'est écrit tant que la commande n'est
// pas confirmée.

/**
 * Un code promo existant et un produit en stock, lus dans l'API. Les codes des
 * tests de PRO-b (E2E…) peuvent être supprimés pendant le test : écartés.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<{ code: { code: string, pourcentage: number }, produit: Object }>}
 */
async function codeEtProduit(page) {
  await connecterAdmin(page);
  let { codes } = await lire(page, "admin/codes-promo");
  let { produits } = await lire(page, "produits");
  return {
    code: codes.find((element) => !element.code.startsWith(PREFIXE.toUpperCase())),
    produit: produits.find((element) => element.etat_stock === "en_stock"),
  };
}

test.describe("PRO-a · critères d'acceptation", () => {
  test("Critère : je peux saisir un code promo lors de la commande @lecture", async ({ page }) => {
    let { code, produit } = await codeEtProduit(page);
    await ouvrir(page, { chemin: "/commande", connexion: "client", panier: [{ variantId: produit.variante_id, quantite: 1 }] });

    // Saisi en minuscules : le code est reconnu quand même.
    await page.getByLabel("Code promo").fill(code.code.toLowerCase());
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByText(`Code ${code.code} appliqué`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Retirer" })).toBeVisible();

    // Un code inconnu est refusé avec un message.
    await page.getByRole("button", { name: "Retirer" }).click();
    await page.getByLabel("Code promo").fill("INCONNU999");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByText("Ce code promo n’existe pas ou n’est plus valide.")).toBeVisible();
  });

  test("Critère : le code est vérifié et la réduction (en pourcentage) est appliquée au total @lecture", async ({
    page,
  }) => {
    let { code, produit } = await codeEtProduit(page);
    let lignes = [{ variantId: produit.variante_id, quantite: 2 }];
    let sousTotal = Math.round(produit.prix * 2 * 100) / 100;
    let remise = Math.round(sousTotal * code.pourcentage) / 100;

    // Serveur : le calcul, et le refus d'un code inconnu.
    let { statut, corps } = await envoyer(page, "panier", { lignes, code: code.code });
    expect(statut).toBe(200);
    expect(corps).toEqual(
      expect.objectContaining({ sousTotal, remise, total: Math.round((sousTotal - remise) * 100) / 100 }),
    );
    let refus = await envoyer(page, "panier", { lignes, code: "INCONNU999" });
    expect(refus.statut, "code inconnu").toBe(422);

    // Page : sous-total, réduction et total affichés.
    await ouvrir(page, { chemin: "/commande", connexion: "client", panier: lignes });
    await page.getByLabel("Code promo").fill(code.code);
    await page.getByRole("button", { name: "Appliquer" }).click();
    let main = page.getByRole("main");
    await expect(main).toContainText(`Réduction ${code.code} (−${code.pourcentage} %)`);
    await expect(main).toContainText(`−${formaterPrix(remise)}`);
    await expect(main).toContainText(formaterPrix(corps.total));
  });
});

testerDodCommune("PRO-a", {
  pages: [{ chemin: "/commande", connexion: "client", panier: [{ variantId: 1, quantite: 1 }] }],
  formulaires: [
    {
      chemin: "/commande",
      connexion: "client",
      panier: [{ variantId: 1, quantite: 1 }],
      bouton: "Appliquer",
      api: { chemin: "panier", corps: { lignes: [{ variantId: 1, quantite: 1 }], code: "INCONNU999" } },
    },
  ],
  reservees: [{ chemin: "/commande", droit: "client", api: "commande?numero=PS-00000000-0000" }],
});
