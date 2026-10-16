import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import radio from "../../assets/radio.svg";
import radioCoche from "../../assets/radio-coche.svg";
import template from "./template.html?raw";
import templateLien from "./lien.html?raw";

// Menu des catégories du catalogue : « Tous les produits », puis un lien par
// catégorie, chacun avec son nombre de produits. Un template par élément
// répété : chaque lien prend place dans le <slot name="liens">.
// Le lien de la catégorie affichée reçoit aria-current="page" ici, et pas
// seulement du routeur : il doit survivre à V.rafraichir().
let FiltreCategoriesView = {
  /**
   * @param {{categories: Array<{nom: string, slug: string, nombre: number}>, total: number,
   *          active: string|undefined}} data  active : slug de la catégorie affichée.
   */
  dom: function (data) {
    let fragment = htmlToFragment(template);

    let tous = { nom: "Tous les produits", chemin: "/", nombre: data.total };
    let parCategorie = data.categories.map((categorie) => ({
      nom: categorie.nom,
      chemin: `/categorie/${categorie.slug}`,
      nombre: categorie.nombre,
    }));

    let actif = data.active === undefined ? "/" : `/categorie/${data.active}`;
    let liens = [tous, ...parCategorie].map((lien) => {
      let element = htmlToFragment(genericRenderer(templateLien, { ...lien, radio, radioCoche }));
      if (lien.chemin === actif) {
        element.querySelector("a").setAttribute("aria-current", "page");
      }
      return element;
    });
    fragment.querySelector('slot[name="liens"]').replaceWith(...liens);

    return fragment;
  },
};

export { FiltreCategoriesView };
