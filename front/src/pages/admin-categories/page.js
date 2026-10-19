import { AdminCategorieData } from "../../data/admin-categorie.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ConfirmationSuppressionView } from "../../ui/confirmation-suppression/index.js";
import { FormulaireCategorieView } from "../../ui/formulaire-categorie/index.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauCategoriesView } from "../../ui/tableau-categories/index.js";
import template from "./template.html?raw";

/**
 * Page « Catégories » du back-office : créer, modifier et supprimer les
 * catégories du catalogue.
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * décide de l'accès et qui valide chaque saisie. Sans session
 * d'administration (403), elle renvoie à /admin, qui affiche la connexion.
 * Une suppression passe toujours par une fenêtre de confirmation, où l'on
 * choisit la catégorie qui recevra les produits.
 */

let M = {
  categories: null, // liste renvoyée par le serveur, ou null
  edition: null, // identifiant de la catégorie modifiée, ou null (création)
  suppression: null, // identifiant de la catégorie à supprimer, ou null
  saisie: { nom: "", description: "" }, // dernière saisie du formulaire
  erreurs: { formulaire: null, suppression: null }, // message de chaque encart
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Une catégorie de la liste chargée, par son identifiant.
 */
C.categorie = function (id) {
  return M.categories.find((categorie) => categorie.id === id);
};

/**
 * Demande les catégories. Renvoie faux sans session d'administration (403).
 */
C.charger = async function () {
  try {
    M.categories = (await AdminCategorieData.fetchAll()).categories;
  } catch (erreur) {
    M.categories = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger les catégories : ${erreur.message}` };
  }

  return true;
};

/**
 * Revient au formulaire de création, vide.
 */
C.reinitialiser = function () {
  M.edition = null;
  M.suppression = null;
  M.saisie = { nom: "", description: "" };
  M.erreurs = { formulaire: null, suppression: null };
};

C.handler_enregistrer = async function (nom, description) {
  M.saisie = { nom, description };

  try {
    if (M.edition === null) {
      await AdminCategorieData.creer(nom, description);
      M.message = { type: "succes", texte: `La catégorie « ${nom} » est créée.` };
    } else {
      await AdminCategorieData.modifier(M.edition, nom, description);
      M.message = { type: "succes", texte: `La catégorie « ${nom} » est enregistrée.` };
    }
    C.reinitialiser();
    await C.charger();
  } catch (erreur) {
    M.erreurs.formulaire = erreur.message;
  }

  V.rafraichir();
};

C.handler_modifier = async function (id) {
  let categorie = C.categorie(id);

  C.reinitialiser();
  M.edition = id;
  M.saisie = { nom: categorie.nom, description: categorie.description };
  M.message = null;
  V.rafraichir();
};

C.handler_annulerEdition = async function () {
  C.reinitialiser();
  V.rafraichir();
};

C.handler_supprimer = async function (id) {
  C.reinitialiser();
  M.suppression = id;
  M.message = null;
  V.rafraichir();
};

C.handler_confirmerSuppression = async function (destination) {
  let categorie = C.categorie(M.suppression);

  try {
    let reponse = await AdminCategorieData.supprimer(M.suppression, destination);
    let suite = "";
    if (reponse.deplaces === 1) suite = " 1 produit a été déplacé.";
    if (reponse.deplaces > 1) suite = ` ${reponse.deplaces} produits ont été déplacés.`;
    M.message = { type: "succes", texte: `La catégorie « ${categorie.nom} » est supprimée.${suite}` };
    C.reinitialiser();
    await C.charger();
  } catch (erreur) {
    M.erreurs.suppression = erreur.message;
    // Des produits ont pu être ajoutés entre-temps : le nombre affiché suit.
    await C.charger();
  }

  V.rafraichir();
};

C.handler_annulerSuppression = async function () {
  C.reinitialiser();
  V.rafraichir();
};

C.init = async function () {
  C.reinitialiser();
  M.message = null;

  if (!(await C.charger())) {
    naviguer("/admin");
    // Le routeur affichera la connexion : ce contenu ne sera pas montré.
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
// du modèle. La saisie survit parce qu'elle est dans le modèle. La fenêtre de
// suppression, reconstruite avec la page, est rouverte ; en modification, le
// focus va au formulaire (sous la liste sur mobile), pour qu'un lecteur
// d'écran l'annonce.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  if (M.suppression !== null) {
    V.racine.querySelector("dialog").showModal();
  } else if (M.edition !== null) {
    V.racine.querySelector("[data-focus]").focus();
  }
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slots = {};
  for (let nom of ["liste", "formulaire", "modale"]) {
    slots[nom] = pageFragment.querySelector(`slot[name="${nom}"]`);
  }

  if (M.categories === null) {
    Object.values(slots).forEach((slot) => slot.remove());
    return pageFragment;
  }

  slots.liste.replaceWith(
    TableauCategoriesView.dom(M.categories, {
      surModification: C.handler_modifier,
      surSuppression: C.handler_supprimer,
    })
  );

  slots.formulaire.replaceWith(
    FormulaireCategorieView.dom(
      {
        mode: M.edition === null ? "creation" : "modification",
        nom: M.saisie.nom,
        description: M.saisie.description,
        erreur: M.erreurs.formulaire,
      },
      { surEnvoi: C.handler_enregistrer, surAnnulation: C.handler_annulerEdition }
    )
  );

  if (M.suppression === null) {
    slots.modale.remove();
  } else {
    slots.modale.replaceWith(
      ConfirmationSuppressionView.dom(
        {
          categorie: C.categorie(M.suppression),
          autres: M.categories.filter((categorie) => categorie.id !== M.suppression),
          erreur: M.erreurs.suppression,
        },
        { surConfirmation: C.handler_confirmerSuppression, surRetour: C.handler_annulerSuppression }
      )
    );
  }

  return pageFragment;
};

export function AdminCategoriesPage() {
  return C.init();
}
