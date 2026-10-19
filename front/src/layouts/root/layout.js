import { AuthData } from "../../data/auth.js";
import { PanierData } from "../../data/panier.js";
import { htmlToFragment } from "../../lib/utils.js";
import { FooterView } from "../../ui/footer/index.js";
import { HeaderView } from "../../ui/header/index.js";
import template from "./template.html?raw";

/**
 * Layout principal : l'en-tête, la page affichée, puis le pied de page.
 *
 * Les slots nommés « header » et « footer » sont remplacés ici. Le slot sans
 * nom est laissé au routeur, qui y place la page.
 *
 * @returns {DocumentFragment}
 */
export function RootLayout() {
  let layout = htmlToFragment(template);
  layout.querySelector('slot[name="header"]').replaceWith(HeaderView.dom(donneesHeader()));
  layout.querySelector('slot[name="footer"]').replaceWith(FooterView.dom());
  return layout;
}

/**
 * Ce qu'affiche le header : le nombre d'articles du panier et l'état de
 * connexion connu (voir data/auth.js).
 */
function donneesHeader() {
  return {
    nombre: PanierData.nombreArticles(),
    connecte: AuthData.session.connecte,
    prenom: AuthData.session.prenom ?? null,
    nom: AuthData.session.nom ?? null,
  };
}

/**
 * Reconstruit le header affiché.
 *
 * Un ajout au panier ou une connexion ne change pas de page : le header,
 * construit au changement de page, est donc reconstruit à chaque modification
 * du panier ou de la session, pour que le compteur et le bouton de compte
 * suivent.
 */
function rafraichirHeader() {
  let header = document.querySelector("header");

  if (header !== null) {
    header.replaceWith(HeaderView.dom(donneesHeader()));
  }
}

PanierData.surChangement = rafraichirHeader;
AuthData.surChangement = rafraichirHeader;
