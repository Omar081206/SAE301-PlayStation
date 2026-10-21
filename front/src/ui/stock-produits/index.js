import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { BadgeStockView } from "../badge-stock/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Couleur de la barre : rouge dès que le stock est faible (bientôt épuisé ou
// épuisé), comme sur la maquette. Classes écrites en entier (voir ui/badge-stock).
const COULEURS = {
  en_stock: "bg-action",
  bientot_epuise: "bg-erreur",
  epuise: "bg-erreur",
};

// Histogramme du stock de chaque variante, tel que le renvoie l'API :
// { nom, options, stock, etat_stock }. La plus grande barre correspond au
// plus grand stock. Un stock faible est signalé par le badge du catalogue.
let StockProduitsView = {
  /**
   * @param {Array<{nom: string, options: string|null, stock: number, etat_stock: string}>} stocks
   */
  dom: function (stocks) {
    let fragment = htmlToFragment(template);
    let plusGrand = Math.max(1, ...stocks.map((variante) => variante.stock));

    let lignes = stocks.map((variante) => {
      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          libelle: variante.options === null ? variante.nom : `${variante.nom} ${variante.options}`,
          stock: variante.stock,
          largeur: Math.round((variante.stock / plusGrand) * 100),
          couleur: COULEURS[variante.etat_stock],
        })
      );

      // En stock : pas d'alerte, la colonne reste vide.
      let alerte = ligne.querySelector('slot[name="alerte"]');

      if (variante.etat_stock === "en_stock") {
        alerte.remove();
      } else {
        alerte.replaceWith(BadgeStockView.dom(variante.etat_stock));
      }

      return ligne;
    });
    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

    return fragment;
  },
};

export { StockProduitsView };
