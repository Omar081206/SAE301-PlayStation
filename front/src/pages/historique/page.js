import { AuthData } from "../../data/auth.js";
import { CompteData } from "../../data/compte.js";
import { naviguer } from "../../lib/navigation.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { FiltresCommandesView } from "../../ui/filtres-commandes/index.js";
import { ListeCommandesClientView } from "../../ui/liste-commandes-client/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationCompteView } from "../../ui/navigation-compte/index.js";
import { PaginationView } from "../../ui/pagination/index.js";
import template from "./template.html?raw";
import templateVide from "./vide.html?raw";

/**
 * Page « Mes commandes » : l'historique des commandes du client, la plus
 * récente d'abord, filtré par statut et par période, par pages de 10.
 *
 * Elle ne protège rien : le serveur refuse (403) si personne n'est connecté,
 * et la page envoie alors à la connexion, qui ramènera ici. Les filtres et la
 * pagination sont appliqués par le serveur.
 */

// Adresse de la connexion, avec le retour vers cette page une fois connecté.
const CONNEXION = "/connexion?retour=/compte/commandes";

let M = {
  statut: null, // statut filtré, ou null pour tous
  periode: "6m", // 30j, 6m, 12m ou tout
  page: 1, // page affichée
  resultat: null, // { commandes, compteurs, page, pages } renvoyé par le serveur
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande la page de commandes qui correspond aux filtres. Renvoie faux si
 * personne n'est connecté (403).
 */
C.charger = async function () {
  try {
    M.resultat = await CompteData.fetchCommandes(M.statut, M.periode, M.page);
  } catch (erreur) {
    M.resultat = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger vos commandes : ${erreur.message}` };
  }

  return true;
};

/**
 * Recharge après un changement de filtre ou de page. Session expirée entre
 * deux clics : retour à la connexion.
 */
C.recharger = async function () {
  if (!(await C.charger())) {
    naviguer(CONNEXION);
    return;
  }
  V.rafraichir();
};

C.handler_statut = async function (statut) {
  M.statut = statut;
  M.page = 1;
  await C.recharger();
};

C.handler_periode = async function (periode) {
  M.periode = periode;
  M.page = 1;
  await C.recharger();
};

C.handler_page = async function (page) {
  M.page = page;
  await C.recharger();
};

C.handler_deconnexion = async function () {
  try {
    await AuthData.logout();
    naviguer("/");
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
    V.rafraichir();
  }
};

C.init = async function () {
  M.statut = null;
  M.periode = "6m";
  M.page = 1;
  M.message = null;

  if (!(await C.charger())) {
    naviguer(CONNEXION);
    // Le routeur affichera la page de connexion : ce contenu ne sera pas montré.
    return "";
  }

  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

// Même principe que la page Catalogue : toute la page se reconstruit à partir
// du modèle.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(genericRenderer(template, { titre: "Mes commandes" }));

  pageFragment
    .querySelector('slot[name="navigation"]')
    .replaceWith(NavigationCompteView.dom("commandes", { surDeconnexion: C.handler_deconnexion }));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotContenu = pageFragment.querySelector('slot[name="contenu"]');

  if (M.resultat === null) {
    slotContenu.remove();
    return pageFragment;
  }

  let filtres = FiltresCommandesView.dom(
    { statut: M.statut, periode: M.periode, compteurs: M.resultat.compteurs },
    { surStatut: C.handler_statut, surPeriode: C.handler_periode }
  );
  let liste =
    M.resultat.commandes.length === 0
      ? htmlToFragment(templateVide)
      : ListeCommandesClientView.dom({
          commandes: M.resultat.commandes,
          legende: "Vos commandes, la plus récente d’abord",
        });
  let pagination = PaginationView.dom(
    { page: M.resultat.page, pages: M.resultat.pages },
    { surPage: C.handler_page }
  );

  slotContenu.replaceWith(filtres, liste, pagination);
  return pageFragment;
};

export function HistoriquePage() {
  return C.init();
}
