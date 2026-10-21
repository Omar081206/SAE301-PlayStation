<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CodePromoModel;

/**
 * Gestion des codes promotionnels, réservée aux administrateurs.
 *
 * Un code est saisi librement puis ramené en majuscules : « ete25 » et
 * « ETE25 » sont le même code, et deux codes ne peuvent pas porter le même
 * texte. La réduction est un pourcentage entier. Supprimer un code ne modifie
 * pas les commandes qui l'ont déjà utilisé.
 */
final class AdminCodePromoController
{
    /** Forme permise pour un code : lettres majuscules et chiffres. */
    private const CODE_MOTIF = '/^[A-Z0-9]{3,20}$/';

    /** Bornes de la réduction, en pourcentage. */
    private const POURCENTAGE_MIN = 1;
    private const POURCENTAGE_MAX = 99;

    /** Le modèle qui lit et modifie les codes promo, fourni à la construction. */
    private CodePromoModel $codes;

    public function __construct(CodePromoModel $codes)
    {
        $this->codes = $codes;
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
     * Code et réduction du corps de la requête, validés. Répond 422 (et
     * termine) si une saisie est invalide, 409 si le code est déjà pris par
     * un autre code que $sauf.
     *
     * @return array{code: string, pourcentage: int}
     */
    private function saisieValide(Request $requete, int $sauf): array
    {
        $corps       = $requete->corps();
        $code        = mb_strtoupper(trim((string) ($corps['code'] ?? '')));
        $pourcentage = $corps['pourcentage'] ?? null;

        if (preg_match(self::CODE_MOTIF, $code) !== 1) {
            Response::erreur('Le code doit contenir de 3 à 20 lettres ou chiffres, sans espace ni accent.', 422);
        }

        if (!is_int($pourcentage) || $pourcentage < self::POURCENTAGE_MIN || $pourcentage > self::POURCENTAGE_MAX) {
            Response::erreur('La réduction doit être un nombre entier de 1 à 99 %.', 422);
        }

        if ($this->codes->codePris($code, $sauf)) {
            Response::erreur('Ce code existe déjà.', 409);
        }

        return ['code' => $code, 'pourcentage' => $pourcentage];
    }

    /**
     * Identifiant d'un code promo existant, lu dans le corps de la requête.
     * Répond 422 s'il est absent ou invalide, 404 si le code n'existe pas.
     */
    private function codeExistant(Request $requete): int
    {
        $id = $requete->corps()['id'] ?? null;

        if (!is_int($id) || $id <= 0) {
            Response::erreur('Identifiant de code promo invalide', 422);
        }

        if (!$this->codes->existe($id)) {
            Response::erreur('Code promo introuvable', 404);
        }

        return $id;
    }

    /**
     * GET /api/admin/codes-promo : tous les codes, avec leurs statistiques.
     *
     * { codes: [ { id, code, pourcentage, utilisations, remise_totale } ] }
     */
    public function index(): void
    {
        $this->verifierAdmin();

        Response::json(['codes' => $this->codes->listerPourAdmin()]);
    }

    /**
     * POST /api/admin/code-promo/creer, corps JSON { code, pourcentage }.
     */
    public function creer(Request $requete): void
    {
        $this->verifierAdmin();

        $saisie = $this->saisieValide($requete, 0);
        $id     = $this->codes->creer($saisie['code'], $saisie['pourcentage']);

        Response::json(['code' => ['id' => $id] + $saisie], 201);
    }

    /**
     * POST /api/admin/code-promo/modifier, corps JSON { id, code, pourcentage }.
     */
    public function modifier(Request $requete): void
    {
        $this->verifierAdmin();

        $id     = $this->codeExistant($requete);
        $saisie = $this->saisieValide($requete, $id);
        $this->codes->modifier($id, $saisie['code'], $saisie['pourcentage']);

        Response::json(['code' => ['id' => $id] + $saisie]);
    }

    /**
     * POST /api/admin/code-promo/supprimer, corps JSON { id }.
     */
    public function supprimer(Request $requete): void
    {
        $this->verifierAdmin();

        $id = $this->codeExistant($requete);
        $this->codes->supprimer($id);

        Response::json(['id' => $id]);
    }
}
