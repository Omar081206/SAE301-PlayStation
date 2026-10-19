import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Textes de chaque usage du formulaire : créer une catégorie, ou modifier
// celle qu'on a choisie dans la liste.
const MODES = {
  creation: { titre: "Nouvelle catégorie", bouton: "Créer la catégorie" },
  modification: { titre: "Modifier la catégorie", bouton: "Enregistrer" },
};

// Formulaire de création ou de modification d'une catégorie. Il ne conserve
// rien et ne décide de rien : il transmet la saisie, et c'est le serveur qui
// la valide (nom libre, longueurs).
let FormulaireCategorieView = {
  html: function (data) {
    return genericRenderer(template, { ...MODES[data.mode], nom: data.nom, description: data.description });
  },

  /**
   * @param {{mode: "creation"|"modification", nom: string, description: string,
   *          erreur: string|null}} data
   * @param {{surEnvoi: (nom: string, description: string) => void,
   *          surAnnulation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireCategorieView.html(data));
    let formulaire = fragment.querySelector("form");

    fragment
      .querySelector('slot[name="message"]')
      .replaceWith(MessageView.dom(data.erreur === null ? null : { type: "erreur", texte: data.erreur }));

    // État réglé en JS : un template n'a pas de condition. Une création n'a
    // rien à annuler.
    let annuler = fragment.querySelector('[data-action="annuler"]');
    if (data.mode === "creation") {
      annuler.remove();
    } else {
      annuler.addEventListener("click", () => actions.surAnnulation());
    }

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      actions.surEnvoi(formulaire.elements.nom.value.trim(), formulaire.elements.description.value.trim());
    });

    return fragment;
  },
};

export { FormulaireCategorieView };
