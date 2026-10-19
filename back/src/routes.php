<?php

declare(strict_types=1);

use App\Controller\AdminCategorieController;
use App\Controller\AdminCommandeController;
use App\Controller\AdminController;
use App\Controller\AuthController;
use App\Controller\CategorieController;
use App\Controller\CommandeController;
use App\Controller\CompteController;
use App\Controller\PanierController;
use App\Controller\ProduitController;

/**
 * Table des routes de l'API.
 *
 * Clé    : méthode HTTP et chemin, séparés par un ou plusieurs espaces.
 * Valeur : [classe du contrôleur, méthode à appeler].
 *
 * Toute instance de contrôleur utilisée ici doit également être enregistrée
 * dans back/index.php.
 */

return [
    'GET  /api/produits'    => [ProduitController::class,   'index'],
    'GET  /api/produit'     => [ProduitController::class,   'detail'],
    'GET  /api/categories'  => [CategorieController::class, 'index'],
    'POST /api/panier'      => [PanierController::class,    'index'],
    'POST /api/commande'    => [CommandeController::class,  'enregistrer'],
    'GET  /api/commande'    => [CommandeController::class,  'detail'],
    'POST /api/login'       => [AuthController::class,      'login'],
    'POST /api/logout'      => [AuthController::class,      'logout'],
    'POST /api/inscription' => [AuthController::class,      'inscription'],
    'GET  /api/session'     => [AuthController::class,      'session'],
    'GET  /api/compte'        => [CompteController::class, 'index'],
    'POST /api/compte/profil' => [CompteController::class, 'profil'],
    'POST /api/admin/login'           => [AdminController::class, 'login'],
    'POST /api/admin/logout'          => [AdminController::class, 'logout'],
    'GET  /api/admin/session'         => [AdminController::class, 'session'],
    'GET  /api/admin/tableau-de-bord' => [AdminController::class, 'tableauDeBord'],
    'GET  /api/admin/commandes'        => [AdminCommandeController::class, 'index'],
    'GET  /api/admin/commande'         => [AdminCommandeController::class, 'detail'],
    'POST /api/admin/commande/statut'  => [AdminCommandeController::class, 'statut'],
    'POST /api/admin/commandes/statut' => [AdminCommandeController::class, 'statutLot'],
    'GET  /api/admin/categories'         => [AdminCategorieController::class, 'index'],
    'POST /api/admin/categorie/creer'     => [AdminCategorieController::class, 'creer'],
    'POST /api/admin/categorie/modifier'  => [AdminCategorieController::class, 'modifier'],
    'POST /api/admin/categorie/supprimer' => [AdminCategorieController::class, 'supprimer'],
];
