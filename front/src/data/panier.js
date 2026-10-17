import { postRequest } from "../lib/api-request.js";

// Le panier vit dans le navigateur (localStorage, clé « panier ») : une liste
// de lignes { variantId, quantite }, sans prix. Les prix et les totaux viennent
// toujours du serveur (voir fetchDetail). Chaque accès au stockage est protégé
// par try/catch : sans stockage, le panier est simplement vide.
const CLE = "panier";
const QUANTITE_MAX = 99;

let PanierData = {};

// Fonction appelée après chaque modification du panier, ou null. Le layout y
// branche la mise à jour du compteur du header : ce module ne touche pas au DOM.
PanierData.surChangement = null;

/**
 * Les lignes enregistrées. Une ligne illisible (stockage modifié à la main)
 * est écartée plutôt que de bloquer tout le panier.
 */
PanierData.lire = function () {
  let lignes = [];

  try {
    lignes = JSON.parse(localStorage.getItem(CLE) ?? "[]");
  } catch (e) {
    // Stockage indisponible ou contenu illisible : panier vide.
    return [];
  }

  if (!Array.isArray(lignes)) {
    return [];
  }

  return lignes.filter(
    (ligne) =>
      Number.isInteger(ligne?.variantId) &&
      ligne.variantId > 0 &&
      Number.isInteger(ligne.quantite) &&
      ligne.quantite >= 1 &&
      ligne.quantite <= QUANTITE_MAX
  );
};

/**
 * Enregistre les lignes, puis prévient l'application (voir surChangement).
 */
PanierData.enregistrer = function (lignes) {
  try {
    localStorage.setItem(CLE, JSON.stringify(lignes));
  } catch (e) {
    // Stockage indisponible : la modification ne survivra pas au rechargement.
  }

  if (PanierData.surChangement !== null) {
    PanierData.surChangement();
  }
};

/**
 * Ajoute un exemplaire d'une variante : une nouvelle ligne, ou une unité de
 * plus sur la ligne existante.
 */
PanierData.ajouter = function (variantId) {
  let lignes = PanierData.lire();
  let ligne = lignes.find((element) => element.variantId === variantId);

  if (ligne === undefined) {
    lignes.push({ variantId, quantite: 1 });
  } else {
    ligne.quantite = Math.min(ligne.quantite + 1, QUANTITE_MAX);
  }

  PanierData.enregistrer(lignes);
};

/**
 * Fixe la quantité d'une ligne, dans les bornes 1 à 99.
 */
PanierData.modifier = function (variantId, quantite) {
  let lignes = PanierData.lire();
  let ligne = lignes.find((element) => element.variantId === variantId);

  if (ligne !== undefined) {
    ligne.quantite = Math.min(Math.max(quantite, 1), QUANTITE_MAX);
    PanierData.enregistrer(lignes);
  }
};

/**
 * Retire une ligne du panier.
 */
PanierData.supprimer = function (variantId) {
  PanierData.enregistrer(PanierData.lire().filter((ligne) => ligne.variantId !== variantId));
};

/**
 * Nombre d'articles (somme des quantités), pour le compteur du header.
 */
PanierData.nombreArticles = function () {
  return PanierData.lire().reduce((somme, ligne) => somme + ligne.quantite, 0);
};

/**
 * Le détail du panier : POST /api/panier, corps JSON { lignes }.
 *
 * { lignes: [ { variantId, quantite, nom, slug, coloris, prix, image, image_alt, sousTotal } ],
 *   total, nombre }
 * Les variantes inconnues du serveur (produit retiré) sont absentes de la réponse.
 */
PanierData.fetchDetail = async function (lignes) {
  return postRequest("panier", { lignes });
};

export { PanierData };
