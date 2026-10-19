import { getRequest, postRequest } from "../lib/api-request.js";

let AuthData = {};

// Dernier état de connexion renvoyé par le serveur : { connecte, email, pseudo, role }.
// Il ne sert qu'à l'affichage (header) : c'est le serveur qui décide des accès.
AuthData.session = { connecte: false, email: null, pseudo: null, role: null };

// Fonction appelée quand l'état de connexion change, ou null. Le layout y
// branche la mise à jour du header : ce module ne touche pas au DOM.
AuthData.surChangement = null;

/**
 * Retient l'état renvoyé par le serveur, prévient l'application, et le renvoie.
 */
AuthData.retenir = function (session) {
  AuthData.session = session;

  if (AuthData.surChangement !== null) {
    AuthData.surChangement();
  }

  return session;
};

/**
 * Connexion : POST /api/login, corps { identifiant, mdp }
 * L'identifiant est le pseudo ou l'adresse e-mail.
 * En cas de succès, le serveur ouvre une session ; le cookie PHPSESSID qu'il
 * renvoie accompagnera ensuite chaque requête.
 * 422 si l'identifiant ou le mot de passe est incorrect.
 *
 * { connecte: true, email, pseudo, role }
 */
AuthData.login = async function (identifiant, mdp) {
  return AuthData.retenir(await postRequest("login", { identifiant, mdp }));
};

/**
 * Création de compte : POST /api/inscription, corps { email, pseudo, mdp }
 * Le compte créé est aussitôt connecté. { connecte: true, email, pseudo, role }
 * 409 si l'adresse ou le pseudo est déjà pris.
 */
AuthData.inscription = async function (email, pseudo, mdp) {
  return AuthData.retenir(await postRequest("inscription", { email, pseudo, mdp }));
};

/**
 * Déconnexion : POST /api/logout
 */
AuthData.logout = async function () {
  return AuthData.retenir(await postRequest("logout"));
};

/**
 * Utilisateur connecté : GET /api/session
 * { connecte, email, pseudo, role } (à null si personne n'est connecté)
 */
AuthData.fetchSession = async function () {
  return AuthData.retenir(await getRequest("session"));
};

export { AuthData };
