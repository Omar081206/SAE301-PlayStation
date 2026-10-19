import { getRequest, postRequest } from "../lib/api-request.js";

let AdminCategorieData = {};

/**
 * Catégories du back-office : GET /api/admin/categories
 * 403 sans connexion administrateur.
 *
 * { categories: [ { id, nom, slug, description, nombre } ] }
 */
AdminCategorieData.fetchAll = async function () {
  return getRequest("admin/categories");
};

/**
 * Création : POST /api/admin/categorie/creer, corps { nom, description }
 * Le slug est déduit du nom par le serveur. 422 si la saisie est invalide,
 * 409 si le nom est déjà pris.
 *
 * { categorie: { id, nom, slug, description } }
 */
AdminCategorieData.creer = async function (nom, description) {
  return postRequest("admin/categorie/creer", { nom, description });
};

/**
 * Modification : POST /api/admin/categorie/modifier, corps { id, nom, description }
 * Mêmes refus que la création, et 404 si la catégorie n'existe plus.
 */
AdminCategorieData.modifier = async function (id, nom, description) {
  return postRequest("admin/categorie/modifier", { id, nom, description });
};

/**
 * Suppression : POST /api/admin/categorie/supprimer, corps { id, destination }
 * destination : catégorie qui reçoit les produits, ou null pour une catégorie
 * vide. 409 si la catégorie a des produits et qu'aucune destination n'est donnée.
 *
 * { id, deplaces }
 */
AdminCategorieData.supprimer = async function (id, destination) {
  return postRequest("admin/categorie/supprimer", { id, destination });
};

export { AdminCategorieData };
