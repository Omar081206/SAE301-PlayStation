import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateCarte from "./carte.html?raw";
import templateVide from "./vide.html?raw";

// Date d'une commande : « 13/10/2026 ». MySQL renvoie « 2026-10-13 09:42:01 ».
const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

// Aperçu des dernières commandes de l'espace personnel, telles que les
// renvoie l'API : { numero, statut, total, cree_le }. Chaque commande donne
// une ligne du tableau (à partir de lg) et une carte (en dessous).
let CommandesRecentesView = {
  /**
   * @param {Array<{numero: string, statut: string, total: number, cree_le: string}>} commandes
   */
  dom: function (commandes) {
    if (commandes.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = [];
    let cartes = [];

    for (let commande of commandes) {
      let donnees = {
        numero: commande.numero,
        date: DATE.format(new Date(commande.cree_le.replace(" ", "T"))),
        total: formaterPrix(commande.total),
      };

      for (let [modele, liste] of [
        [templateLigne, lignes],
        [templateCarte, cartes],
      ]) {
        let element = htmlToFragment(genericRenderer(modele, donnees));
        element.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));
        liste.push(element);
      }
    }

    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);
    return fragment;
  },
};

export { CommandesRecentesView };
