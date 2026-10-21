import { test, expect } from "@playwright/test";
import { formaterPrix } from "../../src/lib/format.js";
import { connecterAdmin, creerClient, envoyer, lire, lirePanier } from "../outils/api.js";
import {
  commander,
  creerProduitTest,
  modifierProduitTest,
  nettoyerClientsTest,
  supprimerProduitTest,
} from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// CMD-a : validation de commande (docs/user-stories.md).

const NUMERO = /^PS-\d{8}-\d{4}$/;

test.describe("CMD-a · DoD spécifique", () => {
  let produit = null;

  test.beforeEach(async ({ page }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: 10, prix: 50 }]);
  });

  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();
  });

  test("DoD : génération de numéros de commande uniques @ecriture", async ({ page }) => {
    await creerClient(page);
    let ligne = [{ variantId: produit.variantes[0].id, quantite: 1 }];

    let premiere = await commander(page, ligne);
    let seconde = await commander(page, ligne);
    expect(premiere.statut).toBe(201);
    expect(seconde.statut).toBe(201);
    expect(premiere.corps.commande.numero).toMatch(NUMERO);
    expect(seconde.corps.commande.numero).toMatch(NUMERO);
    expect(seconde.corps.commande.numero).not.toBe(premiere.corps.commande.numero);
  });

  test("DoD : sauvegarde complète en base de données (commande et lignes, avec le prix au moment de la commande) @ecriture", async ({
    page,
  }) => {
    await creerClient(page);
    let variante = produit.variantes[0];
    let { corps } = await commander(page, [{ variantId: variante.id, quantite: 2 }]);
    let numero = corps.commande.numero;

    // Le prix change après la commande : la commande garde l'ancien.
    produit = await modifierProduitTest(page, produit, { [variante.id]: { prix: 80 } });

    let { commande } = await lire(page, `admin/commande?numero=${numero}`);
    expect(commande.statut).toBe("en_cours");
    expect(commande.total).toBe(100);
    expect(commande.lignes).toEqual([
      expect.objectContaining({ nom: produit.nom, prix_unitaire: 50, quantite: 2, sous_total: 100 }),
    ]);
  });

  test("DoD : page de confirmation de qualité professionnelle @ecriture", async ({ page }) => {
    await creerClient(page);
    let { corps } = await commander(page, [{ variantId: produit.variantes[0].id, quantite: 1 }]);
    let numero = corps.commande.numero;

    await page.goto(`commande/${numero}`);
    await expect(page.getByRole("heading", { name: "Merci, votre commande est enregistrée" })).toBeVisible();
    await expect(page.getByRole("heading", { name: `Commande n° ${numero}` })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(produit.nom);
    await expect(page.getByRole("main")).toContainText(formaterPrix(50));
    await expect(page.getByRole("main")).toContainText(/en cours/i);

    for (let largeur of [375, 768, 1440]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      let deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect.soft(deborde, `débordement à ${largeur} px`).toBe(false);
    }
  });

  test("DoD : test de bout en bout du processus de commande @ecriture", async ({ page }) => {
    let compte = await creerClient(page);
    await envoyer(page, "logout", {});

    // Visiteur : fiche → panier → validation, qui demande de se connecter.
    await page.goto(`produit/${produit.slug}`);
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(page.getByRole("link", { name: "Panier, 1 article" })).toBeVisible();
    await page.goto("panier");
    await page.getByRole("link", { name: "Valider ma commande" }).click();
    await expect(page).toHaveURL(/\/connexion/);

    // Connexion : retour au récapitulatif.
    await page.getByLabel("Adresse e-mail").first().fill(compte.email);
    await page.getByLabel("Mot de passe").first().fill(compte.mdp);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Vérifiez votre commande" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(produit.nom);

    // Clic explicite, confirmation, panier vidé.
    await page.getByRole("button", { name: "Confirmer ma commande" }).click();
    await expect(page.getByRole("heading", { name: "Merci, votre commande est enregistrée" })).toBeVisible();
    await expect(page).toHaveURL(/\/commande\/PS-\d{8}-\d{4}$/);
    expect(await lirePanier(page)).toEqual([]);
    await expect(page.getByRole("link", { name: "Panier, 0 article" })).toBeVisible();
  });
});

testerDodCommune("CMD-a", {
  pages: [
    { chemin: "/commande", connexion: "client", panier: [{ variantId: 1, quantite: 1 }] },
    {
      chemin: async (page) => `/commande/${(await lire(page, "compte")).commandes[0].numero}`,
      connexion: "client",
    },
  ],
  reservees: [{ chemin: "/commande", droit: "client", api: "commande?numero=PS-00000000-0000" }],
});
