import { ModaleView } from "../modale/index.js";
import template from "./template.html?raw";

// Fenêtre de confirmation avant de vider le panier (la fenêtre elle-même
// est ui/modale ; l'explication est dans le template).
let ConfirmationPanierView = {
  /**
   * @param {{nombre: number}} data  nombre : articles du panier (somme des quantités).
   * @param {{surConfirmation: () => void, surRetour: () => void}} actions
   */
  dom: function (data, actions) {
    return ModaleView.dom(
      {
        titre: `Vider le panier (${data.nombre > 1 ? `${data.nombre} articles` : "1 article"}) ?`,
        texte: template.trim(),
        retour: "Annuler",
        confirmer: "Vider le panier",
        erreur: null,
        contenu: null,
      },
      { surConfirmation: () => actions.surConfirmation(), surRetour: actions.surRetour }
    );
  },
};

export { ConfirmationPanierView };
