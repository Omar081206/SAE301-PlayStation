import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateOption from "./option.html?raw";
import templateEditeur from "./editeur.html?raw";
import templateValeur from "./valeur.html?raw";
import templateLigne from "./ligne.html?raw";
import templateBloc from "./bloc.html?raw";

// Explication sous « Variantes », selon les options.
const AIDES = {
  sans: "Produit sans option : une seule variante, au prix de base.",
  avec: "Une variante par combinaison de valeurs. Le prix d'une variante est le prix de base plus son supplément.",
  incomplet: "Ajoutez au moins une valeur à chaque option pour obtenir les variantes.",
};

// Carte « Options et variantes » du formulaire produit : chaque option en
// résumé (« Coloris : Blanc · Noir », « Modifier »), ou en édition (nom,
// valeurs, ajout et retrait) ; puis une ligne par variante (combinaison de
// valeurs), avec son supplément et son stock. Le composant ne garde rien : il
// signale chaque saisie et chaque demande à la page.
let OptionsProduitView = {
  /**
   * @param {{options: Array<{nom: string, valeurs: Array<{valeur: string}>}>,
   *          edition: number|null,
   *          variantes: Array<{signature: string, libelle: string, supplement: string, stock: string}>}} data
   *   edition : position de l'option ouverte en édition, ou null.
   * @param {{surAjouterOption: () => void, surModifierOption: (position: number) => void,
   *          surTerminer: () => void, surRetirerOption: (position: number) => void,
   *          surNomOption: (position: number, nom: string) => void,
   *          surValeur: (position: number, rang: number, valeur: string) => void,
   *          surAjouterValeur: (position: number, valeur: string) => void,
   *          surRetirerValeur: (position: number, rang: number) => void,
   *          surVariante: (signature: string, champ: string, valeur: string) => void}} actions
   */
  dom: function (data, actions) {
    let incomplet = data.options.some((option) => option.valeurs.length === 0);
    let aide = data.options.length === 0 ? AIDES.sans : incomplet ? AIDES.incomplet : AIDES.avec;
    let fragment = htmlToFragment(genericRenderer(template, { aide }));

    let options = data.options.map((option, position) =>
      position === data.edition
        ? OptionsProduitView.editeur(option, position, actions)
        : OptionsProduitView.resume(option, position, actions)
    );
    fragment.querySelector('slot[name="options"]').replaceWith(...options);
    fragment.querySelector('[data-action="ajouter-option"]').addEventListener("click", () => actions.surAjouterOption());

    // Une ligne de tableau (lg) et un bloc (mobile) par variante ; sans
    // option, le supplément n'a pas de sens.
    let lignes = [];
    let blocs = [];
    for (let variante of data.variantes) {
      let donnees = { ...variante, libelle: variante.libelle || "Variante unique" };
      for (let [modele, liste] of [
        [templateLigne, lignes],
        [templateBloc, blocs],
      ]) {
        let element = htmlToFragment(genericRenderer(modele, donnees));
        for (let champ of element.querySelectorAll("[data-champ]")) {
          if (data.options.length === 0 && champ.dataset.champ === "supplement") {
            champ.disabled = true;
          }
          champ.addEventListener("input", () => actions.surVariante(variante.signature, champ.dataset.champ, champ.value));
        }
        liste.push(element);
      }
    }
    fragment.querySelector("tbody").append(...lignes);
    fragment.querySelector('slot[name="blocs"]').replaceWith(...blocs);
    if (data.variantes.length === 0) {
      fragment.querySelector('[data-role="variantes"]').remove();
    }

    return fragment;
  },

  /**
   * Résumé d'une option : son nom, ses valeurs, et « Modifier ».
   */
  resume: function (option, position, actions) {
    let element = htmlToFragment(
      genericRenderer(templateOption, {
        nom: option.nom || "Option sans nom",
        valeurs: option.valeurs.map((valeur) => valeur.valeur).join(" · ") || "Aucune valeur",
      })
    );
    element.querySelector('[data-action="modifier"]').addEventListener("click", () => actions.surModifierOption(position));
    return element;
  },

  /**
   * Édition d'une option : son nom, ses valeurs (modifiables, retirables),
   * l'ajout d'une valeur (bouton ou touche Entrée), « Terminer » et
   * « Retirer l'option ».
   */
  editeur: function (option, position, actions) {
    let element = htmlToFragment(genericRenderer(templateEditeur, { nom: option.nom }));

    element
      .querySelector('[name="nom-option"]')
      .addEventListener("input", (ev) => actions.surNomOption(position, ev.target.value));

    let valeurs = option.valeurs.map((valeur, rang) => {
      let ligne = htmlToFragment(genericRenderer(templateValeur, { valeur: valeur.valeur, position: rang + 1 }));
      ligne.querySelector("input").addEventListener("input", (ev) => actions.surValeur(position, rang, ev.target.value));
      ligne.querySelector('[data-action="retirer"]').addEventListener("click", () => actions.surRetirerValeur(position, rang));
      return ligne;
    });
    element.querySelector('slot[name="valeurs"]').replaceWith(...valeurs);

    let nouvelle = element.querySelector('[data-role="nouvelle"]');
    let ajouter = () => {
      if (nouvelle.value.trim() !== "") actions.surAjouterValeur(position, nouvelle.value.trim());
    };
    element.querySelector('[data-action="ajouter-valeur"]').addEventListener("click", ajouter);
    nouvelle.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        ajouter();
      }
    });

    element.querySelector('[data-action="terminer"]').addEventListener("click", () => actions.surTerminer());
    element.querySelector('[data-action="retirer-option"]').addEventListener("click", () => actions.surRetirerOption(position));

    return element;
  },
};

export { OptionsProduitView };
