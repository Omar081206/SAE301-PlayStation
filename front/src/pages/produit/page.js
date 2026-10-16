import { PanierData } from "../../data/panier.js";
import { ProduitData } from "../../data/produit.js";
import { htmlToFragment } from "../../lib/utils.js";
import { FicheProduitView } from "../../ui/fiche-produit/index.js";
import { GalerieProduitView } from "../../ui/galerie-produit/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Produit » : la fiche d'un produit, désigné par son slug dans l'URL
 * (/produit/manette-sans-fil-dualsense).
 *
 * L'image affichée dans la galerie fait partie de l'état de la page : changer
 * d'image modifie le modèle, puis la page se reconstruit.
 */

let M = {
  produit: null, // dernière réponse de l'API : la fiche du produit
  imageActive: 0, // position, dans produit.images, de l'image affichée
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande la fiche du produit et la range dans le modèle.
 */
C.charger = async function (slug) {
  try {
    M.produit = (await ProduitData.fetchOne(slug)).produit;
    M.imageActive = 0;
    M.message = null;
  } catch (erreur) {
    M.produit = null;

    let texte = `Impossible de charger le produit : ${erreur.message}`;
    if (erreur.statut === 404) texte = "Ce produit n'existe pas ou n'est plus en vente.";

    M.message = { type: "erreur", texte };
  }
};

C.handler_changerImage = async function (position) {
  M.imageActive = position;
  V.rafraichir();
};

C.handler_ajouter = async function (variantId, nom) {
  PanierData.ajouter(variantId);
  M.message = { type: "succes", texte: `« ${nom} » a été ajouté au panier.` };
  V.rafraichir();
};

C.init = async function (slug) {
  M.message = null;
  await C.charger(slug);
  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  V.updateMetadata();
  return fragment;
};

// Même principe que la page Catalogue : toute la page se reconstruit à partir
// du modèle. L'image affichée survit parce qu'elle est dans le modèle.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
  V.updateMetadata();
};

/**
 * Titre de l'onglet et description pour les moteurs de recherche, tirés du
 * produit affiché.
 */
V.updateMetadata = function () {
  if (M.produit === null) {
    return;
  }

  document.title = `${M.produit.nom} · PlayStation Click & Collect`;
  document.querySelector('meta[name="description"]').setAttribute("content", M.produit.description);
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotFiche = pageFragment.querySelector('slot[name="fiche"]');
  if (M.produit === null) {
    slotFiche.remove();
    return pageFragment;
  }

  let fiche = FicheProduitView.dom(M.produit, { surAjout: C.handler_ajouter });
  fiche.querySelector('slot[name="galerie"]').replaceWith(
    GalerieProduitView.dom(
      { images: M.produit.images, active: M.imageActive },
      { surImage: C.handler_changerImage }
    )
  );
  slotFiche.replaceWith(fiche);

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { slug } pour /produit/:slug.
export function ProduitPage(params) {
  return C.init(params.slug);
}
