import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";

// Libellé et couleurs du badge de chaque statut. Les classes sont écrites en
// entier, comme dans ui/message.
const STATUTS = {
  en_cours: { libelle: "En cours", couleurs: "bg-action text-texte-inverse" },
  disponible: { libelle: "Disponible", couleurs: "bg-succes text-texte-inverse" },
  retiree: { libelle: "Retirée", couleurs: "bg-trait text-texte" },
  annulee: { libelle: "Annulée", couleurs: "bg-trait text-texte-attenue" },
};

// Confirmation d'une commande enregistrée, telle que la renvoie l'API : son
// numéro, son statut, ses lignes (prix figés au moment de la commande) et son
// total. Chaque ligne prend place dans le <slot name="lignes">.
let ConfirmationCommandeView = {
  /**
   * @param {{numero: string, statut: string, total: number,
   *          lignes: Array<{nom: string, coloris: string|null, quantite: number, sous_total: number}>}} commande
   */
  dom: function (commande) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        numero: commande.numero,
        statut: STATUTS[commande.statut].libelle,
        couleursStatut: STATUTS[commande.statut].couleurs,
        total: formaterPrix(commande.total),
      })
    );

    let lignes = commande.lignes.map((ligne) =>
      htmlToFragment(
        genericRenderer(templateLigne, {
          nom: ligne.nom,
          details: ligne.coloris === null ? `Qté ${ligne.quantite}` : `Coloris : ${ligne.coloris} · Qté ${ligne.quantite}`,
          sousTotal: formaterPrix(ligne.sous_total),
        })
      )
    );
    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

    return fragment;
  },
};

export { ConfirmationCommandeView };
