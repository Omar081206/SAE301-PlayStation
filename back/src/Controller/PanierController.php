<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\PanierModel;

/**
 * Détail du panier.
 *
 * Le navigateur ne connaît que des identifiants de variantes et des
 * quantités. Les prix, les sous-totaux et le total sont toujours calculés ici,
 * depuis la base : le client ne fait jamais foi.
 */
final class PanierController
{
    /** Quantité maximale d'une ligne, en attendant les contraintes de stock. */
    private const QUANTITE_MAX = 99;

    /** Nombre maximal de lignes acceptées dans une requête. */
    private const LIGNES_MAX = 50;

    /** Le modèle qui interroge la base, fourni à la construction. */
    private PanierModel $paniers;

    public function __construct(PanierModel $paniers)
    {
        $this->paniers = $paniers;
    }

    /**
     * POST /api/panier, corps JSON { lignes: [ { variantId, quantite } ] }.
     *
     * Répond avec les lignes reconnues, complétées par la base, leur
     * sous-total, le total et le nombre d'articles. Une variante inconnue
     * (produit retiré de la vente) est ignorée.
     */
    public function index(Request $requete): void
    {
        $lignes = $requete->corps()['lignes'] ?? null;

        if (!is_array($lignes) || count($lignes) > self::LIGNES_MAX) {
            Response::erreur('Panier invalide', 422);
        }

        // Validation : des entiers, dans les bornes. Une même variante n'a
        // qu'une ligne ; si elle revient, la dernière quantité l'emporte.
        $quantites = [];

        foreach ($lignes as $ligne) {
            $id       = $ligne['variantId'] ?? null;
            $quantite = $ligne['quantite'] ?? null;

            if (!is_int($id) || $id <= 0 || !is_int($quantite) || $quantite < 1 || $quantite > self::QUANTITE_MAX) {
                Response::erreur('Ligne de panier invalide', 422);
            }

            $quantites[$id] = $quantite;
        }

        $variantes = $this->paniers->detailler(array_keys($quantites));

        $detail = [];
        $total  = 0.0;
        $nombre = 0;

        foreach ($quantites as $id => $quantite) {
            if (!isset($variantes[$id])) {
                continue;
            }

            $sousTotal = round($variantes[$id]['prix'] * $quantite, 2);
            $total    += $sousTotal;
            $nombre   += $quantite;

            $detail[] = $variantes[$id] + [
                'variantId' => $id,
                'quantite'  => $quantite,
                'sousTotal' => $sousTotal,
            ];
        }

        Response::json([
            'lignes' => $detail,
            'total'  => round($total, 2),
            'nombre' => $nombre,
        ]);
    }
}
