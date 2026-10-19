import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";
import templateCategorie from "./categorie.html?raw";

// Formulaire produit du back-office : en-tête (titre, « Supprimer le
// produit », « Enregistrer »), carte « Informations », et les emplacements
// des options (slot « options ») et des images (slot « images »), placées par
// la page. Chaque saisie est signalée au fil de la frappe : la page la garde
// dans son modèle, et l'envoie au serveur à l'enregistrement.
let FormulaireProduitView = {
  html: function (data) {
    return genericRenderer(template, {
      titre: data.titre,
      nom: data.saisie.nom,
      prixBase: data.saisie.prixBase,
      description: data.saisie.description,
    });
  },

  /**
   * @param {{titre: string, existant: boolean, message: {type: string, texte: string}|null,
   *          saisie: {nom: string, categorie_id: number|null, prixBase: string, description: string},
   *          categories: Array<{id: number, nom: string}>}} data
   *   existant : le produit est déjà enregistré (il peut être supprimé).
   * @param {{surChamp: (champ: string, valeur: string) => void,
   *          surEnregistrer: () => void, surSupprimer: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireProduitView.html(data));

    fragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(data.message));

    let categorie = fragment.querySelector('[name="categorie_id"]');
    categorie.append(...data.categories.map((element) => htmlToFragment(genericRenderer(templateCategorie, element))));
    categorie.value = data.saisie.categorie_id === null ? "" : String(data.saisie.categorie_id);

    for (let champ of fragment.querySelectorAll("[name]")) {
      champ.addEventListener("input", () => actions.surChamp(champ.name, champ.value));
    }

    // État réglé en JS : un nouveau produit n'a rien à supprimer.
    let supprimer = fragment.querySelector('[data-action="supprimer"]');
    if (data.existant) {
      supprimer.addEventListener("click", () => actions.surSupprimer());
    } else {
      supprimer.remove();
    }
    fragment.querySelector('[data-action="enregistrer"]').addEventListener("click", () => actions.surEnregistrer());

    return fragment;
  },
};

export { FormulaireProduitView };
