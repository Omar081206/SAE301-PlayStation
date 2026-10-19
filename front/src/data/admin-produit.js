import { getRequest, postRequest } from "../lib/api-request.js";

let AdminProduitData = {};

/**
 * Tous les produits, et le seuil « Bientôt épuisé » : GET /api/admin/produits
 * 403 sans connexion administrateur.
 *
 * { produits: [ { id, nom, slug, categorie, prix, stock, variantes } ], seuil }
 * prix : le plus bas des variantes ; stock : la somme de leurs stocks.
 */
AdminProduitData.fetchAll = async function () {
  return getRequest("admin/produits");
};

/**
 * Un produit complet et les catégories : GET /api/admin/produit?id=…
 * id null : seulement les catégories (nouveau produit). 404 si le produit
 * n'existe pas.
 *
 * { produit: { id, categorie_id, nom, slug, description,
 *              options: [ { id, nom, valeurs: [ { id, valeur } ] } ],
 *              variantes: [ { id, prix, stock, valeurs } ],
 *              images: [ { id, variante_id, fichier, alt, ordre, affichage } ] } | null,
 *   categories: [ { id, nom } ] }
 */
AdminProduitData.fetchOne = async function (id) {
  return getRequest(id === null ? "admin/produit" : `admin/produit?id=${encodeURIComponent(id)}`);
};

/**
 * Enregistrement : POST /api/admin/produit/enregistrer, corps
 * { id, nom, categorie_id, description, options, variantes } (voir
 * AdminProduitController). 422 ou 409 si la saisie est refusée.
 *
 * { produit }
 */
AdminProduitData.enregistrer = async function (produit) {
  return postRequest("admin/produit/enregistrer", produit);
};

/**
 * Suppression : POST /api/admin/produit/supprimer, corps { id }.
 */
AdminProduitData.supprimer = async function (id) {
  return postRequest("admin/produit/supprimer", { id });
};

/**
 * Téléversement d'une image : POST /api/admin/produit/image, corps
 * { id, contenu } (contenu : l'image en data URL). { produit }
 */
AdminProduitData.ajouterImage = async function (id, contenu) {
  return postRequest("admin/produit/image", { id, contenu });
};

/**
 * Suppression d'une image : POST /api/admin/produit/image/supprimer. { produit }
 */
AdminProduitData.supprimerImage = async function (image) {
  return postRequest("admin/produit/image/supprimer", { image });
};

/**
 * Image principale de son groupe : POST /api/admin/produit/image/principale. { produit }
 */
AdminProduitData.rendrePrincipale = async function (image) {
  return postRequest("admin/produit/image/principale", { image });
};

/**
 * Rattache une image à une variante (null : au produit) :
 * POST /api/admin/produit/image/variante. { produit }
 */
AdminProduitData.rattacherImage = async function (image, variante) {
  return postRequest("admin/produit/image/variante", { image, variante });
};

/**
 * Où une image sert : POST /api/admin/produit/image/affichage, corps
 * { image, affichage } (« partout », « catalogue » ou « fiche »). { produit }
 */
AdminProduitData.changerAffichage = async function (image, affichage) {
  return postRequest("admin/produit/image/affichage", { image, affichage });
};

/**
 * Seuil « Bientôt épuisé » : POST /api/admin/parametre/seuil, corps { seuil }.
 */
AdminProduitData.modifierSeuil = async function (seuil) {
  return postRequest("admin/parametre/seuil", { seuil });
};

export { AdminProduitData };
