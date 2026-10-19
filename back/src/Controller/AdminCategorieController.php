<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategorieModel;

/**
 * Gestion des catégories, réservée aux administrateurs.
 *
 * Le nom et la description sont saisis ; le slug (adresse /categorie/…) est
 * toujours déduit du nom, ici : deux catégories ne peuvent avoir ni le même
 * nom ni le même slug.
 *
 * Une catégorie qui contient des produits n'est supprimée qu'avec une
 * catégorie de destination : ses produits y sont déplacés, dans la même
 * transaction. Sans destination, la suppression est refusée (409) : aucun
 * produit ne se retrouve sans catégorie.
 */
final class AdminCategorieController
{
    /** Longueurs permises pour le nom (taille de la colonne : 60). */
    private const NOM_MIN = 2;
    private const NOM_MAX = 60;

    /** Longueur maximale de la description. */
    private const DESCRIPTION_MAX = 500;

    /** Le modèle qui lit et modifie les catégories, fourni à la construction. */
    private CategorieModel $categories;

    public function __construct(CategorieModel $categories)
    {
        $this->categories = $categories;
    }

    /**
     * Répond 403 (et termine) sans session d'administration (voir
     * AdminController). La session est déjà ouverte par index.php.
     */
    private function verifierAdmin(): void
    {
        if (!isset($_SESSION['admin'])) {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }
    }

    /**
     * Slug d'un nom : minuscules sans accents, mots séparés par des tirets.
     * « Casques & accessoires » donne « casques-accessoires ». Partagé avec
     * AdminProduitController.
     */
    public static function slug(string $nom): string
    {
        $sansAccents = strtr(mb_strtolower($nom), [
            'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ã' => 'a',
            'ç' => 'c',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'î' => 'i', 'ï' => 'i', 'í' => 'i',
            'ô' => 'o', 'ö' => 'o', 'ó' => 'o', 'õ' => 'o', 'ō' => 'o',
            'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ú' => 'u', 'ū' => 'u',
            'ÿ' => 'y', 'ñ' => 'n', 'œ' => 'oe', 'æ' => 'ae',
        ]);

        return trim((string) preg_replace('/[^a-z0-9]+/', '-', $sansAccents), '-');
    }

    /**
     * Nom, slug et description du corps de la requête, validés. Répond 422
     * (et termine) si une saisie est invalide, 409 si le nom ou le slug est
     * déjà pris par une autre catégorie que $sauf.
     *
     * @return array{nom: string, slug: string, description: string}
     */
    private function saisieValide(Request $requete, int $sauf): array
    {
        $corps       = $requete->corps();
        $nom         = trim((string) ($corps['nom'] ?? ''));
        $description = trim((string) ($corps['description'] ?? ''));
        $slug        = self::slug($nom);

        if (mb_strlen($nom) < self::NOM_MIN || mb_strlen($nom) > self::NOM_MAX) {
            Response::erreur('Le nom doit contenir de 2 à 60 caractères.', 422);
        }

        // Un nom fait seulement de symboles (« *** ») n'aurait pas d'adresse.
        if ($slug === '') {
            Response::erreur('Le nom doit contenir au moins une lettre ou un chiffre.', 422);
        }

        if ($description === '' || mb_strlen($description) > self::DESCRIPTION_MAX) {
            Response::erreur('La description est obligatoire (500 caractères au plus).', 422);
        }

        if ($this->categories->nomOuSlugPris($nom, $slug, $sauf)) {
            Response::erreur('Une catégorie porte déjà ce nom (ou un nom trop proche).', 409);
        }

        return ['nom' => $nom, 'slug' => $slug, 'description' => $description];
    }

    /**
     * Identifiant d'une catégorie existante, lu dans le corps de la requête.
     * Répond 422 s'il est absent ou invalide, 404 si la catégorie n'existe pas.
     */
    private function categorieExistante(Request $requete): int
    {
        $id = $requete->corps()['id'] ?? null;

        if (!is_int($id) || $id <= 0) {
            Response::erreur('Identifiant de catégorie invalide', 422);
        }

        if (!$this->categories->existe($id)) {
            Response::erreur('Catégorie introuvable', 404);
        }

        return $id;
    }

    /**
     * GET /api/admin/categories : toutes les catégories, avec leur nombre de
     * produits.
     */
    public function index(): void
    {
        $this->verifierAdmin();

        Response::json(['categories' => $this->categories->listerPourAdmin()]);
    }

    /**
     * POST /api/admin/categorie/creer, corps JSON { nom, description }.
     */
    public function creer(Request $requete): void
    {
        $this->verifierAdmin();

        $saisie = $this->saisieValide($requete, 0);
        $id     = $this->categories->creer($saisie['nom'], $saisie['slug'], $saisie['description']);

        Response::json(['categorie' => ['id' => $id] + $saisie], 201);
    }

    /**
     * POST /api/admin/categorie/modifier, corps JSON { id, nom, description }.
     * Le slug suit le nom : l'ancienne adresse /categorie/… ne répond plus.
     */
    public function modifier(Request $requete): void
    {
        $this->verifierAdmin();

        $id     = $this->categorieExistante($requete);
        $saisie = $this->saisieValide($requete, $id);
        $this->categories->modifier($id, $saisie['nom'], $saisie['slug'], $saisie['description']);

        Response::json(['categorie' => ['id' => $id] + $saisie]);
    }

    /**
     * POST /api/admin/categorie/supprimer, corps JSON { id, destination }.
     * destination : catégorie qui reçoit les produits, ou null pour une
     * catégorie vide.
     */
    public function supprimer(Request $requete): void
    {
        $this->verifierAdmin();

        $id          = $this->categorieExistante($requete);
        $destination = $requete->corps()['destination'] ?? null;

        if ($destination !== null) {
            if (!is_int($destination) || $destination === $id || !$this->categories->existe($destination)) {
                Response::erreur('Choisissez une autre catégorie existante pour recevoir les produits.', 422);
            }
        }

        $deplaces = $this->categories->supprimer($id, $destination);

        if ($deplaces === null) {
            Response::erreur('Cette catégorie contient des produits : choisissez la catégorie qui les recevra.', 409);
        }

        Response::json(['id' => $id, 'deplaces' => $deplaces]);
    }
}
