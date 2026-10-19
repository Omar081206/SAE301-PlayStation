import { AdminCategorieData } from "../../data/admin-categorie.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ConfirmationSuppressionView } from "../../ui/confirmation-suppression/index.js";
import { FormulaireCategorieView } from "../../ui/formulaire-categorie/index.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauCategoriesView } from "../../ui/tableau-categories/index.js";
import template from "./template.html?raw";
import templateAccesRefuse from "./acces-refuse.html?raw";

/**
 * Page « Catégories » du back-office : créer, modifier et supprimer les
 * catégories du catalogue.
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * décide de l'accès (403 sans session d'administration) et qui valide chaque
 * saisie. Une suppression passe toujours par une confirmation, où l'on
 * choisit la catégorie qui recevra les produits.
 */

let M = {
  categories: null, // liste renvoyée par le serveur, ou null s'il l'a refusée
  acces: true, // faux si le serveur a répondu 403
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
 * Demande les catégories. Le résultat dépend de ce que décide le serveur.
 */
C.charger = async function () {
  try {
    M.categories = (await AdminCategorieData.fetchAll()).categories;
    M.acces = true;
  } catch (erreur) {
    M.categories = null;
    M.acces = erreur.statut !== 403;

    if (M.acces) {
      M.message = { type: "erreur", texte: `Impossible de charger les catégories : ${erreur.message}` };
    }
  }
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
// du modèle. La saisie survit parce qu'elle est dans le modèle. Le focus va
// à l'encart qui vient de s'ouvrir (confirmation, modification), pour qu'un
// lecteur d'écran l'annonce.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  if (M.suppression !== null || M.edition !== null) {
    V.racine.querySelector("[data-focus]").focus();
  }
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slots = {};
  for (let nom of ["confirmation", "formulaire", "liste"]) {
    slots[nom] = pageFragment.querySelector(`slot[name="${nom}"]`);
  }

  if (M.categories === null) {
    slots.confirmation.remove();
    slots.formulaire.remove();
    slots.liste.replaceWith(M.acces ? "" : htmlToFragment(templateAccesRefuse));
    return pageFragment;
  }

  if (M.suppression === null) {
    slots.confirmation.remove();
  } else {
    slots.confirmation.replaceWith(
      ConfirmationSuppressionView.dom(
        {
          categorie: C.categorie(M.suppression),
          autres: M.categories.filter((categorie) => categorie.id !== M.suppression),
          erreur: M.erreurs.suppression,
        },
        { surConfirmation: C.handler_confirmerSuppression, surAnnulation: C.handler_annulerSuppression }
      )
    );
  }

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

  slots.liste.replaceWith(
    TableauCategoriesView.dom(M.categories, {
      surModification: C.handler_modifier,
      surSuppression: C.handler_supprimer,
    })
  );

  return pageFragment;
};

export function AdminCategoriesPage() {
  return C.init();
}
