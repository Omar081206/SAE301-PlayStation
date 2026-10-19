import { AuthData } from "../../data/auth.js";
import { CompteData } from "../../data/compte.js";
import { naviguer } from "../../lib/navigation.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { CommandesRecentesView } from "../../ui/commandes-recentes/index.js";
import { InformationsCompteView } from "../../ui/informations-compte/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationCompteView } from "../../ui/navigation-compte/index.js";
import template from "./template.html?raw";

/**
 * Page « Espace personnel » (accueil) : « Bonjour Prénom », mes informations
 * et mes dernières commandes.
 *
 * Comme la page Commande, elle ne protège rien : le serveur refuse (403) si
 * personne n'est connecté, et la page envoie alors à la connexion, qui
 * ramènera ici.
 */

// Adresse de la connexion, avec le retour vers cette page une fois connecté.
const CONNEXION = "/connexion?retour=/compte";

let M = {
  compte: null, // { profil, commandes } renvoyé par le serveur, ou null
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande le profil et les dernières commandes. Renvoie faux si personne
 * n'est connecté (403).
 */
C.charger = async function () {
  try {
    M.compte = await CompteData.fetch();
  } catch (erreur) {
    M.compte = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger votre espace : ${erreur.message}` };
  }

  return true;
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
  // « Bonjour Nathan » : le prénom vient du serveur, rendu avec le template.
  let titre = M.compte === null ? "Mon espace" : `Bonjour ${M.compte.profil.prenom}`;
  let pageFragment = htmlToFragment(genericRenderer(template, { titre }));

  pageFragment
    .querySelector('slot[name="navigation"]')
    .replaceWith(NavigationCompteView.dom("accueil", { surDeconnexion: C.handler_deconnexion }));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotContenu = pageFragment.querySelector('slot[name="contenu"]');

  if (M.compte === null) {
    slotContenu.remove();
  } else {
    slotContenu.replaceWith(
      InformationsCompteView.dom(M.compte.profil),
      CommandesRecentesView.dom(M.compte.commandes)
    );
  }

  return pageFragment;
};

export function ComptePage() {
  return C.init();
}
