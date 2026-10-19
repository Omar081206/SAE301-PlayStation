import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Fenêtre de confirmation (<dialog> natif) : un titre, une explication, un
// contenu éventuel (champ à remplir) et deux boutons. La page l'ouvre avec
// showModal() une fois insérée : le focus reste dans la fenêtre et Échap la
// ferme. La fenêtre ne décide de rien : elle signale la confirmation (avec
// les champs du formulaire) ou le retour.
let ModaleView = {
  html: function (data) {
    return genericRenderer(template, data);
  },

  /**
   * @param {{titre: string, texte: string, retour: string, confirmer: string,
   *          erreur: string|null, contenu: DocumentFragment|null}} data
   *   retour, confirmer : libellés des deux boutons ; contenu : champs
   *   ajoutés au formulaire de la fenêtre.
   * @param {{surConfirmation: (champs: FormData) => void, surRetour: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(ModaleView.html(data));
    let fenetre = fragment.querySelector("dialog");
    let formulaire = fragment.querySelector("form");

    fragment
      .querySelector('slot[name="message"]')
      .replaceWith(MessageView.dom(data.erreur === null ? null : { type: "erreur", texte: data.erreur }));
    fragment.querySelector('slot[name="contenu"]').replaceWith(data.contenu ?? "");

    fragment.querySelector('[data-action="retour"]').addEventListener("click", () => actions.surRetour());

    // Échap : le navigateur fermerait la fenêtre sans prévenir la page ; on
    // passe par le retour, pour que le modèle de la page suive.
    fenetre.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      actions.surRetour();
    });

    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      actions.surConfirmation(new FormData(formulaire));
    });

    return fragment;
  },
};

export { ModaleView };
