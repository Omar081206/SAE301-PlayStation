import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Carte « Mes informations » de l'espace personnel : nom et adresse e-mail,
// tels que les renvoie l'API, et le lien vers le profil.
let InformationsCompteView = {
  html: function (profil) {
    return genericRenderer(template, { nomComplet: `${profil.prenom} ${profil.nom}`.trim(), email: profil.email });
  },

  /**
   * @param {{prenom: string, nom: string, email: string}} profil
   */
  dom: function (profil) {
    return htmlToFragment(InformationsCompteView.html(profil));
  },
};

export { InformationsCompteView };
