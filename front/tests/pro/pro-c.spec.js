import { test, expect } from "@playwright/test";
import { formaterPrix } from "../../src/lib/format.js";
import { PREFIXE, connecterAdmin, creerClient, envoyer, lire, preparerPanier } from "../outils/api.js";
import { commander, creerProduitTest, nettoyerClientsTest, supprimerProduitTest } from "../outils/donnees.js";
import { testerDodCommune } from "../outils/dod-commune.js";
import { chacunSonTour, requeteBase } from "../outils/serveur.js";

// PRO-c : promotions automatiques (docs/user-stories.md). Pas de DoD
// spécifique : les critères d'acceptation et la DoD commune.

// Réduction de la promotion automatique (ProduitController::PROMOTION).
const PROMOTION = 20;

/**
 * Prix réduit, arrondi au centime, comme le calcule le serveur.
 *
 * @param {number} prix
 */
function prixReduit(prix) {
  return Math.round(prix * (100 - PROMOTION)) / 100;
}

/**
 * Le produit du catalogue en promotion (API publique), ou undefined.
 *
 * @param {import("@playwright/test").Page} page
 */
async function produitEnPromotion(page) {
  let { produits } = await lire(page, "produits");
  let enPromotion = produits.filter((produit) => produit.promotion !== null);
  expect(enPromotion.length, "un seul produit en promotion").toBeLessThanOrEqual(1);
  return enPromotion[0];
}

/**
 * Stock (somme des variantes) du produit le plus stocké de la boutique.
 * Aucune route n'envoie les quantités : lues en base.
 */
function stockMaximal() {
  let [ligne] = requeteBase("SELECT MAX(total) AS stock FROM (SELECT SUM(stock) AS total FROM variante GROUP BY produit_id) AS stocks");
  return Number(ligne.stock);
}

