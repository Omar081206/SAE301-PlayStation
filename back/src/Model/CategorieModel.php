<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des catégories de la boutique.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle exécute les requêtes qu'on lui demande et renvoie des tableaux.
 */
final class CategorieModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Toutes les catégories, avec leur nombre de produits.
     *
     * @return array<int, array<string, mixed>>
     */
    public function lister(): array
    {
        $sql = 'SELECT categorie.nom,
                       categorie.slug,
                       COUNT(produit.id) AS nombre
                  FROM categorie
             LEFT JOIN produit ON produit.categorie_id = categorie.id
              GROUP BY categorie.id, categorie.nom, categorie.slug
              ORDER BY categorie.id';

        $lignes = $this->pdo->query($sql)->fetchAll();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $categories = [];

        foreach ($lignes as $ligne) {
            $categories[] = [
                'nom'    => $ligne['nom'],
                'slug'   => $ligne['slug'],
                'nombre' => (int) $ligne['nombre'],
            ];
        }

        return $categories;
    }

    /**
     * Une catégorie par son slug, ou null si elle n'existe pas.
     *
     * @return array<string, mixed>|null
     */
    public function trouver(string $slug): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT nom, slug FROM categorie WHERE slug = :slug'
        );
        $requetePreparee->bindValue(':slug', $slug, PDO::PARAM_STR);
        $requetePreparee->execute();

        $ligne = $requetePreparee->fetch();

        if ($ligne === false) {
            return null;
        }

        return [
            'nom'  => $ligne['nom'],
            'slug' => $ligne['slug'],
        ];
    }
}
