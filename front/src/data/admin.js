import { getRequest, postRequest } from "../lib/api-request.js";

let AdminData = {};

/**
 * Connexion au back-office : POST /api/admin/login, corps { email, mdp }
 * Seuls les comptes admin sont acceptés (422 sinon). La session
 * d'administration est distincte de celle du client.
 *
 * { connecte: true, email }
 */
AdminData.login = async function (email, mdp) {
  return postRequest("admin/login", { email, mdp });
};

/**
 * Déconnexion du back-office : POST /api/admin/logout
 * La connexion client éventuelle reste ouverte.
 */
AdminData.logout = async function () {
  return postRequest("admin/logout");
};

/**
 * Administrateur connecté : GET /api/admin/session
 * { connecte, email } (email à null si personne n'est connecté)
 */
AdminData.fetchSession = async function () {
  return getRequest("admin/session");
};

/**
 * Indicateurs du tableau de bord : GET /api/admin/tableau-de-bord
 * 403 sans connexion administrateur.
 *
 * { produits, commandes, commandesEnCours, variantesEpuisees }
 */
AdminData.fetchTableauDeBord = async function () {
  return getRequest("admin/tableau-de-bord");
};

export { AdminData };
