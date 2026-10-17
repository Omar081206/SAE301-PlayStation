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
 */

// Adresse de la connexion, avec le retour vers cette page une fois connecté.
const CONNEXION = "/connexion?retour=/commande";

let M = {
  panier: null, // détail du panier renvoyé par l'API : { lignes, total, nombre, ajustements }
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
 * Demande au serveur le détail du panier enregistré.
 */
C.charger = async function () {
  try {
    M.panier = await PanierData.fetchDetail(PanierData.lire());
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
    M.panier = null;
    M.avertissements = [];
    M.message = { type: "erreur", texte: `Impossible de charger votre panier : ${erreur.message}` };
  }
};

C.handler_confirmer = async function () {
  if (M.envoiEnCours) {
    return;
  }

  M.envoiEnCours = true;
  V.rafraichir();

  try {
    let reponse = await CommandeData.save(PanierData.lire());
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
        { panier: M.panier, envoiEnCours: M.envoiEnCours },
        { surConfirmation: C.handler_confirmer }
      )
    );
  }

  return pageFragment;
};

export function CommandePage() {
  return C.init();
}
