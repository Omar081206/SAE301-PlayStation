import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Carte affichée à la place des formulaires quand l'utilisateur est connecté.
let CompteConnecteView = {
  html: function (session) {
    return genericRenderer(template, { email: session.email });
  },

  /**
   * @param {{email: string}} session
   * @param {{surDeconnexion: () => void}} actions
   */
  dom: function (session, actions) {
    let fragment = htmlToFragment(CompteConnecteView.html(session));

    fragment
      .querySelector('[data-action="deconnexion"]')
      .addEventListener("click", () => actions.surDeconnexion());

    return fragment;
  },
};

export { CompteConnecteView };
