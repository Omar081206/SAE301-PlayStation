<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\ProduitModel;

/**
 * Catalogue de la boutique : la liste de tous les produits, et la fiche de chacun.
 *
 * Le catalogue tient sur une page (15 produits) : ni tri ni pagination.
 */
final class ProduitController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProduitModel $produits;

    public function __construct(ProduitModel $produits)
    {
        $this->produits = $produits;
    }

    /**
     * GET /api/produits : tous les produits, avec leur nombre.
     */
    public function index(Request $requete): void
    {
        $produits = $this->produits->lister();

        Response::json([
            'produits' => $produits,
            'total'    => count($produits),
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
