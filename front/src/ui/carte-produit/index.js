import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

// Carte d'un produit, tel que le renvoie l'API :
// { id, nom, slug, categorie, prix, image, image_alt }
// L'image est un fichier de front/public/images/produits/, que Vite recopie
// dans dist/ sous le chemin du projet.
let CarteProduitView = {
  html: function (produit) {
    // Les valeurs sont mises en forme avant d'être passées au template.
    return genericRenderer(template, {
      nom: produit.nom,
      slug: produit.slug,
      prix: formaterPrix(produit.prix),
      image: import.meta.env.BASE_URL + "images/produits/" + produit.image,
      alt: produit.image_alt,
    });
  },

  dom: function (produit) {
    return htmlToFragment(CarteProduitView.html(produit));
  },
};

export { CarteProduitView };
