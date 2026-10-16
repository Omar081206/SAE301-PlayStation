import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import iconeCompte from "../../assets/compte.svg";
import iconePanier from "../../assets/panier.svg";
import logoSony from "../../assets/logo-sony.svg";
import logoPlayStation from "../../assets/logo-playstation.svg";
import template from "./template.html?raw";

// En-tête du site : logos, lien vers le compte et lien vers le panier, avec le
// nombre d'articles. Ces données sont fournies par le layout : le header ne
// lit ni le panier ni la session.
let HeaderView = {
  /**
   * @param {{nombre: number, connecte: boolean}} data  Articles du panier, état de connexion.
   */
  html: function (data) {
    return genericRenderer(template, {
      logoSony,
      logoPlayStation,
      iconeCompte,
      iconePanier,
      nombre: data.nombre,
      libellePanier: data.nombre > 1 ? `Panier, ${data.nombre} articles` : `Panier, ${data.nombre} article`,
      libelleCompte: data.connecte ? "Mon compte" : "Connexion",
    });
  },

  dom: function (data) {
    let fragment = htmlToFragment(HeaderView.html(data));

    // Panier vide : pas de pastille « 0 ».
    if (data.nombre === 0) {
      fragment.querySelector('[data-role="compteur"]').remove();
    }

    return fragment;
  },
};

export { HeaderView };
