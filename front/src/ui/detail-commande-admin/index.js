import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateEvenement from "./evenement.html?raw";
import templateBouton from "./bouton.html?raw";

// Date et heure : « 19/10/2026 09:42 ». MySQL renvoie « 2026-10-19 09:42:01 ».
const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

// Bouton de chaque statut vers lequel une commande peut passer. Les classes
// sont écrites en entier, comme dans ui/message.
const BOUTONS = {
  disponible: { libelle: "Marquer disponible", couleurs: "bg-action text-texte-inverse" },
  retiree: { libelle: "Marquer retirée", couleurs: "bg-action text-texte-inverse" },
  annulee: { libelle: "Annuler la commande", couleurs: "bg-secondaire text-red-700" },
};

/**
 * « 2026-10-19 09:42:01 » -> « 19/10/2026 09:42 »
 */
function formaterDate(date) {
  return DATE.format(new Date(date.replace(" ", "T")));
}

// Détail d'une commande dans le back-office, tel que le renvoie l'API :
// client, lignes (prix figés), total, historique des changements de statut,
// et les statuts vers lesquels elle peut passer (suivants), un bouton chacun.
// Le composant ne décide de rien : il signale le statut demandé.
let DetailCommandeAdminView = {
  /**
   * @param {{numero: string, statut: string, total: number, cree_le: string,
   *          client: {pseudo: string, email: string},
   *          lignes: Array<{nom: string, coloris: string|null, quantite: number, sous_total: number}>,
   *          historique: Array<{ancien: string, nouveau: string, le: string, par: string|null}>,
   *          suivants: string[]}} commande
   * @param {{surStatut: (statut: string) => void}} actions
   */
  dom: function (commande, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        numero: commande.numero,
        date: formaterDate(commande.cree_le),
        pseudo: commande.client.pseudo,
        email: commande.client.email,
        total: formaterPrix(commande.total),
      })
    );

    fragment.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));

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

    // La création ouvre l'historique ; chaque changement de statut suit.
    let evenements = [
      { texte: "Commande passée", date: formaterDate(commande.cree_le), par: commande.client.pseudo },
      ...commande.historique.map((evenement) => ({
        texte: `${BadgeStatutView.libelle(evenement.ancien)} → ${BadgeStatutView.libelle(evenement.nouveau)}`,
        date: formaterDate(evenement.le),
        par: evenement.par ?? "administrateur supprimé",
      })),
    ].map((evenement) => htmlToFragment(genericRenderer(templateEvenement, evenement)));
    fragment.querySelector('slot[name="historique"]').replaceWith(...evenements);

    // État réglé en JS : un template n'a pas de condition. Une commande
    // retirée ou annulée n'a plus de bouton.
    if (commande.suivants.length === 0) {
      fragment.querySelector('[data-role="actions"]').remove();
    } else {
      fragment.querySelector('[data-role="finale"]').remove();
      let boutons = commande.suivants.map((statut) => {
        let bouton = htmlToFragment(genericRenderer(templateBouton, { statut, ...BOUTONS[statut] }));
        bouton.firstElementChild.addEventListener("click", () => actions.surStatut(statut));
        return bouton;
      });
      fragment.querySelector('slot[name="boutons"]').replaceWith(...boutons);
    }

    return fragment;
  },
};

export { DetailCommandeAdminView };
