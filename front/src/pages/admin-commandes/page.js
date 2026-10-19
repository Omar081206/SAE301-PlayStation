import { AdminCommandeData } from "../../data/admin-commande.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ActionsLotView } from "../../ui/actions-lot/index.js";
import { BadgeStatutView } from "../../ui/badge-statut/index.js";
import { ConfirmationAnnulationView } from "../../ui/confirmation-annulation/index.js";
import { ListeCommandesAdminView } from "../../ui/liste-commandes-admin/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Commandes » du back-office : toutes les commandes, triées par
 * numéro, date, statut ou montant ; changement de statut d'une commande
 * (boutons de ligne) ou des commandes cochées (actions en lot). Le détail
 * de chaque commande est sur /admin/commandes/:numero.
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * décide de l'accès et des statuts permis. Sans session d'administration
 * (403), elle renvoie à /admin, qui affiche la connexion. Une annulation
 * passe toujours par une fenêtre de confirmation.
 */

// Sens appliqué quand on choisit une nouvelle colonne de tri : les plus
// récentes et les plus chères d'abord, les statuts dans l'ordre du retrait.
const SENS_PAR_DEFAUT = { numero: "desc", date: "desc", montant: "desc", statut: "asc" };

let M = {
  commandes: null, // liste renvoyée par le serveur, ou null
  tri: "date", // colonne de tri : "numero", "date", "statut" ou "montant"
  sens: "desc", // "asc" ou "desc"
  selection: [], // numéros des commandes cochées
  annulation: null, // { numeros, articles, erreur } pendant la confirmation
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande les commandes, dans l'ordre choisi. Renvoie faux sans session
 * d'administration (403).
 */
C.charger = async function () {
  try {
    M.commandes = (await AdminCommandeData.fetchAll(M.tri, M.sens)).commandes;
  } catch (erreur) {
    M.commandes = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger les commandes : ${erreur.message}` };
  }

  return true;
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
 * Change le statut de commandes : une seule (bouton de ligne), ou plusieurs
 * (lot). Puis recharge la liste.
 */
C.executer = async function (numeros, statut) {
  try {
    if (numeros.length === 1) {
      await AdminCommandeData.changerStatut(numeros[0], statut);
      M.message = { type: "succes", texte: `Commande ${numeros[0]} passée à « ${BadgeStatutView.libelle(statut)} ».` };
    } else {
      M.message = C.compteRendu(await AdminCommandeData.changerStatutLot(numeros, statut));
    }
    M.selection = M.selection.filter((numero) => !numeros.includes(numero));
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

/**
 * Change le statut demandé, ou, pour une annulation, ouvre d'abord la
 * fenêtre de confirmation.
 */
C.demander = async function (numeros, statut) {
  if (statut !== "annulee") {
    await C.executer(numeros, statut);
    return;
  }

  let commande = M.commandes.find((element) => element.numero === numeros[0]);
  M.annulation = { numeros, articles: commande.articles, erreur: null };
  M.message = null;
  V.rafraichir();
};

C.handler_tri = async function (tri, sens) {
  M.sens = sens ?? (tri === M.tri ? (M.sens === "asc" ? "desc" : "asc") : SENS_PAR_DEFAUT[tri]);
  M.tri = tri;
  await C.charger();
  V.rafraichir();
};

C.handler_selection = async function (numeros, coche) {
  let autres = M.selection.filter((numero) => !numeros.includes(numero));
  M.selection = coche ? [...autres, ...numeros] : autres;
  V.rafraichir();
};

C.handler_statut = async function (numero, statut) {
  await C.demander([numero], statut);
};

C.handler_lot = async function (statut) {
  await C.demander(M.selection, statut);
};

C.handler_confirmerAnnulation = async function () {
  await C.executer(M.annulation.numeros, "annulee");
};

C.handler_retour = async function () {
  M.annulation = null;
  V.rafraichir();
};

C.init = async function () {
  M.selection = [];
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
// du modèle. La sélection survit parce qu'elle est dans le modèle. La
// fenêtre de confirmation, reconstruite avec la page, est rouverte.
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

  let slotListe = pageFragment.querySelector('slot[name="liste"]');
  let slotModale = pageFragment.querySelector('slot[name="modale"]');

  if (M.commandes === null) {
    slotModale.remove();
    slotListe.remove();
    return pageFragment;
  }

  slotListe.replaceWith(
    ListeCommandesAdminView.dom(
      {
        commandes: M.commandes,
        tri: M.tri,
        sens: M.sens,
        selection: M.selection,
        lot: ActionsLotView.dom(M.selection.length, { surAction: C.handler_lot }),
      },
      { surTri: C.handler_tri, surSelection: C.handler_selection, surStatut: C.handler_statut }
    )
  );

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

export function AdminCommandesPage() {
  return C.init();
}
