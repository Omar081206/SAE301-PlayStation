<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\AdminProduitModel;
use App\Model\CategorieModel;
use App\Model\ParametreModel;

/**
 * Gestion des produits, réservée aux administrateurs : liste, fiche complète,
 * enregistrement (informations, options, variantes, prix et stocks),
 * suppression, images et seuil « Bientôt épuisé ».
 *
 * Le formulaire montre un prix de base et un supplément par variante, mais
 * chaque variante garde son propre prix en base : le navigateur envoie le
 * prix final de chaque variante (base + supplément).
 *
 * Les images téléversées sont vérifiées, réduites à 1200 px au plus et
 * converties en WebP, puis rangées dans uploads/produits/ sous un nom en
 * « u-… » (voir la règle 1 bis du .htaccess).
 */
final class AdminProduitController
{
    /** Longueurs permises. */
    private const NOM_MAX         = 120;
    private const DESCRIPTION_MAX = 2000;
    private const OPTION_MAX      = 40;
    private const VALEUR_MAX      = 60;

    /** Limites du formulaire : options par produit, valeurs par option, variantes. */
    private const OPTIONS_MAX   = 3;
    private const VALEURS_MAX   = 12;
    private const VARIANTES_MAX = 60;

    /** Bornes d'un prix et d'un stock (tailles des colonnes). */
    private const PRIX_MAX  = 99999.99;
    private const STOCK_MAX = 65535;

    /** Image : poids accepté avant traitement, et plus grand côté après. */
    private const IMAGE_OCTETS_MAX = 6 * 1024 * 1024;
    private const IMAGE_COTE_MAX   = 1200;

    /** Seuil « Bientôt épuisé » : bornes et nom du paramètre. */
    private const SEUIL_MAX = 99;
    private const SEUIL_CLE = 'seuil_bientot_epuise';

    /** Les modèles, fournis à la construction. */
    private AdminProduitModel $produits;
    private CategorieModel $categories;
    private ParametreModel $parametres;

    public function __construct(AdminProduitModel $produits, CategorieModel $categories, ParametreModel $parametres)
    {
        $this->produits   = $produits;
        $this->categories = $categories;
        $this->parametres = $parametres;
    }

    /**
     * Identifiant de l'administrateur connecté. Répond 403 (et termine) sans
     * session d'administration (voir AdminController).
     */
    private function adminConnecte(): int
    {
        if (!isset($_SESSION['admin'])) {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }

        return (int) $_SESSION['admin']['id'];
    }

    /**
     * Le seuil « Bientôt épuisé » actuel (3 par défaut, comme le catalogue).
     */
    private function seuil(): int
    {
        return (int) ($this->parametres->lire(self::SEUIL_CLE) ?? 3);
    }

    /**
     * Le produit d'un identifiant reçu. Répond 422 (et termine) si
     * l'identifiant est invalide, 404 si le produit n'existe pas.
     *
     * @return array<string, mixed>  Le produit complet.
     */
    private function produitExistant(mixed $id): array
    {
        if (!is_int($id) || $id <= 0) {
            Response::erreur('Identifiant de produit invalide', 422);
        }

        $produit = $this->produits->trouver($id);

        if ($produit === null) {
            Response::erreur('Produit introuvable', 404);
        }

        return $produit;
    }

    /**
     * GET /api/admin/produits : tous les produits, et le seuil « Bientôt
     * épuisé ».
     */
    public function index(): void
    {
        $this->adminConnecte();

        Response::json(['produits' => $this->produits->lister(), 'seuil' => $this->seuil()]);
    }

    /**
     * GET /api/admin/produit?id=… : un produit complet (id absent : rien, pour
     * un nouveau produit), et les catégories pour le formulaire.
     */
    public function detail(Request $requete): void
    {
        $this->adminConnecte();

        $id      = $requete->parametre('id');
        $produit = null;

        if ($id !== null) {
            $produit = $this->produitExistant(filter_var($id, FILTER_VALIDATE_INT) === false ? 0 : (int) $id);
        }

        $categories = array_map(
            static fn (array $categorie): array => ['id' => $categorie['id'], 'nom' => $categorie['nom']],
            $this->categories->listerPourAdmin()
        );

        Response::json(['produit' => $produit, 'categories' => $categories]);
    }

