<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\TableauDeBordModel;
use App\Model\UtilisateurModel;

/**
 * Connexion au back-office et tableau de bord.
 *
 * L'authentification des administrateurs est séparée de celle des clients :
 * son propre point d'entrée (seuls les comptes admin y sont acceptés) et sa
 * propre clé de session ($_SESSION['admin']). Être connecté comme client ne
 * donne aucun accès ici, et inversement. Non connecté : 403 (jamais 401, voir
 * AuthController).
 */
final class AdminController
{
    /** Le modèle des comptes, fourni à la construction. */
    private UtilisateurModel $utilisateurs;

    /** Le modèle des indicateurs du tableau de bord. */
    private TableauDeBordModel $tableaux;

    public function __construct(UtilisateurModel $utilisateurs, TableauDeBordModel $tableaux)
    {
        $this->utilisateurs = $utilisateurs;
        $this->tableaux     = $tableaux;
    }

    /**
     * POST /api/admin/login, corps JSON { email, mdp }.
     */
    public function login(Request $requete): void
    {
        $corps = $requete->corps();
        $email = mb_strtolower(trim((string) ($corps['email'] ?? '')));
        $mdp   = (string) ($corps['mdp'] ?? '');

        $compte = $this->utilisateurs->trouverParEmail($email);

        // Même message pour un compte inconnu, un client ou un mauvais mot de
        // passe : rien ne permet de deviner quelles adresses sont admin.
        if ($compte === null || $compte['role'] !== 'admin' || !password_verify($mdp, $compte['mot_de_passe'])) {
            Response::erreur('Adresse e-mail ou mot de passe incorrect.', 422);
        }

        // Accès élevé : identifiant de session neuf, l'ancien est détruit.
        session_regenerate_id(true);

        $_SESSION['admin'] = ['id' => $compte['id'], 'email' => $compte['email'], 'prenom' => $compte['prenom']];

        Response::json(['connecte' => true, 'email' => $compte['email'], 'prenom' => $compte['prenom']]);
    }

    /**
     * POST /api/admin/logout. La connexion client éventuelle reste ouverte.
     */
    public function logout(): void
    {
        unset($_SESSION['admin']);
        session_regenerate_id(true);

        Response::json(['connecte' => false, 'email' => null, 'prenom' => null]);
    }

    /**
     * GET /api/admin/session : l'administrateur connecté, s'il y en a un.
     */
    public function session(): void
    {
        if (!isset($_SESSION['admin'])) {
            Response::json(['connecte' => false, 'email' => null, 'prenom' => null]);
        }

        Response::json([
            'connecte' => true,
            'email'    => $_SESSION['admin']['email'],
            'prenom'   => $_SESSION['admin']['prenom'] ?? null,
        ]);
    }

    /**
     * GET /api/admin/tableau-de-bord : les indicateurs de la page d'accueil.
     */
    public function tableauDeBord(): void
    {
        // La session est déjà ouverte par index.php.
        if (!isset($_SESSION['admin'])) {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }

        Response::json($this->tableaux->indicateurs());
    }
}
