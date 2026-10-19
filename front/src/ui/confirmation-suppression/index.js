import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { ModaleView } from "../modale/index.js";
import template from "./template.html?raw";
import templateOption from "./option.html?raw";

// Fenêtre de confirmation avant de supprimer une catégorie. Si elle contient
// des produits, l'administrateur choisit la catégorie qui les recevra : aucun
// produit ne reste sans catégorie. Le composant ne décide de rien : il
// transmet le choix, et c'est le serveur qui supprime ou refuse.
let ConfirmationSuppressionView = {
  /**
   * @param {{categorie: {id: number, nom: string, nombre: number},
   *          autres: Array<{id: number, nom: string}>, erreur: string|null}} data
   *   autres : les catégories qui peuvent recevoir les produits.
   * @param {{surConfirmation: (destination: number|null) => void,
   *          surRetour: () => void}} actions
   *   destination : null pour une catégorie vide.
   */
  dom: function (data, actions) {
    let nombre = data.categorie.nombre;
    let contenu = null;

    if (nombre > 0) {
      contenu = htmlToFragment(template);
      let options = data.autres.map((autre) => htmlToFragment(genericRenderer(templateOption, autre)));
      contenu.querySelector("select").append(...options);
    }

    return ModaleView.dom(
      {
        titre: `Supprimer la catégorie « ${data.categorie.nom} » ?`,
        texte:
          nombre === 0
            ? "Cette catégorie ne contient aucun produit. La suppression est définitive."
            : `Cette catégorie contient ${nombre > 1 ? `${nombre} produits` : "1 produit"}. Choisissez la catégorie qui les recevra avant de supprimer.`,
        retour: "Annuler",
        confirmer: nombre === 0 ? "Supprimer" : "Réaffecter et supprimer",
        erreur: data.erreur,
        contenu,
      },
      {
        surConfirmation: (champs) =>
          actions.surConfirmation(champs.has("destination") ? Number(champs.get("destination")) : null),
        surRetour: actions.surRetour,
      }
    );
  },
};

export { ConfirmationSuppressionView };
