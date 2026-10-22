import { CategorieData } from "../../data/categorie.js";
import { PanierData } from "../../data/panier.js";
import { ProduitData } from "../../data/produit.js";
import { htmlToFragment } from "../../lib/utils.js";
import { BandeauView } from "../../ui/bandeau/index.js";
import { FiltreCategoriesView } from "../../ui/filtre-categories/index.js";
import { GrilleProduitsView } from "../../ui/grille-produits/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

// Durée d'affichage de la bulle d'ajout au panier, en millisecondes.
const DUREE_NOTIFICATION = 4000;

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
  notification: null, // bulle d'ajout au panier : { type, texte }, ou null
  minuteur: null, // délai d'effacement de la bulle, ou null
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

/**
 * Affiche la bulle d'ajout au panier, puis l'efface au bout de
 * DUREE_NOTIFICATION. Un nouvel ajout relance le délai.
 */
C.notifier = function (notification) {
  M.notification = notification;
  clearTimeout(M.minuteur);
  M.minuteur = setTimeout(() => {
    M.notification = null;
    M.minuteur = null;
    // La page a pu être quittée entre-temps : on ne reconstruit qu'une page
    // encore affichée (sinon la fiche changerait le titre d'une autre page).
    if (V.racine.isConnected) V.rafraichir();
  }, DUREE_NOTIFICATION);
};

C.handler_ajouter = async function (variantId, nom) {
  try {
    // Le serveur vérifie le stock avant d'accepter l'ajout.
    let { ajustement, maximum } = await PanierData.ajouter(variantId);

    if (ajustement === null && maximum) {
      // Dernier exemplaire disponible : on prévient tout de suite, plutôt
      // qu'au clic suivant, qui serait refusé.
      C.notifier({
        type: "avertissement",
        texte: `« ${nom} » a été ajouté au panier : il n’y en a plus en stock, vous avez tout le stock disponible.`,
      });
    } else if (ajustement === null) {
      C.notifier({ type: "succes", texte: `« ${nom} » a été ajouté au panier.` });
    } else if (ajustement.accordee === 0) {
      C.notifier({ type: "avertissement", texte: `« ${nom} » est épuisé : il n’a pas pu être ajouté au panier.` });
    } else {
      C.notifier({
        type: "avertissement",
        texte: `Vous avez déjà le maximum disponible de « ${nom} » dans votre panier.`,
      });
    }
  } catch (erreur) {
    C.notifier({ type: "erreur", texte: `Impossible d’ajouter « ${nom} » au panier : ${erreur.message}` });
  }

  V.rafraichir();
};

C.init = async function (slug) {
  M.message = null;
  // Une bulle restée d'une visite précédente ne doit pas réapparaître.
  clearTimeout(M.minuteur);
  M.notification = null;
  M.minuteur = null;
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
  // Si les produits n'ont pas pu être chargés, le menu, chargé à part, connaît
  // encore son nom : le titre reste celui de la catégorie cochée.
  let titre = "Tous les produits";
  if (M.catalogue !== null && M.catalogue.categorie !== null) {
    titre = M.catalogue.categorie.nom;
  } else if (M.catalogue === null && M.categories !== null) {
    titre = M.categories.categories.find((categorie) => categorie.slug === M.slug)?.nom ?? titre;
  }
  pageFragment.querySelector('slot[name="bandeau"]').replaceWith(BandeauView.dom(titre));

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));
  pageFragment.querySelector('slot[name="notification"]').replaceWith(MessageView.dom(M.notification));

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
