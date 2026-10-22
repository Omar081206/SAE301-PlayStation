import { expect, test } from "@playwright/test";

// Appels directs à l'API, depuis la page : page.request partage les cookies du
// navigateur, donc une connexion faite ici vaut pour les pages ouvertes ensuite.

/**
 * Comptes de départ (sql/import.sql). Variables d'environnement pour en
 * utiliser d'autres : E2E_CLIENT_EMAIL, E2E_CLIENT_MDP, E2E_ADMIN_EMAIL,
 * E2E_ADMIN_MDP. Ils ne servent qu'en lecture : un test qui écrit (commande,
 * profil) crée son propre compte (creerClient).
 */
export const COMPTES = {
  client: {
    email: process.env.E2E_CLIENT_EMAIL ?? "client@playstation.test",
    mdp: process.env.E2E_CLIENT_MDP ?? "client1234",
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@playstation.test",
    mdp: process.env.E2E_ADMIN_MDP ?? "admin1234",
  },
};

// Préfixe de tout ce que les tests créent : on le retrouve et on le supprime.
export const PREFIXE = "e2e";

// Identité des clients créés par les tests : lettres seulement (le serveur
// refuse les chiffres dans un nom). Le back-office les affiche « Test
// Automatique » : un test qui parcourt les commandes peut écarter les leurs.
export const CLIENT_TEST = { prenom: "Test", nom: "Automatique" };

// Adresses des clients créés par les tests de ce worker, en attente de
// nettoyage. Chaque test ne supprime que les siens : les autres workers
// travaillent en même temps avec leurs propres clients.
export const clientsCrees = [];

/**
 * GET sur l'API ; échoue si la réponse n'est pas 200. Renvoie le JSON.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} chemin  ex. « produits », « produit?slug=astro-bot »
 */
export async function lire(page, chemin) {
  let reponse = await page.request.get(`api/${chemin}`);
  expect(reponse.status(), `GET /api/${chemin}`).toBe(200);
  return reponse.json();
}

/**
 * POST JSON sur l'API, sans vérifier le statut. Renvoie { statut, corps }.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} chemin
 * @param {Object} donnees
 */
export async function envoyer(page, chemin, donnees) {
  let reponse = await page.request.post(`api/${chemin}`, { data: donnees });
  return { statut: reponse.status(), corps: await reponse.json().catch(() => null) };
}

/**
 * Connecte le client de test (session client, POST /api/login).
 *
 * @param {import("@playwright/test").Page} page
 * @param {{ email: string, mdp: string }} [compte]
 */
export async function connecterClient(page, compte = COMPTES.client) {
  let { statut } = await envoyer(page, "login", compte);
  expect(statut, "connexion du client de test").toBe(200);
}

/**
 * Connecte l'administrateur de test (session admin, POST /api/admin/login).
 *
 * @param {import("@playwright/test").Page} page
 */
export async function connecterAdmin(page) {
  let { statut } = await envoyer(page, "admin/login", COMPTES.admin);
  expect(statut, "connexion de l'administrateur de test").toBe(200);
}

/**
 * Crée et connecte un client propre au test (adresse e2e-…@playstation.test).
 * À supprimer en fin de test avec nettoyerClientsTest (tests @ecriture seulement).
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<{ email: string, mdp: string }>}
 */
export async function creerClient(page) {
  let compte = {
    ...CLIENT_TEST,
    email: `${PREFIXE}-${Date.now()}-${Math.floor(Math.random() * 1000)}@playstation.test`,
    mdp: "motdepasse-e2e",
  };
  let { statut } = await envoyer(page, "inscription", compte);
  expect(statut, "inscription du client de test").toBe(200);
  clientsCrees.push(compte.email);
  return { email: compte.email, mdp: compte.mdp };
}

/**
 * Clé du panier dans le localStorage : le chemin du projet suivi de
 * « panier », comme dans data/panier.js.
 *
 * @returns {string}
 */
function clePanier() {
  return new URL(test.info().project.use.baseURL).pathname + "panier";
}

/**
 * Lit le panier du localStorage de la page (voir clePanier).
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<Array<Object>>}
 */
export async function lirePanier(page) {
  return page.evaluate((cle) => JSON.parse(localStorage.getItem(cle) ?? "[]"), clePanier());
}

/**
 * Remplace le panier du localStorage, avant le chargement de l'application.
 *
 * @param {import("@playwright/test").Page} page
 * @param {Array<Object>} lignes
 */
export async function preparerPanier(page, lignes) {
  await page.addInitScript(([cle, valeur]) => localStorage.setItem(cle, valeur), [clePanier(), JSON.stringify(lignes)]);
}
