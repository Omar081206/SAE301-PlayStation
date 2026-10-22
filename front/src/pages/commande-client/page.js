import { AuthData } from "../../data/auth.js";
import { CommandeData } from "../../data/commande.js";
import { PanierData } from "../../data/panier.js";
import { naviguer } from "../../lib/navigation.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { BadgeStatutView } from "../../ui/badge-statut/index.js";
import { DetailCommandeClientView } from "../../ui/detail-commande-client/index.js";
import { MessageView } from "../../ui/message/index.js";
import { NavigationCompteView } from "../../ui/navigation-compte/index.js";
import template from "./template.html?raw";

/**
 * Page « Détail d'une commande » de l'espace personnel : statut, articles
 * (avec leurs options) et total. « Commander à nouveau » remet ses articles
 * au panier, avec les mêmes options (la même variante) : le serveur vérifie
 * le stock et l'existence de chaque variante, et la page dit ce qui a été
 * ajouté et ce qui ne l'a pas été.
 *
 * Elle ne protège rien : le serveur ne renvoie la commande qu'à son
 * propriétaire (404 sinon, comme pour un numéro inconnu), et refuse (403) si
 * personne n'est connecté ; la page envoie alors à la connexion.
 */

let M = {
  numero: null, // numéro de la commande affichée (paramètre d'URL)
  commande: null, // détail renvoyé par le serveur, ou null
  messages: [], // [ { type, texte } ] : bandeaux affichés au-dessus du détail
};

let C = {};

/**
 * Demande le détail de la commande. Renvoie faux si personne n'est
 * connecté (403).
 */
C.charger = async function () {
  try {
    M.commande = (await CommandeData.fetchOne(M.numero)).commande;
  } catch (erreur) {
    M.commande = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.messages = [
      {
        type: "erreur",
        texte: erreur.statut === 404 ? "Cette commande est introuvable." : `Impossible de charger la commande : ${erreur.message}`,
      },
    ];
  }

  return true;
};

/**
 * Messages après « Commander à nouveau » : combien d'articles ont été
 * ajoutés, puis un avertissement par article qui ne l'a pas été (ou pas en
 * entier).
 *
 * @param ajoutes  Articles ajoutés au panier (différence de son contenu).
 * @param detail   Réponse du serveur (voir PanierData.fetchDetail), ou null
 *                 si aucun article n'a pu lui être demandé.
 */
C.compteRendu = function (ajoutes, detail) {
  let messages = [];

  if (ajoutes > 0) {
    messages.push({
      type: "succes",
      texte:
        ajoutes > 1
          ? `${ajoutes} articles ont été ajoutés à votre panier avec les options choisies à l’époque.`
          : "1 article a été ajouté à votre panier avec les options choisies à l’époque.",
    });
  }

  for (let ligne of M.commande.lignes) {
    // Les options distinguent deux lignes du même produit.
    let nom = ligne.options === null ? ligne.nom : `${ligne.nom} (${ligne.options})`;
    let ajustement = detail?.ajustements.find((element) => element.variantId === ligne.variantId);
    let present = detail?.lignes.some((element) => element.variantId === ligne.variantId);

    if (ligne.variantId === null || (!present && ajustement === undefined)) {
      // Variante supprimée depuis la commande : produit retiré de la vente.
      messages.push({ type: "avertissement", texte: `« ${nom} » n’est plus vendu : il n’a pas été ajouté à votre panier.` });
    } else if (ajustement !== undefined && ajustement.accordee === 0) {
      messages.push({ type: "avertissement", texte: `« ${nom} » est épuisé : il n’a pas été ajouté à votre panier.` });
    } else if (ajustement !== undefined) {
      messages.push({
        type: "avertissement",
        texte: `« ${nom} » : il n’en reste que ${ajustement.accordee}, la quantité de votre panier a été ajustée.`,
      });
    }
  }

  if (messages.length === 0) {
    messages.push({ type: "avertissement", texte: "Aucun article n’a pu être ajouté à votre panier." });
  }

  return messages;
};

C.handler_renouveler = async function () {
  let ajouts = M.commande.lignes
    .filter((ligne) => ligne.variantId !== null)
    .map((ligne) => ({ variantId: ligne.variantId, quantite: ligne.quantite }));
  let avant = PanierData.nombreArticles();

  try {
    let detail = ajouts.length === 0 ? null : await PanierData.ajouterLignes(ajouts);
    M.messages = C.compteRendu(Math.max(0, PanierData.nombreArticles() - avant), detail);
  } catch (erreur) {
    M.messages = [{ type: "erreur", texte: `Les articles n’ont pas pu être ajoutés au panier : ${erreur.message}` }];
  }

  V.rafraichir();
};

C.handler_deconnexion = async function () {
  try {
    await AuthData.logout();
    naviguer("/");
  } catch (erreur) {
    M.messages = [{ type: "erreur", texte: erreur.message }];
    V.rafraichir();
  }
};

C.init = async function (numero) {
  M.numero = numero;
  M.messages = [];

  if (!(await C.charger())) {
    naviguer(`/connexion?retour=/compte/commandes/${encodeURIComponent(numero)}`);
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
// du modèle.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(genericRenderer(template, { titre: `Commande ${M.numero}` }));

  pageFragment
    .querySelector('slot[name="navigation"]')
    .replaceWith(NavigationCompteView.dom("commandes", { surDeconnexion: C.handler_deconnexion }));
  pageFragment
    .querySelector('slot[name="message"]')
    .replaceWith(...M.messages.map((message) => MessageView.dom(message)));

  let slotContenu = pageFragment.querySelector('slot[name="contenu"]');

  let slotStatut = pageFragment.querySelector('slot[name="statut"]');

  if (M.commande === null) {
    slotContenu.remove();
    slotStatut.remove();
  } else {
    slotStatut.replaceWith(BadgeStatutView.dom(M.commande.statut));
    slotContenu.replaceWith(DetailCommandeClientView.dom(M.commande, { surRenouvellement: C.handler_renouveler }));
  }

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { numero } pour /compte/commandes/:numero.
export function CommandeClientPage(params) {
  return C.init(params.numero);
}
