import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Badge de la promotion automatique (« −20 % »), comme sur la maquette C.
// pourcentage est la réduction que calcule le serveur.
let BadgePromoView = {
  html: function (pourcentage) {
    return genericRenderer(template, { pourcentage });
  },

  dom: function (pourcentage) {
    return htmlToFragment(BadgePromoView.html(pourcentage));
  },
};

export { BadgePromoView };
