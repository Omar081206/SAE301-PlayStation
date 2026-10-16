<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux commandes et à leurs lignes.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien : elle
 * enregistre ce que le contrôleur a validé et calculé, et relit les commandes.
 */
final class CommandeModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Enregistre une commande et ses lignes, et renvoie son numéro.
     *
     * Écriture atomique : la commande et toutes ses lignes sont enregistrées,
     * ou rien ne l'est.
     *
     * @param array<int, array{variantId: int, nom: string, coloris: ?string,
     *                         prix: float, quantite: int}> $lignes
     *        Lignes validées par le contrôleur, prix lus en base.
     */
    public function creer(int $utilisateurId, array $lignes, float $total): string
    {
        $this->pdo->beginTransaction();

        try {
            $requetePreparee = $this->pdo->prepare(
                'INSERT INTO commande (utilisateur_id, total) VALUES (:utilisateur, :total)'
            );
            $requetePreparee->bindValue(':utilisateur', $utilisateurId, PDO::PARAM_INT);
            $requetePreparee->bindValue(':total',       (string) $total, PDO::PARAM_STR);
            $requetePreparee->execute();

            $id = (int) $this->pdo->lastInsertId();

            // Le numéro dérive de l'identifiant, unique par construction :
            // aucun risque que deux commandes simultanées reçoivent le même.
            $requeteNumero = $this->pdo->prepare(
                "UPDATE commande
                    SET numero = CONCAT('PS-', DATE_FORMAT(cree_le, '%Y%m%d'), '-', LPAD(id, 4, '0'))
                  WHERE id = :id"
            );
            $requeteNumero->bindValue(':id', $id, PDO::PARAM_INT);
            $requeteNumero->execute();

            $requeteLigne = $this->pdo->prepare(
                'INSERT INTO ligne_commande (commande_id, variante_id, nom, coloris, prix_unitaire, quantite)
                 VALUES (:commande, :variante, :nom, :coloris, :prix, :quantite)'
            );

            foreach ($lignes as $ligne) {
                $requeteLigne->bindValue(':commande', $id,                       PDO::PARAM_INT);
                $requeteLigne->bindValue(':variante', $ligne['variantId'],       PDO::PARAM_INT);
                $requeteLigne->bindValue(':nom',      $ligne['nom'],             PDO::PARAM_STR);
                $requeteLigne->bindValue(':coloris',  $ligne['coloris'],         $ligne['coloris'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $requeteLigne->bindValue(':prix',     (string) $ligne['prix'],   PDO::PARAM_STR);
                $requeteLigne->bindValue(':quantite', $ligne['quantite'],        PDO::PARAM_INT);
                $requeteLigne->execute();
            }

            $requeteLecture = $this->pdo->prepare('SELECT numero FROM commande WHERE id = :id');
            $requeteLecture->bindValue(':id', $id, PDO::PARAM_INT);
            $requeteLecture->execute();
            $numero = (string) $requeteLecture->fetchColumn();

            $this->pdo->commit();

            return $numero;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Une commande d'un utilisateur, avec ses lignes, ou null si elle n'existe
     * pas ou appartient à quelqu'un d'autre.
     *
     * @return array<string, mixed>|null
     */
    public function trouver(string $numero, int $utilisateurId): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT id, numero, statut, total, cree_le
               FROM commande
              WHERE numero = :numero AND utilisateur_id = :utilisateur'
        );
        $requetePreparee->bindValue(':numero',      $numero,        PDO::PARAM_STR);
        $requetePreparee->bindValue(':utilisateur', $utilisateurId, PDO::PARAM_INT);
        $requetePreparee->execute();

        $commande = $requetePreparee->fetch();

        if ($commande === false) {
            return null;
        }

        $requeteLignes = $this->pdo->prepare(
            'SELECT nom, coloris, prix_unitaire, quantite
               FROM ligne_commande
              WHERE commande_id = :id
           ORDER BY id'
        );
        $requeteLignes->bindValue(':id', (int) $commande['id'], PDO::PARAM_INT);
        $requeteLignes->execute();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $lignes = [];

        foreach ($requeteLignes->fetchAll() as $ligne) {
            $lignes[] = [
                'nom'           => $ligne['nom'],
                'coloris'       => $ligne['coloris'],
                'prix_unitaire' => (float) $ligne['prix_unitaire'],
                'quantite'      => (int) $ligne['quantite'],
                'sous_total'    => round((float) $ligne['prix_unitaire'] * (int) $ligne['quantite'], 2),
            ];
        }

        return [
            'numero'  => $commande['numero'],
            'statut'  => $commande['statut'],
            'total'   => (float) $commande['total'],
            'cree_le' => $commande['cree_le'],
            'lignes'  => $lignes,
        ];
    }
}
