import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateBoutons from "./boutons.html?raw";

// Barre des actions en lot sur les commandes cochées, affichée dès qu'une
// commande est cochée. Elle ne décide de rien : elle signale le statut
// demandé, et c'est le serveur qui accepte ou refuse chaque commande.
let ActionsLotView = {
  html: function (nombre) {
    return genericRenderer(template, {
      libelle: nombre > 1 ? `${nombre} commandes sélectionnées` : "1 commande sélectionnée",
      libelleCourt: nombre > 1 ? `${nombre} sélectionnées` : "1 sélectionnée",
    });
  },

  /**
   * @param {number} nombre  Commandes cochées.
   * @param {{surAction: (statut: string) => void}} actions
   */
  dom: function (nombre, actions) {
    if (nombre === 0) {
      return htmlToFragment("");
    }

    let fragment = htmlToFragment(ActionsLotView.html(nombre));

    // Les mêmes boutons dans les deux emplacements (menu, barre).
    for (let nom of ["boutons-menu", "boutons"]) {
      fragment.querySelector(`slot[name="${nom}"]`).replaceWith(htmlToFragment(templateBoutons));
    }
    for (let bouton of fragment.querySelectorAll("[data-statut]")) {
      bouton.addEventListener("click", () => actions.surAction(bouton.dataset.statut));
    }

    return fragment;
  },
};

export { ActionsLotView };