test.describe("PRO-c · critères d'acceptation", () => {
  let produit = null;
  let finDuTour = null;

  // Le produit en promotion est le même pour toute la boutique : les tests qui
  // le changent passent un par un, d'un navigateur à l'autre (verrou levé
  // après le nettoyage).
  test.beforeEach(async () => {
    let tourCommence;
    let commence = new Promise((resoudre) => (tourCommence = resoudre));
    let fin = new Promise((resoudre) => (finDuTour = resoudre));
    chacunSonTour("promotion", () => {
      tourCommence();
      return fin;
    });
    await commence;
  });

  test.afterEach(async ({ page }) => {
    await supprimerProduitTest(page, produit);
    produit = null;
    nettoyerClientsTest();
    finDuTour();
  });

  test("Critère : le produit dont le stock est le plus élevé est en promotion (−20 %) @ecriture", async ({ page }) => {
    let avant = await produitEnPromotion(page);
    expect(avant, "un produit en promotion").toBeDefined();
    expect(avant.prix).toBe(prixReduit(avant.prix_initial));
    expect(avant.promotion).toBe(PROMOTION);

    // Un produit plus stocké que tous les autres prend la promotion.
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [
      { valeur: "Bleu", stock: stockMaximal() + 10, prix: 49.99 },
      { valeur: "Rouge", stock: 1, prix: 59.99 },
    ]);

    let apres = await produitEnPromotion(page);
    expect(apres.slug, "promotion passée au produit le plus stocké").toBe(produit.slug);
    expect(apres).toEqual(expect.objectContaining({ prix: prixReduit(49.99), prix_initial: 49.99, promotion: PROMOTION }));

    // Toutes ses variantes sont réduites ; l'ancien produit revient à son prix.
    let { produit: fiche } = await lire(page, `produit?slug=${produit.slug}`);
    for (let variante of fiche.variantes) {
      expect(variante.prix, "prix de chaque variante").toBe(prixReduit(variante.prix_initial));
    }
    let { produit: ancien } = await lire(page, `produit?slug=${avant.slug}`);
    expect(ancien.promotion, "plus de promotion sur l'ancien produit").toBeNull();
    expect(ancien.prix).toBe(avant.prix_initial);

    // Le produit supprimé, la promotion revient au produit d'avant.
    await supprimerProduitTest(page, produit);
    produit = null;
    expect((await produitEnPromotion(page)).slug).toBe(avant.slug);
  });

  test("Critère : les prix barrés et promotionnels sont affichés @ecriture", async ({ page }) => {
    await connecterAdmin(page);
    produit = await creerProduitTest(page, [{ valeur: "Unique", stock: stockMaximal() + 10, prix: 49.99 }]);
    let variante = produit.variantes[0];
    let promo = prixReduit(49.99);

    // Fiche : prix réduit, prix d'origine barré, badge.
    await page.goto(`produit/${produit.slug}`);
    let main = page.getByRole("main");
    await expect(main.getByText(formaterPrix(promo), { exact: true })).toBeVisible();
    await expect(main.locator("s"), "prix d'origine barré").toContainText(formaterPrix(49.99));
    await expect(main.getByText(`−${PROMOTION} %`, { exact: true })).toBeVisible();

    // Catalogue : la carte du produit en promotion a son prix barré et son badge, et elle seule.
    await page.goto("");
    let carte = page.getByRole("article").filter({ hasText: produit.nom });
    await expect(carte).toContainText(formaterPrix(promo));
    await expect(carte.locator("s"), "prix d'origine barré sur la carte").toContainText(formaterPrix(49.99));
    await expect(carte.getByText(`−${PROMOTION} %`, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").locator("s"), "une seule carte en promotion").toHaveCount(1);

    // Un produit hors promotion n'a ni prix barré ni badge.
    let { produits } = await lire(page, "produits");
    await page.goto(`produit/${produits.find((element) => element.promotion === null).slug}`);
    await expect(page.getByRole("main").locator("s")).toHaveCount(0);

    // Panier : le montant d'origine barré au-dessus du montant réduit.
    await preparerPanier(page, [{ variantId: variante.id, quantite: 2 }]);
    await page.goto("panier");
    await expect(page.getByRole("main").locator("s").filter({ visible: true })).toContainText(formaterPrix(2 * 49.99));
    await expect(page.getByRole("complementary")).toContainText(formaterPrix(2 * promo));

    // Un code promo s'applique au total déjà réduit (vérification seule : rien n'est écrit).
    // Un code réel : ceux des tests de PRO-b (E2E…) peuvent être supprimés pendant le test.
    let { codes } = await lire(page, "admin/codes-promo");
    let code = codes.find((element) => !element.code.startsWith(PREFIXE.toUpperCase()));
    let { corps } = await envoyer(page, "panier", { lignes: [{ variantId: variante.id, quantite: 2 }], code: code.code });
    let remise = Math.round(2 * promo * code.pourcentage) / 100;
    expect(corps).toEqual(expect.objectContaining({ sousTotal: 2 * promo, remise, total: Math.round((2 * promo - remise) * 100) / 100 }));

    // Récapitulatif, puis commande : prix figés, barré sur la confirmation.
    await creerClient(page);
    await page.goto("commande");
    await expect(page.getByRole("main").locator("s")).toContainText(formaterPrix(2 * 49.99));

    let commande = await commander(page, [{ variantId: variante.id, quantite: 2 }]);
    expect(commande.statut).toBe(201);
    expect(commande.corps.commande.lignes).toEqual([
      expect.objectContaining({ prix_unitaire: promo, prix_initial: 49.99, sous_total_initial: 2 * 49.99 }),
    ]);

    await page.goto(`commande/${commande.corps.commande.numero}`);
    await expect(page.getByRole("main").locator("s")).toContainText(formaterPrix(2 * 49.99));
    await expect(page.getByRole("main")).toContainText(formaterPrix(2 * promo));
  });
});

/**
 * Fiche du produit en promotion, pour la DoD commune.
 *
 * @param {import("@playwright/test").Page} page
 */
async function ficheEnPromotion(page) {
  return `/produit/${(await produitEnPromotion(page)).slug}`;
}

/**
 * Remplit le panier avec le produit en promotion et renvoie la page demandée.
 *
 * @param {string} chemin
 */
function avecPromotion(chemin) {
  return async (page) => {
    await preparerPanier(page, [{ variantId: (await produitEnPromotion(page)).variante_id, quantite: 1 }]);
    return chemin;
  };
}

testerDodCommune("PRO-c", {
  pages: [
    { chemin: ficheEnPromotion },
    { chemin: avecPromotion("/panier") },
    { chemin: avecPromotion("/commande"), connexion: "client" },
  ],
});
