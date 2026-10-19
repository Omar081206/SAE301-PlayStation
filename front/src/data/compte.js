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
