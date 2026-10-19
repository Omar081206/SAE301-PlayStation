import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { BadgeStockView } from "../badge-stock/index.js";
import template from "./template.html?raw";
import templateOption from "./option.html?raw";
import templateValeur from "./valeur.html?raw";

// Mention d'une valeur qu'on ne peut pas choisir, selon la variante à
// laquelle elle mènerait (avec les autres options choisies).
const MENTIONS = { epuise: "Épuisé", inexistante: "Indisponible" };

// Fiche d'un produit, tel que le renvoie l'API :
// { id, nom, slug, description, categorie, categorie_slug, prix, etat_stock,
//   images, options: [ { id, nom, valeurs: [ { id, valeur } ] } ],
//   variantes: [ { id, prix, etat_stock, valeurs, images } ] }
// avec la variante qui correspond aux options choisies (null si cette
// combinaison n'existe pas). Le prix, le badge de stock et le bouton sont
// ceux de cette variante ; la galerie (slot « galerie ») est placée par la
// page. Un groupe de choix par option prend place dans le slot « options » :
// une valeur épuisée ou sans variante est barrée, signalée et ne peut pas
// être choisie.
let FicheProduitView = {
  html: function (data) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    let produit = data.produit;
    return genericRenderer(template, {
      nom: produit.nom,
      prix: formaterPrix(data.variante === null ? produit.prix : data.variante.prix),
      description: produit.description,
      categorie: produit.categorie,
      categorieSlug: produit.categorie_slug,
    });
  },

  /**
   * @param {{produit: Object, variante: {id: number, prix: number, etat_stock: string}|null,
   *          choix: Object<number, number>, etats: Object<number, string>, libelle: string,
   *          modification: boolean}} data
   *   modification : on modifie les options d'un article du panier (le
   *   bouton met le panier à jour au lieu d'ajouter) ;
   *   choix : valeur choisie pour chaque option (identifiants) ; etats :
   *   pour chaque valeur, « disponible », « epuise » ou « inexistante »
   *   (variante à laquelle elle mènerait) ; libelle : nom du produit et
   *   options choisies, pour les messages.
   * @param {{surChoix: (optionId: number, valeurId: number) => void,
   *          surAjout: (variantId: number, libelle: string) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FicheProduitView.html(data));
    let variante = data.variante;

    fragment
      .querySelector('slot[name="badge"]')
      .replaceWith(variante === null ? "" : BadgeStockView.dom(variante.etat_stock));

    let groupes = data.produit.options.map((option) => {
      let choisie = option.valeurs.find((valeur) => valeur.id === data.choix[option.id]);
      let groupe = htmlToFragment(genericRenderer(templateOption, { nom: option.nom, choisie: choisie?.valeur ?? "" }));

      let valeurs = option.valeurs.map((valeur) => {
        let etat = data.etats[valeur.id];
        let element = htmlToFragment(
          genericRenderer(templateValeur, {
            optionId: option.id,
            valeurId: valeur.id,
            valeur: valeur.valeur,
            mention: MENTIONS[etat] ?? "",
          })
        );
        let radio = element.querySelector("input");
        // États réglés en JS : un template n'a pas de condition.
        radio.checked = valeur.id === data.choix[option.id];
        if (etat === "disponible") {
          element.querySelector('[data-role="mention"]').remove();
        } else {
          radio.disabled = true;
          element.querySelector('[data-role="valeur"]').classList.add("line-through");
        }
        radio.addEventListener("change", () => actions.surChoix(option.id, valeur.id));
        return element;
      });
      groupe.querySelector('slot[name="valeurs"]').replaceWith(...valeurs);
      return groupe;
    });
    fragment.querySelector('slot[name="options"]').replaceWith(...groupes);

    let bouton = fragment.querySelector('[data-action="ajouter"]');

    // Combinaison inexistante ou variante épuisée : bouton désactivé (le
    // serveur refuserait de toute façon l'ajout).
    if (variante === null) {
      bouton.disabled = true;
      bouton.textContent = "Combinaison indisponible";
    } else if (variante.etat_stock === "epuise") {
      bouton.disabled = true;
      bouton.textContent = "Épuisé";
    } else {
      if (data.modification) {
        bouton.textContent = "Mettre à jour mon panier";
      }
      bouton.addEventListener("click", () => actions.surAjout(variante.id, data.libelle));
    }

    return fragment;
  },
};

export { FicheProduitView };
