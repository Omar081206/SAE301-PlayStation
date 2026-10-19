import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateElement from "./element.html?raw";
import templateActions from "./actions.html?raw";
import templateVide from "./vide.html?raw";

// Liste des produits du back-office, telle que la renvoie l'API :
// { id, nom, prix, stock, variantes }. Tableau à partir de lg, liste en
// dessous. « Modifier » mène au formulaire ; la suppression est signalée.
let TableauProduitsAdminView = {
  /**
   * @param {Array<{id: number, nom: string, prix: number|null, stock: number, variantes: number}>} produits
   * @param {{surSuppression: (id: number) => void}} actions
   */
  dom: function (produits, actions) {
    if (produits.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = [];
    let elements = [];

    for (let produit of produits) {
      let donnees = {
        nom: produit.nom,
        prix: produit.prix === null ? "—" : formaterPrix(produit.prix),
        // « 27 (4 variantes) » : le stock total, et le nombre de variantes
        // quand il y en a plusieurs.
        stock: produit.variantes > 1 ? `${produit.stock} (${produit.variantes} variantes)` : String(produit.stock),
      };

      for (let [modele, liste] of [
        [templateLigne, lignes],
        [templateElement, elements],
      ]) {
        let element = htmlToFragment(genericRenderer(modele, donnees));
        let boutons = htmlToFragment(genericRenderer(templateActions, { id: produit.id, nom: produit.nom }));
        boutons
          .querySelector('[data-action="supprimer"]')
          .addEventListener("click", () => actions.surSuppression(produit.id));
        element.querySelector('slot[name="actions"]').replaceWith(boutons);
        liste.push(element);
      }
    }

    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="elements"]').replaceWith(...elements);
    return fragment;
  },
};

export { TableauProduitsAdminView };
