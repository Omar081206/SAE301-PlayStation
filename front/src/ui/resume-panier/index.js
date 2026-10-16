import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

// Résumé du panier : le total TTC calculé par le serveur, et le bouton de
// validation (branché avec la validation de commande, CMD-a).
let ResumePanierView = {
  html: function (panier) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    return genericRenderer(template, { total: formaterPrix(panier.total) });
  },

  dom: function (panier) {
    return htmlToFragment(ResumePanierView.html(panier));
  },
};

export { ResumePanierView };
