import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateJour from "./jour.html?raw";
import templateVide from "./vide.html?raw";

/**
 * « 2026-10-15 » -> « 15/10 », comme sur la maquette.
 */
function formaterJour(jour) {
  let [, mois, date] = jour.split("-");
  return `${date}/${mois}`;
}

// Revenus de chaque jour de la période, puis leur total, tels que les renvoie
// l'API : { jours: [{ jour, total }], total }. Sans aucune vente, un texte
// remplace la liste.
let RevenusSemaineView = {
  /**
   * @param {{periode: number, revenus: {jours: Array<{jour: string, total: number}>, total: number}}} statistiques
   */
  dom: function (statistiques) {
    let titre = `Revenus des ${statistiques.periode} derniers jours`;
    let revenus = statistiques.revenus;

    if (revenus.total === 0) {
      return htmlToFragment(genericRenderer(templateVide, { titre }));
    }

    let fragment = htmlToFragment(genericRenderer(template, { titre, total: formaterPrix(revenus.total) }));
    let jours = revenus.jours.map((jour) =>
      htmlToFragment(genericRenderer(templateJour, { jour: formaterJour(jour.jour), total: formaterPrix(jour.total) }))
    );
    fragment.querySelector('slot[name="jours"]').replaceWith(...jours);

    return fragment;
  },
};

export { RevenusSemaineView };
