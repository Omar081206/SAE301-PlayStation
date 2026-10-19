import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logo from "../../assets/logo-playstation-blanc.svg";
import template from "./template.html?raw";
import templateAVenir from "./a-venir.html?raw";

// Sections du back-office qui n'existent pas encore : elles figurent déjà
// dans le menu, grisées, et deviennent des liens avec leur user story
// (Statistiques : PIL-a).
const SECTIONS_A_VENIR = { statistiques: "Statistiques" };

// Mise en forme d'une section à venir dans chacun des deux menus : le menu
// plein écran (mobile, tablette) puis la barre latérale (desktop). Les
// classes sont écrites en entier, comme dans ui/message.
const MENUS = [
  { bordure: "border-b border-texte-inverse/30", espacement: "py-3" },
  { bordure: "", espacement: "px-4 py-3" },
];

// Navigation du back-office : barre latérale à partir de lg ; en dessous,
// barre du haut et menu plein écran. Elle ne décide de rien : elle signale
// la demande de déconnexion, et le layout s'en charge.
let NavigationAdminView = {
  /**
   * @param {{surDeconnexion: () => void}} actions
   */
  dom: function (actions) {
    let fragment = htmlToFragment(genericRenderer(template, { logo }));

    for (let [cle, section] of Object.entries(SECTIONS_A_VENIR)) {
      let slots = fragment.querySelectorAll(`slot[name="a-venir-${cle}"]`);
      slots.forEach((slot, i) =>
        slot.replaceWith(htmlToFragment(genericRenderer(templateAVenir, { section, ...MENUS[i] })))
      );
    }

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
