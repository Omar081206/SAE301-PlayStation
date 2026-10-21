<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\ParametreModel;
use App\Model\StatistiqueModel;

/**
 * Statistiques du back-office, réservées aux administrateurs.
 *
 * Tout est recalculé à chaque demande : rien n'est mis en cache. Comme sur le
 * catalogue, le stock d'une variante s'accompagne de son état (en stock,
 * bientôt épuisé, épuisé), calculé ici avec le seuil de la boutique.
 */
final class AdminStatistiqueController
{
    /** Période des commandes et des revenus, en jours (aujourd'hui compris). */
    private const PERIODE = 7;

    /** Nombre de produits du classement des ventes (celui de la maquette). */
    private const MEILLEURES_VENTES = 3;

    /** Statuts comptés, dans l'ordre de la maquette. */
    private const STATUTS = ['en_cours', 'disponible', 'retiree', 'annulee'];

    /** Seuil « bientôt épuisé » sans paramètre en base (voir ProduitController). */
    private const SEUIL_PAR_DEFAUT = 3;

    /** Le modèle des statistiques, fourni à la construction. */
    private StatistiqueModel $statistiques;

    /** Le modèle des paramètres (seuil de stock), fourni à la construction. */
    private ParametreModel $parametres;

    public function __construct(StatistiqueModel $statistiques, ParametreModel $parametres)
    {
        $this->statistiques = $statistiques;
        $this->parametres   = $parametres;
    }

    /**
     * Répond 403 (et termine) sans session d'administration (voir
     * AdminController). La session est déjà ouverte par index.php.
     */
    private function verifierAdmin(): void
    {
        if (!isset($_SESSION['admin'])) {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }
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
     * GET /api/admin/statistiques : les indicateurs de la page Statistiques.
     *
     * {
     *   periode: 7,
     *   commandes: { total, en_cours, disponible, retiree, annulee },
     *   revenus: { jours: [{ jour: "2026-10-15", total }], total },
     *   stocks: [{ nom, options, stock, etat_stock }],
     *   meilleuresVentes: [{ nom, ventes }]
     * }
     *
     * Commandes et revenus portent sur les 7 derniers jours ; les revenus ne
     * comptent pas les commandes annulées.
     */
    public function index(): void
    {
        $this->verifierAdmin();

        // Un statut absent de la période vaut 0.
        $parStatut = $this->statistiques->commandesParStatut(self::PERIODE);
        $commandes = ['total' => array_sum($parStatut)];

        foreach (self::STATUTS as $statut) {
            $commandes[$statut] = $parStatut[$statut] ?? 0;
        }

        $jours = $this->statistiques->revenusParJour(self::PERIODE);

        $seuil  = $this->seuil();
        $stocks = $this->statistiques->stocks();

        foreach ($stocks as $position => $variante) {
            $stocks[$position]['etat_stock'] = $this->etatStock($variante['stock'], $seuil);
        }

        Response::json([
            'periode'          => self::PERIODE,
            'commandes'        => $commandes,
            'revenus'          => [
                'jours' => $jours,
                'total' => round(array_sum(array_column($jours, 'total')), 2),
            ],
            'stocks'           => $stocks,
            'meilleuresVentes' => $this->statistiques->meilleuresVentes(self::MEILLEURES_VENTES),
        ]);
    }
}
