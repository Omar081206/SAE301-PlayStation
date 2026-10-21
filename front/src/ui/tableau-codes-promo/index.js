import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateElement from "./element.html?raw";
import templateActions from "./actions.html?raw";
import templateVide from "./vide.html?raw";

// Liste des codes promo du back-office, tels que les renvoie l'API :
// { id, code, pourcentage, utilisations, remise_totale }. Tableau à partir
// de md, liste en dessous. Le composant ne décide de rien : il affiche et
// signale les demandes de modification et de suppression.
let TableauCodesPromoView = {
  /**
   * @param {Array<{id: number, code: string, pourcentage: number, utilisations: number,
   *          remise_totale: number}>} codes
   * @param {{surModification: (id: number) => void, surSuppression: (id: number) => void}} actions
   */
  dom: function (codes, actions) {
    if (codes.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = [];
    let elements = [];

    for (let code of codes) {
      // Mise en forme de la maquette : « −10 % », « 12 utilisations », « 64,80 € ».
      let valeurs = {
        code: code.code,
        reduction: `−${code.pourcentage} %`,
        utilisations: code.utilisations,
        libelleUtilisations: `${code.utilisations} utilisation${code.utilisations > 1 ? "s" : ""}`,
        remise: formaterPrix(code.remise_totale),
      };

      for (let [modele, liste] of [
        [templateLigne, lignes],
        [templateElement, elements],
      ]) {
        let element = htmlToFragment(genericRenderer(modele, valeurs));
        let boutons = htmlToFragment(genericRenderer(templateActions, { code: code.code }));
        boutons.querySelector('[data-action="modifier"]').addEventListener("click", () => actions.surModification(code.id));
        boutons.querySelector('[data-action="supprimer"]').addEventListener("click", () => actions.surSuppression(code.id));
        element.querySelector('slot[name="actions"]').replaceWith(boutons);
        liste.push(element);
      }
    }

    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="elements"]').replaceWith(...elements);
    return fragment;
  },
};

export { TableauCodesPromoView };
