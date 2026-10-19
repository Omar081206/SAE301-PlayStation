import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Confirmation d'une commande enregistrée, telle que la renvoie l'API : son
// numéro, son statut, ses lignes (prix figés au moment de la commande) et son
// total. Chaque ligne prend place dans le <slot name="lignes">, le badge du
// statut dans le <slot name="statut">.
let ConfirmationCommandeView = {
  /**
   * @param {{numero: string, statut: string, total: number,
   *          lignes: Array<{nom: string, options: string|null, quantite: number, sous_total: number}>}} commande
   */
  dom: function (commande) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        numero: commande.numero,
        total: formaterPrix(commande.total),
      })
    );

    let lignes = commande.lignes.map((ligne) =>
      htmlToFragment(
        genericRenderer(templateLigne, {
          nom: ligne.nom,
          details: ligne.options === null ? `Qté ${ligne.quantite}` : `${ligne.options} · Qté ${ligne.quantite}`,
          sousTotal: formaterPrix(ligne.sous_total),
        })
      )
    );
    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);
    fragment.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));

    return fragment;
  },
};

export { ConfirmationCommandeView };
