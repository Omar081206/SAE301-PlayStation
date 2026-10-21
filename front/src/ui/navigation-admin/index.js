import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logo from "../../assets/logo-playstation-blanc.svg";
import template from "./template.html?raw";

// Navigation du back-office : barre latérale à partir de lg ; en dessous,
// barre du haut et menu plein écran. Elle ne décide de rien : elle signale
// la demande de déconnexion, et le layout s'en charge.
let NavigationAdminView = {
  /**
   * @param {{surDeconnexion: () => void}} actions
   */
  dom: function (actions) {
    let fragment = htmlToFragment(genericRenderer(template, { logo }));

    // Le menu plein écran est un <dialog> modal : focus gardé dedans, Échap
    // le ferme. Un clic sur un lien change de page, et le layout (menu
    // compris) est reconstruit : il n'y a rien à refermer.
    let menu = fragment.querySelector("dialog");
    fragment.querySelector('[data-action="ouvrir"]').addEventListener("click", () => menu.showModal());
    fragment.querySelector('[data-action="fermer"]').addEventListener("click", () => menu.close());

    for (let bouton of fragment.querySelectorAll('[data-action="deconnexion"]')) {
      bouton.addEventListener("click", () => actions.surDeconnexion());
    }

    return fragment;
  },
};

export { NavigationAdminView };
