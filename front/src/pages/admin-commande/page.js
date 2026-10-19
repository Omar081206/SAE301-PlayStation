import { AdminCommandeData } from "../../data/admin-commande.js";
import { htmlToFragment } from "../../lib/utils.js";
import { BadgeStatutView } from "../../ui/badge-statut/index.js";
import { ConfirmationAnnulationView } from "../../ui/confirmation-annulation/index.js";
import { DetailCommandeAdminView } from "../../ui/detail-commande-admin/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";
import templateAccesRefuse from "./acces-refuse.html?raw";

/**
 * Page « Détail de la commande » du back-office : client, lignes, total,
 * historique des changements de statut, et un bouton par statut permis.
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * décide de l'accès (403) et des statuts permis. Une annulation passe
 * toujours par une confirmation.
 */

let M = {
  numero: null, // numéro de la commande affichée (paramètre d'URL)
  commande: null, // détail renvoyé par le serveur, ou null
  acces: true, // faux si le serveur a répondu 403
  confirmation: false, // vrai pendant la demande de confirmation d'annulation
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande le détail de la commande. Le résultat dépend de ce que décide le
 * serveur.
 */
C.charger = async function () {
  try {
    M.commande = (await AdminCommandeData.fetchOne(M.numero)).commande;
    M.acces = true;
  } catch (erreur) {
    M.commande = null;
    M.acces = erreur.statut !== 403;

    if (M.acces) {
      M.message = { type: "erreur", texte: erreur.message };
    }
  }
};

/**
 * Envoie le changement de statut, puis recharge le détail (statut,
 * historique, boutons).
 */
C.executer = async function (statut) {
  try {
    await AdminCommandeData.changerStatut(M.numero, statut);
    M.message = { type: "succes", texte: `Commande passée à « ${BadgeStatutView.libelle(statut)} ».` };
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
  }

  M.confirmation = false;
  await C.charger();
  V.rafraichir();
};

C.handler_statut = async function (statut) {
  // Une annulation rend le stock : elle attend une confirmation.
  if (statut === "annulee") {
    M.confirmation = true;
    M.message = null;
    V.rafraichir();
    return;
  }

  await C.executer(statut);
};

C.handler_confirmerAnnulation = async function () {
  await C.executer("annulee");
};

C.handler_retour = async function () {
  M.confirmation = false;
  V.rafraichir();
};

C.init = async function (numero) {
  M.numero = numero;
  M.confirmation = false;
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
// du modèle. Le focus va à la demande de confirmation quand elle s'ouvre.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  if (M.confirmation) {
    V.racine.querySelector("[data-focus]").focus();
  }
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  let slotDetail = pageFragment.querySelector('slot[name="detail"]');

  if (M.commande === null) {
    slotConfirmation.remove();
    slotDetail.replaceWith(M.acces ? "" : htmlToFragment(templateAccesRefuse));
    return pageFragment;
  }

  if (M.confirmation) {
    slotConfirmation.replaceWith(
      ConfirmationAnnulationView.dom([M.numero], {
        surConfirmation: C.handler_confirmerAnnulation,
        surRetour: C.handler_retour,
      })
    );
  } else {
    slotConfirmation.remove();
  }

  slotDetail.replaceWith(DetailCommandeAdminView.dom(M.commande, { surStatut: C.handler_statut }));

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { numero } pour /admin/commandes/:numero.
export function AdminCommandePage(params) {
  return C.init(params.numero);
}
