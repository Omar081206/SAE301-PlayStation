import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

// Fiche d'un produit, tel que le renvoie l'API :
// { id, nom, slug, description, categorie, categorie_slug, variante_id, prix, images }
// La galerie prend la place du <slot name="galerie">.
let FicheProduitView = {
  html: function (produit) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    return genericRenderer(template, {
      nom: produit.nom,
      prix: formaterPrix(produit.prix),
      description: produit.description,
      categorie: produit.categorie,
      categorieSlug: produit.categorie_slug,
    });
  },

  /**
   * @param {{variante_id: number, nom: string}} produit
   * @param {{surAjout: (variantId: number, nom: string) => void}} actions
   */
  dom: function (produit, actions) {
    let fragment = htmlToFragment(FicheProduitView.html(produit));

    fragment
      .querySelector('[data-action="ajouter"]')
      .addEventListener("click", () => actions.surAjout(produit.variante_id, produit.nom));

    return fragment;
  },
};

export { FicheProduitView };
