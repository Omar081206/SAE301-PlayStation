import { ModaleView } from "../modale/index.js";
import template from "./template.html?raw";

// Fenêtre de confirmation avant de supprimer un produit (la fenêtre elle-même
// est ui/modale ; l'explication est dans le template).
let ConfirmationProduitView = {
  /**
   * @param {{nom: string, erreur: string|null}} data
   * @param {{surConfirmation: () => void, surRetour: () => void}} actions
   */
  dom: function (data, actions) {
    return ModaleView.dom(
      {
        titre: `Supprimer le produit « ${data.nom} » ?`,
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

export { ConfirmationProduitView };
