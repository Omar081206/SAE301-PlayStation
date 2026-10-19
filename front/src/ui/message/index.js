import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Bandeau à bordure gauche et pastille, comme sur les maquettes : vert pour
// une réussite (articles ajoutés au panier…), jaune pour un avertissement
// (quantité ajustée au stock…), rouge pour une erreur (identifiants refusés,
// mot de passe actuel incorrect…). Les classes sont écrites en entier, et non
// assemblées (« text-" + couleur ») : Tailwind ne génère que les classes
// qu'il trouve telles quelles dans le code.
const TYPES = {
  succes: { bordure: "border-succes", pastille: "bg-succes text-texte-inverse", icone: "✓" },
  avertissement: { bordure: "border-alerte", pastille: "bg-alerte text-texte", icone: "!" },
  erreur: { bordure: "border-erreur", pastille: "bg-erreur text-texte-inverse", icone: "!" },
};

// Message d'information ou d'erreur. data vaut { type: "erreur" | "succes" |
// "avertissement", texte }, ou null pour n'afficher aucun message.
let MessageView = {
  html: function (data) {
    if (data === null) {
      return "";
    }
    return genericRenderer(template, { texte: data.texte, ...TYPES[data.type] });
  },

  dom: function (data) {
    return htmlToFragment(MessageView.html(data));
  },
};

export { MessageView };
