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
import { ComptePage } from "./pages/compte/page.js";
import { ProfilPage } from "./pages/profil/page.js";
import { HistoriquePage } from "./pages/historique/page.js";
import { CommandeClientPage } from "./pages/commande-client/page.js";
import { AdminPage } from "./pages/admin/page.js";
import { AdminCategoriesPage } from "./pages/admin-categories/page.js";
import { AdminProduitsPage } from "./pages/admin-produits/page.js";
import { AdminProduitPage } from "./pages/admin-produit/page.js";
import { AdminCommandesPage } from "./pages/admin-commandes/page.js";
import { AdminCommandePage } from "./pages/admin-commande/page.js";
import { AdminStatistiquesPage } from "./pages/admin-statistiques/page.js";
import { AdminCodesPromoPage } from "./pages/admin-codes-promo/page.js";
import { The404Page } from "./pages/404/page.js";

// base : chemin du projet sur le serveur (BASE dans vite.config.js).
const router = new Router("app", { base: import.meta.env.BASE_URL });

router.addLayout("/", RootLayout);
// Le back-office a son propre layout : le routeur choisit le préfixe le plus long.
router.addLayout("/admin", AdminLayout);

router.addRoute("/", CataloguePage);
router.addRoute("/categorie/:slug", CataloguePage);
router.addRoute("/produit/:slug", ProduitPage);
// « Modifier les options » d'un article du panier : même fiche, variante présélectionnée.
router.addRoute("/produit/:slug/options/:variante", ProduitPage);
router.addRoute("/panier", PanierPage);
router.addRoute("/connexion", ConnexionPage);
router.addRoute("/commande", CommandePage);
router.addRoute("/commande/:numero", ConfirmationPage);
router.addRoute("/compte", ComptePage);
router.addRoute("/compte/profil", ProfilPage);
router.addRoute("/compte/commandes", HistoriquePage);
router.addRoute("/compte/commandes/:numero", CommandeClientPage);
router.addRoute("/admin", AdminPage);
router.addRoute("/admin/categories", AdminCategoriesPage);
router.addRoute("/admin/produits", AdminProduitsPage);
// /admin/produits/nouveau : la même page, pour un nouveau produit.
router.addRoute("/admin/produits/:id", AdminProduitPage);
router.addRoute("/admin/commandes", AdminCommandesPage);
router.addRoute("/admin/commandes/:numero", AdminCommandePage);
router.addRoute("/admin/statistiques", AdminStatistiquesPage);
router.addRoute("/admin/codes-promo", AdminCodesPromoPage);

// En dernier : toute adresse qui ne correspond à aucune route.
router.addRoute("*", The404Page);

// L'état de connexion est demandé une fois, en même temps que la première
// page : seul le header s'en sert, et il se met à jour à l'arrivée de la
// réponse (AuthData.surChangement, voir layouts/root). Sans réponse du
// serveur, le header garde « Connexion ».
AuthData.fetchSession().catch(() => {});

// Démarrer le routeur
router.start();
