import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateCode from "./code-promo.html?raw";
import templateReduction from "./reduction.html?raw";

/**
 * Le bloc « Code promo » : à saisir (bouton Appliquer, refus éventuel sous
 * le champ), ou appliqué (champ en lecture seule, bouton Retirer et message
 * de réussite).
 *
 * @param {object} data    Données du récapitulatif (voir RecapitulatifCommandeView.dom).
 * @param {object} actions Actions du récapitulatif.
 */
function domCode(data, actions) {
  let promo = data.panier.codePromo;
  let fragment = htmlToFragment(
    genericRenderer(templateCode, {
      code: promo === null ? data.saisieCode : promo.code,
      erreur: data.erreurCode ?? "",
    })
  );
  let formulaire = fragment.querySelector("form");
  let champ = formulaire.elements.code;

  // États réglés en JS : un template n'a pas de condition.
  if (data.erreurCode === null) {
    fragment.querySelector('[data-role="erreur"]').remove();
  } else {
    champ.setAttribute("aria-invalid", "true");
  }

  let succes = fragment.querySelector('slot[name="succes"]');

  if (promo === null) {
    fragment.querySelector('[data-action="retirer"]').remove();
    succes.remove();
    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière
      // classique, en rechargeant la page.
      ev.preventDefault();
      actions.surApplication(champ.value.trim());
    });
  } else {
    champ.readOnly = true;
    fragment.querySelector('[data-action="appliquer"]').remove();
    fragment.querySelector('[data-action="retirer"]').addEventListener("click", () => actions.surRetrait());
    succes.replaceWith(
      MessageView.dom({
        type: "succes",
        texte: `Code ${promo.code} appliqué : −${promo.pourcentage} % sur votre commande.`,
      })
    );
    // Pas d'envoi du formulaire une fois le code appliqué (Entrée dans le champ).
    formulaire.addEventListener("submit", (ev) => ev.preventDefault());
  }

  return fragment;
}

// Récapitulatif avant validation : les articles du panier, tels que les
// renvoie l'API panier (prix calculés par le serveur), le code promo, le
// total et le bouton de confirmation. Un template par élément répété :
// chaque ligne prend place dans le <slot name="lignes">.
//
// Le code promo ne se calcule pas ici : le composant signale le code saisi
// (ou son retrait), et c'est le serveur qui le vérifie et renvoie la remise.
let RecapitulatifCommandeView = {
  /**
   * @param {{panier: {lignes: Array<{nom: string, quantite: number, sousTotal: number, sousTotalInitial: number|null,
   *          image: string, image_alt: string}>, sousTotal: number, remise: number,
   *          codePromo: {code: string, pourcentage: number}|null, total: number, nombre: number},
   *          saisieCode: string, erreurCode: string|null, envoiEnCours: boolean}} data
   *   saisieCode : dernier code saisi ; erreurCode : refus du serveur, ou null.
   * @param {{surConfirmation: () => void, surApplication: (code: string) => void,
   *          surRetrait: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(
      genericRenderer(template, { nombre: data.panier.nombre, total: formaterPrix(data.panier.total) })
    );

    let lignes = data.panier.lignes.map((ligne) => {
      let element = htmlToFragment(
        genericRenderer(templateLigne, {
          nom: ligne.nom,
          options: ligne.options ?? "",
          quantite: ligne.quantite,
          sousTotal: formaterPrix(ligne.sousTotal),
          sousTotalInitial: ligne.sousTotalInitial === null ? "" : formaterPrix(ligne.sousTotalInitial),
          image: import.meta.env.BASE_URL + "images/produits/" + ligne.image,
          alt: ligne.image_alt,
        })
      );
      // État réglé en JS : un template n'a pas de condition. Produit sans
      // option : pas de ligne vide ; hors promotion : pas de montant barré.
      if (ligne.options === null) {
        element.querySelector('[data-role="options"]').remove();
      }
      if (ligne.sousTotalInitial === null) {
        element.querySelector('[data-role="initial"]').remove();
      }
      return element;
    });
    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);

    fragment.querySelector('slot[name="code"]').replaceWith(domCode(data, actions));

    let promo = data.panier.codePromo;
    let slotReduction = fragment.querySelector('slot[name="reduction"]');

    if (promo === null) {
      slotReduction.remove();
    } else {
      slotReduction.replaceWith(
        htmlToFragment(
          genericRenderer(templateReduction, {
            sousTotal: formaterPrix(data.panier.sousTotal),
            code: promo.code,
            pourcentage: promo.pourcentage,
            remise: formaterPrix(data.panier.remise),
          })
        )
      );
    }

    let bouton = fragment.querySelector('[data-action="confirmer"]');
    // État réglé en JS : pendant l'envoi, un second clic ne crée pas une
    // seconde commande.
    bouton.disabled = data.envoiEnCours;
    bouton.addEventListener("click", () => actions.surConfirmation());

    return fragment;
  },
};

export { RecapitulatifCommandeView };
