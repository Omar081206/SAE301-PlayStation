import { ModaleView } from "../modale/index.js";
import template from "./template.html?raw";

// Fenêtre de confirmation avant de supprimer un code promo (la fenêtre
// elle-même est ui/modale ; l'explication est dans le template).
let ConfirmationCodePromoView = {
  /**
   * @param {{code: string, erreur: string|null}} data
   * @param {{surConfirmation: () => void, surRetour: () => void}} actions
   */
  dom: function (data, actions) {
    return ModaleView.dom(
      {
        titre: `Supprimer le code « ${data.code} » ?`,
        texte: template.trim(),
        retour: "Annuler",
        confirmer: "Supprimer",
        erreur: data.erreur,
        contenu: null,
      },
      { surConfirmation: () => actions.surConfirmation(), surRetour: actions.surRetour }
    );
  },
};

export { ConfirmationCodePromoView };
