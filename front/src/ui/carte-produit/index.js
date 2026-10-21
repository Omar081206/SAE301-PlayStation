import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import iconeAjout from "../../assets/ajout-panier.svg";
import iconeAjoutDesactive from "../../assets/ajout-panier-desactive.svg";
import { BadgePromoView } from "../badge-promo/index.js";
import { BadgeStockView } from "../badge-stock/index.js";
import template from "./template.html?raw";

// Carte d'un produit, tel que le renvoie l'API :
// { id, nom, slug, categorie, variante_id, prix, prix_initial, promotion, etat_stock, image, image_alt }
// Le badge de stock (composant BadgeStockView) prend la place du <slot name="badge">.
// Produit en promotion (prix_initial non null) : prix réduit, prix d'origine
// barré et badge « −20 % » (BadgePromoView, <slot name="promotion">).
// L'image est un fichier de front/public/images/produits/, que Vite recopie
// dans dist/ sous le chemin du projet.
// Catégories dont les images sont des jaquettes ou des visuels (les jeux) :
// elles remplissent leur cadre, quitte à en rogner les bords. Les autres
// (consoles, manettes…) sont des photos détourées : affichées en entier.
// Partagé avec la page Produit (galerie).
export const CATEGORIES_EN_VISUEL = ["jeux"];

let CarteProduitView = {
  html: function (produit) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    return genericRenderer(template, {
      nom: produit.nom,
      slug: produit.slug,
      prix: formaterPrix(produit.prix),
      prixInitial: produit.prix_initial === null ? "" : formaterPrix(produit.prix_initial),
      image: import.meta.env.BASE_URL + "images/produits/" + produit.image,
      alt: produit.image_alt,
      iconeAjout,
    });
  },

  /**
   * @param {{variante_id: number, nom: string, etat_stock: string, categorie_slug: string,
   *          prix_initial: number|null, promotion: number|null}} produit
   * @param {{surAjout: (variantId: number, nom: string) => void}} actions
   */
  dom: function (produit, actions) {
    let fragment = htmlToFragment(CarteProduitView.html(produit));

    fragment.querySelector('slot[name="badge"]').replaceWith(BadgeStockView.dom(produit.etat_stock));

    // Hors promotion : ni badge « −20 % », ni prix barré.
    if (produit.prix_initial === null) {
      fragment.querySelector('slot[name="promotion"]').remove();
      fragment.querySelector('[data-role="initial"]').remove();
    } else {
      fragment.querySelector('slot[name="promotion"]').replaceWith(BadgePromoView.dom(produit.promotion));
    }

    // Jaquette ou visuel de jeu : l'image remplit le cadre (bords rognés).
    if (CATEGORIES_EN_VISUEL.includes(produit.categorie_slug)) {
      fragment.querySelector("img").classList.replace("object-contain", "object-cover");
    }

    let bouton = fragment.querySelector('[data-action="ajouter"]');

    // Produit épuisé : bouton désactivé et grisé (le serveur refuserait de
    // toute façon l'ajout). État réglé en JS : un template n'a pas de condition.
    if (produit.etat_stock === "epuise") {
      bouton.disabled = true;
      bouton.setAttribute("aria-label", `${produit.nom} est épuisé`);
      bouton.querySelector("img").src = iconeAjoutDesactive;
    }

    bouton.addEventListener("click", () => actions.surAjout(produit.variante_id, produit.nom));

    return fragment;
  },
};

export { CarteProduitView };
