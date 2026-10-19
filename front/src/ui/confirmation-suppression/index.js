import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";
import templateOption from "./option.html?raw";

// Demande de confirmation avant de supprimer une catégorie. Si elle contient
// des produits, l'administrateur choisit la catégorie qui les recevra : aucun
// produit ne reste sans catégorie. Le composant ne décide de rien : il
// transmet le choix, et c'est le serveur qui supprime ou refuse.
let ConfirmationSuppressionView = {
  /**
   * @param {{categorie: {id: number, nom: string, nombre: number},
   *          autres: Array<{id: number, nom: string}>, erreur: string|null}} data
   *   autres : les catégories qui peuvent recevoir les produits.
   * @param {{surConfirmation: (destination: number|null) => void,
   *          surAnnulation: () => void}} actions
   *   destination : null pour une catégorie vide.
   */
  dom: function (data, actions) {
    let nombre = data.categorie.nombre;
    let explication =
      nombre === 0
        ? "Elle ne contient aucun produit. La suppression est définitive."
        : `Elle contient ${nombre > 1 ? `${nombre} produits` : "1 produit"} : ${nombre > 1 ? "ils seront déplacés" : "il sera déplacé"} vers la catégorie choisie. La suppression est définitive.`;

    let fragment = htmlToFragment(genericRenderer(template, { nom: data.categorie.nom, explication }));
    let formulaire = fragment.querySelector("form");

    fragment
      .querySelector('slot[name="message"]')
      .replaceWith(MessageView.dom(data.erreur === null ? null : { type: "erreur", texte: data.erreur }));

    // État réglé en JS : un template n'a pas de condition.
    if (nombre === 0) {
      fragment.querySelector('[data-role="destination"]').remove();
    } else {
      let options = data.autres.map((autre) => htmlToFragment(genericRenderer(templateOption, autre)));
      formulaire.elements.destination.append(...options);
    }

    fragment.querySelector('[data-action="annuler"]').addEventListener("click", () => actions.surAnnulation());

    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      let choix = formulaire.elements.destination;
      actions.surConfirmation(choix === undefined ? null : Number(choix.value));
    });

    return fragment;
  },
};

export { ConfirmationSuppressionView };
