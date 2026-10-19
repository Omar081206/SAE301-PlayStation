<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des catégories de la boutique.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle exécute les requêtes qu'on lui demande et renvoie des tableaux. Les
 * règles de la gestion des catégories (noms, slugs, sort des produits d'une
 * catégorie supprimée) sont dans AdminCategorieController.
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

    /**
     * Toutes les catégories, complètes, avec leur nombre de produits : la
     * liste du back-office.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listerPourAdmin(): array
    {
        $sql = 'SELECT categorie.id,
                       categorie.nom,
                       categorie.slug,
                       categorie.description,
                       COUNT(produit.id) AS nombre
                  FROM categorie
             LEFT JOIN produit ON produit.categorie_id = categorie.id
              GROUP BY categorie.id, categorie.nom, categorie.slug, categorie.description
              ORDER BY categorie.id';

        $lignes = $this->pdo->query($sql)->fetchAll();

        $categories = [];

        foreach ($lignes as $ligne) {
            $categories[] = [
                'id'          => (int) $ligne['id'],
                'nom'         => $ligne['nom'],
                'slug'        => $ligne['slug'],
                'description' => $ligne['description'],
                'nombre'      => (int) $ligne['nombre'],
            ];
        }

        return $categories;
    }

    /**
     * Vrai si la catégorie existe.
     */
    public function existe(int $id): bool
    {
        $requetePreparee = $this->pdo->prepare('SELECT 1 FROM categorie WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Vrai si une autre catégorie que $sauf porte déjà ce nom ou ce slug.
     * La collation de la table ne distingue pas la casse.
     *
     * @param int $sauf Catégorie modifiée (0 pour une création).
     */
    public function nomOuSlugPris(string $nom, string $slug, int $sauf): bool
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT 1 FROM categorie WHERE (nom = :nom OR slug = :slug) AND id <> :sauf'
        );
        $requetePreparee->bindValue(':nom',  $nom,  PDO::PARAM_STR);
        $requetePreparee->bindValue(':slug', $slug, PDO::PARAM_STR);
        $requetePreparee->bindValue(':sauf', $sauf, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Crée une catégorie et renvoie son identifiant.
     */
    public function creer(string $nom, string $slug, string $description): int
    {
        $requetePreparee = $this->pdo->prepare(
            'INSERT INTO categorie (nom, slug, description) VALUES (:nom, :slug, :description)'
        );
        $requetePreparee->bindValue(':nom',         $nom,         PDO::PARAM_STR);
        $requetePreparee->bindValue(':slug',        $slug,        PDO::PARAM_STR);
        $requetePreparee->bindValue(':description', $description, PDO::PARAM_STR);
        $requetePreparee->execute();

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Remplace le nom, le slug et la description d'une catégorie.
     */
    public function modifier(int $id, string $nom, string $slug, string $description): void
    {
        $requetePreparee = $this->pdo->prepare(
            'UPDATE categorie SET nom = :nom, slug = :slug, description = :description WHERE id = :id'
        );
        $requetePreparee->bindValue(':nom',         $nom,         PDO::PARAM_STR);
        $requetePreparee->bindValue(':slug',        $slug,        PDO::PARAM_STR);
        $requetePreparee->bindValue(':description', $description, PDO::PARAM_STR);
        $requetePreparee->bindValue(':id',          $id,          PDO::PARAM_INT);
        $requetePreparee->execute();
    }

    /**
     * Supprime une catégorie. Avec $destination, ses produits y sont d'abord
     * déplacés. Renvoie le nombre de produits déplacés, ou null si la
     * catégorie contient encore des produits (aucune destination donnée, ou
     * produits ajoutés entre-temps) : rien n'est alors supprimé.
     *
     * Écriture atomique : la clé étrangère (ON DELETE RESTRICT) refuse de
     * supprimer une catégorie qui a des produits ; dans ce cas, le
     * déplacement est annulé avec la suppression.
     */
    public function supprimer(int $id, ?int $destination): ?int
    {
        $this->pdo->beginTransaction();

        try {
            $deplaces = 0;

            if ($destination !== null) {
                $requeteDeplacement = $this->pdo->prepare(
                    'UPDATE produit SET categorie_id = :destination WHERE categorie_id = :id'
                );
                $requeteDeplacement->bindValue(':destination', $destination, PDO::PARAM_INT);
                $requeteDeplacement->bindValue(':id',          $id,          PDO::PARAM_INT);
                $requeteDeplacement->execute();
                $deplaces = $requeteDeplacement->rowCount();
            }

            $requeteSuppression = $this->pdo->prepare('DELETE FROM categorie WHERE id = :id');
            $requeteSuppression->bindValue(':id', $id, PDO::PARAM_INT);
            $requeteSuppression->execute();

            $this->pdo->commit();

            return $deplaces;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();

            // 23000 : la clé étrangère protège des produits restés rattachés.
            if ($e instanceof \PDOException && $e->getCode() === '23000') {
                return null;
            }

            throw $e;
        }
    }
}
