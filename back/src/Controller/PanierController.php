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
 *
 * Les quantités sont aussi confrontées au stock réel de chaque variante : une
 * quantité trop grande est ramenée au stock, une variante épuisée est retirée,
 * et chaque correction est signalée dans « ajustements ».
 */
final class PanierController
{
    /** Quantité maximale d'une ligne, même si le stock est plus grand. */
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
     * sous-total, leur quantité maximale (stock disponible, plafonné), le
     * total, le nombre d'articles et les ajustements faits pour respecter le
     * stock. Une variante inconnue (produit retiré de la vente) est ignorée.
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

        $detail      = [];
        $ajustements = [];
        $total       = 0.0;
        $nombre      = 0;

        foreach ($quantites as $id => $quantite) {
            if (!isset($variantes[$id])) {
                continue;
            }

            // Jamais plus que le stock : la quantité accordée peut être 0.
            $stock    = $variantes[$id]['stock'];
            $accordee = min($quantite, $stock);

            if ($accordee < $quantite) {
                $ajustements[] = [
                    'variantId' => $id,
                    'nom'       => $variantes[$id]['nom'],
                    'demandee'  => $quantite,
                    'accordee'  => $accordee,
                ];
            }

            if ($accordee === 0) {
                continue;
            }

            $sousTotal = round($variantes[$id]['prix'] * $accordee, 2);
            $total    += $sousTotal;
            $nombre   += $accordee;

            // Le stock exact ne part pas tel quel : seulement la quantité
            // maximale qu'on peut commander pour cette ligne.
            $ligne = $variantes[$id];
            unset($ligne['stock']);

            $detail[] = $ligne + [
                'variantId'   => $id,
                'quantite'    => $accordee,
                'quantiteMax' => min($stock, self::QUANTITE_MAX),
                'sousTotal'   => $sousTotal,
            ];
        }

        Response::json([
            'lignes'      => $detail,
            'total'       => round($total, 2),
            'nombre'      => $nombre,
            'ajustements' => $ajustements,
        ]);
    }
}