    /**
     * POST /api/admin/produit/enregistrer, corps JSON :
     * { id (null : création), nom, categorie_id, description,
     *   options: [ { id, nom, valeurs: [ { id, cle, valeur } ] } ],
     *   variantes: [ { id, valeurs: [clé…], prix, stock } ] }
     *
     * Une variante par combinaison de valeurs (une par option) ; un produit
     * sans option a une seule variante, sans valeur. Répond avec le produit
     * enregistré.
     */
    public function enregistrer(Request $requete): void
    {
        $auteur = $this->adminConnecte();
        $corps  = $requete->corps();

        $id = $corps['id'] ?? null;
        if ($id !== null) {
            $this->produitExistant($id);
        }

        $infos     = $this->infosValides($corps, $id ?? 0);
        $options   = $this->optionsValides($corps['options'] ?? null, $id);
        $variantes = $this->variantesValides($corps['variantes'] ?? null, $options, $id);

        $id = $this->produits->enregistrer($id, $infos, $options, $variantes, $auteur);

        Response::json(['produit' => $this->produits->trouver($id)]);
    }

    /**
     * Nom, catégorie et description, validés ; le slug est déduit du nom.
     * Répond 422 (ou 409 pour un nom déjà pris) et termine sinon.
     *
     * @param array<string, mixed> $corps
     * @return array{nom: string, slug: string, description: string, categorie_id: int}
     */
    private function infosValides(array $corps, int $sauf): array
    {
        $nom         = trim((string) ($corps['nom'] ?? ''));
        $description = trim((string) ($corps['description'] ?? ''));
        $categorie   = $corps['categorie_id'] ?? null;
        $slug        = AdminCategorieController::slug($nom);

        if (mb_strlen($nom) < 2 || mb_strlen($nom) > self::NOM_MAX || $slug === '') {
            Response::erreur('Le nom doit contenir de 2 à 120 caractères, dont au moins une lettre ou un chiffre.', 422);
        }

        if ($description === '' || mb_strlen($description) > self::DESCRIPTION_MAX) {
            Response::erreur('La description est obligatoire (2000 caractères au plus).', 422);
        }

        if (!is_int($categorie) || !$this->categories->existe($categorie)) {
            Response::erreur('Choisissez une catégorie.', 422);
        }

        if ($this->produits->slugPris($slug, $sauf)) {
            Response::erreur('Un produit porte déjà ce nom (ou un nom trop proche).', 409);
        }

        return ['nom' => $nom, 'slug' => $slug, 'description' => $description, 'categorie_id' => $categorie];
    }

