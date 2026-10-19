import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Navigation de l'espace personnel. La section affichée reçoit
// aria-current="page" ici, et non du routeur seul : la page se reconstruit
// (V.rafraichir) sans que le routeur repasse sur ses liens.
// « Mes commandes » arrive avec SUI-c : grisé en attendant.
let NavigationCompteView = {
  /**
   * @param {"accueil"|"profil"} section  Section affichée.
   * @param {{surDeconnexion: () => void}} actions
   */
  dom: function (section, actions) {
    let fragment = htmlToFragment(template);

    fragment.querySelector(`[data-section="${section}"]`).setAttribute("aria-current", "page");
    fragment
      .querySelector('[data-action="deconnexion"]')
      .addEventListener("click", () => actions.surDeconnexion());

    return fragment;
  },
};

export { NavigationCompteView };
