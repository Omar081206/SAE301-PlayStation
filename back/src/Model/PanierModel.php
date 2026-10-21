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
     * Les variantes demandées, indexées par leur identifiant, avec leur stock
     * actuel. Une variante inconnue est simplement absente du résultat.
     *
     * L'image est la première image « catalogue » (ou « partout ») de la
     * variante (un coloris) s'il en a une, sinon celle du produit. options : les valeurs de la variante, en
     * texte (« Coloris : Noir »), ou null pour un produit sans option.
     * en_promotion : vrai si le produit est en promotion automatique
     * (ProduitModel::EN_PROMOTION) ; prix reste le prix d'origine.
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
                    (SELECT GROUP_CONCAT(CONCAT(option_produit.nom, ' : ', valeur_option.valeur)
                                         ORDER BY option_produit.ordre SEPARATOR ', ')
                       FROM variante_valeur
                 INNER JOIN valeur_option  ON valeur_option.id = variante_valeur.valeur_id
                 INNER JOIN option_produit ON option_produit.id = valeur_option.option_id
                      WHERE variante_valeur.variante_id = variante.id) AS options,
                    variante.prix,
                    variante.stock,
                    produit.nom,
                    produit.slug,
                    COALESCE(image_coloris.fichier, image_produit.fichier) AS image,
                    COALESCE(image_coloris.alt, image_produit.alt)         AS image_alt,
                    produit.id = " . ProduitModel::EN_PROMOTION . " AS en_promotion
               FROM variante
         INNER JOIN produit ON produit.id = variante.produit_id
          LEFT JOIN image AS image_coloris
                 ON image_coloris.id = (SELECT premiere.id FROM image AS premiere
                                         WHERE premiere.variante_id = variante.id
                                           AND premiere.affichage <> 'fiche'
                                      ORDER BY premiere.ordre LIMIT 1)
          LEFT JOIN image AS image_produit
                 ON image_produit.id = (SELECT premiere.id FROM image AS premiere
                                         WHERE premiere.produit_id = produit.id
                                           AND premiere.variante_id IS NULL
                                           AND premiere.affichage <> 'fiche'
                                      ORDER BY premiere.ordre LIMIT 1)
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
                'options'   => $ligne['options'],
                'prix'      => (float) $ligne['prix'],
                'stock'     => (int) $ligne['stock'],
                'image'     => $ligne['image'],
                'image_alt' => $ligne['image_alt'],
                'en_promotion' => (bool) $ligne['en_promotion'],
            ];
        }

        return $variantes;
    }
}
