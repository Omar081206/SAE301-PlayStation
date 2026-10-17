import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Libellé et couleurs de chaque état, comme sur les maquettes A et C. Les
// classes sont écrites en entier, et non assemblées (« bg-" + couleur ») :
// Tailwind ne génère que les classes qu'il trouve telles quelles dans le code.
const ETATS = {
  en_stock: { libelle: "En stock", couleurs: "bg-succes text-texte-inverse" },
  bientot_epuise: { libelle: "Bientôt épuisé", couleurs: "bg-alerte text-texte" },
  epuise: { libelle: "Épuisé", couleurs: "bg-trait text-texte-attenue" },
};

// Badge de disponibilité. etat vaut « en_stock », « bientot_epuise » ou
// « epuise », tel que le calcule le serveur.
let BadgeStockView = {
  html: function (etat) {
    return genericRenderer(template, ETATS[etat]);
  },

  dom: function (etat) {
    return htmlToFragment(BadgeStockView.html(etat));
  },
};

export { BadgeStockView };
