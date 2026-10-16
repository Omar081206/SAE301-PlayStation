import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import radio from "../../assets/radio.svg";
import radioCoche from "../../assets/radio-coche.svg";
import template from "./template.html?raw";
import templateLien from "./lien.html?raw";

// Menu des catégories du catalogue : « Tous les produits », puis un lien par
// catégorie, chacun avec son nombre de produits. Un template par élément
// répété : chaque lien prend place dans le <slot name="liens">.
let FiltreCategoriesView = {
  /**
   * @param {{categories: Array<{nom: string, slug: string, nombre: number}>, total: number}} data
   */
  dom: function (data) {
    let fragment = htmlToFragment(template);

    let tous = { nom: "Tous les produits", chemin: "/", nombre: data.total };
    let parCategorie = data.categories.map((categorie) => ({
      nom: categorie.nom,
      chemin: `/categorie/${categorie.slug}`,
      nombre: categorie.nombre,
    }));

    let liens = [tous, ...parCategorie].map((lien) =>
      htmlToFragment(genericRenderer(templateLien, { ...lien, radio, radioCoche }))
    );
    fragment.querySelector('slot[name="liens"]').replaceWith(...liens);

    return fragment;
  },
};

export { FiltreCategoriesView };
