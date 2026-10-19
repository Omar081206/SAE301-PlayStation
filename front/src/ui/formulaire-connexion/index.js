import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import logo from "../../assets/logo-playstation.svg";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Carte de connexion au back-office. Elle ne conserve rien et ne décide de
// rien : elle transmet les identifiants saisis, et c'est le serveur qui
// accepte ou refuse. La déconnexion se fait depuis la navigation du back-office.
let FormulaireConnexionView = {
  html: function (data) {
    return genericRenderer(template, { logo, email: data.email });
  },

  /**
   * @param {{email: string, erreur: string|null}} data  Adresse à pré-remplir,
   *   refus du serveur à afficher.
   * @param {{surConnexion: (email: string, mdp: string) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireConnexionView.html(data));
    let formulaire = fragment.querySelector("form");

    fragment
      .querySelector('slot[name="message"]')
      .replaceWith(MessageView.dom(data.erreur === null ? null : { type: "erreur", texte: data.erreur }));

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      actions.surConnexion(formulaire.elements.email.value.trim(), formulaire.elements.mdp.value);
    });

    return fragment;
  },
};

export { FormulaireConnexionView };
