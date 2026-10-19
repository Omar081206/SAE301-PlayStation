import { AuthData } from "../../data/auth.js";
import { CompteData } from "../../data/compte.js";
import { naviguer } from "../../lib/navigation.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { FormulaireProfilView } from "../../ui/formulaire-profil/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationCompteView } from "../../ui/navigation-compte/index.js";
import template from "./template.html?raw";

/**
 * Page « Mon profil » : modifier prénom, nom, adresse e-mail et mot de passe.
 *
 * Elle ne protège rien : le serveur refuse (403) si personne n'est connecté,
 * et la page envoie alors à la connexion. Le serveur exige aussi le mot de
 * passe actuel pour changer d'adresse ou de mot de passe : son refus
 * s'affiche en bandeau et sous le champ concerné.
 */

// Adresse de la connexion, avec le retour vers cette page une fois connecté.
const CONNEXION = "/connexion?retour=/compte/profil";

let M = {
  profil: null, // { prenom, nom, email } : valeurs affichées dans le formulaire
  erreurMdp: null, // erreur sur le mot de passe actuel, affichée sous le champ
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande le profil. Renvoie faux si personne n'est connecté (403).
 */
C.charger = async function () {
  try {
    M.profil = (await CompteData.fetch()).profil;
  } catch (erreur) {
    M.profil = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger votre profil : ${erreur.message}` };
  }

  return true;
};

C.handler_enregistrer = async function (saisie) {
  // La saisie est gardée : en cas de refus, le formulaire la réaffiche.
  M.profil = { prenom: saisie.prenom, nom: saisie.nom, email: saisie.email };
  M.erreurMdp = null;

  try {
    M.profil = (await CompteData.modifierProfil(saisie)).profil;
    M.message = { type: "succes", texte: "Vos modifications sont enregistrées." };
  } catch (erreur) {
    if (erreur.statut === 403) {
      naviguer(CONNEXION);
      return;
    }
    M.message = { type: "erreur", texte: erreur.message };
    // Les refus qui portent sur le mot de passe actuel s'affichent aussi
    // sous ce champ.
    if (erreur.message.includes("mot de passe actuel")) {
      M.erreurMdp = erreur.message;
    }
  }

  V.rafraichir();
};

C.handler_deconnexion = async function () {
  try {
    await AuthData.logout();
    naviguer("/");
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
    V.rafraichir();
  }
};

C.init = async function () {
  M.message = null;
  M.erreurMdp = null;

  if (!(await C.charger())) {
    naviguer(CONNEXION);
    // Le routeur affichera la page de connexion : ce contenu ne sera pas montré.
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
// du modèle. La saisie survit parce qu'elle est dans le modèle (sauf les mots
// de passe, jamais conservés). Le message est annoncé à l'écran en haut de
// page : on y ramène la vue.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
  V.racine.scrollIntoView({ block: "start" });
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(genericRenderer(template, { titre: "Mon profil" }));

  pageFragment
    .querySelector('slot[name="navigation"]')
    .replaceWith(NavigationCompteView.dom("profil", { surDeconnexion: C.handler_deconnexion }));
  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotContenu = pageFragment.querySelector('slot[name="contenu"]');

  if (M.profil === null) {
    slotContenu.remove();
  } else {
    slotContenu.replaceWith(
      FormulaireProfilView.dom({ profil: M.profil, erreurMdp: M.erreurMdp }, { surEnvoi: C.handler_enregistrer })
    );
  }

  return pageFragment;
};

export function ProfilPage() {
  return C.init();
}
