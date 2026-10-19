import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateElement from "./element.html?raw";
import templateActions from "./actions.html?raw";
import templateVide from "./vide.html?raw";

// Liste des catégories du back-office, telles que les renvoie l'API :
// { id, nom, slug, description, nombre }. Tableau à partir de lg, liste en
// dessous. Le composant ne décide de rien : il affiche et signale les
// demandes de modification et de suppression.
let TableauCategoriesView = {
  /**
   * @param {Array<{id: number, nom: string}>} categories
   * @param {{surModification: (id: number) => void, surSuppression: (id: number) => void}} actions
   */
  dom: function (categories, actions) {
    if (categories.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = [];
    let elements = [];

    for (let categorie of categories) {
      for (let [modele, liste] of [
        [templateLigne, lignes],
        [templateElement, elements],
      ]) {
        let element = htmlToFragment(genericRenderer(modele, { nom: categorie.nom }));
        let boutons = htmlToFragment(genericRenderer(templateActions, { nom: categorie.nom }));
        boutons
          .querySelector('[data-action="modifier"]')
          .addEventListener("click", () => actions.surModification(categorie.id));
        boutons
          .querySelector('[data-action="supprimer"]')
          .addEventListener("click", () => actions.surSuppression(categorie.id));
        element.querySelector('slot[name="actions"]').replaceWith(boutons);
        liste.push(element);
      }
    }

    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="elements"]').replaceWith(...elements);
    return fragment;
  },
};

export { TableauCategoriesView };
