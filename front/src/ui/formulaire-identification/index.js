import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Les deux cartes de la page de connexion partagent ce template : seuls les
// textes, la couleur du bouton et l'aide à la saisie changent. Les classes
// sont écrites en entier, comme dans ui/message.
const MODES = {
  connexion: {
    titre: "J’ai déjà un compte",
    bouton: "Se connecter",
    autocomplete: "current-password",
    couleurs: "bg-action text-texte-inverse",
  },
  inscription: {
    titre: "Je crée mon compte",
    bouton: "Créer mon compte",
    autocomplete: "new-password",
    couleurs: "bg-secondaire text-lien",
  },
};

// Formulaire de connexion ou de création de compte. Il ne conserve rien et
// ne décide de rien : il transmet la saisie, et c'est le serveur qui accepte
// ou refuse.
let FormulaireIdentificationView = {
  html: function (data) {
    return genericRenderer(template, { ...MODES[data.mode], ...data.saisie });
  },

  /**
   * @param {{mode: "connexion"|"inscription", saisie: {prenom: string, nom: string, email: string},
   *          erreur: string|null, masqueEnMobile: boolean}} data
   *   saisie : dernières valeurs saisies, pour pré-remplir.
   *   masqueEnMobile : en dessous de lg, une seule carte est visible à la fois.
   * @param {{surEnvoi: (saisie: {prenom: string, nom: string, email: string, mdp: string}) => void}} actions
   *   prenom et nom : chaînes vides à la connexion.
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireIdentificationView.html(data));
    let formulaire = fragment.querySelector("form");

    fragment
      .querySelector('slot[name="message"]')
      .replaceWith(MessageView.dom(data.erreur === null ? null : { type: "erreur", texte: data.erreur }));

    // États réglés en JS : un template n'a pas de condition.
    if (data.mode === "inscription") {
      formulaire.elements.mdp.minLength = 8;
    } else {
      fragment.querySelector('[data-role="identite"]').remove();
    }
    if (data.masqueEnMobile) {
      fragment.firstElementChild.classList.add("hidden", "lg:flex");
    }

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      let champs = formulaire.elements;
      actions.surEnvoi({
        prenom: champs.prenom === undefined ? "" : champs.prenom.value.trim(),
        nom: champs.nom === undefined ? "" : champs.nom.value.trim(),
        email: champs.email.value.trim(),
        mdp: champs.mdp.value,
      });
    });

    return fragment;
  },
};

export { FormulaireIdentificationView };
