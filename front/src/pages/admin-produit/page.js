import { AdminProduitData } from "../../data/admin-produit.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { ConfirmationProduitView } from "../../ui/confirmation-produit/index.js";
import { FormulaireProduitView } from "../../ui/formulaire-produit/index.js";
import { ImagesProduitView } from "../../ui/images-produit/index.js";
import { OptionsProduitView } from "../../ui/options-produit/index.js";
import template from "./template.html?raw";

/**
 * Page « Produit » du back-office : créer (/admin/produits/nouveau) ou
 * modifier (/admin/produits/:id) un produit : informations, options et
 * variantes (supplément et stock de chacune), images.
 *
 * Le modèle garde toute la saisie ; elle n'est envoyée qu'à l'enregistrement,
 * et c'est le serveur qui la valide. Une variante est désignée par sa
 * « signature » : les clés de ses valeurs, dans l'ordre des options
 * (« 3|12 ») ; une valeur nouvelle a une clé provisoire (« n1 »…).
 * Les images s'envoient une à une, et seulement pour un produit enregistré.
 *
 * Sans session d'administration (403), la page renvoie à /admin.
 */

let M = {
  id: null, // produit modifié, ou null pour un nouveau
  enregistre: null, // dernier état renvoyé par le serveur (titre, images, variantes)
  categories: [], // [ { id, nom } ]
  saisie: null, // { nom, categorie_id, prixBase, description }
  options: [], // [ { id, nom, valeurs: [ { id, cle, valeur } ] } ]
  variantes: new Map(), // signature -> { id, supplement, stock }
  edition: null, // position de l'option ouverte en édition
  focus: null, // champ de l'éditeur d'option à reprendre (le temps d'une reconstruction)
  compteur: 0, // pour les clés provisoires des nouvelles valeurs
  suppression: null, // { nom, erreur } pendant la confirmation
  messageImages: null, // résultat d'une action sur les images
  message: null, // { type, texte }, ou null
};

// Message à afficher après une redirection vers cette même page (création).
let messageSuivant = null;

let C = {};

/**
 * Signature d'une variante : les clés de ses valeurs, dans l'ordre des
 * options. « » pour un produit sans option.
 */
C.signature = function (cles) {
  return cles.join("|");
};

/**
 * Les clés d'une signature (l'inverse de C.signature).
 */
C.cles = function (signature) {
  return signature === "" ? [] : signature.split("|");
};

/**
 * Remplit le modèle à partir d'un produit renvoyé par le serveur (ou d'un
 * nouveau produit, null). Le prix de base est le plus bas des variantes ; le
 * supplément de chacune est son écart à ce prix.
 */
C.remplir = function (produit) {
  M.enregistre = produit;
  M.edition = null;

  if (produit === null) {
    M.id = null;
    M.saisie = { nom: "", categorie_id: null, prixBase: "", description: "" };
    M.options = [];
    M.variantes = new Map([["", { id: null, supplement: "0", stock: "0" }]]);
    return;
  }

  let base = Math.min(...produit.variantes.map((variante) => variante.prix));
  M.id = produit.id;
  M.saisie = {
    nom: produit.nom,
    categorie_id: produit.categorie_id,
    prixBase: base.toFixed(2),
    description: produit.description,
  };
  M.options = produit.options.map((option) => ({
    id: option.id,
    nom: option.nom,
    valeurs: option.valeurs.map((valeur) => ({ id: valeur.id, cle: String(valeur.id), valeur: valeur.valeur })),
  }));

  M.variantes = new Map();
  for (let variante of produit.variantes) {
    let cles = M.options.map(
      (option) => option.valeurs.find((valeur) => variante.valeurs.includes(valeur.id))?.cle ?? ""
    );
    M.variantes.set(C.signature(cles), {
      id: variante.id,
      supplement: (variante.prix - base).toFixed(2),
      stock: String(variante.stock),
    });
  }
};

/**
 * Demande le produit (ou seulement les catégories, pour un nouveau).
 * Renvoie faux sans session d'administration (403).
 */
