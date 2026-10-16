<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;
use App\Model\ProduitModel;

/**
 * Catalogue de la boutique : la liste des produits, filtrée ou non par
 * catégorie, et la fiche de chacun.
 *
 * Le catalogue tient sur une page (15 produits) : ni tri ni pagination.
 */
final class ProduitController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProduitModel $produits;

    /** Le modèle des catégories, pour vérifier la catégorie demandée. */
    private CategorieModel $categories;

    public function __construct(ProduitModel $produits, CategorieModel $categories)
    {
        $this->produits   = $produits;
        $this->categories = $categories;
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

        Response::json(['produit' => $produit]);
    }
}
