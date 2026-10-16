<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des articles du panier.
 *
 * Le panier lui-même vit dans le navigateur : la base ne fournit que ce qui
 * concerne chaque variante (nom du produit, prix, image). Cette couche ne
 * contient aucune règle métier et ne décide de rien.
 */
final class PanierModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Les variantes demandées, indexées par leur identifiant. Une variante
     * inconnue est simplement absente du résultat.
     *
     * L'image est l'image principale du coloris s'il en a une, sinon celle
     * du produit.
     *
     * @param  array<int, int> $ids Identifiants de variantes, déjà validés.
     * @return array<int, array<string, mixed>>
     */
    public function detailler(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        // Un marqueur ? par identifiant : la liste IN (…) reste liée, valeur
        // par valeur, au lieu d'être collée dans la requête.
        $marqueurs = implode(', ', array_fill(0, count($ids), '?'));

        $requetePreparee = $this->pdo->prepare(
            "SELECT variante.id,
                    variante.coloris,
                    variante.prix,
                    produit.nom,
                    produit.slug,
                    COALESCE(image_coloris.fichier, image_produit.fichier) AS image,
                    COALESCE(image_coloris.alt, image_produit.alt)         AS image_alt
               FROM variante
         INNER JOIN produit ON produit.id = variante.produit_id
          LEFT JOIN image AS image_coloris
                 ON image_coloris.variante_id = variante.id AND image_coloris.ordre = 1
          LEFT JOIN image AS image_produit
                 ON image_produit.produit_id = produit.id AND image_produit.variante_id IS NULL
                AND image_produit.ordre = 1
              WHERE variante.id IN ({$marqueurs})"
        );

        foreach (array_values($ids) as $position => $id) {
            $requetePreparee->bindValue($position + 1, $id, PDO::PARAM_INT);
        }

        $requetePreparee->execute();

        // MySQL renvoie les nombres sous forme de chaînes. On les convertit
        // ligne par ligne, pour que le JSON contienne bien des nombres.
        $variantes = [];

        foreach ($requetePreparee->fetchAll() as $ligne) {
            $variantes[(int) $ligne['id']] = [
                'nom'       => $ligne['nom'],
                'slug'      => $ligne['slug'],
                'coloris'   => $ligne['coloris'],
                'prix'      => (float) $ligne['prix'],
                'image'     => $ligne['image'],
                'image_alt' => $ligne['image_alt'],
            ];
        }

        return $variantes;
    }
}
