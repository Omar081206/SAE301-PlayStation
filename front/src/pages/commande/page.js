import { AuthData } from "../../data/auth.js";
import { CommandeData } from "../../data/commande.js";
import { PanierData } from "../../data/panier.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { LignesPanierView } from "../../ui/lignes-panier/index.js";
import { MessageView } from "../../ui/message/index.js";
import { RecapitulatifCommandeView } from "../../ui/recapitulatif-commande/index.js";
import template from "./template.html?raw";

/**
 * Page « Commande » : récapitulatif du panier avant validation.
 *
 * Réservée au client connecté : sinon, redirection vers la connexion, qui
 * ramène ici ensuite. La validation est enregistrée par le serveur, qui relit
 * les prix ; le panier est alors vidé et la confirmation affichée.
 *
 * Un code promo peut être appliqué : le serveur le vérifie et calcule la
 * remise, à l'affichage puis à nouveau à la validation. Le code n'est gardé
 * que le temps de la page (rien dans le stockage du navigateur).
 */

// Adresse de la connexion, avec le retour vers cette page une fois connecté.
const CONNEXION = "/connexion?retour=/commande";

let M = {
  panier: null, // détail du panier renvoyé par l'API : { lignes, sousTotal, remise, codePromo, total, nombre, ajustements }
  code: null, // code promo accepté par le serveur, ou null
  saisieCode: "", // dernier code saisi, pour le garder dans le champ
  erreurCode: null, // refus du code par le serveur, affiché sous le champ
  envoiEnCours: false, // vrai entre le clic sur « Confirmer » et la réponse
  message: null, // { type, texte }, ou null
  avertissements: [], // un message par quantité ajustée au stock
};

let C = {};

/**
 * Message d'un ajustement fait par le serveur pour respecter le stock.
 */
C.texteAjustement = function (ajustement) {
  if (ajustement.accordee === 0) {
    return `« ${ajustement.nom} » n’est plus disponible : il a été retiré de votre panier.`;
  }

  return `La quantité de « ${ajustement.nom} » a été ramenée à ${ajustement.accordee} : c’est le stock disponible actuellement.`;
};

/**
 * Demande au serveur le détail du panier enregistré, avec le code promo
 * accepté s'il y en a un.
 */
C.charger = async function () {
  try {
    M.panier = await PanierData.fetchDetail(PanierData.lire(), M.code);
    M.avertissements = M.panier.ajustements.map((ajustement) => ({
      type: "avertissement",
      texte: C.texteAjustement(ajustement),
    }));

    // Le stock a baissé : le récapitulatif et le panier enregistré prennent
    // les quantités accordées par le serveur.
    if (M.panier.ajustements.length > 0) {
      PanierData.aligner(M.panier);
    }
  } catch (erreur) {
    // 422 avec un code : il a été supprimé entre-temps. On le retire, on
    // l'explique sous le champ, et on recharge sans lui.
    if (erreur.statut === 422 && M.code !== null) {
      M.saisieCode = M.code;
      M.code = null;
      M.erreurCode = erreur.message;
      return C.charger();
    }

    M.panier = null;
    M.avertissements = [];
    M.message = { type: "erreur", texte: `Impossible de charger votre panier : ${erreur.message}` };
  }
};

C.handler_appliquer = async function (code) {
  M.saisieCode = code;

  if (code === "") {
    M.erreurCode = "Saisissez un code promo.";
    V.rafraichir();
    return;
  }

  try {
    M.panier = await PanierData.fetchDetail(PanierData.lire(), code);
    M.code = code;
    M.erreurCode = null;
  } catch (erreur) {
    // 422 : code inconnu ; le récapitulatif reste celui sans code.
    M.erreurCode = erreur.message;
  }

  V.rafraichir();
};

C.handler_retirer = async function () {
  M.code = null;
  M.saisieCode = "";
  M.erreurCode = null;
  await C.charger();
  V.rafraichir();
};

C.handler_confirmer = async function () {
  if (M.envoiEnCours) {
    return;
  }

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    let reponse = await CommandeData.save(PanierData.lire(), M.code);
    M.envoiEnCours = false;
    PanierData.enregistrer([]);
    naviguer(`/commande/${reponse.commande.numero}`);
  } catch (erreur) {
    M.envoiEnCours = false;

    // Session expirée entre l'affichage et le clic : retour à la connexion.
    if (erreur.statut === 403) {
      naviguer(CONNEXION);
      return;
    }

    // Code promo supprimé depuis son application : rien n'est enregistré. Le
    // récapitulatif est rechargé sans le code, et le refus s'affiche sous le
    // champ.
    if (erreur.statut === 422 && M.code !== null) {
      M.saisieCode = M.code;
      M.code = null;
      M.erreurCode = erreur.message;
      await C.charger();
      V.rafraichir();
      return;
    }

    // Stock insuffisant au moment de valider : rien n'est enregistré. Le
    // récapitulatif est rechargé, ajusté, et le client confirme à nouveau.
    if (erreur.statut === 409) {
      await C.charger();
      M.message = { type: "erreur", texte: erreur.message };
      V.rafraichir();
      return;
    }

    M.message = { type: "erreur", texte: `La commande n'a pas pu être enregistrée : ${erreur.message}` };
    V.rafraichir();
  }
};

C.init = async function () {
  M.message = null;
  M.envoiEnCours = false;
  M.code = null;
  M.saisieCode = "";
  M.erreurCode = null;

  // Le serveur dit si quelqu'un est connecté. S'il ne répond pas, on affiche
  // la page : l'erreur apparaîtra au chargement du panier.
  let session = null;
  try {
    session = await AuthData.fetchSession();
  } catch (erreur) {
    session = null;
  }

  if (session !== null && !session.connecte) {
    naviguer(CONNEXION);
    // Le routeur affichera la page de connexion : ce contenu ne sera pas montré.
    return "";
  }

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
// du modèle (ici, pour désactiver le bouton pendant l'envoi).
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment
    .querySelector('slot[name="message"]')
    .replaceWith(MessageView.dom(M.message), ...M.avertissements.map((avertissement) => MessageView.dom(avertissement)));

  let slotRecapitulatif = pageFragment.querySelector('slot[name="recapitulatif"]');
  if (M.panier === null) {
    slotRecapitulatif.remove();
  } else if (M.panier.lignes.length === 0) {
    // Rien à commander : même message que la page Panier vide.
    slotRecapitulatif.replaceWith(LignesPanierView.dom([], {}));
  } else {
    slotRecapitulatif.replaceWith(
      RecapitulatifCommandeView.dom(
        { panier: M.panier, saisieCode: M.saisieCode, erreurCode: M.erreurCode, envoiEnCours: M.envoiEnCours },
        { surConfirmation: C.handler_confirmer, surApplication: C.handler_appliquer, surRetrait: C.handler_retirer }
      )
    );
  }

  return pageFragment;
};

export function CommandePage() {
  return C.init();
}
