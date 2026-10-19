import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Détail d'une commande du client, tel que le renvoie l'API : articles
// (prix figés, options choisies) et total, puis le bouton
// « Commander à nouveau ». Le composant ne décide de rien : il signale la
// demande, et la page remet les articles au panier.
let DetailCommandeClientView = {
  /**
   * @param {{total: number,
   *          lignes: Array<{nom: string, options: string|null, quantite: number, sous_total: number}>}} commande
   *   options : les options choisies, en texte (« Coloris : Noir »).
   * @param {{surRenouvellement: () => void}} actions
   */
  dom: function (commande, actions) {
    let fragment = htmlToFragment(genericRenderer(template, { total: formaterPrix(commande.total) }));

    let lignes = commande.lignes.map((ligne) => {
      let element = htmlToFragment(
        genericRenderer(templateLigne, {
          nom: ligne.nom,
          options: ligne.options ?? "",
          quantite: ligne.quantite,
          sousTotal: formaterPrix(ligne.sous_total),
        })
      );
      // État réglé en JS : un template n'a pas de condition. Pas d'option :
      // rien à afficher.
      if (ligne.options === null) {
        element.querySelector('[data-role="options"]').remove();
      }
      return element;
    });
    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

    fragment
      .querySelector('[data-action="renouveler"]')
      .addEventListener("click", () => actions.surRenouvellement());

    return fragment;
  },
};

export { DetailCommandeClientView };
