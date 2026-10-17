import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateAvertissement from "./avertissement.html?raw";

// Les classes sont écrites en entier, et non assemblées (« text-" + couleur ») :
// Tailwind ne génère que les classes qu'il trouve telles quelles dans le code.
const COULEURS = {
  erreur: "border-red-700 text-red-700",
  succes: "border-green-700 text-green-700",
};

// Message d'information ou d'erreur. data vaut { type: "erreur" | "succes" |
// "avertissement", texte }, ou null pour n'afficher aucun message.
// L'avertissement (quantité ajustée au stock…) a son propre template : bordure
// jaune et pastille « ! », comme sur la maquette du panier.
let MessageView = {
  html: function (data) {
    if (data === null) {
      return "";
    }
    if (data.type === "avertissement") {
      return genericRenderer(templateAvertissement, { texte: data.texte });
    }
    return genericRenderer(template, { texte: data.texte, couleurs: COULEURS[data.type] });
  },

  dom: function (data) {
    return htmlToFragment(MessageView.html(data));
  },
};

export { MessageView };
