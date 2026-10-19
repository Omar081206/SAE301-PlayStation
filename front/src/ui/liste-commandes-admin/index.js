import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateCarte from "./carte.html?raw";
import templateActions from "./actions.html?raw";
import templateVide from "./vide.html?raw";

// Dates d'une commande : « 13/10/2026 » (tableau) et « 13/10 » (cartes).
// MySQL renvoie « 2026-10-13 09:42:01 ».
const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

/**
 * Boutons d'une commande : un par statut permis (suivants), « — » s'il n'y
 * en a aucun, et le lien vers le détail.
 */
function actionsCommande(commande, surStatut) {
  let fragment = htmlToFragment(genericRenderer(templateActions, { numero: commande.numero }));

  for (let bouton of fragment.querySelectorAll("[data-statut]")) {
    if (commande.suivants.includes(bouton.dataset.statut)) {
      bouton.addEventListener("click", () => surStatut(commande.numero, bouton.dataset.statut));
    } else {
      bouton.remove();
    }
  }
  if (commande.suivants.length > 0) {
    fragment.querySelector('[data-role="aucune"]').remove();
  }

  return fragment;
}

// Liste des commandes du back-office, telles que les renvoie l'API :
// { numero, statut, total, cree_le, suivants }. Tableau à partir de lg,
// cartes en dessous. Le composant ne décide de rien : il affiche le tri et la
// sélection reçus, et signale les demandes (tri, cases cochées, statut).
let ListeCommandesAdminView = {
  /**
   * @param {{commandes: Array<{numero: string, statut: string, total: number,
   *          cree_le: string, suivants: string[]}>,
   *          tri: string, sens: "asc"|"desc", selection: string[], lot: DocumentFragment}} data
   *   selection : numéros cochés ; lot : barre des actions en lot.
   * @param {{surTri: (tri: string, sens: string|null) => void,
   *          surSelection: (numeros: string[], coche: boolean) => void,
   *          surStatut: (numero: string, statut: string) => void}} actions
   *   sens null : la page choisit (même colonne : sens inversé).
   */
  dom: function (data, actions) {
    if (data.commandes.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = [];
    let cartes = [];

    for (let commande of data.commandes) {
      let date = new Date(commande.cree_le.replace(" ", "T"));
      let donnees = {
        numero: commande.numero,
        date: DATE.format(date),
        dateCourte: DATE_COURTE.format(date),
        total: formaterPrix(commande.total),
      };
      let coche = data.selection.includes(commande.numero);

      for (let [modele, liste] of [
        [templateLigne, lignes],
        [templateCarte, cartes],
      ]) {
        let element = htmlToFragment(genericRenderer(modele, donnees));
        element.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));
        element.querySelector('slot[name="actions"]').replaceWith(actionsCommande(commande, actions.surStatut));

        // État réglé en JS : un template n'a pas de condition.
        let caseACocher = element.querySelector('[data-action="choisir"]');
        caseACocher.checked = coche;
        if (coche) {
          element.firstElementChild.classList.add("bg-tuile-claire");
        }
        caseACocher.addEventListener("change", () => actions.surSelection([commande.numero], caseACocher.checked));
        liste.push(element);
      }
    }

    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);
    fragment.querySelector('slot[name="lot"]').replaceWith(data.lot);

    // Case « tout » : cochée si tout est sélectionné, à moitié si une partie.
    let tout = fragment.querySelector('[data-action="tout"]');
    let nombre = data.commandes.filter((commande) => data.selection.includes(commande.numero)).length;
    tout.checked = nombre === data.commandes.length;
    tout.indeterminate = nombre > 0 && nombre < data.commandes.length;
    tout.addEventListener("change", () =>
      actions.surSelection(
        data.commandes.map((commande) => commande.numero),
        tout.checked
      )
    );

    // Tri en cours : flèche et aria-sort sur sa colonne, valeur de la liste.
    let colonne = fragment.querySelector(`[data-colonne="${data.tri}"]`);
    colonne.setAttribute("aria-sort", data.sens === "asc" ? "ascending" : "descending");
    colonne.querySelector('[data-role="fleche"]').textContent = data.sens === "asc" ? "↑" : "↓";

    for (let bouton of fragment.querySelectorAll("[data-tri]")) {
      bouton.addEventListener("click", () => actions.surTri(bouton.dataset.tri, null));
    }

    let liste = fragment.querySelector('[data-role="tri"]');
    liste.value = `${data.tri} ${data.sens}`;
    liste.addEventListener("change", () => {
      let [tri, sens] = liste.value.split(" ");
      actions.surTri(tri, sens);
    });

    return fragment;
  },
};

export { ListeCommandesAdminView };
