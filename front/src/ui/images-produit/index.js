import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../message/index.js";
import template from "./template.html?raw";
import templateImage from "./image.html?raw";
import templateVariante from "./variante.html?raw";

/**
 * Lit des fichiers choisis ou déposés en data URL (« data:image/png;base64,… »),
 * la forme sous laquelle l'API les reçoit.
 */
function lireFichiers(fichiers) {
  return Promise.all(
    [...fichiers].map(
      (fichier) =>
        new Promise((resoudre, rejeter) => {
          let lecteur = new FileReader();
          lecteur.addEventListener("load", () => resoudre(lecteur.result));
          lecteur.addEventListener("error", () => rejeter(lecteur.error));
          lecteur.readAsDataURL(fichier);
        })
    )
  );
}

// Carte « Images » du formulaire produit : zone de dépôt (clic ou
// glisser-déposer) et miniatures. Sous chaque miniature : « Principale » ou
// le bouton pour qu'elle le devienne, « Supprimer », où elle s'affiche
// (catalogue et fiche, catalogue seulement : une jaquette carrée, fiche
// seulement : un visuel en paysage), et la variante à laquelle elle est
// rattachée (un coloris), s'il y en a plusieurs. Le
// composant ne garde rien : il lit les fichiers et signale les demandes.
let ImagesProduitView = {
  /**
   * @param {{actif: boolean, message: {type: string, texte: string}|null,
   *          images: Array<{id: number, variante_id: number|null, fichier: string, alt: string, ordre: number,
   *                         affichage: string}>,
   *          variantes: Array<{id: number, libelle: string}>}} data
   *   actif : le produit est enregistré (on peut lui ajouter des images) ;
   *   variantes : celles auxquelles une image peut être rattachée.
   * @param {{surFichiers: (contenus: string[]) => void, surSupprimer: (id: number) => void,
   *          surPrincipale: (id: number) => void, surVariante: (id: number, variante: number|null) => void,
   *          surAffichage: (id: number, affichage: string) => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(template);

    fragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(data.message));

    let depot = fragment.querySelector('[data-role="depot"]');
    if (!data.actif) {
      depot.remove();
    } else {
      fragment.querySelector('[data-role="inactif"]').remove();

      let champ = depot.querySelector("input");
      let envoyer = async (fichiers) => {
        if (fichiers.length > 0) actions.surFichiers(await lireFichiers(fichiers));
      };
      champ.addEventListener("change", () => envoyer(champ.files));

      // Glisser-déposer : la zone se signale pendant le survol.
      depot.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        depot.setAttribute("data-survol", "");
      });
      depot.addEventListener("dragleave", () => depot.removeAttribute("data-survol"));
      depot.addEventListener("drop", (ev) => {
        ev.preventDefault();
        depot.removeAttribute("data-survol");
        envoyer(ev.dataTransfer.files);
      });
    }

    let images = data.images.map((image) => {
      let element = htmlToFragment(
        genericRenderer(templateImage, {
          src: import.meta.env.BASE_URL + "images/produits/" + image.fichier,
          alt: image.alt,
        })
      );

      // États réglés en JS : un template n'a pas de condition. La première
      // de son groupe (produit, ou variante) est la principale.
      if (image.ordre === 1) {
        element.querySelector('[data-action="principale"]').remove();
      } else {
        element.querySelector('[data-role="principale"]').remove();
        element.querySelector('[data-action="principale"]').addEventListener("click", () => actions.surPrincipale(image.id));
      }
      element.querySelector('[data-action="supprimer"]').addEventListener("click", () => actions.surSupprimer(image.id));

      let affichage = element.querySelector('[data-role="affichage"]');
      affichage.value = image.affichage;
      affichage.addEventListener("change", () => actions.surAffichage(image.id, affichage.value));

      if (data.variantes.length < 2) {
        element.querySelector('[data-role="variante"]').remove();
      } else {
        let liste = element.querySelector('[data-role="variante"] select');
        liste.append(...data.variantes.map((variante) => htmlToFragment(genericRenderer(templateVariante, variante))));
        liste.value = image.variante_id === null ? "" : String(image.variante_id);
        liste.addEventListener("change", () => actions.surVariante(image.id, liste.value === "" ? null : Number(liste.value)));
      }

      return element;
    });
    fragment.querySelector('slot[name="images"]').replaceWith(...images);

    return fragment;
  },
};

export { ImagesProduitView };
