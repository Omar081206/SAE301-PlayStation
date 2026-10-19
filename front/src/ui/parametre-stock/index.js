import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Carte « Paramètre de stock » : le seuil à partir duquel une variante est
// signalée « Bientôt épuisé ». Elle transmet la valeur saisie ; le serveur la
// valide.
let ParametreStockView = {
  html: function (data) {
    return genericRenderer(template, { seuil: data.seuil });
  },

  /**
   * @param {{seuil: number, message: {type: string, texte: string}|null}} data
   * @param {{surSeuil: (seuil: number) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(ParametreStockView.html(data));
    let formulaire = fragment.querySelector("form");

    fragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(data.message));

    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surSeuil(Number(formulaire.elements.seuil.value));
    });

    return fragment;
  },
};

export { ParametreStockView };
