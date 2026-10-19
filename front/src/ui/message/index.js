import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateAvertissement from "./avertissement.html?raw";

// Les classes sont écrites en entier, et non assemblées (« text-" + couleur ») :
// Tailwind ne génère que les classes qu'il trouve telles quelles dans le code.
const COULEURS = {
  succes: "border-green-700 text-green-700",
};

// Bandeau à bordure gauche et pastille « ! », comme sur les maquettes :
// jaune pour un avertissement (quantité ajustée au stock…), rouge pour une
// erreur (identifiants refusés, mot de passe actuel incorrect…).
const BANDEAUX = {
  avertissement: { bordure: "border-alerte", pastille: "bg-alerte text-texte" },
  erreur: { bordure: "border-erreur", pastille: "bg-erreur text-texte-inverse" },
};

// Message d'information ou d'erreur. data vaut { type: "erreur" | "succes" |
// "avertissement", texte }, ou null pour n'afficher aucun message.
let MessageView = {
  html: function (data) {
    if (data === null) {
      return "";
    }
    if (data.type in BANDEAUX) {
      return genericRenderer(templateAvertissement, { texte: data.texte, ...BANDEAUX[data.type] });
    }
    return genericRenderer(template, { texte: data.texte, couleurs: COULEURS[data.type] });
  },

  dom: function (data) {
    return htmlToFragment(MessageView.html(data));
  },
};

export { MessageView };
