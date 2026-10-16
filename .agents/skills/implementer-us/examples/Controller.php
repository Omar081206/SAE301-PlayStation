<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\ExempleModel;

/**
 * Gabarit de contrôleur : valide la requête, orchestre le modèle, répond en JSON.
 * Enregistrer aussi la route (routes.php) et l'instance (index.php).
 */
final class ExempleController
{
    /** Liste blanche des tris : la clé vient du client, la valeur est écrite par nous. */
    private const TRIS = [
        'nom' => 'exemple.nom ASC',
    ];

    /** Le modèle qui interroge la base, fourni à la construction. */
    private ExempleModel $exemples;

    public function __construct(ExempleModel $exemples)
    {
        $this->exemples = $exemples;
    }

    public function index(Request $requete): void
    {
        $slug = $requete->parametre('slug');

        if ($slug === null || $slug === '') {
            Response::erreur('Le paramètre slug est obligatoire', 400);
        }

        $exemple = $this->exemples->trouver($slug);

        if ($exemple === null) {
            Response::erreur('Élément introuvable', 404);
        }

        Response::json(['elements' => [$exemple], 'choisi' => null]);
    }

    public function enregistrer(Request $requete): void
    {
        if (!isset($_SESSION['utilisateur'])) {
            Response::erreur('Connexion requise', 401);
        }

        $id = (int) ($requete->corps()['id'] ?? 0);

        if ($id <= 0) {
            Response::erreur('Identifiant invalide', 422);
        }

        Response::json(['enregistre' => $this->exemples->enregistrer($id)]);
    }
}
