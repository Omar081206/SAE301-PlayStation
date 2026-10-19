import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Navigation de l'espace personnel. La section affichée est marquée ici
// (data-actif, qui porte le style) : la page se reconstruit (V.rafraichir)
// sans que le routeur repasse sur ses liens, et le routeur retire
// aria-current d'un lien qui n'est pas exactement l'adresse affichée (détail
// d'une commande sous « Mes commandes »). aria-current reste posé par le
// routeur sur le lien de la page exacte.
let NavigationCompteView = {
  /**
   * @param {"accueil"|"commandes"|"profil"} section  Section affichée.
   * @param {{surDeconnexion: () => void}} actions
   */
  dom: function (section, actions) {
    let fragment = htmlToFragment(template);

    fragment.querySelector(`[data-section="${section}"]`).setAttribute("data-actif", "");
    fragment
      .querySelector('[data-action="deconnexion"]')
      .addEventListener("click", () => actions.surDeconnexion());

    return fragment;
  },
};

export { NavigationCompteView };
