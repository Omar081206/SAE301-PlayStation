<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des statistiques du back-office.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien :
 * elle compte et additionne sur la période qu'on lui donne, et renvoie des
 * tableaux. Les dates sont celles de la base (CURDATE()), comme cree_le :
 * PHP et MySQL ne sont pas réglés sur le même fuseau horaire.
 */
final class StatistiqueModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Nombre de commandes passées depuis $jours jours (aujourd'hui compris),
     * par statut. Un statut sans commande n'apparaît pas.
     *
     * @return array<string, int> statut => nombre
     */
    public function commandesParStatut(int $jours): array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT statut, COUNT(*) AS nombre
               FROM commande
              WHERE cree_le >= CURDATE() - INTERVAL :decalage DAY
           GROUP BY statut'
        );
        $requetePreparee->bindValue(':decalage', $jours - 1, PDO::PARAM_INT);
        $requetePreparee->execute();

        $statuts = [];

        foreach ($requetePreparee->fetchAll() as $ligne) {
            $statuts[$ligne['statut']] = (int) $ligne['nombre'];
        }

        return $statuts;
    }

    /**
     * Revenus de chacun des $jours derniers jours (aujourd'hui compris), du
     * plus ancien au plus récent : un jour sans vente vaut 0. Les commandes
     * annulées ne rapportent rien.
     *
     * @return array<int, array{jour: string, total: float}>
     */
    public function revenusParJour(int $jours): array
    {
        // La liste des jours est fabriquée par la requête (CTE récursive) :
        // un jour sans commande y figure quand même.
        $requetePreparee = $this->pdo->prepare(
            "WITH RECURSIVE jours (jour) AS (
                 SELECT CURDATE() - INTERVAL :decalage DAY
                 UNION ALL
                 SELECT jour + INTERVAL 1 DAY FROM jours WHERE jour < CURDATE()
             )
             SELECT DATE_FORMAT(jours.jour, '%Y-%m-%d') AS jour,
                    COALESCE(SUM(commande.total), 0)    AS total
               FROM jours
          LEFT JOIN commande ON DATE(commande.cree_le) = jours.jour
                            AND commande.statut <> 'annulee'
           GROUP BY jours.jour
           ORDER BY jours.jour"
        );
        $requetePreparee->bindValue(':decalage', $jours - 1, PDO::PARAM_INT);
        $requetePreparee->execute();

        $revenus = [];

        foreach ($requetePreparee->fetchAll() as $ligne) {
            $revenus[] = [
                'jour'  => $ligne['jour'],
                'total' => (float) $ligne['total'],
            ];
        }

        return $revenus;
    }

    /**
     * Stock de chaque variante, avec le nom de son produit et ses valeurs
     * d'options (« Blanc »), dans l'ordre du catalogue.
     *
     * @return array<int, array{nom: string, options: string|null, stock: int}>
     */
    public function stocks(): array
    {
        $sql = "SELECT produit.nom,
                       (SELECT GROUP_CONCAT(valeur_option.valeur ORDER BY option_produit.ordre SEPARATOR ', ')
                          FROM variante_valeur
                    INNER JOIN valeur_option  ON valeur_option.id = variante_valeur.valeur_id
                    INNER JOIN option_produit ON option_produit.id = valeur_option.option_id
                         WHERE variante_valeur.variante_id = variante.id) AS options,
                       variante.stock
                  FROM variante
            INNER JOIN produit ON produit.id = variante.produit_id
              ORDER BY produit.id, variante.id";

        $stocks = [];

        foreach ($this->pdo->query($sql)->fetchAll() as $ligne) {
            $stocks[] = [
                'nom'     => $ligne['nom'],
                'options' => $ligne['options'],
                'stock'   => (int) $ligne['stock'],
            ];
        }

        return $stocks;
    }

    /**
     * Les $nombre produits les plus vendus, par quantité, hors commandes
     * annulées. Le regroupement se fait sur le nom figé dans la ligne de
     * commande : une vente compte encore si sa variante a été supprimée.
     *
     * @return array<int, array{nom: string, ventes: int}>
     */
    public function meilleuresVentes(int $nombre): array
    {
        $requetePreparee = $this->pdo->prepare(
            "SELECT ligne_commande.nom, SUM(ligne_commande.quantite) AS ventes
               FROM ligne_commande
         INNER JOIN commande ON commande.id = ligne_commande.commande_id
              WHERE commande.statut <> 'annulee'
           GROUP BY ligne_commande.nom
           ORDER BY ventes DESC, ligne_commande.nom
              LIMIT :nombre"
        );
        $requetePreparee->bindValue(':nombre', $nombre, PDO::PARAM_INT);
        $requetePreparee->execute();

        $ventes = [];

        foreach ($requetePreparee->fetchAll() as $ligne) {
            $ventes[] = [
                'nom'    => $ligne['nom'],
                'ventes' => (int) $ligne['ventes'],
            ];
        }

        return $ventes;
    }
}
