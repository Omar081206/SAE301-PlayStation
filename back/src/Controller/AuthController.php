<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\UtilisateurModel;

/**
 * Inscription, connexion et déconnexion.
 *
 * L'identité et le rôle de l'utilisateur connecté sont rangés en session,
 * côté serveur. Le client ne détient que l'identifiant de session, dans le
 * cookie PHPSESSID.
 *
 * La session client (clés id, utilisateur, role) est distincte de la session
 * d'administration (clé admin, voir AdminController) : les comptes admin ne se
 * connectent pas ici, et se déconnecter de la boutique ne touche pas à
 * l'administration.
 *
 * Aucune réponse 401 : sur mmi.unilim.fr, tout l'espace web est protégé par
 * l'authentification HTTP d'Apache, et un 401 venu de l'API ferait croire au
 * navigateur que les identifiants de l'IUT sont refusés (il les redemande ou
 * les oublie). Identifiants incorrects : 422 ; non connecté : 403.
 */
final class AuthController
{
    /** Longueur minimale d'un mot de passe. */
    private const MDP_MIN = 8;

    /** Longueur maximale d'une adresse e-mail (taille de la colonne). */
    private const EMAIL_MAX = 180;

    /** Le modèle qui interroge la base, fourni à la construction. */
    private UtilisateurModel $utilisateurs;

    public function __construct(UtilisateurModel $utilisateurs)
    {
        $this->utilisateurs = $utilisateurs;
    }

    /**
     * POST /api/login, corps JSON { email, mdp }.
     */
    public function login(Request $requete): void
    {
        $corps = $requete->corps();
        $email = mb_strtolower(trim((string) ($corps['email'] ?? '')));
        $mdp   = (string) ($corps['mdp'] ?? '');

        $compte = $this->utilisateurs->trouverParEmail($email);

        // Même message que le compte existe ou non, et pour un compte admin
        // (qui se connecte par /admin) : la réponse ne doit pas permettre de
        // deviner quelles adresses sont inscrites, ni lesquelles sont admin.
        if ($compte === null || $compte['role'] !== 'client' || !password_verify($mdp, $compte['mot_de_passe'])) {
            Response::erreur('Adresse e-mail ou mot de passe incorrect.', 422);
        }

        $this->ouvrirSession($compte['id'], $compte['email'], $compte['role']);
    }

    /**
     * POST /api/inscription, corps JSON { email, mdp }. Le compte créé est
     * aussitôt connecté.
     */
    public function inscription(Request $requete): void
    {
        $corps = $requete->corps();
        $email = mb_strtolower(trim((string) ($corps['email'] ?? '')));
        $mdp   = (string) ($corps['mdp'] ?? '');

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || mb_strlen($email) > self::EMAIL_MAX) {
            Response::erreur('Saisissez une adresse e-mail valide.', 422);
        }

        if (mb_strlen($mdp) < self::MDP_MIN) {
            Response::erreur('Le mot de passe doit contenir au moins 8 caractères.', 422);
        }

        if ($this->utilisateurs->trouverParEmail($email) !== null) {
            Response::erreur('Un compte existe déjà avec cette adresse e-mail.', 409);
        }

        $id = $this->utilisateurs->creer($email, password_hash($mdp, PASSWORD_DEFAULT));

        $this->ouvrirSession($id, $email, 'client');
    }

    /**
     * GET /api/session : l'utilisateur connecté, s'il y en a un.
     */
    public function session(): void
    {
        if (!isset($_SESSION['id'])) {
            Response::json(['connecte' => false, 'email' => null, 'role' => null]);
        }

        // Compte supprimé depuis l'ouverture de la session : on la ferme.
        if (!$this->utilisateurs->existe((int) $_SESSION['id'])) {
            unset($_SESSION['id'], $_SESSION['utilisateur'], $_SESSION['role']);
            Response::json(['connecte' => false, 'email' => null, 'role' => null]);
        }

        Response::json([
            'connecte' => true,
            'email'    => $_SESSION['utilisateur'],
            'role'     => $_SESSION['role'],
        ]);
    }

    public function logout(): void
    {
        // Seule la connexion client est fermée : une session d'administration
        // ouverte dans le même navigateur reste ouverte.
        unset($_SESSION['id'], $_SESSION['utilisateur'], $_SESSION['role']);

        if ($_SESSION !== []) {
            session_regenerate_id(true);
            Response::json(['connecte' => false, 'email' => null, 'role' => null]);
        }

        // Supprime le cookie, avec le chemin sous lequel il a été posé : celui
        // que index.php a réglé avant session_start().
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path'    => session_get_cookie_params()['path'],
        ]);

        session_destroy();                            // efface le fichier serveur

        Response::json(['connecte' => false, 'email' => null, 'role' => null]);
    }

    /**
     * Range l'utilisateur en session et répond avec son état de connexion.
     */
    private function ouvrirSession(int $id, string $email, string $role): void
    {
        // L'utilisateur devient authentifié : on lui attribue un identifiant de
        // session neuf, et on détruit l'ancien (true). Aucun identifiant connu
        // avant ce point ne donne plus accès à la session.
        session_regenerate_id(true);

        $_SESSION['id']          = $id;
        $_SESSION['utilisateur'] = $email;
        $_SESSION['role']        = $role;

        Response::json(['connecte' => true, 'email' => $email, 'role' => $role]);
    }
}
