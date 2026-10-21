import { test, expect } from "@playwright/test";
import { PREFIXE, connecterAdmin, creerClient, envoyer, lire } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// PRO-b : gestion des codes promo (docs/user-stories.md). Pas de DoD
// spécifique : les critères d'acceptation et la DoD commune.

/**
 * Un code promo propre au test : E2E suivi de chiffres (lettres et chiffres
 * seulement, comme le demande le formulaire).
 */
function nouveauCode() {
  return `${PREFIXE.toUpperCase()}${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`;
}

test.describe("PRO-b · critères d'acceptation", () => {
  let produit = null;
  let codesCrees = [];

  // Chaque test ne supprime que ses propres codes : l'autre navigateur travaille en même temps avec les siens.
  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();

    await connecterAdmin(page);
    let { codes } = await lire(page, "admin/codes-promo");
    for (let code of codes.filter((element) => codesCrees.includes(element.code))) {
      await envoyer(page, "admin/code-promo/supprimer", { id: code.id });
    }
    codesCrees = [];
  });

  test("Critère : CRUD des codes promotionnels avec leur pourcentage @ecriture", async ({ page }) => {
    let code = nouveauCode();
    codesCrees.push(code);
    await connecterAdmin(page);
    await page.goto("admin/codes-promo");
    let tableau = page.getByRole("region", { name: "Codes promotionnels" });

    // Création.
    await page.getByLabel("Code", { exact: true }).fill(code);
    await page.getByLabel("Réduction (%)").fill("15");
    await page.getByRole("button", { name: "Créer le code" }).click();
    await expect(tableau.getByRole("row").filter({ hasText: code })).toContainText("15");

    // Modification du pourcentage.
    await page.getByRole("button", { name: `Modifier ${code}` }).filter({ visible: true }).click();
    await page.getByLabel("Réduction (%)").fill("20");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(tableau.getByRole("row").filter({ hasText: code })).toContainText("20");

    // Suppression, après confirmation.
    await page.getByRole("button", { name: `Supprimer ${code}` }).filter({ visible: true }).click();
    let dialogue = page.getByRole("dialog");
    await expect(dialogue).toBeVisible();
    await dialogue.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(tableau.getByText(code)).toHaveCount(0);
  });

  test("Critère : statistiques d'utilisation des codes @ecriture", async ({ page }) => {
    let code = nouveauCode();
    codesCrees.push(code);
    await connecterAdmin(page);
    let creation = await envoyer(page, "admin/code-promo/creer", { code, pourcentage: 10 });
    expect(creation.statut).toBe(201);
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 5, prix: 40 }]);

    // Deux commandes avec le code : 2 utilisations, 4 € + 4 € de remise.
    await creerClient(page);
    for (let i = 0; i < 2; i++) {
      let { statut } = await commander(page, [{ variantId: produit.variantes[0].id, quantite: 1 }], code);
      expect(statut).toBe(201);
    }

    let { codes } = await lire(page, "admin/codes-promo");
    expect(codes.find((element) => element.code === code)).toEqual(
      expect.objectContaining({ utilisations: 2, remise_totale: 8 }),
    );

    await page.goto("admin/codes-promo");
    let ligne = page.getByRole("region", { name: "Codes promotionnels" }).getByRole("row").filter({ hasText: code });
    await expect(ligne).toContainText("2");
    await expect(ligne).toContainText("8,00");
  });
});

testerDodCommune("PRO-b", {
  pages: [{ chemin: "/admin/codes-promo", connexion: "admin" }],
  formulaires: [
    {
      chemin: "/admin/codes-promo",
      connexion: "admin",
      bouton: "Créer le code",
      api: { chemin: "admin/code-promo/creer", corps: { code: "", pourcentage: 0 } },
    },
  ],
  reservees: [{ chemin: "/admin/codes-promo", droit: "admin", api: "admin/codes-promo" }],
});
