import { PanierData } from "../../data/panier.js";
import { ProduitData } from "../../data/produit.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { CATEGORIES_EN_VISUEL } from "../../ui/carte-produit/index.js";
import { FicheProduitView } from "../../ui/fiche-produit/index.js";
import { GalerieProduitView } from "../../ui/galerie-produit/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Produit » : la fiche d'un produit, désigné par son slug dans l'URL
 * (/produit/manette-sans-fil-dualsense).
 *
 * L'image affichée dans la galerie et les options choisies font partie de
 * l'état de la page : changer d'image ou d'option modifie le modèle, puis la
 * page se reconstruit. Les options désignent une variante : son prix, son
 * stock et ses images sont affichés, et c'est elle qui est ajoutée au panier.
 *
 * Depuis le panier, « Modifier les options » ouvre la fiche à l'adresse
 * /produit/:slug/options/:variante : les options de cet article sont
 * présélectionnées, et le bouton remplace sa variante dans le panier au lieu
 * d'en ajouter une. La variante est dans le chemin, pas dans « ?… » : le
 * routeur ne garde que le chemin des liens.
 */

let M = {
  produit: null, // dernière réponse de l'API : la fiche du produit
  choix: {}, // valeur choisie pour chaque option : { optionId: valeurId }
  optionModifiee: null, // option qui vient de changer : son choix reprend le focus
  modification: null, // variante du panier dont on modifie les options, ou null
  imageActive: 0, // position, dans les images de la variante, de l'image affichée
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande la fiche du produit et la range dans le modèle.
 *
 * @param {string|undefined} variante  Variante du panier dont on modifie les
 *   options (paramètre d'URL), ou undefined.
 */
C.charger = async function (slug, variante) {
  try {
    M.produit = (await ProduitData.fetchOne(slug)).produit;
    M.imageActive = 0;

    // Au départ, les options de l'article du panier qu'on modifie, s'il
    // s'agit bien d'une variante de ce produit présente au panier ; sinon,
    // celles de la variante par défaut (la première en stock, choisie par le
    // serveur).
    let demandee = Number(variante);
    let auPanier = PanierData.lire().some((ligne) => ligne.variantId === demandee);
    let modifiee = auPanier ? M.produit.variantes.find((variante) => variante.id === demandee) : undefined;
    M.modification = modifiee === undefined ? null : modifiee.id;

    M.choix = {};
    let parDefaut = modifiee ?? M.produit.variantes.find((variante) => variante.id === M.produit.variante_id);
    for (let option of M.produit.options) {
      M.choix[option.id] = option.valeurs.find((valeur) => parDefaut.valeurs.includes(valeur.id))?.id ?? option.valeurs[0].id;
    }
    M.message = null;
  } catch (erreur) {
    M.produit = null;

    let texte = `Impossible de charger le produit : ${erreur.message}`;
    if (erreur.statut === 404) texte = "Ce produit n'existe pas ou n'est plus en vente.";

    M.message = { type: "erreur", texte };
  }
};

/**
 * La variante qui correspond aux options choisies (une valeur par option),
 * ou null si cette combinaison n'existe pas. Un produit sans option n'a
 * qu'une variante.
 */
C.variante = function (choix = M.choix) {
  return (
    M.produit.variantes.find((variante) =>
      M.produit.options.every((option) => variante.valeurs.includes(choix[option.id]))
    ) ?? null
  );
};

/**
 * Pour chaque valeur d'option, ce qu'on obtiendrait en la choisissant (les
 * autres options restant comme elles sont) : « disponible », « epuise » ou
 * « inexistante » (aucune variante pour cette combinaison).
 */
C.etats = function () {
  let etats = {};

  for (let option of M.produit.options) {
    for (let valeur of option.valeurs) {
      let variante = C.variante({ ...M.choix, [option.id]: valeur.id });
      if (variante === null) etats[valeur.id] = "inexistante";
      else if (variante.etat_stock === "epuise") etats[valeur.id] = "epuise";
      else etats[valeur.id] = "disponible";
    }
  }

  return etats;
};

/**
 * Nom du produit et options choisies, pour les messages : « Manette sans fil
 * DualSense (Noir) ».
 */
C.libelle = function () {
  let valeurs = M.produit.options.map((option) => option.valeurs.find((valeur) => valeur.id === M.choix[option.id]).valeur);
  return valeurs.length === 0 ? M.produit.nom : `${M.produit.nom} (${valeurs.join(", ")})`;
};

C.handler_choisir = async function (optionId, valeurId) {
  M.choix[optionId] = valeurId;
  // Les images changent avec la variante : on repart de la première.
  M.imageActive = 0;
  M.message = null;
  M.optionModifiee = optionId;
  V.rafraichir();
  M.optionModifiee = null;
};

C.handler_changerImage = async function (position) {
  M.imageActive = position;
  V.rafraichir();
};

C.handler_ajouter = async function (variantId, nom) {
  if (M.modification !== null) {
    await C.mettreAJour(variantId, nom);
    return;
  }

  try {
    // Le serveur vérifie le stock avant d'accepter l'ajout.
    let ajustement = await PanierData.ajouter(variantId);

    if (ajustement === null) {
      M.message = { type: "succes", texte: `« ${nom} » a été ajouté au panier.` };
    } else if (ajustement.accordee === 0) {
      M.message = { type: "avertissement", texte: `« ${nom} » est épuisé : il n’a pas pu être ajouté au panier.` };
    } else {
      M.message = {
        type: "avertissement",
        texte: `Vous avez déjà le maximum disponible de « ${nom} » dans votre panier.`,
      };
    }
  } catch (erreur) {
    M.message = { type: "erreur", texte: `Impossible d’ajouter « ${nom} » au panier : ${erreur.message}` };
  }

  V.rafraichir();
};

/**
 * Modifier les options d'un article du panier : sa variante est remplacée
 * par celle choisie (même quantité), puis retour au panier. Si le stock ne
 * permet pas toute la quantité, on reste ici pour le dire.
 */
C.mettreAJour = async function (variantId, nom) {
  try {
    let ajustement = await PanierData.remplacer(M.modification, variantId);

    if (ajustement === null) {
      naviguer("/panier");
      return;
    }

    M.modification = null;
    M.message = {
      type: "avertissement",
      texte:
        ajustement.accordee === 0
          ? `« ${nom} » vient d’être épuisé : l’article a été retiré de votre panier.`
          : `Votre panier est mis à jour, mais il ne reste que ${ajustement.accordee} « ${nom} » : la quantité a été ajustée.`,
    };
  } catch (erreur) {
    M.message = { type: "erreur", texte: `Impossible de mettre à jour votre panier : ${erreur.message}` };
  }

  V.rafraichir();
};

C.init = async function (slug, variante) {
  M.message = null;
  await C.charger(slug, variante);
  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  V.updateMetadata();
  return fragment;
};

// Même principe que la page Catalogue : toute la page se reconstruit à partir
// du modèle. L'image affichée et les options choisies survivent parce
// qu'elles sont dans le modèle.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
  V.updateMetadata();

  // Après un changement d'option, la page reconstruite a perdu le focus : on
  // le rend au choix fait, pour continuer au clavier (flèches dans le groupe).
  if (M.optionModifiee !== null) {
    V.racine.querySelector(`input[name="option-${M.optionModifiee}"]:checked`)?.focus();
  }
};

/**
 * Titre de l'onglet et description pour les moteurs de recherche, tirés du
 * produit affiché.
 */
V.updateMetadata = function () {
  if (M.produit === null) {
    return;
  }

  document.title = `${M.produit.nom} · PlayStation Click & Collect`;
  document.querySelector('meta[name="description"]').setAttribute("content", M.produit.description);
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slotFiche = pageFragment.querySelector('slot[name="fiche"]');
  if (M.produit === null) {
    slotFiche.remove();
    return pageFragment;
  }

  let variante = C.variante();
  let fiche = FicheProduitView.dom(
    {
      produit: M.produit,
      variante,
      choix: M.choix,
      etats: C.etats(),
      libelle: C.libelle(),
      modification: M.modification !== null,
    },
    { surChoix: C.handler_choisir, surAjout: C.handler_ajouter }
  );
  fiche.querySelector('slot[name="galerie"]').replaceWith(
    GalerieProduitView.dom(
      {
        images: variante === null ? M.produit.images : variante.images,
        active: M.imageActive,
        remplir: CATEGORIES_EN_VISUEL.includes(M.produit.categorie_slug),
      },
      { surImage: C.handler_changerImage }
    )
  );
  slotFiche.replaceWith(fiche);

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { slug } pour /produit/:slug,
// et { slug, variante } pour /produit/:slug/options/:variante.
export function ProduitPage(params) {
  return C.init(params.slug, params.variante);
}
