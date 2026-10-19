import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Carte affichée à la place des formulaires quand l'utilisateur est connecté.
let CompteConnecteView = {
  html: function (session) {
    // Une session ouverte avant l'arrivée des prénoms n'en a pas.
    let nomComplet = `${session.prenom ?? ""} ${session.nom ?? ""}`.trim();
    return genericRenderer(template, { email: session.email, nomComplet: nomComplet || "Mon compte" });
  },

  /**
   * @param {{email: string, prenom: string|null, nom: string|null}} session
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
