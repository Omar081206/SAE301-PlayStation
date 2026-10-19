import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logo from "../../assets/logo-playstation-blanc.svg";
import template from "./template.html?raw";
import templateAVenir from "./a-venir.html?raw";

// Sections du back-office qui n'existent pas encore : elles figurent déjà
// dans le menu, grisées, et deviennent des liens avec leur user story.
const SECTIONS_A_VENIR = ["Produits", "Catégories", "Commandes", "Statistiques"];

// Navigation du back-office. Elle ne décide de rien : elle signale la demande
// de déconnexion, et le layout s'en charge.
let NavigationAdminView = {
  /**
   * @param {{surDeconnexion: () => void}} actions
   */
  dom: function (actions) {
    let fragment = htmlToFragment(genericRenderer(template, { logo }));

    let aVenir = SECTIONS_A_VENIR.map((section) => htmlToFragment(genericRenderer(templateAVenir, { section })));
    fragment.querySelector('slot[name="a-venir"]').replaceWith(...aVenir);

    fragment
      .querySelector('[data-action="deconnexion"]')
      .addEventListener("click", () => actions.surDeconnexion());

    return fragment;
  },
};

export { NavigationAdminView };
