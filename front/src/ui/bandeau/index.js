import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Bandeau de titre des pages de la boutique : l'accroche Click & Collect, puis
// le titre de la page (« Tous les produits », « Manettes »…).
let BandeauView = {
  html: function (titre) {
    return genericRenderer(template, { titre });
  },

  dom: function (titre) {
    return htmlToFragment(BandeauView.html(titre));
  },
};

export { BandeauView };
