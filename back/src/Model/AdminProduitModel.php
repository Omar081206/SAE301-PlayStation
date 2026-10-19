<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux produits pour le back-office : liste, fiche complète
 * (informations, options, variantes, images), enregistrement, suppression et
 * images.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien : elle
 * enregistre ce que AdminProduitController a validé, et relit les produits.
 */
final class AdminProduitModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Tous les produits : nom, catégorie, prix le plus bas, stock total et
     * nombre de variantes.
     *
     * @return array<int, array<string, mixed>>
     */
    public function lister(): array
    {
        $sql = 'SELECT produit.id,
                       produit.nom,
                       produit.slug,
                       categorie.nom        AS categorie,
                       MIN(variante.prix)   AS prix,
                       SUM(variante.stock)  AS stock,
                       COUNT(variante.id)   AS variantes
                  FROM produit
            INNER JOIN categorie ON categorie.id = produit.categorie_id
             LEFT JOIN variante  ON variante.produit_id = produit.id
              GROUP BY produit.id, produit.nom, produit.slug, categorie.id, categorie.nom
              ORDER BY categorie.id, produit.id';

        $produits = [];

        foreach ($this->pdo->query($sql)->fetchAll() as $ligne) {
            $produits[] = [
                'id'        => (int) $ligne['id'],
                'nom'       => $ligne['nom'],
                'slug'      => $ligne['slug'],
                'categorie' => $ligne['categorie'],
                'prix'      => $ligne['prix'] === null ? null : (float) $ligne['prix'],
                'stock'     => (int) $ligne['stock'],
                'variantes' => (int) $ligne['variantes'],
            ];
        }

        return $produits;
    }

    /**
     * Un produit complet, ou null s'il n'existe pas.
     *
     * @return array<string, mixed>|null
     */
    public function trouver(int $id): ?array
    {
        $requeteProduit = $this->pdo->prepare(
            'SELECT id, categorie_id, nom, slug, description FROM produit WHERE id = :id'
        );
        $requeteProduit->bindValue(':id', $id, PDO::PARAM_INT);
        $requeteProduit->execute();
        $produit = $requeteProduit->fetch();

        if ($produit === false) {
            return null;
        }

        $requeteValeurs = $this->pdo->prepare(
            'SELECT option_produit.id AS option_id, option_produit.nom,
                    valeur_option.id AS valeur_id, valeur_option.valeur
               FROM option_produit
          LEFT JOIN valeur_option ON valeur_option.option_id = option_produit.id
              WHERE option_produit.produit_id = :id
           ORDER BY option_produit.ordre, option_produit.id, valeur_option.ordre, valeur_option.id'
        );
        $requeteValeurs->bindValue(':id', $id, PDO::PARAM_INT);
        $requeteValeurs->execute();

        $options = [];
        foreach ($requeteValeurs->fetchAll() as $ligne) {
            $optionId = (int) $ligne['option_id'];
            $options[$optionId] ??= ['id' => $optionId, 'nom' => $ligne['nom'], 'valeurs' => []];
            if ($ligne['valeur_id'] !== null) {
                $options[$optionId]['valeurs'][] = ['id' => (int) $ligne['valeur_id'], 'valeur' => $ligne['valeur']];
            }
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
        $requeteVariantes->bindValue(':id', $id, PDO::PARAM_INT);
        $requeteVariantes->execute();

        $variantes = [];
        foreach ($requeteVariantes->fetchAll() as $ligne) {
            $variantes[] = [
                'id'      => (int) $ligne['id'],
                'prix'    => (float) $ligne['prix'],
                'stock'   => (int) $ligne['stock'],
                'valeurs' => $ligne['valeurs'] === null ? [] : array_map('intval', explode(',', $ligne['valeurs'])),
            ];
        }

        $requeteImages = $this->pdo->prepare(
            'SELECT id, variante_id, fichier, alt, ordre, affichage FROM image
              WHERE produit_id = :id
           ORDER BY variante_id IS NOT NULL, variante_id, ordre'
        );
        $requeteImages->bindValue(':id', $id, PDO::PARAM_INT);
        $requeteImages->execute();

        $images = [];
        foreach ($requeteImages->fetchAll() as $ligne) {
            $images[] = [
                'id'          => (int) $ligne['id'],
                'variante_id' => $ligne['variante_id'] === null ? null : (int) $ligne['variante_id'],
                'fichier'     => $ligne['fichier'],
                'alt'         => $ligne['alt'],
                'ordre'       => (int) $ligne['ordre'],
                'affichage'   => $ligne['affichage'],
            ];
        }

        return [
            'id'           => (int) $produit['id'],
            'categorie_id' => (int) $produit['categorie_id'],
            'nom'          => $produit['nom'],
            'slug'         => $produit['slug'],
            'description'  => $produit['description'],
            'options'      => array_values($options),
            'variantes'    => $variantes,
            'images'       => $images,
        ];
    }

    /**
     * Vrai si un autre produit que $sauf a déjà ce slug (adresse de sa fiche).
     *
     * @param int $sauf Produit modifié (0 pour une création).
     */
    public function slugPris(string $slug, int $sauf): bool
    {
        $requetePreparee = $this->pdo->prepare('SELECT 1 FROM produit WHERE slug = :slug AND id <> :sauf');
        $requetePreparee->bindValue(':slug', $slug, PDO::PARAM_STR);
        $requetePreparee->bindValue(':sauf', $sauf, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Enregistre un produit et tout son formulaire, en une transaction : ses
     * informations, ses options (avec leurs valeurs) et ses variantes. Renvoie
     * l'identifiant du produit.
     *
     * Les options, valeurs et variantes absentes de la saisie sont supprimées
     * (les commandes passées gardent leur texte figé). Une valeur nouvelle est
     * désignée par une clé provisoire (« n1 »…), que les variantes reprennent.
     * Chaque changement de stock est inscrit au journal des stocks (motif
     * « ajustement »).
     *
     * @param array{nom: string, slug: string, description: string, categorie_id: int} $infos
     * @param array<int, array{id: ?int, nom: string,
     *                         valeurs: array<int, array{id: ?int, cle: string, valeur: string}>}> $options
     * @param array<int, array{id: ?int, valeurs: string[], prix: float, stock: int}> $variantes
     *        valeurs : clés des valeurs (identifiant en texte, ou clé provisoire).
     */
    public function enregistrer(?int $id, array $infos, array $options, array $variantes, int $auteurId): int
    {
        $this->pdo->beginTransaction();

        try {
            $id = $this->enregistrerInfos($id, $infos);

            // Options et valeurs : celles qui restent sont mises à jour, les
            // nouvelles créées, les autres supprimées. $cles relie la clé de
            // chaque valeur (provisoire ou non) à son identifiant en base.
            $cles = [];
            $optionsGardees = [];

            foreach ($options as $positionOption => $option) {
                $optionId = $this->enregistrerOption($id, $option['id'], $option['nom'], $positionOption + 1);
                $optionsGardees[] = $optionId;
                $valeursGardees = [];

                foreach ($option['valeurs'] as $positionValeur => $valeur) {
                    $valeurId = $this->enregistrerValeur($optionId, $valeur['id'], $valeur['valeur'], $positionValeur + 1);
                    $valeursGardees[] = $valeurId;
                    $cles[$valeur['cle']] = $valeurId;
                }

                $this->supprimerAbsents('valeur_option', 'option_id', $optionId, $valeursGardees);
            }

            $this->supprimerAbsents('option_produit', 'produit_id', $id, $optionsGardees);

            // Variantes : même principe ; leurs valeurs sont réécrites.
            $variantesGardees = [];

            foreach ($variantes as $variante) {
                $varianteId = $this->enregistrerVariante($id, $variante['id'], $variante['prix'], $variante['stock'], $auteurId);
                $variantesGardees[] = $varianteId;

                $requeteEffacer = $this->pdo->prepare('DELETE FROM variante_valeur WHERE variante_id = :id');
                $requeteEffacer->bindValue(':id', $varianteId, PDO::PARAM_INT);
                $requeteEffacer->execute();

                $requeteLier = $this->pdo->prepare(
                    'INSERT INTO variante_valeur (variante_id, valeur_id) VALUES (:variante, :valeur)'
                );
                foreach ($variante['valeurs'] as $cle) {
                    $requeteLier->bindValue(':variante', $varianteId,  PDO::PARAM_INT);
                    $requeteLier->bindValue(':valeur',   $cles[$cle],  PDO::PARAM_INT);
                    $requeteLier->execute();
                }
            }

            $this->supprimerAbsents('variante', 'produit_id', $id, $variantesGardees);

            $this->pdo->commit();

            return $id;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Crée le produit ($id null) ou met à jour ses informations. Renvoie son
     * identifiant. Appelée dans la transaction de enregistrer().
     *
     * @param array{nom: string, slug: string, description: string, categorie_id: int} $infos
     */
    private function enregistrerInfos(?int $id, array $infos): int
    {
        $requetePreparee = $this->pdo->prepare(
            $id === null
                ? 'INSERT INTO produit (categorie_id, nom, slug, description) VALUES (:categorie, :nom, :slug, :description)'
                : 'UPDATE produit SET categorie_id = :categorie, nom = :nom, slug = :slug, description = :description WHERE id = :id'
        );
        $requetePreparee->bindValue(':categorie',   $infos['categorie_id'], PDO::PARAM_INT);
        $requetePreparee->bindValue(':nom',         $infos['nom'],          PDO::PARAM_STR);
        $requetePreparee->bindValue(':slug',        $infos['slug'],         PDO::PARAM_STR);
        $requetePreparee->bindValue(':description', $infos['description'],  PDO::PARAM_STR);
        if ($id !== null) {
            $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        }
        $requetePreparee->execute();

        return $id ?? (int) $this->pdo->lastInsertId();
    }

    /**
     * Crée une option ($optionId null) ou met à jour son nom et son ordre.
     * Renvoie son identifiant.
     */
    private function enregistrerOption(int $produitId, ?int $optionId, string $nom, int $ordre): int
    {
        if ($optionId === null) {
            $requetePreparee = $this->pdo->prepare(
                'INSERT INTO option_produit (produit_id, nom, ordre) VALUES (:produit, :nom, :ordre)'
            );
            $requetePreparee->bindValue(':produit', $produitId, PDO::PARAM_INT);
        } else {
            $requetePreparee = $this->pdo->prepare(
                'UPDATE option_produit SET nom = :nom, ordre = :ordre WHERE id = :id AND produit_id = :produit'
            );
            $requetePreparee->bindValue(':id',      $optionId,  PDO::PARAM_INT);
            $requetePreparee->bindValue(':produit', $produitId, PDO::PARAM_INT);
        }
        $requetePreparee->bindValue(':nom',   $nom,   PDO::PARAM_STR);
        $requetePreparee->bindValue(':ordre', $ordre, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $optionId ?? (int) $this->pdo->lastInsertId();
    }

    /**
     * Crée une valeur d'option ($valeurId null) ou met à jour son texte et son
     * ordre. Renvoie son identifiant.
     */
    private function enregistrerValeur(int $optionId, ?int $valeurId, string $valeur, int $ordre): int
    {
        if ($valeurId === null) {
            $requetePreparee = $this->pdo->prepare(
                'INSERT INTO valeur_option (option_id, valeur, ordre) VALUES (:option, :valeur, :ordre)'
            );
        } else {
            $requetePreparee = $this->pdo->prepare(
                'UPDATE valeur_option SET valeur = :valeur, ordre = :ordre WHERE id = :id AND option_id = :option'
            );
            $requetePreparee->bindValue(':id', $valeurId, PDO::PARAM_INT);
        }
        $requetePreparee->bindValue(':option', $optionId, PDO::PARAM_INT);
        $requetePreparee->bindValue(':valeur', $valeur,   PDO::PARAM_STR);
        $requetePreparee->bindValue(':ordre',  $ordre,    PDO::PARAM_INT);
        $requetePreparee->execute();

        return $valeurId ?? (int) $this->pdo->lastInsertId();
    }

    /**
     * Crée une variante ($varianteId null) ou met à jour son prix et son
     * stock ; un changement de stock est inscrit au journal (« ajustement »).
     * Renvoie son identifiant.
     */
    private function enregistrerVariante(int $produitId, ?int $varianteId, float $prix, int $stock, int $auteurId): int
    {
        $avant = 0;

        if ($varianteId === null) {
            $requetePreparee = $this->pdo->prepare(
                'INSERT INTO variante (produit_id, prix, stock) VALUES (:produit, :prix, :stock)'
            );
            $requetePreparee->bindValue(':produit', $produitId, PDO::PARAM_INT);
        } else {
            // Stock relu sous verrou : une commande simultanée ne peut pas
            // le modifier entre la lecture et l'écriture.
            $requeteAvant = $this->pdo->prepare(
                'SELECT stock FROM variante WHERE id = :id AND produit_id = :produit FOR UPDATE'
            );
            $requeteAvant->bindValue(':id',      $varianteId, PDO::PARAM_INT);
            $requeteAvant->bindValue(':produit', $produitId,  PDO::PARAM_INT);
            $requeteAvant->execute();
            $avant = (int) $requeteAvant->fetchColumn();

            $requetePreparee = $this->pdo->prepare('UPDATE variante SET prix = :prix, stock = :stock WHERE id = :id');
            $requetePreparee->bindValue(':id', $varianteId, PDO::PARAM_INT);
        }
        $requetePreparee->bindValue(':prix',  (string) $prix, PDO::PARAM_STR);
        $requetePreparee->bindValue(':stock', $stock,         PDO::PARAM_INT);
        $requetePreparee->execute();

        $varianteId ??= (int) $this->pdo->lastInsertId();

        if ($stock !== $avant) {
            $requeteJournal = $this->pdo->prepare(
                "INSERT INTO mouvement_stock (variante_id, commande_id, utilisateur_id, quantite, motif, stock_avant, stock_apres)
                 VALUES (:variante, NULL, :auteur, :quantite, 'ajustement', :avant, :apres)"
            );
            $requeteJournal->bindValue(':variante', $varianteId,      PDO::PARAM_INT);
            $requeteJournal->bindValue(':auteur',   $auteurId,        PDO::PARAM_INT);
            $requeteJournal->bindValue(':quantite', $stock - $avant,  PDO::PARAM_INT);
            $requeteJournal->bindValue(':avant',    $avant,           PDO::PARAM_INT);
            $requeteJournal->bindValue(':apres',    $stock,           PDO::PARAM_INT);
            $requeteJournal->execute();
        }

        return $varianteId;
    }

    /**
     * Supprime les lignes d'une table rattachées à un parent, sauf celles
     * gardées. La table et la colonne viennent du code, jamais de la requête.
     *
     * @param int[] $gardes Identifiants à conserver.
     */
    private function supprimerAbsents(string $table, string $colonne, int $parentId, array $gardes): void
    {
        $sql = "DELETE FROM {$table} WHERE {$colonne} = ?";
        if ($gardes !== []) {
            $sql .= ' AND id NOT IN (' . implode(', ', array_fill(0, count($gardes), '?')) . ')';
        }

        $requetePreparee = $this->pdo->prepare($sql);
        $requetePreparee->bindValue(1, $parentId, PDO::PARAM_INT);
        foreach (array_values($gardes) as $position => $garde) {
            $requetePreparee->bindValue($position + 2, $garde, PDO::PARAM_INT);
        }
        $requetePreparee->execute();
    }

    /**
     * Supprime un produit (variantes, options et images avec lui). Renvoie
     * les fichiers de ses images, pour effacer ceux qui ont été téléversés.
     * Les commandes passées gardent leurs lignes (variante à NULL).
     *
     * @return string[]
     */
    public function supprimer(int $id): array
    {
        $requeteImages = $this->pdo->prepare('SELECT fichier FROM image WHERE produit_id = :id');
        $requeteImages->bindValue(':id', $id, PDO::PARAM_INT);
        $requeteImages->execute();
        $fichiers = $requeteImages->fetchAll(PDO::FETCH_COLUMN);

        $requetePreparee = $this->pdo->prepare('DELETE FROM produit WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $fichiers;
    }

    /**
     * Ajoute une image au produit (images du produit, après les autres).
     */
    public function ajouterImage(int $produitId, string $fichier, string $alt): void
    {
        $requetePreparee = $this->pdo->prepare(
            'INSERT INTO image (produit_id, variante_id, fichier, alt, ordre)
             SELECT :produit, NULL, :fichier, :alt, COALESCE(MAX(ordre), 0) + 1
               FROM image WHERE produit_id = :produit_ordre AND variante_id IS NULL'
        );
        $requetePreparee->bindValue(':produit',       $produitId, PDO::PARAM_INT);
        $requetePreparee->bindValue(':produit_ordre', $produitId, PDO::PARAM_INT);
        $requetePreparee->bindValue(':fichier',       $fichier,   PDO::PARAM_STR);
        $requetePreparee->bindValue(':alt',           $alt,       PDO::PARAM_STR);
        $requetePreparee->execute();
    }

    /**
     * Une image, ou null si elle n'existe pas.
     *
     * @return array{id: int, produit_id: int, variante_id: ?int, fichier: string}|null
     */
    public function trouverImage(int $id): ?array
    {
        $requetePreparee = $this->pdo->prepare('SELECT id, produit_id, variante_id, fichier FROM image WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();
        $ligne = $requetePreparee->fetch();

        if ($ligne === false) {
            return null;
        }

        return [
            'id'          => (int) $ligne['id'],
            'produit_id'  => (int) $ligne['produit_id'],
            'variante_id' => $ligne['variante_id'] === null ? null : (int) $ligne['variante_id'],
            'fichier'     => $ligne['fichier'],
        ];
    }

    /**
     * Vrai si la variante appartient au produit.
     */
    public function varianteDuProduit(int $varianteId, int $produitId): bool
    {
        $requetePreparee = $this->pdo->prepare('SELECT 1 FROM variante WHERE id = :id AND produit_id = :produit');
        $requetePreparee->bindValue(':id',      $varianteId, PDO::PARAM_INT);
        $requetePreparee->bindValue(':produit', $produitId,  PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Supprime une image, puis renumérote les images de son groupe (celles du
     * produit, ou celles d'une variante) : la suivante devient la principale.
     */
    public function supprimerImage(int $id): void
    {
        $image = $this->trouverImage($id);

        $requetePreparee = $this->pdo->prepare('DELETE FROM image WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();

        $this->renumeroter($image['produit_id'], $image['variante_id'], null, null);
    }

    /**
     * Fait d'une image la principale (ordre 1) de son groupe.
     */
    public function rendrePrincipale(int $id): void
    {
        $image = $this->trouverImage($id);
        $this->renumeroter($image['produit_id'], $image['variante_id'], $id, null);
    }

    /**
     * Où l'image sert : « partout », « catalogue » (cartes, panier) ou
     * « fiche » (galerie). Valeur déjà validée par le contrôleur.
     */
    public function changerAffichage(int $id, string $affichage): void
    {
        $requetePreparee = $this->pdo->prepare('UPDATE image SET affichage = :affichage WHERE id = :id');
        $requetePreparee->bindValue(':affichage', $affichage, PDO::PARAM_STR);
        $requetePreparee->bindValue(':id',        $id,        PDO::PARAM_INT);
        $requetePreparee->execute();
    }

    /**
     * Rattache une image à une variante (un coloris), ou au produit
     * ($varianteId null). Elle passe en fin de son nouveau groupe.
     */
    public function rattacherImage(int $id, ?int $varianteId): void
    {
        $image = $this->trouverImage($id);

        $this->pdo->beginTransaction();

        try {
            // Ordre provisoire hors des valeurs utilisées, puis renumérotation
            // des deux groupes concernés.
            $requetePreparee = $this->pdo->prepare('UPDATE image SET variante_id = :variante, ordre = 250 WHERE id = :id');
            $requetePreparee->bindValue(':variante', $varianteId, $varianteId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $requetePreparee->bindValue(':id',       $id,         PDO::PARAM_INT);
            $requetePreparee->execute();

            $this->renumeroter($image['produit_id'], $image['variante_id'], null, null);
            $this->renumeroter($image['produit_id'], $varianteId, null, $id);

            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Renumérote de 1 à n les images d'un groupe (produit, ou variante),
     * dans leur ordre actuel. $enTete passe en premier, $enFin en dernier.
     */
    private function renumeroter(int $produitId, ?int $varianteId, ?int $enTete, ?int $enFin): void
    {
        $requeteGroupe = $this->pdo->prepare(
            'SELECT id FROM image WHERE produit_id = :produit AND variante_id <=> :variante ORDER BY ordre, id'
        );
        $requeteGroupe->bindValue(':produit',  $produitId,  PDO::PARAM_INT);
        $requeteGroupe->bindValue(':variante', $varianteId, $varianteId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $requeteGroupe->execute();
        $ids = array_map('intval', $requeteGroupe->fetchAll(PDO::FETCH_COLUMN));

        if ($enTete !== null) {
            $ids = array_merge([$enTete], array_values(array_diff($ids, [$enTete])));
        }
        if ($enFin !== null) {
            $ids = array_merge(array_values(array_diff($ids, [$enFin])), [$enFin]);
        }

        // Deux passes : la clé unique (produit, variante, ordre) interdit que
        // deux images portent un instant le même ordre.
        $requeteOrdre = $this->pdo->prepare('UPDATE image SET ordre = :ordre WHERE id = :id');
        foreach ([100, 0] as $decalage) {
            foreach ($ids as $position => $imageId) {
                $requeteOrdre->bindValue(':ordre', $decalage + $position + 1, PDO::PARAM_INT);
                $requeteOrdre->bindValue(':id',    $imageId,                  PDO::PARAM_INT);
                $requeteOrdre->execute();
            }
        }
    }
}
