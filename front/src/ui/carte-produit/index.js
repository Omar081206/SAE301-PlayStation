import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import iconeAjout from "../../assets/ajout-panier.svg";
import { BadgeStockView } from "../badge-stock/index.js";
import template from "./template.html?raw";

// Carte d'un produit, tel que le renvoie l'API :
// { id, nom, slug, categorie, variante_id, prix, etat_stock, image, image_alt }
// Le badge de stock (composant BadgeStockView) prend la place du <slot name="badge">.
// L'image est un fichier de front/public/images/produits/, que Vite recopie
// dans dist/ sous le chemin du projet.
let CarteProduitView = {
  html: function (produit) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    return genericRenderer(template, {
      nom: produit.nom,
      slug: produit.slug,
      prix: formaterPrix(produit.prix),
      image: import.meta.env.BASE_URL + "images/produits/" + produit.image,
      alt: produit.image_alt,
      iconeAjout,
    });
  },

  /**
   * @param {{variante_id: number, nom: string, etat_stock: string}} produit
   * @param {{surAjout: (variantId: number, nom: string) => void}} actions
   */
  dom: function (produit, actions) {
    let fragment = htmlToFragment(CarteProduitView.html(produit));

    fragment.querySelector('slot[name="badge"]').replaceWith(BadgeStockView.dom(produit.etat_stock));

    fragment
      .querySelector('[data-action="ajouter"]')
      .addEventListener("click", () => actions.surAjout(produit.variante_id, produit.nom));

    return fragment;
  },
};

export { CarteProduitView };
