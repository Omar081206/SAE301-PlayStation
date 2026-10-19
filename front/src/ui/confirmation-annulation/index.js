import { genericRenderer } from "../../lib/utils.js";
import { ModaleView } from "../modale/index.js";
import template from "./template.html?raw";
import templateLot from "./lot.html?raw";

// Fenêtre de confirmation avant d'annuler une ou plusieurs commandes : une
// annulation rend le stock et ne se défait pas. Les explications sont dans
// les templates ; la fenêtre elle-même est ui/modale.
let ConfirmationAnnulationView = {
  /**
   * @param {{numeros: string[], articles: number, erreur: string|null}} data
   *   articles : nombre d'articles de la commande (une seule commande).
   * @param {{surConfirmation: () => void, surRetour: () => void}} actions
   */
  dom: function (data, actions) {
    let seule = data.numeros.length === 1;
    let remise =
      data.articles > 1
        ? `Les ${data.articles} articles de cette commande seront remis en stock.`
        : "L’article de cette commande sera remis en stock.";

    return ModaleView.dom(
      {
        titre: seule ? `Annuler la commande ${data.numeros[0]} ?` : `Annuler ${data.numeros.length} commandes ?`,
        // Explications : template.html (une commande), lot.html (plusieurs).
        texte: seule ? genericRenderer(template, { remise }).trim() : templateLot.trim(),
        retour: seule ? "Garder la commande" : "Garder les commandes",
        confirmer: "Confirmer l’annulation",
        erreur: data.erreur,
        contenu: null,
      },
      { surConfirmation: () => actions.surConfirmation(), surRetour: actions.surRetour }
    );
  },
};

export { ConfirmationAnnulationView };
