import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Récapitulatif avant validation : les articles du panier, tels que les
// renvoie l'API panier (prix calculés par le serveur), le total et le bouton
// de confirmation. Un template par élément répété : chaque ligne prend place
// dans le <slot name="lignes">.
let RecapitulatifCommandeView = {
  /**
   * @param {{panier: {lignes: Array<{nom: string, quantite: number, sousTotal: number,
   *          image: string, image_alt: string}>, total: number, nombre: number},
   *          envoiEnCours: boolean}} data
   * @param {{surConfirmation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, { nombre: data.panier.nombre, total: formaterPrix(data.panier.total) })
    );

    let lignes = data.panier.lignes.map((ligne) => {
      let element = htmlToFragment(
        genericRenderer(templateLigne, {
          nom: ligne.nom,
          options: ligne.options ?? "",
          quantite: ligne.quantite,
          sousTotal: formaterPrix(ligne.sousTotal),
          image: import.meta.env.BASE_URL + "images/produits/" + ligne.image,
          alt: ligne.image_alt,
        })
      );
      // État réglé en JS : un template n'a pas de condition. Produit sans
      // option : pas de ligne vide.
      if (ligne.options === null) {
        element.querySelector('[data-role="options"]').remove();
      }
      return element;
    });
    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

    let bouton = fragment.querySelector('[data-action="confirmer"]');
    // État réglé en JS : pendant l'envoi, un second clic ne crée pas une
    // seconde commande.
    bouton.disabled = data.envoiEnCours;
    bouton.addEventListener("click", () => actions.surConfirmation());

    return fragment;
  },
};

export { RecapitulatifCommandeView };
