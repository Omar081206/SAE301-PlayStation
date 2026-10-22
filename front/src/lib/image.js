/**
 * Adresses des images produits. L'API ne donne que le nom de l'original
 * (« ps5.webp ») ; ses miniatures sont posées à côté de lui (« ps5-320.webp »,
 * « ps5-640.webp » : plus grand côté en px), dans front/public/images/produits/
 * ou, pour une image téléversée (« u-… »), dans uploads/produits/ (voir
 * AdminProduitController::MINIATURES).
 */

const DOSSIER = import.meta.env.BASE_URL + "images/produits/";

/**
 * « ps5.webp » -> adresse de l'original (fiche produit)
 */
export function urlImage(fichier) {
  return DOSSIER + fichier;
}

/**
 * « ps5.webp », 320 -> adresse de « ps5-320.webp »
 */
export function urlMiniature(fichier, cote) {
  return DOSSIER + fichier.replace(/\.[a-z]+$/, "") + `-${cote}.webp`;
}

/**
 * « ps5.webp » -> attribut srcset des deux miniatures : le navigateur choisit
 * selon la largeur affichée (sizes) et la densité de l'écran.
 */
export function srcsetMiniatures(fichier) {
  return `${urlMiniature(fichier, 320)} 320w, ${urlMiniature(fichier, 640)} 640w`;
}

/**
 * Si la miniature manque (image déposée à la main sans ses miniatures),
 * l'élément <img> revient à l'original au lieu d'afficher une image cassée.
 */
export function secoursOriginal(img, fichier) {
  img.addEventListener(
    "error",
    () => {
      img.removeAttribute("srcset");
      img.src = urlImage(fichier);
    },
    { once: true }
  );
}
