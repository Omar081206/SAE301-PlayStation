import { getRequest } from "../lib/api-request.js";

let CategorieData = {};

/**
 * Toutes les catégories : GET /api/categories
 *
 * { categories: [ { nom, slug, nombre } ], total }
 * nombre : produits de la catégorie ; total : produits de tout le catalogue.
 */
CategorieData.fetchTous = async function () {
  return getRequest("categories");
};

export { CategorieData };
