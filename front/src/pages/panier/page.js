import { PanierData } from "../../data/panier.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { ConfirmationPanierView } from "../../ui/confirmation-panier/index.js";
import { LignesPanierView } from "../../ui/lignes-panier/index.js";
import { MessageView } from "../../ui/message/index.js";
import { ResumePanierView } from "../../ui/resume-panier/index.js";
import template from "./template.html?raw";

/**
 * Page « Panier ».
 *
 * Le panier est conservé dans le navigateur (data/panier.js), sans prix. À
 * chaque affichage et après chaque modification, la page demande au serveur
 * le détail des lignes : noms, prix, sous-totaux et total viennent de lui.
 * Le serveur ramène aussi les quantités au stock disponible : le panier
 * enregistré est alors aligné sur sa réponse, et chaque correction annoncée.
 */

let M = {
  panier: null, // dernière réponse de l'API : { lignes, total, nombre, ajustements }
  message: null, // { type, texte }, ou null
  avertissements: [], // un message par quantité ajustée au stock
  notification: null, // bulle « plus de stock » : { type, texte }, ou null
  auMaximum: null, // variante montée au stock disponible par « + », ou null
  confirmationVider: false, // vrai pendant la confirmation « Vider le panier »
};

let C = {};

/**
 * Message d'un ajustement fait par le serveur pour respecter le stock.
 */
C.texteAjustement = function (ajustement) {
  if (ajustement.accordee === 0) {
    return `« ${ajustement.nom} » n’est plus disponible : il a été retiré de votre panier.`;
  }

  return `La quantité de « ${ajustement.nom} » a été ramenée à ${ajustement.accordee} : c’est le stock disponible actuellement.`;
};

/**
 * Demande au serveur le détail du panier enregistré et le range dans le modèle.
 */
C.charger = async function () {
  let lignes = PanierData.lire();

  try {
    M.panier = await PanierData.fetchDetail(lignes);
    M.message = null;
    M.avertissements = M.panier.ajustements.map((ajustement) => ({
      type: "avertissement",
      texte: C.texteAjustement(ajustement),
    }));

    // Quantité ramenée au stock, variante épuisée ou retirée de la vente : le
    // panier enregistré prend les valeurs accordées par le serveur.
    if (M.panier.ajustements.length > 0 || M.panier.lignes.length !== lignes.length) {
      PanierData.aligner(M.panier);
    }
  } catch (erreur) {
    M.panier = null;
    M.avertissements = [];
    M.message = { type: "erreur", texte: `Impossible de charger le panier : ${erreur.message}` };
  }
};

/**
 * Bulle « plus de stock » de la ligne montée au stock disponible par « + » :
 * elle reste tant que la ligne y est, et disparaît dès qu'on la diminue ou
 * qu'on la supprime.
 */
C.suivreMaximum = function () {
  let ligne = M.panier?.lignes.find((element) => element.variantId === M.auMaximum);

  if (ligne === undefined || ligne.quantite < ligne.quantiteMax) {
    M.auMaximum = null;
    M.notification = null;
    return;
  }

  M.notification = {
    type: "avertissement",
    texte: `Il n’y a plus de stock pour « ${ligne.nom} » : vous avez tout le stock disponible dans votre panier.`,
  };
};

C.handler_changerQuantite = async function (variantId, quantite) {
  let avant = M.panier.lignes.find((ligne) => ligne.variantId === variantId);
  PanierData.modifier(variantId, quantite);
  await C.charger();

  // « + » qui atteint le stock disponible : le bouton se grise, la bulle dit pourquoi.
  let apres = M.panier?.lignes.find((ligne) => ligne.variantId === variantId);
  if (avant !== undefined && quantite > avant.quantite && apres !== undefined && apres.quantite >= apres.quantiteMax) {
    M.auMaximum = variantId;
  }
  C.suivreMaximum();

  V.rafraichir();
};

C.handler_supprimer = async function (variantId) {
  PanierData.supprimer(variantId);
  await C.charger();
  C.suivreMaximum();
  V.rafraichir();
};

C.handler_vider = async function () {
  M.confirmationVider = true;
  V.rafraichir();
};

C.handler_confirmerVider = async function () {
  M.confirmationVider = false;
  PanierData.vider();
  await C.charger();
  C.suivreMaximum();
  // Après le chargement, qui remet le message à zéro.
  if (M.message === null) {
    M.message = { type: "succes", texte: "Votre panier est vidé." };
  }
  V.rafraichir();
};

C.handler_annulerVider = async function () {
  M.confirmationVider = false;
  V.rafraichir();
};

C.init = async function () {
  M.message = null;
  M.confirmationVider = false;
  M.notification = null;
  M.auMaximum = null;
  await C.charger();
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
// du modèle, après chaque changement de quantité ou suppression. La fenêtre
// « Vider le panier », reconstruite avec la page, est rouverte.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  V.racine.querySelector("dialog")?.showModal();
};

V.createPageFragment = function () {
  // Le titre rappelle le nombre d'articles : il est rendu avec le template.
  let titre = "Mon panier";
  if (M.panier !== null && M.panier.nombre > 0) {
    titre += M.panier.nombre > 1 ? ` (${M.panier.nombre} articles)` : " (1 article)";
  }
  let pageFragment = htmlToFragment(genericRenderer(template, { titre }));

  pageFragment
    .querySelector('slot[name="message"]')
    .replaceWith(MessageView.dom(M.message), ...M.avertissements.map((avertissement) => MessageView.dom(avertissement)));
  pageFragment.querySelector('slot[name="notification"]').replaceWith(MessageView.dom(M.notification));

  let slotLignes = pageFragment.querySelector('slot[name="lignes"]');
  let slotResume = pageFragment.querySelector('slot[name="resume"]');
  let slotModale = pageFragment.querySelector('slot[name="modale"]');

  if (M.panier === null) {
    slotLignes.remove();
    slotResume.remove();
    slotModale.remove();
    return pageFragment;
  }

  slotLignes.replaceWith(
    LignesPanierView.dom(M.panier.lignes, {
      surQuantite: C.handler_changerQuantite,
      surSuppression: C.handler_supprimer,
      surVider: C.handler_vider,
    })
  );

  if (M.confirmationVider) {
    slotModale.replaceWith(
      ConfirmationPanierView.dom(
        { nombre: M.panier.nombre },
        { surConfirmation: C.handler_confirmerVider, surRetour: C.handler_annulerVider }
      )
    );
  } else {
    slotModale.remove();
  }

  // Panier vide : rien à résumer.
  if (M.panier.lignes.length === 0) {
    slotResume.remove();
  } else {
    slotResume.replaceWith(ResumePanierView.dom(M.panier));
  }

  return pageFragment;
};

export function PanierPage() {
  return C.init();
}
