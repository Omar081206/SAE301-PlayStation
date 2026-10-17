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
     * Enregistre une commande et ses lignes, décrémente le stock de chaque
     * variante et inscrit chaque mouvement au journal. Renvoie le numéro de la
     * commande, ou null si une variante n'a plus assez de stock.
     *
     * Écriture atomique : tout est enregistré, ou rien ne l'est. Les variantes
     * sont verrouillées (FOR UPDATE) avant d'être relues : deux commandes
     * simultanées sur la dernière unité sont traitées l'une après l'autre, et
     * la seconde trouve un stock à 0.
     *
     * @param array<int, array{variantId: int, nom: string, coloris: ?string,
     *                         prix: float, quantite: int}> $lignes
     *        Lignes validées par le contrôleur, prix lus en base.
     */
    public function creer(int $utilisateurId, array $lignes, float $total): ?string
    {
        $this->pdo->beginTransaction();

        try {
            // Verrouillage dans un ordre fixe (par identifiant) : deux
            // transactions ne peuvent pas s'attendre mutuellement.
            $ids       = array_map(static fn (array $ligne): int => $ligne['variantId'], $lignes);
            $marqueurs = implode(', ', array_fill(0, count($ids), '?'));

            $requeteStock = $this->pdo->prepare(
                "SELECT id, stock FROM variante WHERE id IN ({$marqueurs}) ORDER BY id FOR UPDATE"
            );
            foreach (array_values($ids) as $position => $id) {
                $requeteStock->bindValue($position + 1, $id, PDO::PARAM_INT);
            }
            $requeteStock->execute();

            $stocks = [];
            foreach ($requeteStock->fetchAll() as $ligne) {
                $stocks[(int) $ligne['id']] = (int) $ligne['stock'];
            }

            foreach ($lignes as $ligne) {
                if (($stocks[$ligne['variantId']] ?? 0) < $ligne['quantite']) {
                    $this->pdo->rollBack();

                    return null;
                }
            }

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

                // « stock >= :quantite » : même sans le verrou, le stock ne
                // pourrait pas devenir négatif.
                $requeteDecrement = $this->pdo->prepare(
                    'UPDATE variante SET stock = stock - :quantite WHERE id = :id AND stock >= :minimum'
                );
                $requeteDecrement->bindValue(':quantite', $ligne['quantite'],  PDO::PARAM_INT);
                $requeteDecrement->bindValue(':minimum',  $ligne['quantite'],  PDO::PARAM_INT);
                $requeteDecrement->bindValue(':id',       $ligne['variantId'], PDO::PARAM_INT);
                $requeteDecrement->execute();

                if ($requeteDecrement->rowCount() !== 1) {
                    throw new \RuntimeException('Décrémentation du stock impossible');
                }

                $avant = $stocks[$ligne['variantId']];
                $this->journaliser($ligne['variantId'], $id, $utilisateurId, -$ligne['quantite'], 'commande', $avant);
                $stocks[$ligne['variantId']] = $avant - $ligne['quantite'];
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
     * Change le statut d'une commande, si son statut actuel le permet.
     *
     * La commande est verrouillée pendant le changement : deux demandes
     * simultanées ne peuvent pas partir du même statut. Avec $recrediter, le
     * stock de chaque ligne est rendu à sa variante et inscrit au journal,
     * dans la même transaction.
     *
     * @param string[] $statutsAutorises Statuts depuis lesquels le changement
     *                                   est permis (règle du contrôleur).
     * @return array{avant: string, change: bool}|null
     *         null si la commande n'existe pas ; change à false si son statut
     *         actuel (avant) ne fait pas partie des statuts autorisés.
     */
    public function changerStatut(
        string $numero,
        string $nouveau,
        array $statutsAutorises,
        bool $recrediter,
        int $auteurId
    ): ?array {
        $this->pdo->beginTransaction();

        try {
            $requeteCommande = $this->pdo->prepare('SELECT id, statut FROM commande WHERE numero = :numero FOR UPDATE');
            $requeteCommande->bindValue(':numero', $numero, PDO::PARAM_STR);
            $requeteCommande->execute();
            $commande = $requeteCommande->fetch();

            if ($commande === false) {
                $this->pdo->rollBack();

                return null;
            }

            if (!in_array($commande['statut'], $statutsAutorises, true)) {
                $this->pdo->rollBack();

                return ['avant' => $commande['statut'], 'change' => false];
            }

            $id = (int) $commande['id'];

            $requeteStatut = $this->pdo->prepare('UPDATE commande SET statut = :statut WHERE id = :id');
            $requeteStatut->bindValue(':statut', $nouveau, PDO::PARAM_STR);
            $requeteStatut->bindValue(':id',     $id,      PDO::PARAM_INT);
            $requeteStatut->execute();

            if ($recrediter) {
                // Lignes dont la variante existe encore, verrouillées par
                // identifiant comme à la commande.
                $requeteLignes = $this->pdo->prepare(
                    'SELECT ligne_commande.variante_id, ligne_commande.quantite, variante.stock
                       FROM ligne_commande
                 INNER JOIN variante ON variante.id = ligne_commande.variante_id
                      WHERE ligne_commande.commande_id = :id
                   ORDER BY ligne_commande.variante_id
                        FOR UPDATE'
                );
                $requeteLignes->bindValue(':id', $id, PDO::PARAM_INT);
                $requeteLignes->execute();

                $requeteCredit = $this->pdo->prepare('UPDATE variante SET stock = stock + :quantite WHERE id = :id');

                foreach ($requeteLignes->fetchAll() as $ligne) {
                    $variante = (int) $ligne['variante_id'];
                    $quantite = (int) $ligne['quantite'];

                    $requeteCredit->bindValue(':quantite', $quantite, PDO::PARAM_INT);
                    $requeteCredit->bindValue(':id',       $variante, PDO::PARAM_INT);
                    $requeteCredit->execute();

                    $this->journaliser($variante, $id, $auteurId, $quantite, 'annulation', (int) $ligne['stock']);
                }
            }

            $this->pdo->commit();

            return ['avant' => $commande['statut'], 'change' => true];
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Inscrit un mouvement de stock au journal (appelée dans une transaction
     * déjà ouverte).
     *
     * @param int $quantite Négative pour une sortie, positive pour un retour.
     */
    private function journaliser(int $varianteId, int $commandeId, int $utilisateurId, int $quantite, string $motif, int $stockAvant): void
    {
        $requetePreparee = $this->pdo->prepare(
            'INSERT INTO mouvement_stock (variante_id, commande_id, utilisateur_id, quantite, motif, stock_avant, stock_apres)
             VALUES (:variante, :commande, :utilisateur, :quantite, :motif, :avant, :apres)'
        );
        $requetePreparee->bindValue(':variante',    $varianteId,             PDO::PARAM_INT);
        $requetePreparee->bindValue(':commande',    $commandeId,             PDO::PARAM_INT);
        $requetePreparee->bindValue(':utilisateur', $utilisateurId,          PDO::PARAM_INT);
        $requetePreparee->bindValue(':quantite',    $quantite,               PDO::PARAM_INT);
        $requetePreparee->bindValue(':motif',       $motif,                  PDO::PARAM_STR);
        $requetePreparee->bindValue(':avant',       $stockAvant,             PDO::PARAM_INT);
        $requetePreparee->bindValue(':apres',       $stockAvant + $quantite, PDO::PARAM_INT);
        $requetePreparee->execute();
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
