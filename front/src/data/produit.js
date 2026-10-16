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

/**
 * La fiche d'un produit : GET /api/produit?slug=…
 *
 * { produit: { id, nom, slug, description, categorie, categorie_slug, prix,
 *              images: [ { fichier, alt } ] } }
 * Les images sont dans l'ordre de la galerie : la première est l'image principale.
 */
ProduitData.fetchOne = async function (slug) {
  return getRequest(`produit?slug=${encodeURIComponent(slug)}`);
};

export { ProduitData };
