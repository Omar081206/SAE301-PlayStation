import { getRequest } from "../lib/api-request.js";

let ProduitData = {};

/**
 * Tout le catalogue : GET /api/produits
 *
 * { produits: [ { id, nom, slug, categorie, prix, image, image_alt } ], total }
 * image est le nom du fichier de l'image principale (dans public/images/produits/),
 * ou null si le produit n'en a pas.
 */
ProduitData.fetchTous = async function () {
  return getRequest("produits");
};

export { ProduitData };