    /**
     * Options et valeurs, validées : noms non vides et distincts, au moins
     * une valeur par option. Les identifiants donnés doivent appartenir au
     * produit ; chaque valeur a une clé unique (son identifiant, ou une clé
     * provisoire pour une nouvelle valeur).
     *
     * @return array<int, array{id: ?int, nom: string,
     *                          valeurs: array<int, array{id: ?int, cle: string, valeur: string}>}>
     */
    private function optionsValides(mixed $options, ?int $produitId): array
    {
        if (!is_array($options) || count($options) > self::OPTIONS_MAX) {
            Response::erreur('Options invalides (3 au plus).', 422);
        }

        // Ce qui existe déjà pour ce produit : on n'accepte que ses propres
        // options et valeurs.
        $existantes = [];
        if ($produitId !== null) {
            foreach ($this->produits->trouver($produitId)['options'] as $option) {
                $existantes[$option['id']] = array_column($option['valeurs'], 'id');
            }
        }

        $resultat = [];
        $noms     = [];
        $cles     = [];

        foreach ($options as $option) {
            $optionId = $option['id'] ?? null;
            $nom      = trim((string) ($option['nom'] ?? ''));
            $valeurs  = $option['valeurs'] ?? null;

            if ($nom === '' || mb_strlen($nom) > self::OPTION_MAX || in_array(mb_strtolower($nom), $noms, true)) {
                Response::erreur('Chaque option a un nom (40 caractères au plus), différent des autres.', 422);
            }
            if ($optionId !== null && (!is_int($optionId) || !array_key_exists($optionId, $existantes))) {
                Response::erreur('Option inconnue', 422);
            }
            if (!is_array($valeurs) || $valeurs === [] || count($valeurs) > self::VALEURS_MAX) {
                Response::erreur("L'option « {$nom} » doit avoir de 1 à 12 valeurs.", 422);
            }
            $noms[] = mb_strtolower($nom);

            $textes = [];
            $propres = [];
            foreach ($valeurs as $valeur) {
                $valeurId = $valeur['id'] ?? null;
                $texte    = trim((string) ($valeur['valeur'] ?? ''));
                $cle      = (string) ($valeur['cle'] ?? '');

                if ($texte === '' || mb_strlen($texte) > self::VALEUR_MAX || in_array(mb_strtolower($texte), $textes, true)) {
                    Response::erreur("Les valeurs de « {$nom} » sont obligatoires (60 caractères au plus) et différentes.", 422);
                }
                if ($valeurId !== null && (!is_int($valeurId) || !in_array($valeurId, $existantes[$optionId] ?? [], true))) {
                    Response::erreur('Valeur inconnue', 422);
                }
                if ($cle === '' || isset($cles[$cle])) {
                    Response::erreur('Clé de valeur invalide', 422);
                }
                $textes[]   = mb_strtolower($texte);
                $cles[$cle] = true;
                $propres[]  = ['id' => $valeurId, 'cle' => $cle, 'valeur' => $texte];
            }

            $resultat[] = ['id' => $optionId, 'nom' => $nom, 'valeurs' => $propres];
        }

        return $resultat;
    }

    /**
     * Variantes, validées : une valeur par option, combinaisons distinctes,
     * prix et stock dans les bornes, identifiants appartenant au produit.
     *
     * @param array<int, array{id: ?int, nom: string, valeurs: array<int, array{cle: string}>}> $options
     * @return array<int, array{id: ?int, valeurs: string[], prix: float, stock: int}>
     */
    private function variantesValides(mixed $variantes, array $options, ?int $produitId): array
    {
        if (!is_array($variantes) || $variantes === [] || count($variantes) > self::VARIANTES_MAX) {
            Response::erreur('Le produit doit avoir de 1 à 60 variantes.', 422);
        }

        $existantes = $produitId === null ? [] : array_column($this->produits->trouver($produitId)['variantes'], 'id');

        $resultat      = [];
        $combinaisons  = [];

        foreach ($variantes as $variante) {
            $varianteId = $variante['id'] ?? null;
            $valeurs    = $variante['valeurs'] ?? null;
            $prix       = $variante['prix'] ?? null;
            $stock      = $variante['stock'] ?? null;

            if ($varianteId !== null && (!is_int($varianteId) || !in_array($varianteId, $existantes, true))) {
                Response::erreur('Variante inconnue', 422);
            }
            if (!is_array($valeurs) || count($valeurs) !== count($options)) {
                Response::erreur('Chaque variante a une valeur par option.', 422);
            }

            // Une valeur de chaque option, dans l'ordre des options.
            foreach ($options as $position => $option) {
                if (!in_array((string) ($valeurs[$position] ?? ''), array_column($option['valeurs'], 'cle'), true)) {
                    Response::erreur('Chaque variante a une valeur par option.', 422);
                }
            }

            $combinaison = implode('|', array_map('strval', $valeurs));
            if (isset($combinaisons[$combinaison])) {
                Response::erreur('Deux variantes ont la même combinaison.', 422);
            }
            $combinaisons[$combinaison] = true;

            if (!is_int($prix) && !is_float($prix) || $prix <= 0 || $prix > self::PRIX_MAX) {
                Response::erreur('Chaque variante a un prix entre 0,01 € et 99 999,99 €.', 422);
            }
            if (!is_int($stock) || $stock < 0 || $stock > self::STOCK_MAX) {
                Response::erreur('Chaque stock est un nombre entier positif ou nul.', 422);
            }

            $resultat[] = [
                'id'      => $varianteId,
                'valeurs' => array_map('strval', $valeurs),
                'prix'    => round((float) $prix, 2),
                'stock'   => $stock,
            ];
        }

        return $resultat;
    }

