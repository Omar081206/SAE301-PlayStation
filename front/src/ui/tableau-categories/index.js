import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateVide from "./vide.html?raw";

// Liste des catégories du back-office, telles que les renvoie l'API :
// { id, nom, slug, description, nombre }. Le composant ne décide de rien : il
// affiche et signale les demandes de modification et de suppression.
let TableauCategoriesView = {
  /**
   * @param {Array<{id: number, nom: string, slug: string, description: string, nombre: number}>} categories
   * @param {{surModification: (id: number) => void, surSuppression: (id: number) => void}} actions
   */
  dom: function (categories, actions) {
    if (categories.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);

    let lignes = categories.map((categorie) => {
      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          nom: categorie.nom,
          slug: categorie.slug,
          description: categorie.description,
          produits: categorie.nombre > 1 ? `${categorie.nombre} produits` : `${categorie.nombre} produit`,
        })
      );
      ligne
        .querySelector('[data-action="modifier"]')
        .addEventListener("click", () => actions.surModification(categorie.id));
      ligne
        .querySelector('[data-action="supprimer"]')
        .addEventListener("click", () => actions.surSuppression(categorie.id));
      return ligne;
    });

    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);
    return fragment;
  },
};

export { TableauCategoriesView };
