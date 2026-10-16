import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import iconePanier from "../../assets/panier.svg";
import logoSony from "../../assets/logo-sony.svg";
import logoPlayStation from "../../assets/logo-playstation.svg";
import template from "./template.html?raw";

// En-tête du site : logos et lien vers le panier, avec le nombre d'articles.
// Le nombre est fourni par le layout : le header ne lit pas le panier.
let HeaderView = {
  html: function (nombre) {
    return genericRenderer(template, {
      logoSony,
      logoPlayStation,
      iconePanier,
      nombre,
      libellePanier: nombre > 1 ? `Panier, ${nombre} articles` : `Panier, ${nombre} article`,
    });
  },

  dom: function (nombre) {
    let fragment = htmlToFragment(HeaderView.html(nombre));

    // Panier vide : pas de pastille « 0 ».
    if (nombre === 0) {
      fragment.querySelector('[data-role="compteur"]').remove();
    }

    return fragment;
  },
};

export { HeaderView };
