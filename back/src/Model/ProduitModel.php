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
     * Les produits du catalogue, regroupés par catégorie.
     *
     * Le prix affiché est le plus bas des variantes du produit, l'image celle
     * d'ordre 1 (image principale), ou null si le produit n'en a pas encore.
     * variante_id est la variante par défaut (la première créée) : c'est elle
     * qu'ajoute le bouton « Ajouter au panier », et stock est le sien.
     *
     * @param string|null $categorie Slug de la catégorie à afficher, ou null
     *                               pour tout le catalogue.
     * @return array<int, array<string, mixed>>
     */
    public function lister(?string $categorie): array
    {
        $sql = 'SELECT produit.id,
                       produit.nom,
                       produit.slug,
                       categorie.nom  AS categorie,
                       MIN(variante.id)   AS variante_id,
                       MIN(variante.prix) AS prix,
                       (SELECT defaut.stock
                          FROM variante AS defaut
                         WHERE defaut.produit_id = produit.id
                      ORDER BY defaut.id
                         LIMIT 1) AS stock,
                       image.fichier  AS image,
                       image.alt      AS image_alt
                  FROM produit
            INNER JOIN categorie ON categorie.id = produit.categorie_id
            INNER JOIN variante  ON variante.produit_id = produit.id
             LEFT JOIN image     ON image.produit_id = produit.id AND image.ordre = 1
                                  AND image.variante_id IS NULL
                 WHERE :categorie IS NULL OR categorie.slug = :categorie_slug
              GROUP BY produit.id, produit.nom, produit.slug, categorie.id, categorie.nom,
                       image.fichier, image.alt
              ORDER BY categorie.id, produit.id';

        $requetePreparee = $this->pdo->prepare($sql);

        // Le même slug est lié deux fois : un paramètre nommé ne peut figurer
        // qu'une fois dans une requête préparée.
        $requetePreparee->bindValue(':categorie',      $categorie, PDO::PARAM_STR);
        $requetePreparee->bindValue(':categorie_slug', $categorie, PDO::PARAM_STR);

        $requetePreparee->execute();

        $lignes = $requetePreparee->fetchAll();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $produits = [];

        foreach ($lignes as $ligne) {
            $produits[] = [
                'id'          => (int) $ligne['id'],
                'nom'         => $ligne['nom'],
                'slug'        => $ligne['slug'],
                'categorie'   => $ligne['categorie'],
                'variante_id' => (int) $ligne['variante_id'],
                'prix'        => (float) $ligne['prix'],
                'stock'       => (int) $ligne['stock'],
                'image'       => $ligne['image'],
                'image_alt'   => $ligne['image_alt'],
            ];
        }

        return $produits;
    }

    /**
     * Un produit par son slug, avec les images de sa variante par défaut, ses
     * options (et leurs valeurs) et ses variantes, ou null s'il n'existe pas.
     *
     * Chaque variante donne son prix, son stock, ses valeurs (une par option)
     * et ses images : les siennes si elle en a (un coloris), sinon celles du
     * produit. Comme dans le catalogue, le prix est le plus bas des variantes.
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
                    MIN(variante.id)   AS variante_id,
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

        $produitId = (int) $ligne['id'];

        $requeteImages = $this->pdo->prepare(
            'SELECT variante_id, fichier, alt FROM image WHERE produit_id = :id ORDER BY ordre'
        );
        $requeteImages->bindValue(':id', $produitId, PDO::PARAM_INT);
        $requeteImages->execute();

        // Images du produit (variante_id NULL), et images propres à certaines
        // variantes, indexées par variante.
        $imagesProduit   = [];
        $imagesVariantes = [];
        foreach ($requeteImages->fetchAll() as $image) {
            $donnees = ['fichier' => $image['fichier'], 'alt' => $image['alt']];
            if ($image['variante_id'] === null) {
                $imagesProduit[] = $donnees;
            } else {
                $imagesVariantes[(int) $image['variante_id']][] = $donnees;
            }
        }

        $requeteValeurs = $this->pdo->prepare(
            'SELECT option_produit.id AS option_id, option_produit.nom,
                    valeur_option.id AS valeur_id, valeur_option.valeur
               FROM option_produit
         INNER JOIN valeur_option ON valeur_option.option_id = option_produit.id
              WHERE option_produit.produit_id = :id
           ORDER BY option_produit.ordre, option_produit.id, valeur_option.ordre, valeur_option.id'
        );
        $requeteValeurs->bindValue(':id', $produitId, PDO::PARAM_INT);
        $requeteValeurs->execute();

        $options = [];
        foreach ($requeteValeurs->fetchAll() as $valeur) {
            $optionId = (int) $valeur['option_id'];
            $options[$optionId] ??= ['id' => $optionId, 'nom' => $valeur['nom'], 'valeurs' => []];
            $options[$optionId]['valeurs'][] = ['id' => (int) $valeur['valeur_id'], 'valeur' => $valeur['valeur']];
        }

        $requeteVariantes = $this->pdo->prepare(
            'SELECT variante.id, variante.prix, variante.stock,
                    GROUP_CONCAT(variante_valeur.valeur_id ORDER BY variante_valeur.valeur_id) AS valeurs
               FROM variante
          LEFT JOIN variante_valeur ON variante_valeur.variante_id = variante.id
              WHERE variante.produit_id = :id
           GROUP BY variante.id, variante.prix, variante.stock
           ORDER BY variante.id'
        );
        $requeteVariantes->bindValue(':id', $produitId, PDO::PARAM_INT);
        $requeteVariantes->execute();

        $variantes = [];

        foreach ($requeteVariantes->fetchAll() as $variante) {
            $id = (int) $variante['id'];
            $variantes[] = [
                'id'      => $id,
                'prix'    => (float) $variante['prix'],
                'stock'   => (int) $variante['stock'],
                'valeurs' => $variante['valeurs'] === null ? [] : array_map('intval', explode(',', $variante['valeurs'])),
                'images'  => $imagesVariantes[$id] ?? $imagesProduit,
            ];
        }

        // MySQL renvoie des chaînes : on convertit avant le JSON.
        return [
            'id'             => (int) $ligne['id'],
            'nom'            => $ligne['nom'],
            'slug'           => $ligne['slug'],
            'description'    => $ligne['description'],
            'categorie'      => $ligne['categorie'],
            'categorie_slug' => $ligne['categorie_slug'],
            'variante_id'    => (int) $ligne['variante_id'],
            'prix'           => (float) $ligne['prix'],
            'images'         => $imagesProduit,
            'options'        => array_values($options),
            'variantes'      => $variantes,
        ];
    }
}
