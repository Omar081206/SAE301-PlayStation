import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateVide from "./vide.html?raw";

// Lignes du panier, telles que les renvoie l'API (prix et sous-totaux calculés
// par le serveur). Un template par élément répété : chaque ligne prend place
// dans le <slot name="lignes">. Le composant ne modifie pas le panier : il
// signale la quantité demandée, la suppression ou le vidage, et la page décide.
let LignesPanierView = {
  /**
   * @param {Array<{variantId: number, nom: string, slug: string, quantite: number,
   *                quantiteMax: number, sousTotal: number, sousTotalInitial: number|null, image: string,
   *                image_alt: string}>} lignes  quantiteMax : stock disponible, plafonné.
   * @param {{surQuantite: (variantId: number, quantite: number) => void,
   *          surSuppression: (variantId: number) => void, surVider: () => void}} actions
   */
  dom: function (lignes, actions) {
    if (lignes.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);

    let elements = lignes.map((ligne) => {
      let element = htmlToFragment(
        genericRenderer(templateLigne, {
          nom: ligne.nom,
          slug: ligne.slug,
          variantId: ligne.variantId,
          options: ligne.options ?? "",
          quantite: ligne.quantite,
          sousTotal: formaterPrix(ligne.sousTotal),
          sousTotalInitial: ligne.sousTotalInitial === null ? "" : formaterPrix(ligne.sousTotalInitial),
          image: import.meta.env.BASE_URL + "images/produits/" + ligne.image,
          alt: ligne.image_alt,
        })
      );

      // Produit hors promotion : pas de montant barré.
      if (ligne.sousTotalInitial === null) {
        element.querySelectorAll('[data-role="initial"]').forEach((barre) => barre.remove());
      }

      // Produit sans option : rien à afficher ni à modifier.
      if (ligne.options === null) {
        element.querySelector('[data-role="options"]').remove();
        element.querySelector('[data-role="modifier"]').remove();
      }

      let moins = element.querySelector('[data-action="moins"]');
      let plus = element.querySelector('[data-action="plus"]');

      // État réglé en JS : un template n'a pas de condition.
      moins.disabled = ligne.quantite <= 1;
      plus.disabled = ligne.quantite >= ligne.quantiteMax;

      moins.addEventListener("click", () => actions.surQuantite(ligne.variantId, ligne.quantite - 1));
      plus.addEventListener("click", () => actions.surQuantite(ligne.variantId, ligne.quantite + 1));
      element
        .querySelector('[data-action="supprimer"]')
        .addEventListener("click", () => actions.surSuppression(ligne.variantId));

      return element;
    });
    fragment.querySelector('slot[name="lignes"]').replaceWith(...elements);
    fragment.querySelector('[data-action="vider"]').addEventListener("click", () => actions.surVider());

    return fragment;
  },
};

export { LignesPanierView };
