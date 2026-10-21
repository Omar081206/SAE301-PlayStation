import { AdminCodePromoData } from "../../data/admin-code-promo.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ConfirmationCodePromoView } from "../../ui/confirmation-code-promo/index.js";
import { FormulaireCodePromoView } from "../../ui/formulaire-code-promo/index.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauCodesPromoView } from "../../ui/tableau-codes-promo/index.js";
import template from "./template.html?raw";

/**
 * Page « Codes promo » du back-office : créer, modifier et supprimer les
 * codes promotionnels, et voir combien de fois chacun a servi.
 *
 * Comme la page Catégories, elle ne protège rien : c'est le serveur qui
 * décide de l'accès et qui valide chaque saisie. Sans session
 * d'administration (403), elle renvoie à /admin, qui affiche la connexion.
 * Une suppression passe toujours par une fenêtre de confirmation.
 */

let M = {
  codes: null, // liste renvoyée par le serveur, ou null
  edition: null, // identifiant du code modifié, ou null (création)
  suppression: null, // identifiant du code à supprimer, ou null
  saisie: { code: "", pourcentage: "" }, // dernière saisie du formulaire
  erreurs: { formulaire: null, suppression: null }, // message de chaque encart
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Un code de la liste chargée, par son identifiant.
 */
C.code = function (id) {
  return M.codes.find((code) => code.id === id);
};

/**
 * Demande les codes promo. Renvoie faux sans session d'administration (403).
 */
C.charger = async function () {
  try {
    M.codes = (await AdminCodePromoData.fetchAll()).codes;
  } catch (erreur) {
    M.codes = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger les codes promo : ${erreur.message}` };
  }

  return true;
};

/**
 * Revient au formulaire de création, vide.
 */
C.reinitialiser = function () {
  M.edition = null;
  M.suppression = null;
  M.saisie = { code: "", pourcentage: "" };
  M.erreurs = { formulaire: null, suppression: null };
};

C.handler_enregistrer = async function (code, pourcentage) {
  M.saisie = { code, pourcentage };

  try {
    // Le serveur attend un nombre entier : une saisie vide ou décimale lui
    // parvient telle quelle, et c'est lui qui la refuse.
    let reponse =
      M.edition === null
        ? await AdminCodePromoData.creer(code, Number(pourcentage))
        : await AdminCodePromoData.modifier(M.edition, code, Number(pourcentage));
    let verbe = M.edition === null ? "créé" : "enregistré";
    M.message = { type: "succes", texte: `Le code « ${reponse.code.code} » est ${verbe}.` };
    C.reinitialiser();
    await C.charger();
  } catch (erreur) {
    M.erreurs.formulaire = erreur.message;
  }

  V.rafraichir();
};

C.handler_modifier = async function (id) {
  let code = C.code(id);

  C.reinitialiser();
  M.edition = id;
  M.saisie = { code: code.code, pourcentage: String(code.pourcentage) };
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

C.handler_confirmerSuppression = async function () {
  let code = C.code(M.suppression);

  try {
    await AdminCodePromoData.supprimer(M.suppression);
    M.message = { type: "succes", texte: `Le code « ${code.code} » est supprimé.` };
    C.reinitialiser();
    await C.charger();
  } catch (erreur) {
    M.erreurs.suppression = erreur.message;
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

  if (M.codes === null) {
    Object.values(slots).forEach((slot) => slot.remove());
    return pageFragment;
  }

  slots.liste.replaceWith(
    TableauCodesPromoView.dom(M.codes, {
      surModification: C.handler_modifier,
      surSuppression: C.handler_supprimer,
    })
  );

  slots.formulaire.replaceWith(
    FormulaireCodePromoView.dom(
      {
        mode: M.edition === null ? "creation" : "modification",
        code: M.saisie.code,
        pourcentage: M.saisie.pourcentage,
        erreur: M.erreurs.formulaire,
      },
      { surEnvoi: C.handler_enregistrer, surAnnulation: C.handler_annulerEdition }
    )
  );

  if (M.suppression === null) {
    slots.modale.remove();
  } else {
    slots.modale.replaceWith(
      ConfirmationCodePromoView.dom(
        { code: C.code(M.suppression).code, erreur: M.erreurs.suppression },
        { surConfirmation: C.handler_confirmerSuppression, surRetour: C.handler_annulerSuppression }
      )
    );
  }

  return pageFragment;
};

export function AdminCodesPromoPage() {
  return C.init();
}
