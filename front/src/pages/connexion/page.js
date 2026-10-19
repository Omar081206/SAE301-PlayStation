import { AuthData } from "../../data/auth.js";
import { naviguer, parametre } from "../../lib/navigation.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { CompteConnecteView } from "../../ui/compte-connecte/index.js";
import { FormulaireIdentificationView } from "../../ui/formulaire-identification/index.js";
import { MessageView } from "../../ui/message/index.js";
import { OngletsIdentificationView } from "../../ui/onglets-identification/index.js";
import template from "./template.html?raw";

/**
 * Page « Connexion » : se connecter ou créer un compte, puis, une fois
 * connecté, se déconnecter.
 *
 * Comme la page Administration, elle ne protège rien : c'est le serveur qui
 * accepte ou refuse, et la page affiche sa réponse.
 *
 * Une page réservée y envoie avec ?retour=/chemin : une fois connecté,
 * l'utilisateur y est ramené.
 */

let M = {
  session: null, // { connecte, email, prenom, nom, role } : dernier état renvoyé par le serveur
  onglet: "connexion", // carte affichée en dessous de lg : "connexion" ou "inscription"
  // Dernière saisie de chaque formulaire, pour les pré-remplir.
  saisies: { connexion: { prenom: "", nom: "", email: "" }, inscription: { prenom: "", nom: "", email: "" } },
  erreurs: { connexion: null, inscription: null }, // message de chaque formulaire
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Après une connexion réussie : retour à la page demandée, ou, sans demande,
 * à l'espace personnel. Seul un chemin interne (« /… », pas « //autre-site »)
 * est suivi. Renvoie vrai (la page change).
 */
C.retourner = function () {
  let retour = parametre("retour");

  if (retour === null || !retour.startsWith("/") || retour.startsWith("//")) {
    retour = "/compte";
  }

  naviguer(retour);
  return true;
};

/**
 * Demande au serveur qui est connecté.
 */
C.charger = async function () {
  try {
    M.session = await AuthData.fetchSession();
  } catch (erreur) {
    M.session = null;
    M.message = { type: "erreur", texte: `Impossible de joindre le serveur : ${erreur.message}` };
  }
};

C.handler_connexion = async function (saisie) {
  M.saisies.connexion.email = saisie.email;

  try {
    M.session = await AuthData.login(saisie.email, saisie.mdp);
    M.erreurs = { connexion: null, inscription: null };
    M.message = { type: "succes", texte: "Vous êtes connecté." };
    if (C.retourner()) return;
  } catch (erreur) {
    M.erreurs.connexion = erreur.message;
  }

  V.rafraichir();
};

C.handler_inscription = async function (saisie) {
  M.saisies.inscription = { prenom: saisie.prenom, nom: saisie.nom, email: saisie.email };

  try {
    M.session = await AuthData.inscription(saisie.prenom, saisie.nom, saisie.email, saisie.mdp);
    M.erreurs = { connexion: null, inscription: null };
    M.message = { type: "succes", texte: "Votre compte est créé : vous êtes connecté." };
    if (C.retourner()) return;
  } catch (erreur) {
    M.erreurs.inscription = erreur.message;
  }

  V.rafraichir();
};

C.handler_deconnexion = async function () {
  try {
    M.session = await AuthData.logout();
    M.message = { type: "succes", texte: "Vous êtes déconnecté." };
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
  }

  V.rafraichir();
};

C.handler_changerOnglet = async function (onglet) {
  M.onglet = onglet;
  V.rafraichir();
};

C.init = async function () {
  M.message = null;
  M.erreurs = { connexion: null, inscription: null };
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
// du modèle. La saisie survit parce qu'elle est dans le modèle.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let connecte = M.session !== null && M.session.connecte;

  // Le titre change une fois connecté : il est rendu avec le template.
  let pageFragment = htmlToFragment(
    genericRenderer(template, {
      titre: connecte ? "Mon compte" : "Identifiez-vous",
      suite: connecte ? "" : " pour valider votre commande",
    })
  );

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slots = {};
  for (let nom of ["onglets", "connexion", "inscription", "compte"]) {
    slots[nom] = pageFragment.querySelector(`slot[name="${nom}"]`);
  }

  if (connecte) {
    slots.onglets.remove();
    slots.connexion.remove();
    slots.inscription.remove();
    slots.compte.replaceWith(CompteConnecteView.dom(M.session, { surDeconnexion: C.handler_deconnexion }));
    return pageFragment;
  }

  slots.compte.remove();
  slots.onglets.replaceWith(OngletsIdentificationView.dom(M.onglet, { surOnglet: C.handler_changerOnglet }));

  for (let mode of ["connexion", "inscription"]) {
    slots[mode].replaceWith(
      FormulaireIdentificationView.dom(
        {
          mode,
          saisie: M.saisies[mode],
          erreur: M.erreurs[mode],
          masqueEnMobile: M.onglet !== mode,
        },
        { surEnvoi: mode === "connexion" ? C.handler_connexion : C.handler_inscription }
      )
    );
  }

  return pageFragment;
};

export function ConnexionPage() {
  return C.init();
}
