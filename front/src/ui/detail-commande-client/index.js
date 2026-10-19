import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Détail d'une commande du client, tel que le renvoie l'API : statut,
// articles (prix figés, options choisies) et total.
let DetailCommandeClientView = {
  /**
   * @param {{statut: string, total: number,
   *          lignes: Array<{nom: string, coloris: string|null, quantite: number, sous_total: number}>}} commande
   */
  dom: function (commande) {
    let fragment = htmlToFragment(genericRenderer(template, { total: formaterPrix(commande.total) }));

    fragment.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));

    let lignes = commande.lignes.map((ligne) => {
      let element = htmlToFragment(
        genericRenderer(templateLigne, {
          nom: ligne.nom,
          coloris: ligne.coloris ?? "",
          quantite: ligne.quantite,
          sousTotal: formaterPrix(ligne.sous_total),
        })
      );
      // État réglé en JS : un template n'a pas de condition. Pas de
      // coloris : pas d'option à afficher.
      if (ligne.coloris === null) {
        element.querySelector('[data-role="options"]').remove();
      }
      return element;
    });
    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

    return fragment;
  },
};

export { DetailCommandeClientView };
