import { ProduitData } from "../../data/produit.js";
import { htmlToFragment } from "../../lib/utils.js";
import { GrilleProduitsView } from "../../ui/grille-produits/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Catalogue » : tous les produits de la boutique.
 *
 * Le catalogue tient sur une page : il est chargé en une fois, sans tri ni
 * pagination.
 */

let M = {
  catalogue: null, // dernière réponse de l'API : { produits, total }
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande le catalogue et range la réponse dans le modèle.
 */
C.charger = async function () {
  try {
    M.catalogue = await ProduitData.fetchTous();
    M.message = null;
  } catch (erreur) {
    M.catalogue = null;
    M.message = { type: "erreur", texte: `Impossible de charger le catalogue : ${erreur.message}` };
  }
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

/**
 * Reconstruit toute la page à partir du modèle, et remplace l'ancienne.
 * C'est le principe des frameworks : l'affichage se déduit de l'état, on ne le
 * retouche pas morceau par morceau.
 */
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotGrille = pageFragment.querySelector('slot[name="grille"]');
  if (M.catalogue === null) {
    // Rien à afficher : on retire l'emplacement.
    slotGrille.remove();
  } else {
    slotGrille.replaceWith(GrilleProduitsView.dom(M.catalogue.produits));
  }

  return pageFragment;
};

export function CataloguePage() {
  return C.init();
}
