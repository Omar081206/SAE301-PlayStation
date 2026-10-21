import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateIndicateur from "./indicateur.html?raw";

// Indicateurs du tableau de bord, tels que les renvoie l'API.
// Un template par élément répété : chaque indicateur prend place dans le
// <slot name="indicateurs">.
let IndicateursView = {
  /**
   * @param {{produits: number, commandes: number}} tableau
   */
  dom: function (tableau) {
    let fragment = htmlToFragment(template);

    // Les deux indicateurs de la maquette.
    let indicateurs = [
      { libelle: "Produits", valeur: tableau.produits },
      { libelle: "Commandes", valeur: tableau.commandes },
    ].map((indicateur) => htmlToFragment(genericRenderer(templateIndicateur, indicateur)));
    fragment.querySelector('slot[name="indicateurs"]').replaceWith(...indicateurs);

    return fragment;
  },
};

export { IndicateursView };