C.charger = async function (id) {
  try {
    let reponse = await AdminProduitData.fetchOne(id);
    M.categories = reponse.categories;
    C.remplir(reponse.produit);
  } catch (erreur) {
    M.saisie = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = {
      type: "erreur",
      texte: erreur.statut === 404 ? "Ce produit n'existe pas (ou plus)." : erreur.message,
    };
  }

  return true;
};

/**
 * Toutes les combinaisons de valeurs (une par option), en clés ; une seule,
 * vide, pour un produit sans option. Aucune si une option n'a pas de valeur.
 */
C.combinaisons = function () {
  return M.options.reduce(
    (combinaisons, option) =>
      combinaisons.flatMap((debut) => option.valeurs.map((valeur) => [...debut, valeur.cle])),
    [[]]
  );
};

/**
 * Les variantes à afficher : une par combinaison, avec ce qui a été saisi
 * (ou un supplément et un stock à 0 pour une combinaison nouvelle).
 */
C.variantesAffichees = function () {
  return C.combinaisons().map((cles) => {
    let signature = C.signature(cles);
    let libelle = cles
      .map((cle, position) => M.options[position].valeurs.find((valeur) => valeur.cle === cle).valeur)
      .join(" / ");
    let variante = M.variantes.get(signature) ?? { id: null, supplement: "0", stock: "0" };
    return { signature, libelle, supplement: variante.supplement, stock: variante.stock };
  });
};

/**
 * Récrit les signatures connues : modifier(cles) renvoie les nouvelles clés,
 * ou null pour oublier la variante. À clé égale, la première est gardée.
 */
C.recrireSignatures = function (modifier) {
  let recrites = new Map();
  for (let [signature, variante] of M.variantes) {
    let cles = modifier(C.cles(signature));
    if (cles !== null && !recrites.has(C.signature(cles))) {
      recrites.set(C.signature(cles), variante);
    }
  }
  M.variantes = recrites;
};

// Saisies : gardées dans le modèle, sans reconstruire la page (le champ
// garde le focus).
C.handler_champ = async function (champ, valeur) {
  M.saisie[champ] = champ === "categorie_id" ? (valeur === "" ? null : Number(valeur)) : valeur;
};

C.handler_nomOption = async function (position, nom) {
  M.options[position].nom = nom;
};

C.handler_valeur = async function (position, rang, valeur) {
  M.options[position].valeurs[rang].valeur = valeur;
};

C.handler_variante = async function (signature, champ, valeur) {
  let variante = M.variantes.get(signature) ?? { id: null, supplement: "0", stock: "0" };
  variante[champ] = valeur;
  M.variantes.set(signature, variante);
};

// Changements de structure : la page se reconstruit.
C.handler_ajouterOption = async function () {
  M.options.push({ id: null, nom: "", valeurs: [] });
  M.edition = M.options.length - 1;
  M.focus = "nom";
  V.rafraichir();
  M.focus = null;
};

C.handler_modifierOption = async function (position) {
  M.edition = position;
  M.focus = "nom";
  V.rafraichir();
  M.focus = null;
};

C.handler_terminer = async function () {
  M.edition = null;
  V.rafraichir();
};

C.handler_retirerOption = async function (position) {
  // Les variantes perdent la valeur de cette option ; deux qui ne
  // différaient que par elle n'en font plus qu'une.
  let complete = M.options.length;
  C.recrireSignatures((cles) => (cles.length === complete ? cles.filter((cle, rang) => rang !== position) : null));
  M.options.splice(position, 1);
  M.edition = null;
  V.rafraichir();
};

C.handler_ajouterValeur = async function (position, texte) {
  let option = M.options[position];
  let cle = `n${++M.compteur}`;

  // Première valeur d'une option nouvelle : les variantes existantes la
  // prennent (elles gardent leur stock au lieu d'être recréées).
  if (option.valeurs.length === 0) {
    let sansCetteOption = M.options.length - 1;
    C.recrireSignatures((cles) =>
      cles.length === sansCetteOption ? [...cles.slice(0, position), cle, ...cles.slice(position)] : cles
    );
  }

  option.valeurs.push({ id: null, cle, valeur: texte });
  M.focus = "nouvelle";
  V.rafraichir();
  M.focus = null;
};

