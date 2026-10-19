import { getRequest, postRequest } from "../lib/api-request.js";

let AdminCommandeData = {};

/**
 * Toutes les commandes : GET /api/admin/commandes?tri=…&sens=…
 * tri : "date", "statut" ou "montant" ; sens : "asc" ou "desc".
 * 403 sans connexion administrateur.
 *
 * { commandes: [ { numero, statut, total, cree_le, client, articles } ], tri, sens }
 */
AdminCommandeData.fetchAll = async function (tri, sens) {
  return getRequest(`admin/commandes?tri=${encodeURIComponent(tri)}&sens=${encodeURIComponent(sens)}`);
};

/**
 * Une commande : GET /api/admin/commande?numero=…
 * 404 si elle n'existe pas.
 *
 * { commande: { numero, statut, total, cree_le, client: { pseudo, email },
 *               lignes, historique: [ { ancien, nouveau, le, par } ], suivants } }
 * suivants : statuts vers lesquels elle peut passer.
 */
AdminCommandeData.fetchOne = async function (numero) {
  return getRequest(`admin/commande?numero=${encodeURIComponent(numero)}`);
};

/**
 * Changement de statut d'une commande : POST /api/admin/commande/statut,
 * corps { numero, statut }. 422 si son statut actuel ne le permet pas.
 */
AdminCommandeData.changerStatut = async function (numero, statut) {
  return postRequest("admin/commande/statut", { numero, statut });
};

/**
 * Changement de statut en lot : POST /api/admin/commandes/statut,
 * corps { numeros, statut }. Chaque commande est traitée séparément.
 *
 * { statut, changees, resultats: [ { numero, change, erreur? } ] }
 */
AdminCommandeData.changerStatutLot = async function (numeros, statut) {
  return postRequest("admin/commandes/statut", { numeros, statut });
};

export { AdminCommandeData };
