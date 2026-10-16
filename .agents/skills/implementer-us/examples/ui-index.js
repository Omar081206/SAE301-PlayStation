// Gabarit de composant. Copier vers front/src/ui/<nom>/index.js (+ template.html + ligne.html).
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterNote } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne.html?raw";
import templateVide from "./vide.html?raw";

// Liste d'éléments, tels que les renvoie l'API : { id, nom, note_moyenne }.
// Le composant ne décide de rien : il affiche et signale les actions.
let ListeExempleView = {
  /**
   * @param {{elements: Array<{id: number, nom: string, note_moyenne: number}>, choisi: number|null}} data
   * @param {{surChoix: (id: number) => void}} actions
   */
  dom: function (data, actions) {
    if (data.elements.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);

    let lignes = data.elements.map((element) => {
      let ligne = htmlToFragment(
        genericRenderer(templateLigne, {
          id: element.id,
          nom: element.nom,
          note: formaterNote(element.note_moyenne),
        })
      );
      let bouton = ligne.querySelector('[data-action="choisir"]');
      // État réglé en JS : un template n'a pas de condition.
      bouton.setAttribute("aria-pressed", String(element.id === data.choisi));
      bouton.addEventListener("click", () => actions.surChoix(element.id));
      return ligne;
    });

    fragment.querySelector('slot[name="lignes"]').replaceWith(...lignes);
    return fragment;
  },
};

export { ListeExempleView };
