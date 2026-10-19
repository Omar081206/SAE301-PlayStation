import { getRequest, postRequest } from "../lib/api-request.js";

let AuthData = {};

// Dernier état de connexion renvoyé par le serveur : { connecte, email, prenom, nom, role }.
// Il ne sert qu'à l'affichage (header) : c'est le serveur qui décide des accès.
AuthData.session = { connecte: false, email: null, prenom: null, nom: null, role: null };

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
 * Connexion : POST /api/login, corps { email, mdp }
 * En cas de succès, le serveur ouvre une session ; le cookie PHPSESSID qu'il
 * renvoie accompagnera ensuite chaque requête.
 * 422 si l'adresse ou le mot de passe est incorrect.
 *
 * { connecte: true, email, prenom, nom, role }
 */
AuthData.login = async function (email, mdp) {
  return AuthData.retenir(await postRequest("login", { email, mdp }));
};

/**
 * Création de compte : POST /api/inscription, corps { prenom, nom, email, mdp }
 * Le compte créé est aussitôt connecté. { connecte: true, email, prenom, nom, role }
 * 409 si l'adresse est déjà prise.
 */
AuthData.inscription = async function (prenom, nom, email, mdp) {
  return AuthData.retenir(await postRequest("inscription", { prenom, nom, email, mdp }));
};

/**
 * Déconnexion : POST /api/logout
 */
AuthData.logout = async function () {
  return AuthData.retenir(await postRequest("logout"));
};

/**
 * Utilisateur connecté : GET /api/session
 * { connecte, email, prenom, nom, role } (à null si personne n'est connecté)
 */
AuthData.fetchSession = async function () {
  return AuthData.retenir(await getRequest("session"));
};

export { AuthData };
