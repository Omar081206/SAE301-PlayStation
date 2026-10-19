import { AdminData } from "../../data/admin.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { FormulaireConnexionView } from "../../ui/formulaire-connexion/index.js";
import { IndicateursView } from "../../ui/indicateurs/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Administration » : accueil du back-office.
 *
 * La page ne protège rien : c'est le serveur qui décide de l'accès. Elle
 * demande les indicateurs ; avec une session d'administration, il les
 * renvoie (200), sinon il refuse (403) et la page affiche le formulaire de
 * connexion administrateur.
 */

let M = {
  email: "", // dernière adresse saisie, pour pré-remplir le formulaire
  tableau: null, // indicateurs, si le serveur les a fournis
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande les indicateurs. Le résultat dépend de ce que décide le serveur.
 */
C.chargerTableau = async function () {
  try {
    M.tableau = await AdminData.fetchTableauDeBord();
  } catch (erreur) {
    M.tableau = null;

    // 403 : pas de session d'administration, le formulaire suffit.
    if (erreur.statut !== 403) {
      M.message = { type: "erreur", texte: `Impossible de charger le tableau de bord : ${erreur.message}` };
    }
  }
};

C.handler_connexion = async function (email, mdp) {
  M.email = email;

  try {
    await AdminData.login(email, mdp);
    M.message = null;
    // La requête suivante transporte le cookie de session reçu à l'instant.
    await C.chargerTableau();
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
  }

  V.rafraichir();
};

C.init = async function () {
  M.message = null;
  await C.chargerTableau();
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
// du modèle. L'adresse saisie survit parce qu'elle est dans le modèle.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  // Le titre dépend de l'accès : il est rendu avec le template.
  let titre = M.tableau === null ? "Back-office" : "Tableau de bord";
  let pageFragment = htmlToFragment(genericRenderer(template, { titre }));

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotConnexion = pageFragment.querySelector('slot[name="connexion"]');
  let slotIndicateurs = pageFragment.querySelector('slot[name="indicateurs"]');

  if (M.tableau === null) {
    slotIndicateurs.remove();
    slotConnexion.replaceWith(
      FormulaireConnexionView.dom({ email: M.email }, { surConnexion: C.handler_connexion })
    );
  } else {
    slotConnexion.remove();
    slotIndicateurs.replaceWith(IndicateursView.dom(M.tableau));
  }

  return pageFragment;
};

export function AdminPage() {
  return C.init();
}
