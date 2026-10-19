import { AdminCommandeData } from "../../data/admin-commande.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { BadgeStatutView } from "../../ui/badge-statut/index.js";
import { ConfirmationAnnulationView } from "../../ui/confirmation-annulation/index.js";
import { DetailCommandeAdminView } from "../../ui/detail-commande-admin/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Détail de la commande » du back-office : articles, total, client,
 * journal des changements de statut, et un bouton par statut permis.
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * décide de l'accès et des statuts permis. Sans session d'administration
 * (403), elle renvoie à /admin, qui affiche la connexion. Une annulation
 * passe toujours par une fenêtre de confirmation.
 */

let M = {
  numero: null, // numéro de la commande affichée (paramètre d'URL)
  commande: null, // détail renvoyé par le serveur, ou null
  annulation: null, // { numeros, articles, erreur } pendant la confirmation
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande le détail de la commande. Renvoie faux sans session
 * d'administration (403).
 */
C.charger = async function () {
  try {
    M.commande = (await AdminCommandeData.fetchOne(M.numero)).commande;
  } catch (erreur) {
    M.commande = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: erreur.message };
  }

  return true;
};

/**
 * Envoie le changement de statut, puis recharge le détail (statut, journal,
 * boutons).
 */
C.executer = async function (statut) {
  try {
    await AdminCommandeData.changerStatut(M.numero, statut);
    M.message = { type: "succes", texte: `Commande passée à « ${BadgeStatutView.libelle(statut)} ».` };
    M.annulation = null;
  } catch (erreur) {
    // Refus pendant la confirmation : il s'affiche dans la fenêtre.
    if (M.annulation !== null) {
      M.annulation.erreur = erreur.message;
    } else {
      M.message = { type: "erreur", texte: erreur.message };
    }
  }

  await C.charger();
  V.rafraichir();
};

C.handler_statut = async function (statut) {
  // Une annulation rend le stock : elle attend une confirmation.
  if (statut === "annulee") {
    let articles = M.commande.lignes.reduce((somme, ligne) => somme + ligne.quantite, 0);
    M.annulation = { numeros: [M.numero], articles, erreur: null };
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
  M.annulation = null;
  V.rafraichir();
};

C.init = async function (numero) {
  M.numero = numero;
  M.annulation = null;
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
// du modèle. La fenêtre de confirmation, reconstruite avec la page, est
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

  let slotDetail = pageFragment.querySelector('slot[name="detail"]');
  let slotModale = pageFragment.querySelector('slot[name="modale"]');

  if (M.commande === null) {
    slotDetail.remove();
  } else {
    slotDetail.replaceWith(DetailCommandeAdminView.dom(M.commande, { surStatut: C.handler_statut }));
  }

  if (M.annulation === null) {
    slotModale.remove();
  } else {
    slotModale.replaceWith(
      ConfirmationAnnulationView.dom(M.annulation, {
        surConfirmation: C.handler_confirmerAnnulation,
        surRetour: C.handler_retour,
      })
    );
  }

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { numero } pour /admin/commandes/:numero.
export function AdminCommandePage(params) {
  return C.init(params.numero);
}
