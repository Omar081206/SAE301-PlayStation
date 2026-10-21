<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des codes promotionnels.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle exécute les requêtes qu'on lui demande et renvoie des tableaux. Les
 * règles de saisie (forme du code, bornes de la réduction) sont dans
 * AdminCodePromoController.
 */
final class CodePromoModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Tous les codes, du plus récent au plus ancien, avec leurs statistiques :
     * nombre de commandes qui les ont utilisés et somme des remises
     * accordées, hors commandes annulées.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listerPourAdmin(): array
    {
        $sql = "SELECT code_promo.id,
                       code_promo.code,
                       code_promo.pourcentage,
                       COUNT(commande.id)                AS utilisations,
                       COALESCE(SUM(commande.remise), 0) AS remise_totale
                  FROM code_promo
             LEFT JOIN commande ON commande.code_promo_id = code_promo.id
                               AND commande.statut <> 'annulee'
              GROUP BY code_promo.id, code_promo.code, code_promo.pourcentage
              ORDER BY code_promo.id DESC";

        $lignes = $this->pdo->query($sql)->fetchAll();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $codes = [];

        foreach ($lignes as $ligne) {
            $codes[] = [
                'id'            => (int) $ligne['id'],
                'code'          => $ligne['code'],
                'pourcentage'   => (int) $ligne['pourcentage'],
                'utilisations'  => (int) $ligne['utilisations'],
                'remise_totale' => (float) $ligne['remise_totale'],
            ];
        }

        return $codes;
    }

    /**
     * Vrai si le code promo existe.
     */
    public function existe(int $id): bool
    {
        $requetePreparee = $this->pdo->prepare('SELECT 1 FROM code_promo WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Vrai si un autre code que $sauf porte déjà ce texte.
     *
     * @param int $sauf Code modifié (0 pour une création).
     */
    public function codePris(string $code, int $sauf): bool
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT 1 FROM code_promo WHERE code = :code AND id <> :sauf'
        );
        $requetePreparee->bindValue(':code', $code, PDO::PARAM_STR);
        $requetePreparee->bindValue(':sauf', $sauf, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Crée un code promo et renvoie son identifiant.
     */
    public function creer(string $code, int $pourcentage): int
    {
        $requetePreparee = $this->pdo->prepare(
            'INSERT INTO code_promo (code, pourcentage) VALUES (:code, :pourcentage)'
        );
        $requetePreparee->bindValue(':code',        $code,        PDO::PARAM_STR);
        $requetePreparee->bindValue(':pourcentage', $pourcentage, PDO::PARAM_INT);
        $requetePreparee->execute();

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Remplace le texte et la réduction d'un code promo. Les commandes déjà
     * passées gardent la remise qu'elles ont obtenue.
     */
    public function modifier(int $id, string $code, int $pourcentage): void
    {
        $requetePreparee = $this->pdo->prepare(
            'UPDATE code_promo SET code = :code, pourcentage = :pourcentage WHERE id = :id'
        );
        $requetePreparee->bindValue(':code',        $code,        PDO::PARAM_STR);
        $requetePreparee->bindValue(':pourcentage', $pourcentage, PDO::PARAM_INT);
        $requetePreparee->bindValue(':id',          $id,          PDO::PARAM_INT);
        $requetePreparee->execute();
    }

    /**
     * Supprime un code promo. Les commandes qui l'ont utilisé perdent le lien
     * (clé étrangère ON DELETE SET NULL) mais gardent leur remise.
     */
    public function supprimer(int $id): void
    {
        $requetePreparee = $this->pdo->prepare('DELETE FROM code_promo WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();
    }
}
