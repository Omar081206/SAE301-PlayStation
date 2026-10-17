import { PanierData } from "../../data/panier.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
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

C.handler_changerQuantite = async function (variantId, quantite) {
  PanierData.modifier(variantId, quantite);
  await C.charger();
  V.rafraichir();
};

C.handler_supprimer = async function (variantId) {
  PanierData.supprimer(variantId);
  await C.charger();
  V.rafraichir();
};

C.init = async function () {
  M.message = null;
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
// du modèle, après chaque changement de quantité ou suppression.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
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

  let slotLignes = pageFragment.querySelector('slot[name="lignes"]');
  let slotResume = pageFragment.querySelector('slot[name="resume"]');

  if (M.panier === null) {
    slotLignes.remove();
    slotResume.remove();
    return pageFragment;
  }

  slotLignes.replaceWith(
    LignesPanierView.dom(M.panier.lignes, {
      surQuantite: C.handler_changerQuantite,
      surSuppression: C.handler_supprimer,
    })
  );

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
