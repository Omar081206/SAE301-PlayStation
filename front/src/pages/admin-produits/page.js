import { AdminProduitData } from "../../data/admin-produit.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ConfirmationProduitView } from "../../ui/confirmation-produit/index.js";
import { MessageView } from "../../ui/message/index.js";
import { ParametreStockView } from "../../ui/parametre-stock/index.js";
import { TableauProduitsAdminView } from "../../ui/tableau-produits-admin/index.js";
import template from "./template.html?raw";

/**
 * Page « Produits » du back-office : la liste des produits (modifier,
 * supprimer après confirmation) et le seuil « Bientôt épuisé ».
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * décide de l'accès. Sans session d'administration (403), elle renvoie à
 * /admin, qui affiche la connexion.
 */

let M = {
  produits: null, // liste renvoyée par le serveur, ou null
  seuil: 3, // seuil « Bientôt épuisé » actuel
  suppression: null, // { id, nom, erreur } pendant la confirmation
  messageSeuil: null, // résultat de l'enregistrement du seuil
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande les produits et le seuil. Renvoie faux sans session
 * d'administration (403).
 */
C.charger = async function () {
  try {
    let reponse = await AdminProduitData.fetchAll();
    M.produits = reponse.produits;
    M.seuil = reponse.seuil;
  } catch (erreur) {
    M.produits = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger les produits : ${erreur.message}` };
  }

  return true;
};

C.handler_supprimer = async function (id) {
  let produit = M.produits.find((element) => element.id === id);
  M.suppression = { id, nom: produit.nom, erreur: null };
  M.message = null;
  V.rafraichir();
};

C.handler_confirmerSuppression = async function () {
  try {
    await AdminProduitData.supprimer(M.suppression.id);
    M.message = { type: "succes", texte: `Le produit « ${M.suppression.nom} » est supprimé.` };
    M.suppression = null;
    await C.charger();
  } catch (erreur) {
    M.suppression.erreur = erreur.message;
  }

  V.rafraichir();
};

C.handler_retour = async function () {
  M.suppression = null;
  V.rafraichir();
};

C.handler_seuil = async function (seuil) {
  try {
    M.seuil = (await AdminProduitData.modifierSeuil(seuil)).seuil;
    M.messageSeuil = { type: "succes", texte: `Seuil enregistré : ${M.seuil} unité(s).` };
  } catch (erreur) {
    M.messageSeuil = { type: "erreur", texte: erreur.message };
  }

  V.rafraichir();
};

C.init = async function () {
  M.suppression = null;
  M.messageSeuil = null;
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
// du modèle. La fenêtre de suppression, reconstruite avec la page, est
// rouverte.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  V.racine.querySelector("dialog")?.showModal();
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slots = {};
  for (let nom of ["liste", "parametre", "modale"]) {
    slots[nom] = pageFragment.querySelector(`slot[name="${nom}"]`);
  }

  if (M.produits === null) {
    Object.values(slots).forEach((slot) => slot.remove());
    return pageFragment;
  }

  slots.liste.replaceWith(TableauProduitsAdminView.dom(M.produits, { surSuppression: C.handler_supprimer }));
  slots.parametre.replaceWith(
    ParametreStockView.dom({ seuil: M.seuil, message: M.messageSeuil }, { surSeuil: C.handler_seuil })
  );

  if (M.suppression === null) {
    slots.modale.remove();
  } else {
    slots.modale.replaceWith(
      ConfirmationProduitView.dom(M.suppression, {
        surConfirmation: C.handler_confirmerSuppression,
        surRetour: C.handler_retour,
      })
    );
  }

  return pageFragment;
};

export function AdminProduitsPage() {
  return C.init();
}
