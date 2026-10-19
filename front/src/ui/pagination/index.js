import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Pagination : page précédente, numéro de page, page suivante. Rien n'est
// affiché s'il n'y a qu'une page. Le composant signale la page demandée.
let PaginationView = {
  /**
   * @param {{page: number, pages: number}} data
   * @param {{surPage: (page: number) => void}} actions
   */
  dom: function (data, actions) {
    if (data.pages <= 1) {
      return htmlToFragment("");
    }

    let fragment = htmlToFragment(genericRenderer(template, data));
    let precedente = fragment.querySelector('[data-page="precedente"]');
    let suivante = fragment.querySelector('[data-page="suivante"]');

    // État réglé en JS : un template n'a pas de condition.
    precedente.disabled = data.page <= 1;
    suivante.disabled = data.page >= data.pages;
    precedente.addEventListener("click", () => actions.surPage(data.page - 1));
    suivante.addEventListener("click", () => actions.surPage(data.page + 1));

    return fragment;
  },
};

export { PaginationView };
