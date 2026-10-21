import { getRequest, postRequest } from "../lib/api-request.js";

let CommandeData = {};

/**
 * Validation de la commande : POST /api/commande, corps JSON { lignes, code }
 * (les lignes du panier { variantId, quantite }, sans prix ; code : code promo
 * saisi, ou null). 403 si personne n'est connecté, 422 si le panier est vide
 * ou invalide, ou si le code n'existe plus.
 *
 * { commande: { numero, statut, total, code_promo, pourcentage_promo, remise, cree_le,
 *               lignes: [ { variantId, nom, options, prix_unitaire, quantite, sous_total } ] } }
 * options : les options choisies, en texte (« Coloris : Noir »), ou null.
 * total : montant payé, remise déduite ; code_promo, pourcentage_promo : null
 * sans code.
 */
CommandeData.save = async function (lignes, code = null) {
  return postRequest("commande", { lignes, code });
};

/**
 * Une commande du client connecté : GET /api/commande?numero=…
 * Même réponse que save ; 404 si la commande n'existe pas ou n'est pas à lui.
 */
CommandeData.fetchOne = async function (numero) {
  return getRequest(`commande?numero=${encodeURIComponent(numero)}`);
};

export { CommandeData };
