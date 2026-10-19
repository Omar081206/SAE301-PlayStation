import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateCarte from "./carte.html?raw";

// Date d'une commande : « 13/10/2026 ». MySQL renvoie « 2026-10-13 09:42:01 ».
const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

// Commandes d'un client, telles que les renvoie l'API : { numero, statut,
// total, cree_le }, la plus récente d'abord. Chaque commande donne une ligne
// du tableau (à partir de lg) et une carte (en dessous), avec un lien vers son
// détail. Partagé par l'accueil de l'espace personnel et l'historique.
let ListeCommandesClientView = {
  /**
   * @param {{commandes: Array<{numero: string, statut: string, total: number, cree_le: string}>,
   *          legende: string}} data  legende : titre du tableau, pour les lecteurs d'écran.
   */
  dom: function (data) {
    let fragment = htmlToFragment(genericRenderer(template, { legende: data.legende }));
    let lignes = [];
    let cartes = [];

    for (let commande of data.commandes) {
      let donnees = {
        numero: commande.numero,
        date: DATE.format(new Date(commande.cree_le.replace(" ", "T"))),
        total: formaterPrix(commande.total),
      };

      for (let [modele, liste] of [
        [templateLigne, lignes],
        [templateCarte, cartes],
      ]) {
        let element = htmlToFragment(genericRenderer(modele, donnees));
        element.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));
        liste.push(element);
      }
    }

    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);
    return fragment;
  },
};

export { ListeCommandesClientView };
