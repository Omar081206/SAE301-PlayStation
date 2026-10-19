import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Barre des actions en lot sur les commandes cochées. Elle ne décide de
// rien : elle signale le statut demandé, et c'est le serveur qui accepte ou
// refuse chaque commande.
let ActionsLotView = {
  html: function (nombre) {
    let libelle = "Cochez des commandes pour changer leur statut en lot.";
    if (nombre === 1) libelle = "1 commande sélectionnée";
    if (nombre > 1) libelle = `${nombre} commandes sélectionnées`;
    return genericRenderer(template, { libelle });
  },

  /**
   * @param {number} nombre  Commandes cochées.
   * @param {{surAction: (statut: string) => void}} actions
   */
  dom: function (nombre, actions) {
    let fragment = htmlToFragment(ActionsLotView.html(nombre));

    for (let bouton of fragment.querySelectorAll("[data-statut]")) {
      // État réglé en JS : un template n'a pas de condition.
      bouton.disabled = nombre === 0;
      bouton.addEventListener("click", () => actions.surAction(bouton.dataset.statut));
    }

    return fragment;
  },
};

export { ActionsLotView };
