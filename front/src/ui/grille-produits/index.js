import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { CarteProduitView } from "../carte-produit/index.js";
import template from "./template.html?raw";
import templateVide from "./vide.html?raw";

// Grille de cartes, précédée du nombre de produits. Elle compose un autre
// composant, CarteProduitView : les cartes prennent la place du <slot name="cartes">.
let GrilleProduitsView = {
  /**
   * @param {{surAjout: (variantId: number, nom: string) => void}} actions  Transmises à chaque carte.
   */
  dom: function (produits, actions) {
    if (produits.length === 0) {
      return htmlToFragment(templateVide);
    }

    let nombre = produits.length > 1 ? `${produits.length} produits` : "1 produit";
    let fragment = htmlToFragment(genericRenderer(template, { nombre }));
    let cartes = produits.map((produit) => CarteProduitView.dom(produit, actions));
    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);
    return fragment;
  },
};

export { GrilleProduitsView };
