import { getRequest } from "../lib/api-request.js";

let ProduitData = {};

/**
 * Le catalogue : GET /api/produits?categorie=…
 *
 * categorie (slug) est facultatif : sans lui, tout le catalogue.
 *
 * { produits: [ { id, nom, slug, categorie, prix, image, image_alt } ], total,
 *   categorie: { nom, slug } ou null }
 * image est le nom du fichier de l'image principale (dans public/images/produits/),
 * ou null si le produit n'en a pas.
 */
ProduitData.fetchTous = async function (categorie) {
  let uri = "produits";

  if (categorie !== undefined) {
    uri += `?categorie=${encodeURIComponent(categorie)}`;
  }

  return getRequest(uri);
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
