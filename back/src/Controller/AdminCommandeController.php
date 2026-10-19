<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CommandeModel;

/**
 * Changement de statut des commandes, réservé aux administrateurs.
 *
 * Seule l'annulation touche au stock : elle rend à chaque variante les
 * quantités de la commande. Les autres statuts ne font que suivre le retrait
 * en magasin. L'écran de gestion des commandes viendra avec PIL-b.
 */
final class AdminCommandeController
{
    /**
     * Statuts depuis lesquels on peut passer à chaque nouveau statut. Une
     * commande retirée ou annulée ne change plus.
     */
    private const TRANSITIONS = [
        'disponible' => ['en_cours'],
        'retiree'    => ['disponible'],
        'annulee'    => ['en_cours', 'disponible'],
    ];

    /** Le modèle qui modifie les commandes, fourni à la construction. */
    private CommandeModel $commandes;

    public function __construct(CommandeModel $commandes)
    {
        $this->commandes = $commandes;
    }

    /**
     * POST /api/admin/commande/statut, corps JSON { numero, statut }.
     */
    public function statut(Request $requete): void
    {
        // La session est déjà ouverte par index.php. Session d'administration
        // uniquement (voir AdminController).
        if (!isset($_SESSION['admin'])) {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }

        $corps   = $requete->corps();
        $numero  = (string) ($corps['numero'] ?? '');
        $nouveau = (string) ($corps['statut'] ?? '');

        if ($numero === '' || !array_key_exists($nouveau, self::TRANSITIONS)) {
            Response::erreur('Numéro de commande ou statut invalide', 422);
        }

        $resultat = $this->commandes->changerStatut(
            $numero,
            $nouveau,
            self::TRANSITIONS[$nouveau],
            $nouveau === 'annulee',
            (int) $_SESSION['admin']['id']
        );

        if ($resultat === null) {
            Response::erreur('Commande introuvable', 404);
        }

        if (!$resultat['change']) {
            Response::erreur("Une commande « {$resultat['avant']} » ne peut pas passer à « {$nouveau} ».", 422);
        }

        Response::json(['numero' => $numero, 'statut' => $nouveau, 'ancienStatut' => $resultat['avant']]);
    }
}
