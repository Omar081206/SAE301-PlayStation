import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Sélecteur « Connexion | Créer un compte » : en dessous de lg, il choisit la
// carte affichée. Il signale l'onglet demandé, et la page décide.
let OngletsIdentificationView = {
  /**
   * @param {"connexion"|"inscription"} onglet  Onglet affiché.
   * @param {{surOnglet: (onglet: string) => void}} actions
   */
  dom: function (onglet, actions) {
    let fragment = htmlToFragment(template);

    for (let bouton of fragment.querySelectorAll("[data-choix]")) {
      bouton.setAttribute("aria-pressed", String(bouton.dataset.choix === onglet));
      bouton.addEventListener("click", () => actions.surOnglet(bouton.dataset.choix));
    }

    return fragment;
  },
};

export { OngletsIdentificationView };
