import { CategorieData } from "../../data/categorie.js";
import { PanierData } from "../../data/panier.js";
import { ProduitData } from "../../data/produit.js";
import { htmlToFragment } from "../../lib/utils.js";
import { BandeauView } from "../../ui/bandeau/index.js";
import { FiltreCategoriesView } from "../../ui/filtre-categories/index.js";
import { GrilleProduitsView } from "../../ui/grille-produits/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Catalogue » : tous les produits de la boutique (/), ou ceux d'une
 * catégorie (/categorie/manettes).
 *
 * Le filtre est fait par le serveur : choisir une catégorie, c'est suivre un
 * lien, et la page se recharge avec les produits de cette catégorie.
 */

let M = {
  catalogue: null, // dernière réponse de l'API : { produits, total, categorie }
  categories: null, // menu des catégories : { categories, total }
  slug: undefined, // catégorie affichée, undefined pour tout le catalogue
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande le catalogue, entier ou d'une catégorie, et range la réponse dans le modèle.
 * slug (de la catégorie) est facultatif, voir data/produit.js.
 */
C.charger = async function (slug) {
  try {
    M.catalogue = await ProduitData.fetchTous(slug);
    M.message = null;
  } catch (erreur) {
    M.catalogue = null;

    let texte = `Impossible de charger le catalogue : ${erreur.message}`;
    if (erreur.statut === 404) texte = "Cette catégorie n'existe pas.";

    M.message = { type: "erreur", texte };
  }
};

/**
 * Demande les catégories du menu. Sans elles, le catalogue reste affiché.
 */
C.chargerCategories = async function () {
  try {
    M.categories = await CategorieData.fetchTous();
  } catch (erreur) {
    M.categories = null;
  }
};

C.handler_ajouter = async function (variantId, nom) {
  try {
    // Le serveur vérifie le stock avant d'accepter l'ajout.
    let ajustement = await PanierData.ajouter(variantId);

    if (ajustement === null) {
      M.message = { type: "succes", texte: `« ${nom} » a été ajouté au panier.` };
    } else if (ajustement.accordee === 0) {
      M.message = { type: "avertissement", texte: `« ${nom} » est épuisé : il n’a pas pu être ajouté au panier.` };
    } else {
      M.message = {
        type: "avertissement",
        texte: `Vous avez déjà le maximum disponible de « ${nom} » dans votre panier.`,
      };
    }
  } catch (erreur) {
    M.message = { type: "erreur", texte: `Impossible d’ajouter « ${nom} » au panier : ${erreur.message}` };
  }

  V.rafraichir();
};

C.init = async function (slug) {
  M.message = null;
  M.slug = slug;
  await C.charger(slug);
  await C.chargerCategories();
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

  // Le titre est celui de la catégorie affichée, s'il y en a une.
  let titre = "Tous les produits";
  if (M.catalogue !== null && M.catalogue.categorie !== null) {
    titre = M.catalogue.categorie.nom;
  }
  pageFragment.querySelector('slot[name="bandeau"]').replaceWith(BandeauView.dom(titre));

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotFiltre = pageFragment.querySelector('slot[name="filtre"]');
  if (M.categories === null) {
    slotFiltre.remove();
  } else {
    slotFiltre.replaceWith(FiltreCategoriesView.dom({ ...M.categories, active: M.slug }));
  }

  let slotGrille = pageFragment.querySelector('slot[name="grille"]');
  if (M.catalogue === null) {
    // Rien à afficher : on retire l'emplacement.
    slotGrille.remove();
  } else {
    slotGrille.replaceWith(GrilleProduitsView.dom(M.catalogue.produits, { surAjout: C.handler_ajouter }));
  }

  return pageFragment;
};

// params : paramètres d'URL de la route, { slug } pour /categorie/:slug, vide pour /.
export function CataloguePage(params) {
  return C.init(params.slug);
}
