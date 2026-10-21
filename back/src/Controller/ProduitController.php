<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;
use App\Model\ParametreModel;
use App\Model\ProduitModel;

/**
 * Catalogue de la boutique : la liste des produits, filtrée ou non par
 * catégorie, et la fiche de chacun.
 *
 * Le catalogue tient sur une page (15 produits) : ni tri ni pagination.
 *
 * L'état du stock (« en stock », « bientôt épuisé », « épuisé ») est calculé
 * ici, à chaque requête, à partir du stock réel et du seuil de la table
 * parametre. Les quantités elles-mêmes ne sont jamais envoyées au navigateur.
 *
 * Promotion automatique (PRO-c) : le produit au plus grand stock (voir
 * ProduitModel::EN_PROMOTION) est vendu −20 %. prix est alors le prix réduit,
 * prix_initial le prix d'origine et promotion le pourcentage ; pour les autres
 * produits, prix_initial et promotion valent null. Le calcul est partagé avec
 * PanierController et CommandeController (prixPromotion).
 */
final class ProduitController
{
    /** Seuil « bientôt épuisé » utilisé si le paramètre est absent de la base. */
    private const SEUIL_PAR_DEFAUT = 3;

    /** Réduction de la promotion automatique, en pourcentage. */
    public const PROMOTION = 20;

    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProduitModel $produits;

    /** Le modèle des catégories, pour vérifier la catégorie demandée. */
    private CategorieModel $categories;

    /** Le modèle des paramètres, pour le seuil « bientôt épuisé ». */
    private ParametreModel $parametres;

    public function __construct(ProduitModel $produits, CategorieModel $categories, ParametreModel $parametres)
    {
        $this->produits   = $produits;
        $this->categories = $categories;
        $this->parametres = $parametres;
    }

    /**
     * Seuil « bientôt épuisé » : un stock de 1 à ce seuil est « bientôt épuisé ».
     */
    private function seuil(): int
    {
        $valeur = $this->parametres->lire('seuil_bientot_epuise');

        return $valeur === null ? self::SEUIL_PAR_DEFAUT : max(0, (int) $valeur);
    }

    /**
     * État affiché pour un stock donné.
     */
    private function etatStock(int $stock, int $seuil): string
    {
        if ($stock <= 0) {
            return 'epuise';
        }

        return $stock <= $seuil ? 'bientot_epuise' : 'en_stock';
    }

    /**
     * Prix réduit par la promotion automatique, arrondi au centime (74,99 € :
     * 59,99 €). Partagé avec PanierController et CommandeController.
     */
    public static function prixPromotion(float $prix): float
    {
        return round($prix * (100 - self::PROMOTION) / 100, 2);
    }

    /**
     * Prix d'un produit ou d'une variante : prix (payé), prix_initial et
     * promotion, selon que le produit est en promotion ou non.
     *
     * @return array{prix: float, prix_initial: ?float, promotion: ?int}
     */
    private function prix(float $prix, bool $enPromotion): array
    {
        if (!$enPromotion) {
            return ['prix' => $prix, 'prix_initial' => null, 'promotion' => null];
        }

        return ['prix' => self::prixPromotion($prix), 'prix_initial' => $prix, 'promotion' => self::PROMOTION];
    }

    /**
     * GET /api/produits?categorie=… : les produits, avec leur nombre.
     *
     * Sans le paramètre categorie, tout le catalogue ; avec, les produits de
     * cette catégorie, et la catégorie elle-même (pour le titre de la page).
     */
    public function index(Request $requete): void
    {
        $slug      = $requete->parametre('categorie');
        $categorie = null;

        if ($slug !== null) {
            $categorie = $this->categories->trouver($slug);

            if ($categorie === null) {
                Response::erreur('Catégorie introuvable', 404);
            }
        }

        $produits = $this->produits->lister($slug);
        $seuil    = $this->seuil();

        // L'état remplace la quantité, qui reste côté serveur. Le prix tient
        // compte de la promotion automatique.
        foreach ($produits as $position => $produit) {
            $produits[$position] = $this->prix($produit['prix'], $produit['en_promotion']) + $produit;
            $produits[$position]['etat_stock'] = $this->etatStock($produit['stock'], $seuil);
            unset($produits[$position]['stock'], $produits[$position]['en_promotion']);
        }

        Response::json([
            'produits'  => $produits,
            'total'     => count($produits),
            'categorie' => $categorie,
        ]);
    }

    /**
     * GET /api/produit?slug=… : la fiche d'un produit.
     */
    public function detail(Request $requete): void
    {
        $slug = $requete->parametre('slug');

        if ($slug === null || $slug === '') {
            Response::erreur('Le paramètre slug est obligatoire', 400);
        }

        $produit = $this->produits->trouver($slug);

        if ($produit === null) {
            Response::erreur('Produit introuvable', 404);
        }

        // Un état par variante, et celui de la variante par défaut (la
        // première en stock) pour le badge principal. Les quantités restent ici.
        $seuil = $this->seuil();

        // La promotion vaut pour toutes les variantes du produit.
        foreach ($produit['variantes'] as $position => $variante) {
            $produit['variantes'][$position] = $this->prix($variante['prix'], $produit['en_promotion']) + $variante;
            $produit['variantes'][$position]['etat_stock'] = $this->etatStock($variante['stock'], $seuil);
            unset($produit['variantes'][$position]['stock']);
        }

        $produit = $this->prix($produit['prix'], $produit['en_promotion']) + $produit;
        unset($produit['en_promotion']);

        foreach ($produit['variantes'] as $variante) {
            if ($variante['id'] === $produit['variante_id']) {
                $produit['etat_stock'] = $variante['etat_stock'];
            }
        }

        Response::json(['produit' => $produit]);
    }
}
