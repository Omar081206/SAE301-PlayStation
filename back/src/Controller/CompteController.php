<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CommandeModel;
use App\Model\UtilisateurModel;

/**
 * Espace personnel du client connecté : son profil et ses dernières
 * commandes, et la modification de son profil.
 *
 * Changer d'adresse e-mail ou de mot de passe exige le mot de passe actuel :
 * une session restée ouverte ne suffit pas à s'approprier le compte. Changer
 * seulement le prénom ou le nom ne l'exige pas.
 *
 * Non connecté : 403, et non 401 (voir AuthController).
 */
final class CompteController
{
    /** Nombre de commandes de l'aperçu « Commandes récentes ». */
    private const RECENTES = 3;

    /** Commandes par page de l'historique. */
    private const PAR_PAGE = 10;

    /** Périodes de l'historique, en jours (null : toutes les commandes). */
    private const PERIODES = ['30j' => 30, '6m' => 183, '12m' => 365, 'tout' => null];

    /** Statuts qu'on peut filtrer. */
    private const STATUTS = ['en_cours', 'disponible', 'retiree', 'annulee'];

    /** Le modèle des comptes, fourni à la construction. */
    private UtilisateurModel $utilisateurs;

    /** Le modèle des commandes, pour l'aperçu de l'activité. */
    private CommandeModel $commandes;

    public function __construct(UtilisateurModel $utilisateurs, CommandeModel $commandes)
    {
        $this->utilisateurs = $utilisateurs;
        $this->commandes    = $commandes;
    }

    /**
     * Le compte du client connecté. Répond 403 (et termine) si personne
     * n'est connecté, ou si le compte de la session n'existe plus.
     *
     * @return array<string, mixed>
     */
    private function compteConnecte(): array
    {
        $compte = $this->utilisateurs->trouverParId((int) ($_SESSION['id'] ?? 0));

        if ($compte === null || $compte['role'] !== 'client') {
            AuthController::fermerSession();
            Response::erreur('Connectez-vous pour accéder à votre espace personnel.', 403);
        }

        return $compte;
    }

    /**
     * GET /api/compte : prénom, nom, adresse et dernières commandes.
     */
    public function index(): void
    {
        $compte = $this->compteConnecte();

        Response::json([
            'profil'    => ['prenom' => $compte['prenom'], 'nom' => $compte['nom'], 'email' => $compte['email']],
            'commandes' => $this->commandes->recentes($compte['id'], self::RECENTES),
        ]);
    }

    /**
     * GET /api/compte/commandes?statut=…&periode=…&page=… : l'historique des
     * commandes, la plus récente d'abord, par pages de 10.
     *
     * statut : en_cours, disponible, retiree, annulee, ou absent pour tous ;
     * periode : 30j, 6m (par défaut), 12m ou tout. Répond aussi avec le nombre
     * de commandes de chaque statut sur la période (filtres).
     */
    public function commandes(Request $requete): void
    {
        $compte = $this->compteConnecte();

        $statut  = $requete->parametre('statut');
        $periode = $requete->parametre('periode', '6m');
        $page    = filter_var($requete->parametre('page', '1'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        if (($statut !== null && !in_array($statut, self::STATUTS, true))
            || !array_key_exists($periode, self::PERIODES) || $page === false) {
            Response::erreur('Filtre invalide', 400);
        }

        $resultat = $this->commandes->historique(
            $compte['id'],
            $statut,
            self::PERIODES[$periode],
            self::PAR_PAGE,
            ($page - 1) * self::PAR_PAGE
        );

        Response::json([
            'commandes' => $resultat['commandes'],
            'compteurs' => $resultat['compteurs'],
            'page'      => $page,
            'pages'     => max(1, (int) ceil($resultat['total'] / self::PAR_PAGE)),
        ]);
    }

    /**
     * POST /api/compte/profil, corps JSON { prenom, nom, email, mdpActuel,
     * nouveauMdp }. nouveauMdp vide : le mot de passe ne change pas.
     *
     * Répond avec le profil enregistré et le nouvel état de connexion (le
     * header affiche le prénom).
     */
    public function profil(Request $requete): void
    {
        $compte = $this->compteConnecte();

        $corps      = $requete->corps();
        $prenom     = trim((string) ($corps['prenom'] ?? ''));
        $nom        = trim((string) ($corps['nom'] ?? ''));
        $email      = mb_strtolower(trim((string) ($corps['email'] ?? '')));
        $mdpActuel  = (string) ($corps['mdpActuel'] ?? '');
        $nouveauMdp = (string) ($corps['nouveauMdp'] ?? '');

        $erreur = AuthController::erreurIdentite($prenom, $nom, $email);

        if ($erreur !== null) {
            Response::erreur($erreur, 422);
        }

        $changeEmail = $email !== mb_strtolower($compte['email']);
        $changeMdp   = $nouveauMdp !== '';

        if ($changeEmail || $changeMdp) {
            if ($mdpActuel === '') {
                Response::erreur('Saisissez votre mot de passe actuel pour changer d’adresse e-mail ou de mot de passe.', 422);
            }

            if (!password_verify($mdpActuel, $compte['mot_de_passe'])) {
                Response::erreur('Le mot de passe actuel est incorrect.', 422);
            }
        }

        if ($changeMdp && mb_strlen($nouveauMdp) < AuthController::MDP_MIN) {
            Response::erreur('Le nouveau mot de passe doit contenir au moins 8 caractères.', 422);
        }

        if ($changeEmail && $this->utilisateurs->trouverParEmail($email) !== null) {
            Response::erreur('Un compte existe déjà avec cette adresse e-mail.', 409);
        }

        $this->utilisateurs->modifierProfil($compte['id'], $prenom, $nom, $email);

        if ($changeMdp) {
            $this->utilisateurs->modifierMotDePasse($compte['id'], password_hash($nouveauMdp, PASSWORD_DEFAULT));
            // Identifiants changés : nouvel identifiant de session.
            session_regenerate_id(true);
        }

        $_SESSION['utilisateur'] = $email;
        $_SESSION['prenom']      = $prenom;
        $_SESSION['nom']         = $nom;

        Response::json([
            'profil'  => ['prenom' => $prenom, 'nom' => $nom, 'email' => $email],
            'session' => ['connecte' => true, 'email' => $email, 'prenom' => $prenom, 'nom' => $nom, 'role' => 'client'],
        ]);
    }
}
