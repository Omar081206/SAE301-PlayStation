<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Gabarit de modèle : exécute les requêtes demandées, ne décide de rien.
 */
final class ExempleModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Un élément par son slug, ou null.
     *
     * @return array<string, mixed>|null
     */
    public function trouver(string $slug): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT id, nom, note_moyenne FROM exemple WHERE slug = :slug'
        );
        $requetePreparee->bindValue(':slug', $slug, PDO::PARAM_STR);
        $requetePreparee->execute();

        $ligne = $requetePreparee->fetch();

        if ($ligne === false) {
            return null;
        }

        // MySQL renvoie des chaînes : on convertit avant le JSON.
        return [
            'id'           => (int) $ligne['id'],
            'nom'          => $ligne['nom'],
            'note_moyenne' => (float) $ligne['note_moyenne'],
        ];
    }

    /**
     * Écriture atomique : tout ou rien.
     */
    public function enregistrer(int $id): bool
    {
        $this->pdo->beginTransaction();

        try {
            $requetePreparee = $this->pdo->prepare('UPDATE exemple SET choisi = 1 WHERE id = :id');
            $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
            $requetePreparee->execute();
            $this->pdo->commit();

            return true;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
