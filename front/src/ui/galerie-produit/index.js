import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateMiniature from "./miniature.html?raw";

// Galerie de la fiche produit : l'image affichée, les flèches et une miniature
// par image. Elle ne retient pas l'image affichée : elle signale celle que
// l'utilisateur demande, et la page décide.
let GalerieProduitView = {
  /**
   * @param {{images: Array<{fichier: string, alt: string}>, active: number}} data
   * @param {{surImage: (position: number) => void}} actions
   */
  dom: function (data, actions) {
    let image = data.images[data.active];
    let fragment = htmlToFragment(
      genericRenderer(template, {
        image: import.meta.env.BASE_URL + "images/produits/" + image.fichier,
        alt: image.alt,
      })
    );

    let precedente = fragment.querySelector('[data-action="precedente"]');
    let suivante = fragment.querySelector('[data-action="suivante"]');

    // Une seule image : rien à parcourir, ni flèches ni miniatures.
    if (data.images.length === 1) {
      precedente.remove();
      suivante.remove();
      fragment.querySelector('[data-role="miniatures"]').remove();
      return fragment;
    }

    // État réglé en JS : un template n'a pas de condition.
    precedente.disabled = data.active === 0;
    suivante.disabled = data.active === data.images.length - 1;
    precedente.addEventListener("click", () => actions.surImage(data.active - 1));
    suivante.addEventListener("click", () => actions.surImage(data.active + 1));

    let miniatures = data.images.map((element, position) => {
      let miniature = htmlToFragment(
        genericRenderer(templateMiniature, {
          image: import.meta.env.BASE_URL + "images/produits/" + element.fichier,
          numero: position + 1,
        })
      );
      let bouton = miniature.querySelector("button");
      bouton.setAttribute("aria-current", String(position === data.active));
      bouton.addEventListener("click", () => actions.surImage(position));
      return miniature;
    });
    fragment.querySelector('slot[name="miniatures"]').replaceWith(...miniatures);

    return fragment;
  },
};

export { GalerieProduitView };
