import { AdminCommandeData } from "../../data/admin-commande.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ActionsLotView } from "../../ui/actions-lot/index.js";
import { BadgeStatutView } from "../../ui/badge-statut/index.js";
import { ConfirmationAnnulationView } from "../../ui/confirmation-annulation/index.js";
import { ListeCommandesAdminView } from "../../ui/liste-commandes-admin/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";
import templateAccesRefuse from "./acces-refuse.html?raw";

/**
 * Page « Commandes » du back-office : toutes les commandes, triées par date,
 * statut ou montant, et les changements de statut en lot sur les commandes
 * cochées. Le détail de chaque commande est sur /admin/commandes/:numero.
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * décide de l'accès (403) et des statuts permis. Une annulation passe
 * toujours par une confirmation.
 */

// Sens appliqué quand on choisit une nouvelle colonne de tri : les plus
// récentes et les plus chères d'abord, les statuts dans l'ordre du retrait.
const SENS_PAR_DEFAUT = { date: "desc", montant: "desc", statut: "asc" };

let M = {
  commandes: null, // liste renvoyée par le serveur, ou null s'il l'a refusée
  acces: true, // faux si le serveur a répondu 403
  tri: "date", // colonne de tri : "date", "statut" ou "montant"
  sens: "desc", // "asc" ou "desc"
  selection: [], // numéros des commandes cochées
  confirmation: false, // vrai pendant la demande de confirmation d'annulation
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande les commandes, dans l'ordre choisi. Le résultat dépend de ce que
 * décide le serveur.
 */
C.charger = async function () {
  try {
    M.commandes = (await AdminCommandeData.fetchAll(M.tri, M.sens)).commandes;
    M.acces = true;
  } catch (erreur) {
    M.commandes = null;
    M.acces = erreur.statut !== 403;

    if (M.acces) {
      M.message = { type: "erreur", texte: `Impossible de charger les commandes : ${erreur.message}` };
    }
  }
};

/**
 * Résume la réponse d'un changement en lot : combien ont changé, lesquelles
 * ont été refusées et pourquoi.
 */
C.compteRendu = function (reponse) {
  let libelle = BadgeStatutView.libelle(reponse.statut);
  let refusees = reponse.resultats.filter((resultat) => !resultat.change);
  let texte =
    reponse.changees > 1
      ? `${reponse.changees} commandes passées à « ${libelle} ».`
      : `${reponse.changees} commande passée à « ${libelle} ».`;

  if (refusees.length > 0) {
    let details = refusees.map((resultat) => `${resultat.numero} (${resultat.erreur})`).join(", ");
    texte += ` Non modifiée(s) : ${details}`;
  }

  return { type: refusees.length === 0 ? "succes" : "erreur", texte };
};

/**
 * Envoie le changement de statut des commandes cochées, puis recharge la
 * liste.
 */
C.executer = async function (statut) {
  try {
    M.message = C.compteRendu(await AdminCommandeData.changerStatutLot(M.selection, statut));
    M.selection = [];
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
  }

  M.confirmation = false;
  await C.charger();
  V.rafraichir();
};

C.handler_tri = async function (tri) {
  M.sens = tri === M.tri ? (M.sens === "asc" ? "desc" : "asc") : SENS_PAR_DEFAUT[tri];
  M.tri = tri;
  await C.charger();
  V.rafraichir();
};

C.handler_selection = async function (numeros, coche) {
  let autres = M.selection.filter((numero) => !numeros.includes(numero));
  M.selection = coche ? [...autres, ...numeros] : autres;
  M.confirmation = false;
  V.rafraichir();
};

C.handler_action = async function (statut) {
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

C.init = async function () {
  M.selection = [];
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
// du modèle. La sélection survit parce qu'elle est dans le modèle. Le focus
// va à la demande de confirmation quand elle s'ouvre, pour qu'un lecteur
// d'écran l'annonce.
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

  let slots = {};
  for (let nom of ["confirmation", "actions", "liste"]) {
    slots[nom] = pageFragment.querySelector(`slot[name="${nom}"]`);
  }

  if (M.commandes === null) {
    slots.confirmation.remove();
    slots.actions.remove();
    slots.liste.replaceWith(M.acces ? "" : htmlToFragment(templateAccesRefuse));
    return pageFragment;
  }

  if (M.confirmation) {
    slots.confirmation.replaceWith(
      ConfirmationAnnulationView.dom(M.selection, {
        surConfirmation: C.handler_confirmerAnnulation,
        surRetour: C.handler_retour,
      })
    );
  } else {
    slots.confirmation.remove();
  }

  slots.actions.replaceWith(ActionsLotView.dom(M.selection.length, { surAction: C.handler_action }));
  slots.liste.replaceWith(
    ListeCommandesAdminView.dom(
      { commandes: M.commandes, tri: M.tri, sens: M.sens, selection: M.selection },
      { surTri: C.handler_tri, surSelection: C.handler_selection }
    )
  );

  return pageFragment;
};

export function AdminCommandesPage() {
  return C.init();
}
