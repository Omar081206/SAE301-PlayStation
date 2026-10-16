import { CommandeData } from "../../data/commande.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ConfirmationCommandeView } from "../../ui/confirmation-commande/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Confirmation » : une commande enregistrée, désignée par son numéro
 * dans l'URL (/commande/PS-20261016-0001).
 *
 * La commande est relue sur le serveur : la page peut être rechargée, et seul
 * le client qui l'a passée peut la voir.
 */

let M = {
  commande: null, // dernière réponse de l'API : la commande
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande la commande au serveur et la range dans le modèle.
 */
C.charger = async function (numero) {
  try {
    M.commande = (await CommandeData.fetchOne(numero)).commande;
    M.message = null;
  } catch (erreur) {
    M.commande = null;

    let texte = `Impossible de charger la commande : ${erreur.message}`;
    if (erreur.statut === 403) texte = "Connectez-vous pour consulter votre commande.";
    if (erreur.statut === 404) texte = "Cette commande est introuvable.";

    M.message = { type: "erreur", texte };
  }
};

C.init = async function (numero) {
  M.message = null;
  await C.charger(numero);
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
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  if (M.commande === null) {
    slotConfirmation.remove();
  } else {
    slotConfirmation.replaceWith(ConfirmationCommandeView.dom(M.commande));
  }

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { numero } pour /commande/:numero.
export function ConfirmationPage(params) {
  return C.init(params.numero);
}
