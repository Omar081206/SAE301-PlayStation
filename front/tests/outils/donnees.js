import { expect } from "@playwright/test";
import { clientsCrees, connecterAdmin, envoyer, lire, PREFIXE } from "./api.js";
import { requeteBase } from "./serveur.js";

// Image d'un produit de test : un PNG d'un pixel. Un vrai produit a toujours
// au moins une image, et sa fiche publique en a besoin.
const IMAGE_TEST =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// Données propres aux tests @ecriture : un produit, des clients, des commandes
// préfixés « e2e », créés par l'application elle-même (API d'administration,
// inscription) et supprimés à la fin. Les produits, comptes et commandes
// existants ne sont jamais modifiés.

/**
 * Crée un produit de test, à une option « Niveau » : une variante par valeur,
 * avec son stock et son prix, et une image. La page doit avoir une session admin.
 *
 * @param {import("@playwright/test").Page} page
 * @param {Array<{ valeur: string, stock: number, prix: number }>} variantes
 * @returns {Promise<Object>} le produit enregistré (GET /api/admin/produit)
 */
export async function creerProduitTest(page, variantes) {
  let { categories } = await lire(page, "admin/categories");
  let { statut, corps } = await envoyer(page, "admin/produit/enregistrer", {
    id: null,
    // Un suffixe au hasard : deux navigateurs peuvent créer un produit dans la même milliseconde.
    nom: `${PREFIXE} produit ${Date.now()}${Math.floor(Math.random() * 1000)}`,
    categorie_id: categories[0].id,
    description: "Produit créé par les tests automatisés, supprimé à la fin du test.",
    options: [
      {
        id: null,
        nom: "Niveau",
        valeurs: variantes.map((variante, i) => ({ id: null, cle: `v${i}`, valeur: variante.valeur })),
      },
    ],
    variantes: variantes.map((variante, i) => ({
      id: null,
      valeurs: [`v${i}`],
      prix: variante.prix,
      stock: variante.stock,
    })),
  });
  expect(statut, `création du produit de test : ${corps?.erreur ?? ""}`).toBe(200);

  let image = await envoyer(page, "admin/produit/image", { id: corps.produit.id, contenu: IMAGE_TEST });
  expect(image.statut, `image du produit de test : ${image.corps?.erreur ?? ""}`).toBe(201);
  return image.corps.produit;
}

/**
 * Change le stock et le prix des variantes d'un produit de test, comme le
 * back-office (POST /api/admin/produit/enregistrer).
 *
 * @param {import("@playwright/test").Page} page  avec une session admin
 * @param {Object} produit  tel que renvoyé par creerProduitTest
 * @param {Object<number, { stock?: number, prix?: number }>} changements  par identifiant de variante
 * @returns {Promise<Object>} le produit enregistré
 */
export async function modifierProduitTest(page, produit, changements) {
  let { statut, corps } = await envoyer(page, "admin/produit/enregistrer", {
    id: produit.id,
    nom: produit.nom,
    categorie_id: produit.categorie_id,
    description: produit.description,
    options: produit.options.map((option) => ({
      id: option.id,
      nom: option.nom,
      valeurs: option.valeurs.map((valeur) => ({ id: valeur.id, cle: String(valeur.id), valeur: valeur.valeur })),
    })),
    variantes: produit.variantes.map((variante) => ({
      id: variante.id,
      valeurs: variante.valeurs.map(String),
      prix: changements[variante.id]?.prix ?? variante.prix,
      stock: changements[variante.id]?.stock ?? variante.stock,
    })),
  });
  expect(statut, `modification du produit de test : ${corps?.erreur ?? ""}`).toBe(200);
  return corps.produit;
}

/**
 * Supprime un produit de test et ses mouvements de stock.
 *
 * @param {import("@playwright/test").Page} page  avec une session admin
 * @param {Object | null} produit
 */
export async function supprimerProduitTest(page, produit) {
  if (produit === null || produit === undefined) {
    return;
  }
  await connecterAdmin(page);
  requeteBase(
    `DELETE FROM mouvement_stock WHERE variante_id IN (SELECT id FROM variante WHERE produit_id = ${Number(produit.id)})`,
  );
  await envoyer(page, "admin/produit/supprimer", { id: produit.id });
}

/**
 * Supprime les clients créés par le test en cours (creerClient) et tout ce qui
 * leur est rattaché : commandes, lignes, journal, mouvements de stock.
 */
export function nettoyerClientsTest() {
  if (clientsCrees.length === 0) {
    return;
  }

  // Adresses produites par creerClient (e2e-<nombres>@playstation.test) : rien à échapper.
  let adresses = clientsCrees.map((email) => `'${email}'`).join(", ");
  let clients = `SELECT id FROM utilisateur WHERE email IN (${adresses})`;
  let commandes = `SELECT id FROM commande WHERE utilisateur_id IN (${clients})`;
  requeteBase(`DELETE FROM mouvement_stock WHERE commande_id IN (${commandes})`);
  requeteBase(`DELETE FROM commande WHERE utilisateur_id IN (SELECT id FROM (${clients}) AS e2e)`);
  requeteBase(`DELETE FROM utilisateur WHERE email IN (${adresses})`);
  clientsCrees.length = 0;
}

/**
 * Passe une commande pour le client connecté. Renvoie { statut, corps }.
 *
 * @param {import("@playwright/test").Page} page  avec une session client
 * @param {Array<{ variantId: number, quantite: number }>} lignes
 * @param {string | null} [code]  code promo
 */
export async function commander(page, lignes, code = null) {
  return envoyer(page, "commande", { lignes, code });
}
