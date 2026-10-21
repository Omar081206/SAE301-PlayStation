import { getRequest } from "../lib/api-request.js";

let ProduitData = {};

/**
 * Le catalogue : GET /api/produits?categorie=…
 *
 * categorie (slug) est facultatif : sans lui, tout le catalogue.
 *
 * { produits: [ { id, nom, slug, categorie, categorie_slug, variante_id, prix,
 *                 prix_initial, promotion, image, image_alt, etat_stock } ], total,
 *   categorie: { nom, slug } ou null }
 * variante_id : la variante par défaut (la première en stock). prix_initial et
 * promotion : prix d'origine et pourcentage du produit en promotion
 * automatique, null pour les autres. image : nom du fichier de l'image
 * principale, ou null si le produit n'en a pas.
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
 * { produit: { id, nom, slug, description, categorie, categorie_slug, variante_id,
 *              prix, prix_initial, promotion, etat_stock, images: [ { fichier, alt } ],
 *              options: [ { id, nom, valeurs: [ { id, valeur } ] } ],
 *              variantes: [ { id, prix, prix_initial, promotion, etat_stock,
 *                             valeurs: [id…], images: [ { fichier, alt } ] } ] } }
 * Les images sont dans l'ordre de la galerie : la première est l'image principale.
 */
ProduitData.fetchOne = async function (slug) {
  return getRequest(`produit?slug=${encodeURIComponent(slug)}`);
};

export { ProduitData };
