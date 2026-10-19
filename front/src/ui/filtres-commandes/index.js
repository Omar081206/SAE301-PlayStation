import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateStatut from "./statut.html?raw";

// Filtres de l'historique : un bouton par statut (avec le nombre de commandes
// de ce statut sur la période), « Tous », et la période. Le filtre choisi
// reçoit aria-pressed. Le composant ne décide de rien : il signale le choix.
let FiltresCommandesView = {
  /**
   * @param {{statut: string|null, periode: string,
   *          compteurs: {en_cours: number, disponible: number, retiree: number, annulee: number}}} data
   *   statut : filtre choisi, ou null pour tous ; periode : 30j, 6m, 12m ou tout.
   * @param {{surStatut: (statut: string|null) => void, surPeriode: (periode: string) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(template);
    let total = Object.values(data.compteurs).reduce((somme, nombre) => somme + nombre, 0);

    let boutons = [{ statut: "", libelle: "Tous", nombre: total }].concat(
      Object.entries(data.compteurs).map(([statut, nombre]) => ({ statut, libelle: BadgeStatutView.libelle(statut), nombre }))
    );

    let elements = boutons.map((bouton) => {
      let element = htmlToFragment(genericRenderer(templateStatut, bouton));
      let statut = bouton.statut === "" ? null : bouton.statut;
      element.firstElementChild.setAttribute("aria-pressed", String(statut === data.statut));
      element.firstElementChild.addEventListener("click", () => actions.surStatut(statut));
      return element;
    });
    fragment.querySelector('slot[name="statuts"]').replaceWith(...elements);

    let periode = fragment.querySelector('[data-role="periode"]');
    periode.value = data.periode;
    periode.addEventListener("change", () => actions.surPeriode(periode.value));

    return fragment;
  },
};

export { FiltresCommandesView };
