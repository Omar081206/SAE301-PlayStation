import { Router } from "./lib/router.js";
import { AuthData } from "./data/auth.js";
import { RootLayout } from "./layouts/root/layout.js";
import { AdminLayout } from "./layouts/admin/layout.js";
import { CataloguePage } from "./pages/catalogue/page.js";
import { ProduitPage } from "./pages/produit/page.js";
import { PanierPage } from "./pages/panier/page.js";
import { ConnexionPage } from "./pages/connexion/page.js";
import { CommandePage } from "./pages/commande/page.js";
import { ConfirmationPage } from "./pages/confirmation/page.js";
import { AdminPage } from "./pages/admin/page.js";
import { The404Page } from "./pages/404/page.js";

// base : chemin du projet sur le serveur (BASE dans vite.config.js).
const router = new Router("app", { base: import.meta.env.BASE_URL });

router.addLayout("/", RootLayout);
// Le back-office a son propre layout : le routeur choisit le préfixe le plus long.
router.addLayout("/admin", AdminLayout);

router.addRoute("/", CataloguePage);
router.addRoute("/categorie/:slug", CataloguePage);
router.addRoute("/produit/:slug", ProduitPage);
router.addRoute("/panier", PanierPage);
router.addRoute("/connexion", ConnexionPage);
router.addRoute("/commande", CommandePage);
router.addRoute("/commande/:numero", ConfirmationPage);
router.addRoute("/admin", AdminPage);

// En dernier : toute adresse qui ne correspond à aucune route.
router.addRoute("*", The404Page);

// L'état de connexion est demandé une fois, avant le premier affichage : le
// header en a besoin dès le départ. Sans réponse du serveur, l'application
// démarre comme si personne n'était connecté.
try {
  await AuthData.fetchSession();
} catch (erreur) {
  // Le header affichera « Connexion ».
}

// Démarrer le routeur
router.start();
