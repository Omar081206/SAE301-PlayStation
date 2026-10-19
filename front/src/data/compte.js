import { getRequest, postRequest } from "../lib/api-request.js";
import { AuthData } from "./auth.js";

let CompteData = {};

/**
 * Espace personnel : GET /api/compte
 * 403 si personne n'est connecté.
 *
 * { profil: { prenom, nom, email }, commandes: [ { numero, statut, total, cree_le } ] }
 */
CompteData.fetch = async function () {
  return getRequest("compte");
};

/**
 * Historique des commandes : GET /api/compte/commandes?statut=…&periode=…&page=…
 * statut : en_cours, disponible, retiree, annulee, ou null pour tous ;
 * periode : 30j, 6m, 12m ou tout. 403 si personne n'est connecté.
 *
 * { commandes: [ { numero, statut, total, cree_le } ],
 *   compteurs: { en_cours, disponible, retiree, annulee }, page, pages }
 */
CompteData.fetchCommandes = async function (statut, periode, page) {
  let parametres = new URLSearchParams({ periode, page: String(page) });
  if (statut !== null) {
    parametres.set("statut", statut);
  }
  return getRequest(`compte/commandes?${parametres}`);
};

/**
 * Modification du profil : POST /api/compte/profil,
 * corps { prenom, nom, email, mdpActuel, nouveauMdp }
 * nouveauMdp vide : le mot de passe ne change pas. 422 si la saisie est
 * invalide ou le mot de passe actuel incorrect, 409 si l'adresse est prise.
 *
 * Le nouvel état de connexion est retenu (le header affiche le prénom).
 * { profil: { prenom, nom, email }, session }
 */
CompteData.modifierProfil = async function (saisie) {
  let reponse = await postRequest("compte/profil", saisie);
  AuthData.retenir(reponse.session);
  return reponse;
};

export { CompteData };