    /**
     * POST /api/admin/produit/supprimer, corps JSON { id }. Les images
     * téléversées du produit sont effacées ; les commandes passées le gardent
     * (nom, options et prix figés).
     */
    public function supprimer(Request $requete): void
    {
        $this->adminConnecte();
        $produit = $this->produitExistant($requete->corps()['id'] ?? null);

        foreach ($this->produits->supprimer($produit['id']) as $fichier) {
            $this->effacerFichier($fichier);
        }

        Response::json(['id' => $produit['id']]);
    }

    /**
     * Dossier des images téléversées (créé au premier envoi).
     */
    private function dossierImages(): string
    {
        return dirname(__DIR__, 3) . '/uploads/produits';
    }

    /**
     * Efface le fichier d'une image téléversée (« u-… ») ; les images
     * déposées à la main dans front/public ne sont jamais effacées.
     */
    private function effacerFichier(string $fichier): void
    {
        if (preg_match('/^u-[A-Za-z0-9._-]+$/', $fichier) === 1 && is_file($this->dossierImages() . '/' . $fichier)) {
            unlink($this->dossierImages() . '/' . $fichier);
        }
    }

    /**
     * POST /api/admin/produit/image, corps JSON { id, contenu } : contenu est
     * l'image en data URL (« data:image/png;base64,… »). Elle est vérifiée,
     * réduite et convertie en WebP, puis ajoutée aux images du produit.
     */
    public function image(Request $requete): void
    {
        $this->adminConnecte();
        $corps   = $requete->corps();
        $produit = $this->produitExistant($corps['id'] ?? null);

        $contenu = (string) ($corps['contenu'] ?? '');
        if (preg_match('#^data:image/(?:jpeg|png|webp);base64,(.+)$#', $contenu, $morceaux) !== 1) {
            Response::erreur('Choisissez une image JPEG, PNG ou WebP.', 422);
        }

        $octets = base64_decode($morceaux[1], true);
        if ($octets === false || strlen($octets) > self::IMAGE_OCTETS_MAX) {
            Response::erreur('Image illisible ou trop lourde (6 Mo au plus).', 422);
        }

        // Le type réel est lu dans le fichier, pas dans ce que déclare le
        // navigateur.
        $infos = @getimagesizefromstring($octets);
        if ($infos === false || !in_array($infos[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            Response::erreur('Choisissez une image JPEG, PNG ou WebP.', 422);
        }

        $source = @imagecreatefromstring($octets);
        if ($source === false) {
            Response::erreur('Image illisible.', 422);
        }

        // Redimensionnement : le plus grand côté à 1200 px au plus.
        $echelle = min(1, self::IMAGE_COTE_MAX / max($infos[0], $infos[1]));
        $largeur = max(1, (int) round($infos[0] * $echelle));
        $hauteur = max(1, (int) round($infos[1] * $echelle));

        $image = imagecreatetruecolor($largeur, $hauteur);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagecopyresampled($image, $source, 0, 0, 0, 0, $largeur, $hauteur, $infos[0], $infos[1]);

        $dossier = $this->dossierImages();
        if (!is_dir($dossier) && !mkdir($dossier, 0775, true)) {
            Response::erreur("Le dossier des images n'a pas pu être créé.", 500);
        }

        $fichier = 'u-' . $produit['slug'] . '-' . bin2hex(random_bytes(4)) . '.webp';
        if (!imagewebp($image, $dossier . '/' . $fichier, 82)) {
            Response::erreur("L'image n'a pas pu être enregistrée.", 500);
        }

        $vue = count($produit['images']) + 1;
        $this->produits->ajouterImage($produit['id'], $fichier, "{$produit['nom']}, vue {$vue}");

        Response::json(['produit' => $this->produits->trouver($produit['id'])], 201);
    }

    /**
     * Une image existante, lue dans le corps (clé image). Répond 422 ou 404
     * (et termine) sinon.
     *
     * @return array{id: int, produit_id: int, variante_id: ?int, fichier: string}
     */
    private function imageExistante(Request $requete): array
    {
        $id = $requete->corps()['image'] ?? null;

        if (!is_int($id) || $id <= 0) {
            Response::erreur("Identifiant d'image invalide", 422);
        }

        $image = $this->produits->trouverImage($id);

        if ($image === null) {
            Response::erreur('Image introuvable', 404);
        }

        return $image;
    }

    /**
     * POST /api/admin/produit/image/supprimer, corps JSON { image }.
     */
    public function imageSupprimer(Request $requete): void
    {
        $this->adminConnecte();
        $image = $this->imageExistante($requete);

        $this->produits->supprimerImage($image['id']);
        $this->effacerFichier($image['fichier']);

        Response::json(['produit' => $this->produits->trouver($image['produit_id'])]);
    }

    /**
     * POST /api/admin/produit/image/principale, corps JSON { image } : elle
     * devient la première de son groupe (produit, ou variante).
     */
    public function imagePrincipale(Request $requete): void
    {
        $this->adminConnecte();
        $image = $this->imageExistante($requete);

        $this->produits->rendrePrincipale($image['id']);

        Response::json(['produit' => $this->produits->trouver($image['produit_id'])]);
    }

    /**
     * POST /api/admin/produit/image/variante, corps JSON { image, variante } :
     * rattache l'image à une variante du produit (un coloris), ou au produit
     * (variante null).
     */
    public function imageVariante(Request $requete): void
    {
        $this->adminConnecte();
        $image    = $this->imageExistante($requete);
        $variante = $requete->corps()['variante'] ?? null;

        if ($variante !== null && (!is_int($variante) || !$this->produits->varianteDuProduit($variante, $image['produit_id']))) {
            Response::erreur('Variante inconnue', 422);
        }

        $this->produits->rattacherImage($image['id'], $variante);

        Response::json(['produit' => $this->produits->trouver($image['produit_id'])]);
    }

    /**
     * POST /api/admin/produit/image/affichage, corps JSON { image, affichage } :
     * « partout », « catalogue » (cartes du catalogue, panier : une jaquette
     * carrée) ou « fiche » (galerie : un visuel en paysage).
     */
    public function imageAffichage(Request $requete): void
    {
        $this->adminConnecte();
        $image     = $this->imageExistante($requete);
        $affichage = $requete->corps()['affichage'] ?? null;

        if (!in_array($affichage, ['partout', 'catalogue', 'fiche'], true)) {
            Response::erreur("Affichage d'image invalide", 422);
        }

        $this->produits->changerAffichage($image['id'], $affichage);

        Response::json(['produit' => $this->produits->trouver($image['produit_id'])]);
    }

    /**
     * POST /api/admin/parametre/seuil, corps JSON { seuil } : le seuil
     * « Bientôt épuisé » (de 0 à 99 unités).
     */
    public function seuilModifier(Request $requete): void
    {
        $this->adminConnecte();
        $seuil = $requete->corps()['seuil'] ?? null;

        if (!is_int($seuil) || $seuil < 0 || $seuil > self::SEUIL_MAX) {
            Response::erreur('Le seuil est un nombre entier de 0 à 99.', 422);
        }

        $this->parametres->ecrire(
            self::SEUIL_CLE,
            (string) $seuil,
            'Stock à partir duquel une variante est signalée « Bientôt épuisé ».'
        );

        Response::json(['seuil' => $seuil]);
    }
}
