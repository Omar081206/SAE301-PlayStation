import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Formulaire de connexion au back-office. Il ne conserve rien et ne décide de
// rien : il transmet les identifiants saisis, et c'est le serveur qui accepte
// ou refuse. La déconnexion se fait depuis la navigation du back-office.
let FormulaireConnexionView = {
  html: function (data) {
    return genericRenderer(template, data);
  },

  /**
   * @param {{identifiant: string}} data  Pseudo ou adresse à pré-remplir.
   * @param {{surConnexion: (identifiant: string, mdp: string) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireConnexionView.html(data));
    let formulaire = fragment.querySelector("form");

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      actions.surConnexion(formulaire.elements.identifiant.value.trim(), formulaire.elements.mdp.value);
    });

    return fragment;
  },
};

export { FormulaireConnexionView };
