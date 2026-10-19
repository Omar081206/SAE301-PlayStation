import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";

// Les deux cartes de la page de connexion partagent ce template : seuls les
// textes, la couleur du bouton et l'aide à la saisie changent. Les classes
// sont écrites en entier, comme dans ui/message.
// Le premier champ reçoit le pseudo ou l'adresse à la connexion, l'adresse
// seule à l'inscription (le pseudo a alors son propre champ).
const MODES = {
  connexion: {
    titre: "J’ai déjà un compte",
    bouton: "Se connecter",
    libelleIdentifiant: "Pseudo ou adresse e-mail",
    typeIdentifiant: "text",
    autocompleteIdentifiant: "username",
    autocomplete: "current-password",
    couleurs: "bg-action text-texte-inverse",
  },
  inscription: {
    titre: "Je crée mon compte",
    bouton: "Créer mon compte",
    libelleIdentifiant: "Adresse e-mail",
    typeIdentifiant: "email",
    autocompleteIdentifiant: "email",
    autocomplete: "new-password",
    couleurs: "bg-secondaire text-lien",
  },
};

// Formulaire de connexion ou de création de compte. Il ne conserve rien et
// ne décide de rien : il transmet la saisie, et c'est le serveur qui accepte
// ou refuse.
let FormulaireIdentificationView = {
  html: function (data) {
    return genericRenderer(template, { ...MODES[data.mode], identifiant: data.identifiant, pseudo: data.pseudo });
  },

  /**
   * @param {{mode: "connexion"|"inscription", identifiant: string, pseudo: string,
   *          erreur: string|null, masqueEnMobile: boolean}} data
   *   identifiant : pseudo ou adresse (connexion), adresse (inscription).
   *   masqueEnMobile : en dessous de lg, une seule carte est visible à la fois.
   * @param {{surEnvoi: (identifiant: string, mdp: string, pseudo: string) => void}} actions
   *   pseudo : chaîne vide à la connexion.
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
      fragment.querySelector('[data-role="pseudo"]').remove();
    }
    if (data.masqueEnMobile) {
      fragment.firstElementChild.classList.add("hidden", "lg:flex");
    }

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      let pseudo = formulaire.elements.pseudo === undefined ? "" : formulaire.elements.pseudo.value.trim();
      actions.surEnvoi(formulaire.elements.identifiant.value.trim(), formulaire.elements.mdp.value, pseudo);
    });

    return fragment;
  },
};

export { FormulaireIdentificationView };
