<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CodePromoModel;
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
 *
 * Un code promo peut accompagner le panier : il est vérifié ici, et sa
 * réduction (un pourcentage du sous-total) est calculée ici aussi. Les mêmes
 * règles servent à l'enregistrement de la commande (CommandeController).
 */
final class PanierController
{
    /** Quantité maximale d'une ligne, même si le stock est plus grand. */
    private const QUANTITE_MAX = 99;

    /** Nombre maximal de lignes acceptées dans une requête. */
    private const LIGNES_MAX = 50;

    /** Message d'un code promo inconnu ou supprimé, celui de la maquette. */
    public const CODE_INVALIDE = 'Ce code promo n’existe pas ou n’est plus valide.';

    /** Le modèle qui interroge la base, fourni à la construction. */
    private PanierModel $paniers;

    /** Le modèle des codes promo, fourni à la construction. */
    private CodePromoModel $codes;

    public function __construct(PanierModel $paniers, CodePromoModel $codes)
    {
        $this->paniers = $paniers;
        $this->codes   = $codes;
    }

    /**
     * Le code promo saisi, vérifié en base : null si aucun code n'est saisi.
     * Répond 422 (et termine) si le code n'existe pas, ou s'il n'est pas du
     * texte : un code mal formé n'est pas ignoré en silence, la commande
     * passerait sans la réduction attendue. Partagé avec CommandeController.
     *
     * @return array{id: int, code: string, pourcentage: int}|null
     */
    public static function codeValide(CodePromoModel $codes, mixed $saisie): ?array
    {
        if ($saisie !== null && !is_string($saisie)) {
            Response::erreur(self::CODE_INVALIDE, 422);
        }

        $texte = mb_strtoupper(trim($saisie ?? ''));

        if ($texte === '') {
            return null;
        }

        $code = $codes->trouverParCode($texte);

        if ($code === null) {
            Response::erreur(self::CODE_INVALIDE, 422);
        }

        return $code;
    }

    /**
     * Montant de la réduction : le pourcentage du sous-total, arrondi au
     * centime (59,99 € à 10 % : 6,00 €). Partagé avec CommandeController.
     */
    public static function remise(float $sousTotal, int $pourcentage): float
    {
        return round($sousTotal * $pourcentage / 100, 2);
    }

    /**
     * POST /api/panier, corps JSON { lignes: [ { variantId, quantite } ], code }.
     * code : code promo saisi, facultatif.
     *
     * Répond avec les lignes reconnues, complétées par la base, leur
     * sous-total, leur quantité maximale (stock disponible, plafonné), le
     * total, le nombre d'articles et les ajustements faits pour respecter le
     * stock. Une variante inconnue (produit retiré de la vente) est ignorée.
     *
     * Ligne d'un produit en promotion automatique (ProduitController) : prix
     * et sousTotal réduits, prixInitial et sousTotalInitial d'origine ; null
     * pour les autres lignes.
     *
     * Avec un code : sousTotal (avant réduction), remise, codePromo
     * { code, pourcentage }, et total après réduction. Sans code : remise 0,
     * codePromo null, total égal à sousTotal. Code inconnu : 422.
     */
    public function index(Request $requete): void
    {
        $lignes = $requete->corps()['lignes'] ?? null;
        $code   = self::codeValide($this->codes, $requete->corps()['code'] ?? null);

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

            // Produit en promotion automatique : le prix réduit, et le prix
            // d'origine pour l'afficher barré.
            $initial   = $variantes[$id]['prix'];
            $enPromo   = $variantes[$id]['en_promotion'];
            $prix      = $enPromo ? ProduitController::prixPromotion($initial) : $initial;
            $sousTotal = round($prix * $accordee, 2);
            $total    += $sousTotal;
            $nombre   += $accordee;

            // Le stock exact ne part pas tel quel : seulement la quantité
            // maximale qu'on peut commander pour cette ligne.
            $ligne = $variantes[$id];
            unset($ligne['stock'], $ligne['en_promotion']);

            $detail[] = [
                'prix'             => $prix,
                'prixInitial'      => $enPromo ? $initial : null,
            ] + $ligne + [
                'variantId'        => $id,
                'quantite'         => $accordee,
                'quantiteMax'      => min($stock, self::QUANTITE_MAX),
                'sousTotal'        => $sousTotal,
                'sousTotalInitial' => $enPromo ? round($initial * $accordee, 2) : null,
            ];
        }

        $sousTotal = round($total, 2);
        $remise    = $code === null ? 0.0 : self::remise($sousTotal, $code['pourcentage']);

        Response::json([
            'lignes'      => $detail,
            'sousTotal'   => $sousTotal,
            'remise'      => $remise,
            'codePromo'   => $code === null ? null : ['code' => $code['code'], 'pourcentage' => $code['pourcentage']],
            'total'       => round($sousTotal - $remise, 2),
            'nombre'      => $nombre,
            'ajustements' => $ajustements,
        ]);
    }
}
