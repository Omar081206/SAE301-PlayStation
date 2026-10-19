import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Formulaire « Mon profil » : prénom, nom, adresse e-mail et changement de
// mot de passe. Il ne conserve rien et ne décide de rien : il transmet la
// saisie, et c'est le serveur qui la valide (mot de passe actuel compris).
let FormulaireProfilView = {
  html: function (data) {
    return genericRenderer(template, { ...data.profil, erreur: data.erreurMdp ?? "" });
  },

  /**
   * @param {{profil: {prenom: string, nom: string, email: string}, erreurMdp: string|null}} data
   *   profil : valeurs à pré-remplir ; erreurMdp : erreur sur le mot de
   *   passe actuel, affichée sous le champ.
   * @param {{surEnvoi: (saisie: {prenom: string, nom: string, email: string,
   *          mdpActuel: string, nouveauMdp: string}) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireProfilView.html(data));
    let formulaire = fragment.querySelector("form");

    // État réglé en JS : un template n'a pas de condition.
    if (data.erreurMdp === null) {
      fragment.querySelector('[data-role="erreur-mdp"]').remove();
    } else {
      formulaire.elements.mdpActuel.setAttribute("aria-invalid", "true");
    }

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      let champs = formulaire.elements;
      actions.surEnvoi({
        prenom: champs.prenom.value.trim(),
        nom: champs.nom.value.trim(),
        email: champs.email.value.trim(),
        mdpActuel: champs.mdpActuel.value,
        nouveauMdp: champs.nouveauMdp.value,
      });
    });

    return fragment;
  },
};

export { FormulaireProfilView };
