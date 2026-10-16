<?php

declare(strict_types=1);

use App\Controller\AuthController;
use App\Controller\CategorieController;
use App\Controller\CommandeController;
use App\Controller\PanierController;
use App\Controller\ProduitController;
use App\Controller\StatsController;

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
    'GET  /api/admin/stats' => [StatsController::class,     'index'],
];
