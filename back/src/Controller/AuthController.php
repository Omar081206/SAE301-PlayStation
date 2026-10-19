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
 * La session client (clés id, utilisateur, prenom, nom, role) est distincte
 * de la session d'administration (clé admin, voir AdminController) : les
 * comptes admin ne se connectent pas ici, et se déconnecter de la boutique ne
 * touche pas à l'administration.
 *
 * Aucune réponse 401 : sur mmi.unilim.fr, tout l'espace web est protégé par
 * l'authentification HTTP d'Apache, et un 401 venu de l'API ferait croire au
 * navigateur que les identifiants de l'IUT sont refusés (il les redemande ou
 * les oublie). Identifiants incorrects : 422 ; non connecté : 403.
 */
final class AuthController
{
    /** Longueur minimale d'un mot de passe. */
    public const MDP_MIN = 8;

    /** Longueur maximale d'une adresse e-mail (taille de la colonne). */
    private const EMAIL_MAX = 180;

    /** Longueur maximale d'un prénom ou d'un nom (taille des colonnes). */
    private const NOM_MAX = 60;

    /**
     * Forme d'un prénom ou d'un nom : des lettres (accents compris), et
     * éventuellement des espaces, tirets et apostrophes entre elles.
     */
    private const NOM_FORME = "/^\\p{L}[\\p{L}\\p{M} '’-]*$/u";

    /** Le modèle qui interroge la base, fourni à la construction. */
    private UtilisateurModel $utilisateurs;

    public function __construct(UtilisateurModel $utilisateurs)
    {
        $this->utilisateurs = $utilisateurs;
    }

    /**
     * Message d'erreur pour un prénom, un nom ou une adresse invalide, ou
     * null si les trois sont valides. Partagé avec CompteController (profil).
     */
    public static function erreurIdentite(string $prenom, string $nom, string $email): ?string
    {
        foreach (['prénom' => $prenom, 'nom' => $nom] as $libelle => $valeur) {
            if (mb_strlen($valeur) > self::NOM_MAX || preg_match(self::NOM_FORME, $valeur) !== 1) {
                return "Saisissez votre {$libelle} (lettres, espaces, tirets ou apostrophes ; 60 caractères au plus).";
            }
        }

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || mb_strlen($email) > self::EMAIL_MAX) {
            return 'Saisissez une adresse e-mail valide.';
        }

        return null;
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

        $this->ouvrirSession($compte['id'], $compte['email'], $compte['prenom'], $compte['nom'], $compte['role']);
    }

    /**
     * POST /api/inscription, corps JSON { prenom, nom, email, mdp }. Le compte
     * créé est aussitôt connecté.
     */
    public function inscription(Request $requete): void
    {
        $corps  = $requete->corps();
        $prenom = trim((string) ($corps['prenom'] ?? ''));
        $nom    = trim((string) ($corps['nom'] ?? ''));
        $email  = mb_strtolower(trim((string) ($corps['email'] ?? '')));
        $mdp    = (string) ($corps['mdp'] ?? '');

        $erreur = self::erreurIdentite($prenom, $nom, $email);

        if ($erreur !== null) {
            Response::erreur($erreur, 422);
        }

        if (mb_strlen($mdp) < self::MDP_MIN) {
            Response::erreur('Le mot de passe doit contenir au moins 8 caractères.', 422);
        }

        if ($this->utilisateurs->trouverParEmail($email) !== null) {
            Response::erreur('Un compte existe déjà avec cette adresse e-mail.', 409);
        }

        $id = $this->utilisateurs->creer($email, $prenom, $nom, password_hash($mdp, PASSWORD_DEFAULT));

        $this->ouvrirSession($id, $email, $prenom, $nom, 'client');
    }

    /**
     * GET /api/session : l'utilisateur connecté, s'il y en a un.
     */
    public function session(): void
    {
        if (!isset($_SESSION['id'])) {
            Response::json(self::deconnecte());
        }

        // Compte supprimé depuis l'ouverture de la session : on la ferme.
        if (!$this->utilisateurs->existe((int) $_SESSION['id'])) {
            self::fermerSession();
            Response::json(self::deconnecte());
        }

        // Une session ouverte avant l'arrivée des prénoms n'en a pas : le
        // header affiche alors « Mon compte ».
        Response::json([
            'connecte' => true,
            'email'    => $_SESSION['utilisateur'],
            'prenom'   => $_SESSION['prenom'] ?? null,
            'nom'      => $_SESSION['nom'] ?? null,
            'role'     => $_SESSION['role'],
        ]);
    }

    public function logout(): void
    {
        // Seule la connexion client est fermée : une session d'administration
        // ouverte dans le même navigateur reste ouverte.
        self::fermerSession();

        if ($_SESSION !== []) {
            session_regenerate_id(true);
            Response::json(self::deconnecte());
        }

        // Supprime le cookie, avec le chemin sous lequel il a été posé : celui
        // que index.php a réglé avant session_start().
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path'    => session_get_cookie_params()['path'],
        ]);

        session_destroy();                            // efface le fichier serveur

        Response::json(self::deconnecte());
    }

    /**
     * Réponse « personne n'est connecté ».
     *
     * @return array<string, mixed>
     */
    public static function deconnecte(): array
    {
        return ['connecte' => false, 'email' => null, 'prenom' => null, 'nom' => null, 'role' => null];
    }

    /**
     * Retire la connexion client de la session (la session d'administration
     * éventuelle reste). Partagé avec les contrôleurs qui vérifient le client.
     */
    public static function fermerSession(): void
    {
        unset($_SESSION['id'], $_SESSION['utilisateur'], $_SESSION['prenom'], $_SESSION['nom'], $_SESSION['role']);
    }

    /**
     * Range l'utilisateur en session et répond avec son état de connexion.
     */
    private function ouvrirSession(int $id, string $email, string $prenom, string $nom, string $role): void
    {
        // L'utilisateur devient authentifié : on lui attribue un identifiant de
        // session neuf, et on détruit l'ancien (true). Aucun identifiant connu
        // avant ce point ne donne plus accès à la session.
        session_regenerate_id(true);

        $_SESSION['id']          = $id;
        $_SESSION['utilisateur'] = $email;
        $_SESSION['prenom']      = $prenom;
        $_SESSION['nom']         = $nom;
        $_SESSION['role']        = $role;

        Response::json(['connecte' => true, 'email' => $email, 'prenom' => $prenom, 'nom' => $nom, 'role' => $role]);
    }
}
