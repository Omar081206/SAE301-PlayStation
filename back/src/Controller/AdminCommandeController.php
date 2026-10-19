<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CommandeModel;

/**
 * Gestion des commandes, réservée aux administrateurs : liste triée, détail,
 * changement de statut, à l'unité ou en lot.
 *
 * Seule l'annulation touche au stock : elle rend à chaque variante les
 * quantités de la commande. Les autres statuts ne font que suivre le retrait
 * en magasin. Chaque changement est inscrit au journal des administrateurs
 * (CommandeModel::changerStatut).
 */
final class AdminCommandeController
{
    /**
     * Statuts depuis lesquels on peut passer à chaque nouveau statut. Une
     * commande retirée ou annulée ne change plus.
     */
    private const TRANSITIONS = [
        'disponible' => ['en_cours'],
        'retiree'    => ['disponible'],
        'annulee'    => ['en_cours', 'disponible'],
    ];

    /** Libellé de chaque statut, pour les messages. */
    private const LIBELLES = [
        'en_cours'   => 'en cours',
        'disponible' => 'disponible',
        'retiree'    => 'retirée',
        'annulee'    => 'annulée',
    ];

    /** Clés de tri acceptées pour la liste. */
    private const TRIS = ['numero', 'date', 'statut', 'montant'];

    /** Nombre maximal de commandes dans une action en lot. */
    private const LOT_MAX = 100;

    /** Le modèle qui lit et modifie les commandes, fourni à la construction. */
    private CommandeModel $commandes;

    public function __construct(CommandeModel $commandes)
    {
        $this->commandes = $commandes;
    }

    /**
     * Identifiant de l'administrateur connecté. Répond 403 (et termine) sans
     * session d'administration (voir AdminController). La session est déjà
     * ouverte par index.php.
     */
    private function adminConnecte(): int
    {
        if (!isset($_SESSION['admin'])) {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }

        return (int) $_SESSION['admin']['id'];
    }

    /**
     * Statuts vers lesquels une commande peut passer depuis son statut actuel.
     *
     * @return string[]
     */
    private function suivants(string $statut): array
    {
        return array_keys(array_filter(
            self::TRANSITIONS,
            static fn (array $depuis): bool => in_array($statut, $depuis, true)
        ));
    }

    /**
     * Change le statut d'une commande et décrit le résultat :
     * { numero, change, statut, ancienStatut } si le changement est fait,
     * { numero, change: false, code, erreur } sinon (code HTTP de la raison).
     *
     * @return array<string, mixed>
     */
    private function appliquer(string $numero, string $nouveau, int $auteur): array
    {
        $resultat = $this->commandes->changerStatut(
            $numero,
            $nouveau,
            self::TRANSITIONS[$nouveau],
            $nouveau === 'annulee',
            $auteur
        );

        if ($resultat === null) {
            return ['numero' => $numero, 'change' => false, 'code' => 404, 'erreur' => 'Commande introuvable'];
        }

        if (!$resultat['change']) {
            return [
                'numero' => $numero,
                'change' => false,
                'code'   => 422,
                'erreur' => 'Une commande « ' . self::LIBELLES[$resultat['avant']]
                          . ' » ne peut pas passer à « ' . self::LIBELLES[$nouveau] . ' ».',
            ];
        }

        return ['numero' => $numero, 'change' => true, 'statut' => $nouveau, 'ancienStatut' => $resultat['avant']];
    }

    /**
     * GET /api/admin/commandes?tri=numero|date|statut|montant&sens=asc|desc :
     * toutes les commandes, chacune avec les statuts vers lesquels elle peut
     * passer (boutons de ligne). Par défaut, les plus récentes d'abord.
     */
    public function index(Request $requete): void
    {
        $this->adminConnecte();

        $tri  = $requete->parametre('tri', 'date');
        $sens = $requete->parametre('sens', 'desc');

        if (!in_array($tri, self::TRIS, true) || !in_array($sens, ['asc', 'desc'], true)) {
            Response::erreur('Tri invalide', 400);
        }

        $commandes = array_map(
            fn (array $commande): array => $commande + ['suivants' => $this->suivants($commande['statut'])],
            $this->commandes->listerPourAdmin($tri, $sens === 'asc')
        );

        Response::json([
            'commandes' => $commandes,
            'tri'       => $tri,
            'sens'      => $sens,
        ]);
    }

    /**
     * GET /api/admin/commande?numero=… : le détail d'une commande, avec les
     * statuts vers lesquels elle peut passer.
     */
    public function detail(Request $requete): void
    {
        $this->adminConnecte();

        $numero = $requete->parametre('numero');

        if ($numero === null || $numero === '') {
            Response::erreur('Le paramètre numero est obligatoire', 400);
        }

        $commande = $this->commandes->trouverPourAdmin($numero);

        if ($commande === null) {
            Response::erreur('Commande introuvable', 404);
        }

        Response::json(['commande' => $commande + ['suivants' => $this->suivants($commande['statut'])]]);
    }

    /**
     * POST /api/admin/commande/statut, corps JSON { numero, statut }.
     */
    public function statut(Request $requete): void
    {
        $auteur = $this->adminConnecte();

        $corps   = $requete->corps();
        $numero  = (string) ($corps['numero'] ?? '');
        $nouveau = (string) ($corps['statut'] ?? '');

        if ($numero === '' || !array_key_exists($nouveau, self::TRANSITIONS)) {
            Response::erreur('Numéro de commande ou statut invalide', 422);
        }

        $resultat = $this->appliquer($numero, $nouveau, $auteur);

        if (!$resultat['change']) {
            Response::erreur($resultat['erreur'], $resultat['code']);
        }

        Response::json(['numero' => $numero, 'statut' => $nouveau, 'ancienStatut' => $resultat['ancienStatut']]);
    }

    /**
     * POST /api/admin/commandes/statut, corps JSON { numeros: [...], statut }.
     *
     * Chaque commande est traitée séparément, dans sa propre transaction :
     * celles qui le peuvent changent de statut, les autres sont refusées sans
     * bloquer le lot. La réponse donne le résultat de chacune.
     */
    public function statutLot(Request $requete): void
    {
        $auteur = $this->adminConnecte();

        $corps   = $requete->corps();
        $numeros = $corps['numeros'] ?? null;
        $nouveau = (string) ($corps['statut'] ?? '');

        if (!is_array($numeros) || $numeros === [] || count($numeros) > self::LOT_MAX
            || !array_key_exists($nouveau, self::TRANSITIONS)) {
            Response::erreur('Sélection ou statut invalide', 422);
        }

        foreach ($numeros as $numero) {
            if (!is_string($numero) || $numero === '') {
                Response::erreur('Numéro de commande invalide', 422);
            }
        }

        // Une commande cochée deux fois n'est traitée qu'une fois.
        $resultats = [];

        foreach (array_unique($numeros) as $numero) {
            $resultat = $this->appliquer($numero, $nouveau, $auteur);
            unset($resultat['code']);
            $resultats[] = $resultat;
        }

        Response::json([
            'statut'    => $nouveau,
            'changees'  => count(array_filter($resultats, static fn (array $r): bool => $r['change'])),
            'resultats' => $resultats,
        ]);
    }
}
