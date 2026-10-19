import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import iconeCompte from "../../assets/compte.svg";
import iconePanier from "../../assets/panier.svg";
import logoSony from "../../assets/logo-sony.svg";
import logoPlayStation from "../../assets/logo-playstation.svg";
import template from "./template.html?raw";

// En-tête du site : logos, lien vers le compte et lien vers le panier, avec le
// nombre d'articles. Ces données sont fournies par le layout : le header ne
// lit ni le panier ni la session.
let HeaderView = {
  /**
   * @param {{nombre: number, connecte: boolean, prenom: string|null, nom: string|null}} data
   *   Articles du panier, état de connexion, prénom et nom du client connecté.
   */
  html: function (data) {
    // Connecté : « Nathan D. » remplace « Mon compte » (sauf session ouverte
    // avant l'arrivée des prénoms) et le lien mène à l'espace personnel.
    let nomCourt = data.prenom ? `${data.prenom}${data.nom ? ` ${data.nom.charAt(0)}.` : ""}` : null;

    return genericRenderer(template, {
      logoSony,
      logoPlayStation,
      iconeCompte,
      iconePanier,
      nombre: data.nombre,
      libellePanier: data.nombre > 1 ? `Panier, ${data.nombre} articles` : `Panier, ${data.nombre} article`,
      lienCompte: data.connecte ? "/compte" : "/connexion",
      libelleCompte: data.connecte ? (nomCourt ?? "Mon compte") : "Connexion",
      libelleIcone: data.connecte ? (nomCourt ? `Mon compte, ${nomCourt}` : "Mon compte") : "Connexion",
    });
  },

  dom: function (data) {
    let fragment = htmlToFragment(HeaderView.html(data));

    // Panier vide : pas de pastille « 0 ».
    if (data.nombre === 0) {
      fragment.querySelector('[data-role="compteur"]').remove();
    }

    return fragment;
  },
};

export { HeaderView };
