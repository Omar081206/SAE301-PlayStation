import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateElement from "./element.html?raw";
import templateVide from "./vide.html?raw";

// Produits les plus vendus, tels que les renvoie l'API : { nom, ventes },
// le plus vendu d'abord. Tableau à partir de md, liste en dessous.
let MeilleuresVentesView = {
  /**
   * @param {Array<{nom: string, ventes: number}>} ventes
   */
  dom: function (ventes) {
    if (ventes.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = ventes.map((produit) => htmlToFragment(genericRenderer(templateLigne, produit)));
    let elements = ventes.map((produit) => htmlToFragment(genericRenderer(templateElement, produit)));

    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="elements"]').replaceWith(...elements);
    return fragment;
  },
};

export { MeilleuresVentesView };
