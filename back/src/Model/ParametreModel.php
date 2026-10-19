<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux paramètres de la boutique (table parametre).
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien : elle
 * renvoie la valeur brute, que le contrôleur interprète.
 */
final class ParametreModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * La valeur d'un paramètre, ou null s'il n'existe pas.
     *
     * Une base importée avant la création de la table parametre n'a aucun
     * paramètre : null aussi, et le contrôleur applique sa valeur par défaut,
     * plutôt que de rendre tout le catalogue indisponible.
     */
    public function lire(string $cle): ?string
    {
        try {
            $requetePreparee = $this->pdo->prepare('SELECT valeur FROM parametre WHERE cle = :cle');
            $requetePreparee->bindValue(':cle', $cle, PDO::PARAM_STR);
            $requetePreparee->execute();
        } catch (\PDOException $e) {
            // 42S02 : table absente. Toute autre erreur reste une vraie panne.
            if ($e->getCode() !== '42S02') {
                throw $e;
            }

            return null;
        }

        $valeur = $requetePreparee->fetchColumn();

        return $valeur === false ? null : (string) $valeur;
    }

    /**
     * Enregistre la valeur d'un paramètre, créé avec sa description s'il
     * n'existe pas encore (sinon, la description ne change pas).
     */
    public function ecrire(string $cle, string $valeur, string $description): void
    {
        $requetePreparee = $this->pdo->prepare(
            'INSERT INTO parametre (cle, valeur, description) VALUES (:cle, :valeur, :description)
             ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)'
        );
        $requetePreparee->bindValue(':cle',         $cle,         PDO::PARAM_STR);
        $requetePreparee->bindValue(':valeur',      $valeur,      PDO::PARAM_STR);
        $requetePreparee->bindValue(':description', $description, PDO::PARAM_STR);
        $requetePreparee->execute();
    }
}
