import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Demande de confirmation avant d'annuler une ou plusieurs commandes : une
// annulation rend le stock et ne se défait pas. Le composant ne décide de
// rien : il signale la réponse de l'administrateur.
let ConfirmationAnnulationView = {
  html: function (numeros) {
    let titre = numeros.length === 1 ? `Annuler la commande ${numeros[0]} ?` : `Annuler ${numeros.length} commandes ?`;
    let explication =
      numeros.length === 1
        ? "Les articles de la commande seront remis en stock. Une commande annulée ne peut plus changer de statut."
        : "Les articles de ces commandes seront remis en stock. Les commandes déjà retirées ou annulées ne changeront pas. Une commande annulée ne peut plus changer de statut.";
    return genericRenderer(template, { titre, explication });
  },

  /**
   * @param {string[]} numeros  Commandes à annuler.
   * @param {{surConfirmation: () => void, surRetour: () => void}} actions
   */
  dom: function (numeros, actions) {
    let fragment = htmlToFragment(ConfirmationAnnulationView.html(numeros));

    fragment.querySelector('[data-action="confirmer"]').addEventListener("click", () => actions.surConfirmation());
    fragment.querySelector('[data-action="retour"]').addEventListener("click", () => actions.surRetour());

    return fragment;
  },
};

export { ConfirmationAnnulationView };
