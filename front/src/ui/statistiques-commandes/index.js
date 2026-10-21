import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateCarte from "./carte.html?raw";

// Commandes de la période, au total puis par statut, telles que les renvoie
// l'API. Un template par carte : chacune prend place dans le
// <slot name="cartes">.
let StatistiquesCommandesView = {
  /**
   * @param {{periode: number, commandes: {total: number, en_cours: number, disponible: number,
   *          retiree: number, annulee: number}}} statistiques
   */
  dom: function (statistiques) {
    let fragment = htmlToFragment(template);
    let commandes = statistiques.commandes;

    // Les cinq cartes de la maquette, dans son ordre.
    let cartes = [
      { libelle: `Commandes (${statistiques.periode} j)`, valeur: commandes.total },
      { libelle: "En cours", valeur: commandes.en_cours },
      { libelle: "Disponibles", valeur: commandes.disponible },
      { libelle: "Retirées", valeur: commandes.retiree },
      { libelle: "Annulées", valeur: commandes.annulee },
    ].map((carte) => htmlToFragment(genericRenderer(templateCarte, carte)));
    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);

    return fragment;
  },
};

export { StatistiquesCommandesView };
