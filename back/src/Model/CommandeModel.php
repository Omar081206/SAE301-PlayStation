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
    /**
     * Colonnes de tri de la liste du back-office, par clé reçue du
     * contrôleur. Le statut est un ENUM : MySQL le trie dans l'ordre de sa
     * déclaration (en cours, disponible, retirée, annulée).
     */
    private const TRIS = [
        'numero'  => 'commande.id',
        'date'    => 'commande.cree_le',
        'statut'  => 'commande.statut',
        'montant' => 'commande.total',
    ];

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
     * @param array<int, array{variantId: int, nom: string, options: ?string,
     *                         prix: float, quantite: int}> $lignes
     *        Lignes validées par le contrôleur, prix lus en base.
     * @param float $total Montant payé : somme des lignes, moins la remise.
     * @param array{id: int, code: string, pourcentage: int}|null $promo
     *        Code promo vérifié par le contrôleur, ou null ; son texte et sa
     *        réduction sont recopiés dans la commande.
     * @param float $remise Montant déduit grâce au code (0 sans code).
     */
    public function creer(int $utilisateurId, array $lignes, float $total, ?array $promo = null, float $remise = 0.0): ?string
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
                'INSERT INTO commande (utilisateur_id, total, code_promo_id, code_promo, pourcentage_promo, remise)
                 VALUES (:utilisateur, :total, :code_id, :code, :pourcentage, :remise)'
            );
            $requetePreparee->bindValue(':utilisateur', $utilisateurId,   PDO::PARAM_INT);
            $requetePreparee->bindValue(':total',       (string) $total,  PDO::PARAM_STR);
            $requetePreparee->bindValue(':code_id',     $promo['id'] ?? null,          $promo === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $requetePreparee->bindValue(':code',        $promo['code'] ?? null,        $promo === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $requetePreparee->bindValue(':pourcentage', $promo['pourcentage'] ?? null, $promo === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $requetePreparee->bindValue(':remise',      (string) $remise, PDO::PARAM_STR);
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
                'INSERT INTO ligne_commande (commande_id, variante_id, nom, options, prix_unitaire, quantite)
                 VALUES (:commande, :variante, :nom, :options, :prix, :quantite)'
            );

            foreach ($lignes as $ligne) {
                $requeteLigne->bindValue(':commande', $id,                       PDO::PARAM_INT);
                $requeteLigne->bindValue(':variante', $ligne['variantId'],       PDO::PARAM_INT);
                $requeteLigne->bindValue(':nom',      $ligne['nom'],             PDO::PARAM_STR);
                $requeteLigne->bindValue(':options',  $ligne['options'],         $ligne['options'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
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
     * simultanées ne peuvent pas partir du même statut. Le changement est
     * inscrit au journal des administrateurs (journal_admin) et, avec
     * $recrediter, le stock de chaque ligne est rendu à sa variante et inscrit
     * au journal des stocks, dans la même transaction.
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

            $requeteJournal = $this->pdo->prepare(
                'INSERT INTO journal_admin (commande_id, utilisateur_id, ancien_statut, nouveau_statut)
                 VALUES (:commande, :auteur, :ancien, :nouveau)'
            );
            $requeteJournal->bindValue(':commande', $id,                  PDO::PARAM_INT);
            $requeteJournal->bindValue(':auteur',   $auteurId,            PDO::PARAM_INT);
            $requeteJournal->bindValue(':ancien',   $commande['statut'],  PDO::PARAM_STR);
            $requeteJournal->bindValue(':nouveau',  $nouveau,             PDO::PARAM_STR);
            $requeteJournal->execute();

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
            'SELECT id, numero, statut, total, code_promo, pourcentage_promo, remise, cree_le
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

        return [
            'numero'            => $commande['numero'],
            'statut'            => $commande['statut'],
            'total'             => (float) $commande['total'],
            'code_promo'        => $commande['code_promo'],
            'pourcentage_promo' => $commande['pourcentage_promo'] === null ? null : (int) $commande['pourcentage_promo'],
            'remise'            => (float) $commande['remise'],
            'cree_le'           => $commande['cree_le'],
            'lignes'            => $this->lignes((int) $commande['id']),
        ];
    }

    /**
     * Les dernières commandes d'un utilisateur, la plus récente d'abord :
     * numéro, date, statut et total (aperçu de l'espace personnel).
     *
     * @return array<int, array<string, mixed>>
     */
    public function recentes(int $utilisateurId, int $limite): array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT numero, statut, total, cree_le
               FROM commande
              WHERE utilisateur_id = :utilisateur
           ORDER BY cree_le DESC, id DESC
              LIMIT :limite'
        );
        $requetePreparee->bindValue(':utilisateur', $utilisateurId, PDO::PARAM_INT);
        $requetePreparee->bindValue(':limite',      $limite,        PDO::PARAM_INT);
        $requetePreparee->execute();

        $commandes = [];

        foreach ($requetePreparee->fetchAll() as $ligne) {
            $commandes[] = [
                'numero'  => $ligne['numero'],
                'statut'  => $ligne['statut'],
                'total'   => (float) $ligne['total'],
                'cree_le' => $ligne['cree_le'],
            ];
        }

        return $commandes;
    }

    /**
     * Une page des commandes d'un utilisateur, la plus récente d'abord, et le
     * nombre de commandes par statut sur la période (pour les filtres).
     *
     * @param string|null $statut   Statut à garder, ou null pour tous (déjà
     *                              validé par le contrôleur).
     * @param int|null    $jours    Période en jours avant aujourd'hui, ou null
     *                              pour toutes les commandes.
     * @return array{commandes: array<int, array<string, mixed>>, total: int,
     *               compteurs: array<string, int>}
     *         total : nombre de commandes qui correspondent aux filtres.
     */
    public function historique(int $utilisateurId, ?string $statut, ?int $jours, int $limite, int $decalage): array
    {
        // Conditions communes : le client, et la période s'il y en a une.
        $conditions = 'utilisateur_id = :utilisateur AND (:jours IS NULL OR cree_le >= NOW() - INTERVAL :jours_valeur DAY)';

        $requeteCompteurs = $this->pdo->prepare(
            "SELECT statut, COUNT(*) AS nombre FROM commande WHERE {$conditions} GROUP BY statut"
        );
        $requeteCompteurs->bindValue(':utilisateur',  $utilisateurId, PDO::PARAM_INT);
        $requeteCompteurs->bindValue(':jours',        $jours,         $jours === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $requeteCompteurs->bindValue(':jours_valeur', $jours ?? 0,    PDO::PARAM_INT);
        $requeteCompteurs->execute();

        $compteurs = ['en_cours' => 0, 'disponible' => 0, 'retiree' => 0, 'annulee' => 0];
        foreach ($requeteCompteurs->fetchAll() as $ligne) {
            $compteurs[$ligne['statut']] = (int) $ligne['nombre'];
        }

        $requetePreparee = $this->pdo->prepare(
            "SELECT numero, statut, total, cree_le
               FROM commande
              WHERE {$conditions} AND (:statut IS NULL OR statut = :statut_valeur)
           ORDER BY cree_le DESC, id DESC
              LIMIT :limite OFFSET :decalage"
        );
        $requetePreparee->bindValue(':utilisateur',   $utilisateurId, PDO::PARAM_INT);
        $requetePreparee->bindValue(':jours',         $jours,         $jours === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $requetePreparee->bindValue(':jours_valeur',  $jours ?? 0,    PDO::PARAM_INT);
        $requetePreparee->bindValue(':statut',        $statut,        $statut === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $requetePreparee->bindValue(':statut_valeur', $statut ?? '',  PDO::PARAM_STR);
        $requetePreparee->bindValue(':limite',        $limite,        PDO::PARAM_INT);
        $requetePreparee->bindValue(':decalage',      $decalage,      PDO::PARAM_INT);
        $requetePreparee->execute();

        $commandes = [];

        foreach ($requetePreparee->fetchAll() as $ligne) {
            $commandes[] = [
                'numero'  => $ligne['numero'],
                'statut'  => $ligne['statut'],
                'total'   => (float) $ligne['total'],
                'cree_le' => $ligne['cree_le'],
            ];
        }

        return [
            'commandes' => $commandes,
            'total'     => $statut === null ? array_sum($compteurs) : $compteurs[$statut],
            'compteurs' => $compteurs,
        ];
    }

    /**
     * Les lignes d'une commande, prix figés à la commande. variantId : la
     * variante commandée (pour la commander à nouveau), null si elle a été
     * supprimée depuis.
     *
     * @return array<int, array<string, mixed>>
     */
    private function lignes(int $commandeId): array
    {
        $requeteLignes = $this->pdo->prepare(
            'SELECT variante_id, nom, options, prix_unitaire, quantite
               FROM ligne_commande
              WHERE commande_id = :id
           ORDER BY id'
        );
        $requeteLignes->bindValue(':id', $commandeId, PDO::PARAM_INT);
        $requeteLignes->execute();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $lignes = [];

        foreach ($requeteLignes->fetchAll() as $ligne) {
            $lignes[] = [
                'variantId'     => $ligne['variante_id'] === null ? null : (int) $ligne['variante_id'],
                'nom'           => $ligne['nom'],
                'options'       => $ligne['options'],
                'prix_unitaire' => (float) $ligne['prix_unitaire'],
                'quantite'      => (int) $ligne['quantite'],
                'sous_total'    => round((float) $ligne['prix_unitaire'] * (int) $ligne['quantite'], 2),
            ];
        }

        return $lignes;
    }

    /**
     * Toutes les commandes, pour le back-office : numéro, date, client,
     * nombre d'articles, total et statut.
     *
     * @param string $tri  Clé de TRIS (numero, date, statut ou montant), déjà
     *                     validée par le contrôleur.
     * @param bool   $croissant Sens du tri ; à valeur égale, la plus récente
     *                          d'abord.
     * @return array<int, array<string, mixed>>
     */
    public function listerPourAdmin(string $tri, bool $croissant): array
    {
        // La colonne et le sens viennent de listes fixes, jamais de la
        // requête : ils peuvent être écrits dans le SQL.
        $colonne = self::TRIS[$tri] ?? self::TRIS['date'];
        $sens    = $croissant ? 'ASC' : 'DESC';

        $sql = "SELECT commande.numero,
                       commande.statut,
                       commande.total,
                       commande.cree_le,
                       utilisateur.prenom,
                       utilisateur.nom,
                       COALESCE(SUM(ligne_commande.quantite), 0) AS articles
                  FROM commande
            INNER JOIN utilisateur    ON utilisateur.id = commande.utilisateur_id
             LEFT JOIN ligne_commande ON ligne_commande.commande_id = commande.id
              GROUP BY commande.id, commande.numero, commande.statut, commande.total,
                       commande.cree_le, utilisateur.prenom, utilisateur.nom
              ORDER BY {$colonne} {$sens}, commande.cree_le DESC, commande.id DESC";

        $commandes = [];

        foreach ($this->pdo->query($sql)->fetchAll() as $ligne) {
            $commandes[] = [
                'numero'   => $ligne['numero'],
                'statut'   => $ligne['statut'],
                'total'    => (float) $ligne['total'],
                'cree_le'  => $ligne['cree_le'],
                'client'   => trim($ligne['prenom'] . ' ' . $ligne['nom']),
                'articles' => (int) $ligne['articles'],
            ];
        }

        return $commandes;
    }

    /**
     * Une commande, quel que soit son client, pour le back-office : lignes,
     * client et historique des changements de statut. null si elle n'existe
     * pas.
     *
     * @return array<string, mixed>|null
     */
    public function trouverPourAdmin(string $numero): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT commande.id, commande.numero, commande.statut, commande.total, commande.cree_le,
                    utilisateur.prenom, utilisateur.nom, utilisateur.email
               FROM commande
         INNER JOIN utilisateur ON utilisateur.id = commande.utilisateur_id
              WHERE commande.numero = :numero'
        );
        $requetePreparee->bindValue(':numero', $numero, PDO::PARAM_STR);
        $requetePreparee->execute();

        $commande = $requetePreparee->fetch();

        if ($commande === false) {
            return null;
        }

        // Un administrateur supprimé depuis : l'auteur reste inconnu (NULL).
        $requeteJournal = $this->pdo->prepare(
            'SELECT journal_admin.ancien_statut, journal_admin.nouveau_statut, journal_admin.cree_le,
                    utilisateur.email
               FROM journal_admin
          LEFT JOIN utilisateur ON utilisateur.id = journal_admin.utilisateur_id
              WHERE journal_admin.commande_id = :id
           ORDER BY journal_admin.id'
        );
        $requeteJournal->bindValue(':id', (int) $commande['id'], PDO::PARAM_INT);
        $requeteJournal->execute();

        $historique = [];

        foreach ($requeteJournal->fetchAll() as $ligne) {
            $historique[] = [
                'ancien'  => $ligne['ancien_statut'],
                'nouveau' => $ligne['nouveau_statut'],
                'le'      => $ligne['cree_le'],
                'par'     => $ligne['email'],
            ];
        }

        return [
            'numero'     => $commande['numero'],
            'statut'     => $commande['statut'],
            'total'      => (float) $commande['total'],
            'cree_le'    => $commande['cree_le'],
            'client'     => [
                'prenom' => $commande['prenom'],
                'nom'    => $commande['nom'],
                'email'  => $commande['email'],
            ],
            'lignes'     => $this->lignes((int) $commande['id']),
            'historique' => $historique,
        ];
    }
}