C.handler_retirerValeur = async function (position, rang) {
  M.options[position].valeurs.splice(rang, 1);
  M.focus = "nouvelle";
  V.rafraichir();
  M.focus = null;
};

/**
 * Ce qui part au serveur : informations, options (avec les clés des
 * valeurs) et une variante par combinaison, au prix base + supplément.
 */
C.donnees = function () {
  let base = Number(M.saisie.prixBase);

  return {
    id: M.id,
    nom: M.saisie.nom,
    categorie_id: M.saisie.categorie_id,
    description: M.saisie.description,
    options: M.options,
    variantes: C.combinaisons().map((cles) => {
      let variante = M.variantes.get(C.signature(cles)) ?? { id: null, supplement: "0", stock: "0" };
      return {
        id: variante.id,
        valeurs: cles,
        prix: Math.round((base + Number(variante.supplement || 0)) * 100) / 100,
        stock: Number(variante.stock),
      };
    }),
  };
};

C.handler_enregistrer = async function () {
  try {
    let produit = (await AdminProduitData.enregistrer(C.donnees())).produit;

    // Création : on passe à l'adresse du produit (pour ses images).
    if (M.id === null) {
      messageSuivant = { type: "succes", texte: "Le produit est créé : vous pouvez maintenant ajouter ses images." };
      naviguer(`/admin/produits/${produit.id}`);
      return;
    }

    C.remplir(produit);
    M.message = { type: "succes", texte: "Les modifications sont enregistrées." };
  } catch (erreur) {
    if (erreur.statut === 403) {
      naviguer("/admin");
      return;
    }
    M.message = { type: "erreur", texte: erreur.message };
  }

  V.rafraichir();
};

/**
 * Applique une action sur les images, puis reprend les images (et elles
 * seules) du produit renvoyé : la saisie en cours n'est pas perdue.
 */
C.surImages = async function (action, succes) {
  try {
    let produit = (await action()).produit;
    M.enregistre = { ...M.enregistre, images: produit.images };
    M.messageImages = succes === null ? null : { type: "succes", texte: succes };
  } catch (erreur) {
    M.messageImages = { type: "erreur", texte: erreur.message };
  }

  V.rafraichir();
};

C.handler_fichiers = async function (contenus) {
  // Une image à la fois : la requête reste sous la taille permise.
  let envoyees = 0;
  for (let contenu of contenus) {
    await C.surImages(() => AdminProduitData.ajouterImage(M.id, contenu), null);
    if (M.messageImages?.type === "erreur") return;
    envoyees += 1;
  }
  M.messageImages = { type: "succes", texte: envoyees > 1 ? `${envoyees} images ajoutées.` : "Image ajoutée." };
  V.rafraichir();
};

C.handler_supprimerImage = async function (id) {
  await C.surImages(() => AdminProduitData.supprimerImage(id), "Image supprimée.");
};

C.handler_principale = async function (id) {
  await C.surImages(() => AdminProduitData.rendrePrincipale(id), null);
};

C.handler_varianteImage = async function (id, variante) {
  await C.surImages(() => AdminProduitData.rattacherImage(id, variante), null);
};

C.handler_supprimer = async function () {
  M.suppression = { nom: M.enregistre.nom, erreur: null };
  V.rafraichir();
};

C.handler_confirmerSuppression = async function () {
  try {
    await AdminProduitData.supprimer(M.id);
    naviguer("/admin/produits");
    return;
  } catch (erreur) {
    M.suppression.erreur = erreur.message;
  }

  V.rafraichir();
};

C.handler_retour = async function () {
  M.suppression = null;
  V.rafraichir();
};

