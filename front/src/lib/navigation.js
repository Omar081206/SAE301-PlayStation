/**
 * Navigation déclenchée par le code (redirection), sans recharger la page.
 *
 * Les liens data-link suffisent quand l'utilisateur clique. Pour une
 * redirection (page réservée, retour après connexion), on ajoute l'adresse à
 * l'historique, puis on émet l'événement popstate que le routeur écoute déjà
 * (voir lib/router.js) : il affiche alors la page correspondante.
 */

/**
 * Affiche la page d'un chemin de route, par exemple « /connexion ».
 * Le chemin du projet (import.meta.env.BASE_URL) est ajouté ici.
 */
export function naviguer(chemin) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  history.pushState(null, "", base + chemin);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Valeur d'un paramètre de l'adresse courante (?retour=/commande), ou null.
 */
export function parametre(nom) {
  return new URLSearchParams(window.location.search).get(nom);
}
