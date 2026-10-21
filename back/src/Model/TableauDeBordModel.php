<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Indicateurs de la page d'accueil du back-office.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle compte ce qu'on lui demande et renvoie des nombres.
 */
final class TableauDeBordModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Nombre de produits et de commandes.
     *
     * @return array<string, int>
     */
    public function indicateurs(): array
    {
        $ligne = $this->pdo->query(
            'SELECT (SELECT COUNT(*) FROM produit)  AS produits,
                    (SELECT COUNT(*) FROM commande) AS commandes'
        )->fetch();

        // MySQL renvoie les nombres sous forme de chaînes : on les convertit
        // pour que le JSON contienne bien des nombres.
        return [
            'produits'  => (int) $ligne['produits'],
            'commandes' => (int) $ligne['commandes'],
        ];
    }
}
