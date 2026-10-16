import { getRequest, postRequest } from "../lib/api-request.js";

let CommandeData = {};

/**
 * Validation de la commande : POST /api/commande, corps JSON { lignes }
 * (les lignes du panier { variantId, quantite }, sans prix).
 * 401 si personne n'est connecté, 422 si le panier est vide ou invalide.
 *
 * { commande: { numero, statut, total, cree_le,
 *               lignes: [ { nom, coloris, prix_unitaire, quantite, sous_total } ] } }
 */
CommandeData.save = async function (lignes) {
  return postRequest("commande", { lignes });
};

/**
 * Une commande du client connecté : GET /api/commande?numero=…
 * Même réponse que save ; 404 si la commande n'existe pas ou n'est pas à lui.
 */
CommandeData.fetchOne = async function (numero) {
  return getRequest(`commande?numero=${encodeURIComponent(numero)}`);
};

export { CommandeData };
