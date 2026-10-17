import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStockView } from "../badge-stock/index.js";
import template from "./template.html?raw";
import templateColoris from "./coloris.html?raw";

// Fiche d'un produit, tel que le renvoie l'API :
// { id, nom, slug, description, categorie, categorie_slug, variante_id, prix,
//   etat_stock, images, variantes: [ { id, coloris, etat_stock } ] }
// La galerie prend la place du <slot name="galerie"> ; le badge de stock de la
// variante par défaut, celle du <slot name="badge"> ; une ligne par coloris,
// avec son propre badge, celle du <slot name="coloris">.
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
   * @param {{variante_id: number, nom: string, etat_stock: string,
   *          variantes: Array<{coloris: string|null, etat_stock: string}>}} produit
   * @param {{surAjout: (variantId: number, nom: string) => void}} actions
   */
  dom: function (produit, actions) {
    let fragment = htmlToFragment(FicheProduitView.html(produit));

    fragment.querySelector('slot[name="badge"]').replaceWith(BadgeStockView.dom(produit.etat_stock));

    // Un seul coloris (ou aucun) : le badge principal suffit.
    if (produit.variantes.length < 2) {
      fragment.querySelector('[data-role="coloris"]').remove();
    } else {
      let lignes = produit.variantes.map((variante) => {
        let ligne = htmlToFragment(genericRenderer(templateColoris, { coloris: variante.coloris }));
        ligne.querySelector('slot[name="badge"]').replaceWith(BadgeStockView.dom(variante.etat_stock));
        return ligne;
      });
      fragment.querySelector('slot[name="coloris"]').replaceWith(...lignes);
    }

    let bouton = fragment.querySelector('[data-action="ajouter"]');

    // Variante par défaut épuisée : bouton désactivé (le serveur refuserait
    // de toute façon l'ajout).
    if (produit.etat_stock === "epuise") {
      bouton.disabled = true;
      bouton.textContent = "Épuisé";
    }

    bouton.addEventListener("click", () => actions.surAjout(produit.variante_id, produit.nom));

    return fragment;
  },
};

export { FicheProduitView };
