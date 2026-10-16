// Gabarit de page dynamique. Copier vers front/src/pages/<nom>/page.js,
// puis remplacer « Exemple » / « exemple » par le nom de la page.
import { ExempleData } from "../../data/exemple.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ListeExempleView } from "../../ui/liste-exemple/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Exemple ».
 * Le serveur décide de tout (droits, validité) : la page affiche sa réponse.
 */

let M = {
  exemple: null, // dernière réponse de l'API, ou null
  message: null, // { type: "erreur" | "succes", texte }, ou null
};

let C = {};

/**
 * Demande les données au serveur et les range dans le modèle.
 */
C.charger = async function (slug) {
  try {
    M.exemple = await ExempleData.fetchOne(slug);
    M.message = null;
  } catch (erreur) {
    M.exemple = null;
    let texte = erreur.message;
    if (erreur.statut === 401) texte = "Vous n'êtes pas connecté.";
    M.message = { type: "erreur", texte };
  }
};

C.handler_choisir = async function (id) {
  // 1. modifier M (ou appeler Data), 2. redessiner.
  M.message = { type: "succes", texte: `Choix ${id} enregistré.` };
  V.rafraichir();
};

C.init = async function (slug) {
  M.message = null;
  await C.charger(slug);
  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotListe = pageFragment.querySelector('slot[name="liste"]');
  if (M.exemple === null) {
    slotListe.remove();
  } else {
    slotListe.replaceWith(ListeExempleView.dom(M.exemple, { surChoix: C.handler_choisir }));
  }

  return pageFragment;
};

// params : paramètres d'URL de la route, par exemple { slug } pour /produit/:slug.
export function ExemplePage(params) {
  return C.init(params.slug);
}
