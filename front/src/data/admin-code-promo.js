import { getRequest, postRequest } from "../lib/api-request.js";

let AdminCodePromoData = {};

/**
 * Codes promo du back-office : GET /api/admin/codes-promo
 * 403 sans connexion administrateur.
 *
 * { codes: [ { id, code, pourcentage, utilisations, remise_totale } ] }
 * utilisations, remise_totale : commandes non annulées qui ont utilisé le code.
 */
AdminCodePromoData.fetchAll = async function () {
  return getRequest("admin/codes-promo");
};

/**
 * Création : POST /api/admin/code-promo/creer, corps { code, pourcentage }
 * Le code est mis en majuscules par le serveur. 422 si la saisie est
 * invalide, 409 si le code existe déjà.
 *
 * { code: { id, code, pourcentage } }
 */
AdminCodePromoData.creer = async function (code, pourcentage) {
  return postRequest("admin/code-promo/creer", { code, pourcentage });
};

/**
 * Modification : POST /api/admin/code-promo/modifier, corps { id, code, pourcentage }
 * Mêmes refus que la création, et 404 si le code n'existe plus.
 */
AdminCodePromoData.modifier = async function (id, code, pourcentage) {
  return postRequest("admin/code-promo/modifier", { id, code, pourcentage });
};

/**
 * Suppression : POST /api/admin/code-promo/supprimer, corps { id }
 * Les commandes déjà passées gardent leur remise. 404 si le code n'existe plus.
 *
 * { id }
 */
AdminCodePromoData.supprimer = async function (id) {
  return postRequest("admin/code-promo/supprimer", { id });
};

export { AdminCodePromoData };