C.init = async function (id) {
  M.message = messageSuivant;
  messageSuivant = null;
  M.messageImages = null;
  M.suppression = null;
  M.focus = null;

  if (!(await C.charger(id === "nouveau" ? null : Number(id)))) {
    naviguer("/admin");
    // Le routeur affichera la connexion : ce contenu ne sera pas montré.
    return "";
  }

  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

// Même principe que la page Catalogue : toute la page se reconstruit à partir
// du modèle (la saisie y est gardée). Après un changement d'option, le focus
// revient dans l'éditeur ; la fenêtre de suppression est rouverte.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;

  V.racine.querySelector("dialog")?.showModal();
  if (M.focus !== null) {
    V.racine.querySelector(`[data-focus="${M.focus}"]`)?.focus();
  }
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);
  let slotFormulaire = pageFragment.querySelector('slot[name="formulaire"]');
  let slotModale = pageFragment.querySelector('slot[name="modale"]');

  if (M.saisie === null) {
    // Produit introuvable ou serveur indisponible : le message seul.
    slotFormulaire.replaceWith(
      FormulaireProduitView.dom(
        { titre: "Produit", existant: false, message: M.message, saisie: { nom: "", categorie_id: null, prixBase: "", description: "" }, categories: [] },
        { surChamp: C.handler_champ, surEnregistrer: C.handler_enregistrer, surSupprimer: C.handler_supprimer }
      )
    );
    slotModale.remove();
    return pageFragment;
  }

  let formulaire = FormulaireProduitView.dom(
    {
      titre: M.enregistre === null ? "Nouveau produit" : `Modifier « ${M.enregistre.nom} »`,
      existant: M.enregistre !== null,
      message: M.message,
      saisie: M.saisie,
      categories: M.categories,
    },
    { surChamp: C.handler_champ, surEnregistrer: C.handler_enregistrer, surSupprimer: C.handler_supprimer }
  );

  formulaire.querySelector('slot[name="options"]').replaceWith(
    OptionsProduitView.dom(
      { options: M.options, edition: M.edition, variantes: C.variantesAffichees() },
      {
        surAjouterOption: C.handler_ajouterOption,
        surModifierOption: C.handler_modifierOption,
        surTerminer: C.handler_terminer,
        surRetirerOption: C.handler_retirerOption,
        surNomOption: C.handler_nomOption,
        surValeur: C.handler_valeur,
        surAjouterValeur: C.handler_ajouterValeur,
        surRetirerValeur: C.handler_retirerValeur,
        surVariante: C.handler_variante,
      }
    )
  );

  // Les images se rattachent aux variantes enregistrées (pas à la saisie
  // en cours) : celles du dernier état renvoyé par le serveur.
  let enregistre = M.enregistre;
  let variantesEnregistrees =
    enregistre === null
      ? []
      : enregistre.variantes.map((variante) => ({
          id: variante.id,
          libelle:
            enregistre.options
              .flatMap((option) => option.valeurs)
              .filter((valeur) => variante.valeurs.includes(valeur.id))
              .map((valeur) => valeur.valeur)
              .join(" / ") || "Variante unique",
        }));

  formulaire.querySelector('slot[name="images"]').replaceWith(
    ImagesProduitView.dom(
      {
        actif: enregistre !== null,
        message: M.messageImages,
        images: enregistre === null ? [] : enregistre.images,
        variantes: variantesEnregistrees,
      },
      {
        surFichiers: C.handler_fichiers,
        surSupprimer: C.handler_supprimerImage,
        surPrincipale: C.handler_principale,
        surVariante: C.handler_varianteImage,
      }
    )
  );

  slotFormulaire.replaceWith(formulaire);

  if (M.suppression === null) {
    slotModale.remove();
  } else {
    slotModale.replaceWith(
      ConfirmationProduitView.dom(M.suppression, {
        surConfirmation: C.handler_confirmerSuppression,
        surRetour: C.handler_retour,
      })
    );
  }

  return pageFragment;
};

// params : paramètres d'URL de la route, ici { id } pour /admin/produits/:id
// (« nouveau » pour un nouveau produit).
export function AdminProduitPage(params) {
  return C.init(params.id);
}
