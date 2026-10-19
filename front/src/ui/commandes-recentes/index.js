import { htmlToFragment } from "../../lib/utils.js";
import { ListeCommandesClientView } from "../liste-commandes-client/index.js";
import template from "./template.html?raw";
import templateVide from "./vide.html?raw";

// Aperçu des dernières commandes de l'espace personnel : une carte « Commandes
// récentes » autour de la liste des commandes (ui/liste-commandes-client).
let CommandesRecentesView = {
  /**
   * @param {Array<{numero: string, statut: string, total: number, cree_le: string}>} commandes
   */
  dom: function (commandes) {
    if (commandes.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    fragment
      .querySelector('slot[name="liste"]')
      .replaceWith(
        ListeCommandesClientView.dom({ commandes, legende: "Vos dernières commandes, la plus récente d’abord" })
      );
    return fragment;
  },
};

export { CommandesRecentesView };
