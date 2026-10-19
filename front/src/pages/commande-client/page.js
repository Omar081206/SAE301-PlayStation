import { AuthData } from "../../data/auth.js";
import { CommandeData } from "../../data/commande.js";
import { naviguer } from "../../lib/navigation.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { DetailCommandeClientView } from "../../ui/detail-commande-client/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationCompteView } from "../../ui/navigation-compte/index.js";
import template from "./template.html?raw";

/**
 * Page « Détail d'une commande » de l'espace personnel : statut, articles
 * (avec leurs options) et total.
 *
 * Elle ne protège rien : le serveur ne renvoie la commande qu'à son
 * propriétaire (404 sinon, comme pour un numéro inconnu), et refuse (403) si
 * personne n'est connecté ; la page envoie alors à la connexion.
 */

let M = {
  numero: null, // numéro de la commande affichée (paramètre d'URL)
  commande: null, // détail renvoyé par le serveur, ou null
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande le détail de la commande. Renvoie faux si personne n'est
 * connecté (403).
 */
C.charger = async function () {
  try {
    M.commande = (await CommandeData.fetchOne(M.numero)).commande;
  } catch (erreur) {
    M.commande = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = {
      type: "erreur",
      texte: erreur.statut === 404 ? "Cette commande est introuvable." : erreur.message,
    };
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

C.init = async function (numero) {
  M.numero = numero;
  M.message = null;

  if (!(await C.charger())) {
    naviguer(`/connexion?retour=/compte/commandes/${encodeURIComponent(numero)}`);
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
  let pageFragment = htmlToFragment(genericRenderer(template, { titre: `Commande ${M.numero}` }));

  pageFragment
    .querySelector('slot[name="navigation"]')
    .replaceWith(NavigationCompteView.dom("commandes", { surDeconnexion: C.handler_deconnexion }));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotContenu = pageFragment.querySelector('slot[name="contenu"]');

  if (M.commande === null) {
    slotContenu.remove();
  } else {
    slotContenu.replaceWith(DetailCommandeClientView.dom(M.commande));
  }

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { numero } pour /compte/commandes/:numero.
export function CommandeClientPage(params) {
  return C.init(params.numero);
}
