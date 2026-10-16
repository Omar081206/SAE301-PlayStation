<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des produits de la boutique.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle exécute les requêtes qu'on lui demande et renvoie des tableaux.
 */
final class ProduitModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Tous les produits du catalogue, regroupés par catégorie.
     *
     * Le prix affiché est le plus bas des variantes du produit, l'image celle
     * d'ordre 1 (image principale), ou null si le produit n'en a pas encore.
     *
     * @return array<int, array<string, mixed>>
     */
    public function lister(): array
    {
        $sql = 'SELECT produit.id,
                       produit.nom,
                       produit.slug,
                       categorie.nom  AS categorie,
                       MIN(variante.prix) AS prix,
                       image.fichier  AS image,
                       image.alt      AS image_alt
                  FROM produit
            INNER JOIN categorie ON categorie.id = produit.categorie_id
            INNER JOIN variante  ON variante.produit_id = produit.id
             LEFT JOIN image     ON image.produit_id = produit.id AND image.ordre = 1
              GROUP BY produit.id, produit.nom, produit.slug, categorie.id, categorie.nom,
                       image.fichier, image.alt
              ORDER BY categorie.id, produit.id';

        $lignes = $this->pdo->query($sql)->fetchAll();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $produits = [];

        foreach ($lignes as $ligne) {
            $produits[] = [
                'id'        => (int) $ligne['id'],
                'nom'       => $ligne['nom'],
                'slug'      => $ligne['slug'],
                'categorie' => $ligne['categorie'],
                'prix'      => (float) $ligne['prix'],
                'image'     => $ligne['image'],
                'image_alt' => $ligne['image_alt'],
            ];
        }

        return $produits;
    }

    /**
     * Un produit par son slug, avec toutes ses images, ou null s'il n'existe pas.
     *
     * Comme dans le catalogue, le prix est le plus bas des variantes.
     *
     * @return array<string, mixed>|null
     */
    public function trouver(string $slug): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT produit.id,
                    produit.nom,
                    produit.slug,
                    produit.description,
                    categorie.nom  AS categorie,
                    categorie.slug AS categorie_slug,
                    MIN(variante.prix) AS prix
               FROM produit
         INNER JOIN categorie ON categorie.id = produit.categorie_id
         INNER JOIN variante  ON variante.produit_id = produit.id
              WHERE produit.slug = :slug
           GROUP BY produit.id, produit.nom, produit.slug, produit.description,
                    categorie.nom, categorie.slug'
        );
        $requetePreparee->bindValue(':slug', $slug, PDO::PARAM_STR);
        $requetePreparee->execute();

        $ligne = $requetePreparee->fetch();

        if ($ligne === false) {
            return null;
        }

        $requeteImages = $this->pdo->prepare(
            'SELECT fichier, alt FROM image WHERE produit_id = :id ORDER BY ordre'
        );
        $requeteImages->bindValue(':id', (int) $ligne['id'], PDO::PARAM_INT);
        $requeteImages->execute();

        // MySQL renvoie des chaînes : on convertit avant le JSON.
        return [
            'id'             => (int) $ligne['id'],
            'nom'            => $ligne['nom'],
            'slug'           => $ligne['slug'],
            'description'    => $ligne['description'],
            'categorie'      => $ligne['categorie'],
            'categorie_slug' => $ligne['categorie_slug'],
            'prix'           => (float) $ligne['prix'],
            'images'         => $requeteImages->fetchAll(),
        ];
    }
}
