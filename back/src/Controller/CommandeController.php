<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CommandeModel;
use App\Model\PanierModel;

/**
 * Validation et consultation des commandes, réservées au client connecté.
 *
 * Le navigateur n'envoie que des identifiants de variantes et des quantités :
 * noms, prix et total sont relus en base au moment de la commande, puis
 * figés dans les lignes de commande.
 */
final class CommandeController
{
    /** Quantité maximale d'une ligne : mêmes règles que PanierController. */
    private const QUANTITE_MAX = 99;

    /** Nombre maximal de lignes acceptées dans une commande. */
    private const LIGNES_MAX = 50;

    /** Le modèle qui lit les variantes (prix actuels), fourni à la construction. */
    private PanierModel $paniers;

    /** Le modèle qui enregistre et relit les commandes. */
    private CommandeModel $commandes;

    public function __construct(PanierModel $paniers, CommandeModel $commandes)
    {
        $this->paniers   = $paniers;
        $this->commandes = $commandes;
    }

    /**
     * POST /api/commande, corps JSON { lignes: [ { variantId, quantite } ] }.
     *
     * Enregistre la commande au statut « en cours » et répond avec elle.
     */
    public function enregistrer(Request $requete): void
    {
        if (!isset($_SESSION['id'])) {
            Response::erreur('Connectez-vous pour valider votre commande.', 401);
        }

        $lignes = $requete->corps()['lignes'] ?? null;

        if (!is_array($lignes) || count($lignes) > self::LIGNES_MAX) {
            Response::erreur('Panier invalide', 422);
        }

        // Validation : des entiers, dans les bornes. Une même variante n'a
        // qu'une ligne ; si elle revient, la dernière quantité l'emporte.
        $quantites = [];

        foreach ($lignes as $ligne) {
            $id       = $ligne['variantId'] ?? null;
            $quantite = $ligne['quantite'] ?? null;

            if (!is_int($id) || $id <= 0 || !is_int($quantite) || $quantite < 1 || $quantite > self::QUANTITE_MAX) {
                Response::erreur('Ligne de panier invalide', 422);
            }

            $quantites[$id] = $quantite;
        }

        $variantes = $this->paniers->detailler(array_keys($quantites));

        // Les prix viennent de la base, jamais du client.
        $aEnregistrer = [];
        $total        = 0.0;

        foreach ($quantites as $id => $quantite) {
            if (!isset($variantes[$id])) {
                continue;
            }

            $total += round($variantes[$id]['prix'] * $quantite, 2);

            $aEnregistrer[] = [
                'variantId' => $id,
                'nom'       => $variantes[$id]['nom'],
                'coloris'   => $variantes[$id]['coloris'],
                'prix'      => $variantes[$id]['prix'],
                'quantite'  => $quantite,
            ];
        }

        if ($aEnregistrer === []) {
            Response::erreur('Votre panier est vide.', 422);
        }

        $numero = $this->commandes->creer((int) $_SESSION['id'], $aEnregistrer, round($total, 2));

        Response::json(['commande' => $this->commandes->trouver($numero, (int) $_SESSION['id'])], 201);
    }

    /**
     * GET /api/commande?numero=… : une commande du client connecté.
     */
    public function detail(Request $requete): void
    {
        if (!isset($_SESSION['id'])) {
            Response::erreur('Connectez-vous pour consulter votre commande.', 401);
        }

        $numero = $requete->parametre('numero');

        if ($numero === null || $numero === '') {
            Response::erreur('Le paramètre numero est obligatoire', 400);
        }

        $commande = $this->commandes->trouver($numero, (int) $_SESSION['id']);

        // Même réponse pour une commande inexistante et pour celle d'un autre
        // client : on ne révèle pas quels numéros existent.
        if ($commande === null) {
            Response::erreur('Commande introuvable', 404);
        }

        Response::json(['commande' => $commande]);
    }
}
