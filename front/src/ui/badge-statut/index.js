import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Libellé et couleurs du badge de chaque statut de commande. Les classes sont
// écrites en entier, comme dans ui/message.
const STATUTS = {
  en_cours: { libelle: "En cours", couleurs: "bg-action text-texte-inverse" },
  disponible: { libelle: "Disponible", couleurs: "bg-succes text-texte-inverse" },
  retiree: { libelle: "Retirée", couleurs: "bg-trait text-texte" },
  annulee: { libelle: "Annulée", couleurs: "bg-trait text-texte-attenue" },
};

// Badge du statut d'une commande (en_cours, disponible, retiree, annulee).
let BadgeStatutView = {
  html: function (statut) {
    return genericRenderer(template, STATUTS[statut]);
  },

  dom: function (statut) {
    return htmlToFragment(BadgeStatutView.html(statut));
  },

  /**
   * Libellé d'un statut, pour les messages (« Disponible »…).
   */
  libelle: function (statut) {
    return STATUTS[statut].libelle;
  },
};

export { BadgeStatutView };
