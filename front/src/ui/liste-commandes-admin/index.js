import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStatutView } from "../badge-statut/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateVide from "./vide.html?raw";

// Date et heure d'une commande : « 19/10/2026 09:42 ». MySQL renvoie
// « 2026-10-19 09:42:01 », heure du serveur.
const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

// Liste des commandes du back-office, telles que les renvoie l'API :
// { numero, statut, total, cree_le, client, articles }. Le composant ne
// décide de rien : il affiche le tri et la sélection reçus, et signale les
// demandes de tri et les cases cochées.
let ListeCommandesAdminView = {
  /**
   * @param {{commandes: Array<{numero: string, statut: string, total: number,
   *          cree_le: string, client: string, articles: number}>,
   *          tri: "date"|"statut"|"montant", sens: "asc"|"desc", selection: string[]}} data
   *   selection : numéros des commandes cochées.
   * @param {{surTri: (tri: string) => void,
   *          surSelection: (numeros: string[], coche: boolean) => void}} actions
   */
  dom: function (data, actions) {
    if (data.commandes.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);

    let lignes = data.commandes.map((commande) => {
      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          numero: commande.numero,
          date: DATE.format(new Date(commande.cree_le.replace(" ", "T"))),
          client: commande.client,
          articles: commande.articles,
          total: formaterPrix(commande.total),
        })
      );
      ligne.querySelector('slot[name="statut"]').replaceWith(BadgeStatutView.dom(commande.statut));

      let caseACocher = ligne.querySelector('[data-action="choisir"]');
      caseACocher.checked = data.selection.includes(commande.numero);
      caseACocher.addEventListener("change", () => actions.surSelection([commande.numero], caseACocher.checked));
      return ligne;
    });
    fragment.querySelector("tbody").append(...lignes);

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

    // État réglé en JS : un template n'a pas de condition.
    let colonne = fragment.querySelector(`[data-colonne="${data.tri}"]`);
    colonne.setAttribute("aria-sort", data.sens === "asc" ? "ascending" : "descending");
    colonne.querySelector('[data-role="fleche"]').textContent = data.sens === "asc" ? "↑" : "↓";

    for (let bouton of fragment.querySelectorAll("[data-tri]")) {
      bouton.addEventListener("click", () => actions.surTri(bouton.dataset.tri));
    }

    return fragment;
  },
};

export { ListeCommandesAdminView };
