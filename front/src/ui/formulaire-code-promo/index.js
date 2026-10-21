import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Textes de chaque usage du formulaire : créer un code, ou modifier celui
// qu'on a choisi dans la liste.
const MODES = {
  creation: { titre: "Nouveau code promo", bouton: "Créer le code" },
  modification: { titre: "Modifier le code promo", bouton: "Enregistrer" },
};

// Formulaire de création ou de modification d'un code promo. Il ne conserve
// rien et ne décide de rien : il transmet la saisie, et c'est le serveur qui
// la valide (forme du code, bornes de la réduction) et la met en majuscules.
let FormulaireCodePromoView = {
  html: function (data) {
    return genericRenderer(template, { ...MODES[data.mode], code: data.code, pourcentage: data.pourcentage });
  },

  /**
   * @param {{mode: "creation"|"modification", code: string, pourcentage: string,
   *          erreur: string|null}} data
   * @param {{surEnvoi: (code: string, pourcentage: string) => void,
   *          surAnnulation: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireCodePromoView.html(data));
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
      actions.surEnvoi(formulaire.elements.code.value.trim(), formulaire.elements.pourcentage.value.trim());
    });

    return fragment;
  },
};

export { FormulaireCodePromoView };
