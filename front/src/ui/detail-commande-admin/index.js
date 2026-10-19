import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateArticle from "./article.html?raw";
import templateEvenement from "./evenement.html?raw";
import templateBouton from "./bouton.html?raw";
import templateJournalVide from "./journal-vide.html?raw";

// Date et heure : « 13/10/2026 15:40 ». MySQL renvoie « 2026-10-13 15:40:01 ».
const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

// Bouton de chaque statut vers lequel une commande peut passer. Les classes
// sont écrites en entier, comme dans ui/message.
const BOUTONS = {
  disponible: { libelle: "Passer à « disponible »", couleurs: "bg-action text-texte-inverse" },
  retiree: { libelle: "Passer à « retirée »", couleurs: "bg-action text-texte-inverse" },
  annulee: { libelle: "Annuler la commande", couleurs: "bg-secondaire text-lien" },
};

/**
 * « 2026-10-13 15:40:01 » -> « 13/10/2026 15:40 »
 */
function formaterDate(date) {
  return DATE.format(new Date(date.replace(" ", "T")));
}

// Détail d'une commande dans le back-office, tel que le renvoie l'API :
// articles (prix figés), total, client, journal des changements de statut,
// et les statuts vers lesquels elle peut passer (suivants), un bouton chacun.
// Le composant ne décide de rien : il signale le statut demandé.
let DetailCommandeAdminView = {
  /**
   * @param {{numero: string, statut: string, total: number,
   *          client: {prenom: string, nom: string, email: string},
   *          lignes: Array<{nom: string, coloris: string|null, quantite: number,
   *                         prix_unitaire: number, sous_total: number}>,
   *          historique: Array<{ancien: string, nouveau: string, le: string, par: string|null}>,
   *          suivants: string[]}} commande
   * @param {{surStatut: (statut: string) => void}} actions
   */
  dom: function (commande, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        numero: commande.numero,
        total: formaterPrix(commande.total),
        client: `${commande.client.prenom} ${commande.client.nom}`.trim(),
        email: commande.client.email,
      })
    );

    fragment.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));

    // Chaque article donne une ligne du tableau (lg) et un bloc (mobile).
    let lignes = [];
    let articles = [];
    for (let ligne of commande.lignes) {
      let donnees = {
        nom: ligne.nom,
        options: ligne.coloris ?? "—",
        quantite: ligne.quantite,
        prixUnitaire: formaterPrix(ligne.prix_unitaire),
        sousTotal: formaterPrix(ligne.sous_total),
      };
      lignes.push(htmlToFragment(genericRenderer(templateLigne, donnees)));
      articles.push(htmlToFragment(genericRenderer(templateArticle, donnees)));
    }
    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="articles"]').replaceWith(...articles);

    let evenements = commande.historique.map((evenement) =>
      htmlToFragment(
        genericRenderer(templateEvenement, {
          date: formaterDate(evenement.le),
          texte: `${evenement.par ?? "administrateur supprimé"} : statut « ${BadgeStatutView.libelle(evenement.ancien).toLowerCase()} » → « ${BadgeStatutView.libelle(evenement.nouveau).toLowerCase()} »`,
        })
      )
    );
    if (evenements.length === 0) {
      evenements.push(htmlToFragment(templateJournalVide));
    }
    fragment.querySelector('slot[name="journal"]').replaceWith(...evenements);

    // Une commande retirée ou annulée n'a plus de bouton.
    let boutons = commande.suivants.map((statut) => {
      let bouton = htmlToFragment(genericRenderer(templateBouton, { statut, ...BOUTONS[statut] }));
      bouton.firstElementChild.addEventListener("click", () => actions.surStatut(statut));
      return bouton;
    });
    fragment.querySelector('slot[name="boutons"]').replaceWith(...boutons);

    return fragment;
  },
};

export { DetailCommandeAdminView };
