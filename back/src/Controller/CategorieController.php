<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;

/**
 * Catégories de la boutique, pour le menu de navigation du catalogue.
 */
final class CategorieController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private CategorieModel $categories;

    public function __construct(CategorieModel $categories)
    {
        $this->categories = $categories;
    }

    /**
     * GET /api/categories : toutes les catégories avec leur nombre de produits,
     * et le nombre total de produits (pour « Tous les produits »).
     */
    public function index(Request $requete): void
    {
        $categories = $this->categories->lister();

        Response::json([
            'categories' => $categories,
            'total'      => array_sum(array_column($categories, 'nombre')),
        ]);
    }
}
