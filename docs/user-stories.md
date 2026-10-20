# User stories — SAé 3.01 (extrait du sujet)

Source : sujet officiel. Ordre de réalisation : `docs/ordre-us.md`.

## Definition of Done commune (toute US)

- code dans une branche dédiée à l'US, commits explicites, puis fusion ;
- HTML et CSS valides (validateur W3C) ;
- charte graphique PlayStation respectée, responsive (375 / 768 / 1440) ;
- testé sur 3 navigateurs ;
- formulaires validés côté client ET serveur, messages d'erreur clairs en français ;
- pages et actions réservées inaccessibles sans les droits.

## Epic « Commander en click & collect »
_Objectif : en tant que client, je veux constituer un panier et valider ma commande afin de la retirer en magasin._  
_Terminé quand : un visiteur peut remplir un panier, s'identifier et obtenir une commande enregistrée avec un numéro unique._  

### CMD-a : Validation de commande

**En tant que client connecté, je veux valider ma commande afin de finaliser mon achat**

**Critères d'acceptation**

- Je suis redirigé vers la connexion si je ne suis pas connecté
- Je vois un récapitulatif complet avant validation
- Je confirme ma commande par un clic explicite
- Ma commande est enregistrée avec un numéro unique et le statut « en cours »
- Mon panier est vidé après validation
- Je reçois une confirmation de commande claire

**DoD spécifique**

- Génération de numéros de commande uniques
- Sauvegarde complète en base de données (commande et lignes de commande, avec le prix de chaque produit au moment de la commande)
- Page de confirmation de qualité professionnelle
- Test de bout en bout du processus de commande

### CMD-b : Panier d'achat

**En tant que client, je veux ajouter des produits à un panier afin de préparer ma commande**

**Critères d'acceptation**

- Je peux ajouter des produits depuis le catalogue et depuis les pages détail
- Une icône panier avec compteur d'articles est visible
- Je peux consulter mon panier (liste des produits)
- Je peux modifier les quantités dans le panier
- Je peux supprimer des articles du panier
- Les totaux se calculent automatiquement
- Mon panier est sauvegardé localement et restauré d'une visite à l'autre

**DoD spécifique**

- Panier persistant en local (stockage du navigateur)
- Totaux recalculés à chaque modification du panier

### CMD-c : Authentification

**En tant que visiteur, je veux créer un compte et me connecter afin de pouvoir finaliser mes achats**

**Critères d'acceptation**

- Je peux créer un compte avec email et mot de passe
- Je peux me connecter avec mes identifiants
- Je peux me déconnecter
- Mon mot de passe est stocké de manière sécurisée
- Je reçois des messages d'erreur clairs en cas de problème
- Ma session est maintenue lors de la navigation

**DoD spécifique**

- Hashage sécurisé des mots de passe (bcrypt ou équivalent)
- Gestion sécurisée des sessions (identifiant de session régénéré à la connexion)

## Epic « Découvrir l'offre »
_Objectif : en tant que visiteur, je veux parcourir l'offre de l'enseigne afin de trouver les produits qui m'intéressent._  
_Terminé quand : un visiteur peut aller du catalogue à n'importe quelle fiche produit en passant par les catégories, sur mobile comme sur desktop._  

### DEC-a : Navigation par catégories

**En tant que visiteur, je veux filtrer les produits par catégorie afin de trouver plus facilement ce qui m'intéresse**

**Critères d'acceptation**

- Je vois un menu de navigation avec les catégories
- Je peux cliquer sur une catégorie pour voir uniquement ses produits
- Le nombre de produits par catégorie est affiché
- Un bouton « Tous les produits » me permet de réinitialiser le filtre
- L'URL change selon la catégorie sélectionnée

**DoD spécifique**

- Filtrage fonctionnel (en JavaScript ou par rechargement de la page)
- URLs propres (/categorie/nom-categorie)
- Fil d'Ariane ou indication visuelle de la catégorie active

### DEC-b : Catalogue de produits

**En tant que visiteur, je veux consulter le catalogue de produits afin de découvrir l'offre disponible**

**Critères d'acceptation**

- Je peux voir tous les produits
- Chaque produit affiche : nom, prix, image principale
- La page se charge en moins de 3 secondes

**DoD spécifique**

- Base de données initialisée avec les produits de test (au moins 3 catégories de 4 produits)

### DEC-c : Détail d'un produit

**En tant que visiteur, je veux consulter le détail d'un produit afin de prendre une décision d'achat éclairée**

**Critères d'acceptation**

- Je peux accéder à une page dédiée pour chaque produit
- Je vois une galerie d'images du produit
- Je peux lire une description détaillée
- Le prix est affiché clairement
- Un bouton « Ajouter au panier » est présent
- Je peux revenir facilement au catalogue

**DoD spécifique**

- URL propre pour chaque produit (/produit/nom-produit)
- Galerie d'images fonctionnelle (navigation entre les images)
- Métadonnées pour le SEO
- Retour vers la catégorie d'origine

## Epic « Garantir la disponibilité »
_Objectif : en tant que client, je veux que seuls les produits disponibles soient commandables afin de ne pas avoir de mauvaise surprise au retrait._  
_Terminé quand : il est impossible de commander au-delà du stock, et le stock reste exact après chaque commande et chaque annulation._  

### STK-a : Mise à jour automatique des stocks

**En tant que système, je veux mettre à jour automatiquement les stocks afin de maintenir leur cohérence**

**Critères d'acceptation**

- Le stock est décrémenté à la validation d'une commande
- Le stock est recrédité lorsqu'une commande passe au statut « annulée »
- Aucun autre changement de statut d'une commande ne modifie le stock
- Les mises à jour sont atomiques (tout ou rien)
- Un journal des mouvements de stock est tenu
- Un stock ne peut jamais devenir négatif
- Si les produits ont des variantes, la mise à jour se fait par variante

**DoD spécifique**

- Transactions en base de données, avec annulation (rollback) en cas d'erreur
- Journal complet des mouvements de stock
- Test de concurrence : deux commandes simultanées portant sur la dernière unité d'un produit

### STK-b : Affichage des stocks

**En tant que client, je veux voir la disponibilité des produits afin de savoir si je peux les commander**

**Critères d'acceptation**

- Je vois l'état du stock sur chaque produit (« En stock », « Bientôt épuisé », « Épuisé »)
- Le seuil « Bientôt épuisé » est défini par une valeur de configuration (fichier ou table de paramètres)
- Le style visuel diffère selon l'état du stock
- L'état affiché correspond au stock réel au moment où la page est chargée
- Si les produits ont des variantes, je vois le stock par variante

**DoD spécifique**

- Champs de stock ajoutés à la base de données
- Tests avec différents niveaux de stock

### STK-c : Contraintes de stock

**En tant que client, je veux être limité par les stocks disponibles afin d'éviter les commandes impossibles**

**Critères d'acceptation**

- Je ne peux pas ajouter un produit épuisé au panier
- La quantité maximum est limitée au stock disponible
- Je reçois des messages d'erreur clairs en cas de dépassement
- Les quantités de mon panier s'ajustent automatiquement si nécessaire
- La vérification se fait avant chaque ajout au panier et à la validation de la commande
- Si les produits ont des variantes, les contraintes s'appliquent par variante

**DoD spécifique**

- Vérification côté client et côté serveur
- Gestion des cas limites (stock modifié pendant la session)
- Tests avec différents scénarios de stock

## Epic « Gérer l'offre »
_Objectif : en tant qu'administrateur, je veux maintenir le catalogue afin que l'offre en ligne reflète celle du magasin._  
_Terminé quand : un administrateur peut créer, modifier et retirer catégories et produits sans intervenir directement dans la base de données._  

### GOF-a : Gestion des produits

**En tant qu'administrateur, je veux gérer les produits afin de maintenir le catalogue à jour**

**Critères d'acceptation**

- Je peux ajouter de nouveaux produits avec toutes leurs informations
- Je peux modifier tous les aspects d'un produit existant
- Je peux supprimer des produits, après confirmation
- Je peux téléverser et gérer les images des produits
- Je peux fixer les prix et les stocks
- Je peux modifier le seuil d'alerte « Bientôt épuisé »
- Si les produits ont des options, je peux définir les options disponibles pour chaque produit

**DoD spécifique**

- CRUD complet des produits
- Gestion des images (téléversement, redimensionnement)

### GOF-b : Back-office

**En tant qu'administrateur, je veux accéder à un back-office sécurisé afin de gérer le site**

**Critères d'acceptation**

- J'accède au back-office par une URL dédiée (/admin)
- L'authentification des administrateurs est séparée de celle des clients
- La page d'accueil du back-office affiche quelques indicateurs simples (nombre de produits, nombre de commandes)
- J'ai une navigation claire entre les sections d'administration
- Le design est cohérent avec le front-office mais distinct

**DoD spécifique**

- Compte administrateur de test en base de données
- Aucune page /admin n'est accessible sans authentification administrateur

### GOF-c : Gestion des catégories

**En tant qu'administrateur, je veux gérer les catégories afin d'organiser le catalogue**

**Critères d'acceptation**

- Je peux créer de nouvelles catégories avec nom et description
- Je peux modifier les catégories existantes
- Je peux supprimer une catégorie en gérant les produits qui lui sont rattachés
- Je dois confirmer avant toute suppression
- La validation empêche les données incohérentes

**DoD spécifique**

- CRUD complet des catégories
- Règle explicite pour les produits d'une catégorie supprimée (réaffectation ou blocage de la suppression)

## Epic « Personnaliser son produit »
_Objectif : en tant que client, je veux choisir les options de mes produits afin d'acheter exactement ce que je veux._  
_Terminé quand : un produit configuré peut être commandé et suivi de bout en bout, avec un stock géré par variante._  

### OPT-a : Options dans le panier et les commandes

**En tant que client, je veux retrouver les options choisies dans mon panier et mes commandes afin d'être sûr d'obtenir ce que j'ai choisi**

**Critères d'acceptation**

- Les options choisies sont affichées pour chaque article du panier
- Un même produit commandé avec des options différentes apparaît sur des lignes distinctes
- Je peux modifier les options d'un article dans mon panier
- Les totaux tiennent compte du prix des options
- Les options sont enregistrées avec la commande et visibles dans le récapitulatif et la confirmation

**DoD spécifique**

- Les lignes de commande conservent les options et le prix au moment de la commande

### OPT-b : Variantes et stock par variante

**En tant que client, je veux que seules les combinaisons d'options disponibles me soient proposées afin de ne pas commander une variante épuisée**

**Critères d'acceptation**

- Chaque combinaison d'options correspond à une variante qui a son propre stock
- Les combinaisons inexistantes ou épuisées ne sont pas sélectionnables, ou sont clairement signalées
- Les règles de stock existantes (affichage, contraintes, mise à jour) s'appliquent par variante

**DoD spécifique**

- Modélisation des variantes en base de données
- Migration des données et du code existants vers ce modèle

### OPT-c : Choix des options

**En tant que client, je veux choisir les options d'un produit sur sa fiche afin de le personnaliser**

**Critères d'acceptation**

- Je vois les options disponibles sur la page produit (taille, couleur, etc.)
- Je peux sélectionner une combinaison d'options
- Le prix se met à jour selon mes choix
- Le bouton « Ajouter au panier » ajoute le produit avec les options choisies

**DoD spécifique**

- Modélisation des options en base de données (options définies par produit)
- Interface dynamique (JavaScript)

## Epic « Suivre mes achats »
_Objectif : en tant que client connecté, je veux retrouver mes informations et mes commandes afin de suivre et renouveler mes achats._  
_Terminé quand : un client peut gérer son profil, consulter ses commandes passées et en relancer une._  

### SUI-a : Réutilisation des commandes

**En tant que client connecté, je veux réutiliser mes anciennes commandes afin de gagner du temps**

**Critères d'acceptation**

- Je peux cliquer sur « Commander à nouveau » depuis l'historique
- Les produits de la commande sont transférés dans mon panier
- La disponibilité est vérifiée avant le transfert
- Je suis informé si des produits ne sont plus disponibles
- Si les produits ont des options, les options choisies à l'époque sont conservées
- Je reçois un message de confirmation du transfert

**DoD spécifique**

- Gestion des produits supprimés ou modifiés depuis la commande

### SUI-b : Espace personnel

**En tant que client connecté, je veux accéder à mon espace personnel afin de gérer mes informations**

**Critères d'acceptation**

- J'accède à une page d'accueil personnalisée
- Je vois mes informations personnelles
- Je peux modifier mon profil (nom, email, mot de passe)
- J'ai une navigation intuitive dans mon espace
- Je suis redirigé vers la connexion si je ne suis pas connecté
- Je vois un aperçu de mon activité (commandes récentes)

**DoD spécifique**

- La modification du mot de passe exige le mot de passe actuel

### SUI-c : Historique des commandes

**En tant que client connecté, je veux consulter l'historique de mes commandes afin de suivre mes achats**

**Critères d'acceptation**

- Je vois la liste de toutes mes commandes par date décroissante
- Le statut de chaque commande est visible (« en cours », « disponible », « retirée », « annulée »)
- Je vois le montant total de chaque commande
- Je peux accéder au détail de chaque commande
- Je peux filtrer par statut ou par période
- Si les produits ont des options, les options choisies sont visibles

**DoD spécifique**

- Pagination si nécessaire

## Epic « Traiter et piloter l'activité »
_Objectif : en tant qu'administrateur, je veux suivre les commandes et l'activité afin d'organiser les retraits et d'anticiper le réassort._  
_Terminé quand : un administrateur peut faire passer une commande de « en cours » à « retirée », annuler une commande et consulter les indicateurs clés._  

### PIL-a : Tableaux de bord statistiques

**En tant qu'administrateur, je veux consulter des statistiques afin de piloter l'activité**

**Critères d'acceptation**

- Je vois un graphique des stocks par produit (histogramme)
- Je vois les revenus des 7 derniers jours
- Je vois les statistiques des commandes (nombre, statuts)
- Je vois les produits les plus vendus
- Je suis alerté des stocks faibles

**DoD spécifique**

- Données à jour à chaque consultation
- Export des statistiques

### PIL-b : Gestion des commandes

**En tant qu'administrateur, je veux gérer les commandes afin de suivre et traiter les ventes**

**Critères d'acceptation**

- Je vois la liste de toutes les commandes des clients
- Je peux trier les commandes par date, statut ou montant
- Je peux faire passer une commande de « en cours » à « disponible » puis à « retirée »
- Je peux annuler une commande tant qu'elle n'est pas retirée
- L'annulation remet en stock les produits de la commande ; les autres changements de statut ne modifient pas le stock
- Je peux accéder au détail complet de chaque commande
- Je peux effectuer des actions en lot sur plusieurs commandes

**DoD spécifique**

- Confirmation demandée avant toute annulation
- Journal des modifications effectuées par les administrateurs

## Epic « Promotions » (bonus)
_Objectif : en tant que client, je veux bénéficier de réductions afin d'acheter à meilleur prix._  
_Terminé quand : une réduction, automatique ou par code, est appliquée correctement au total d'une commande._  

### PRO-a : Codes promotionnels

**En tant que client, je veux utiliser des codes promo afin de bénéficier de réductions**

**Critères d'acceptation**

- Je peux saisir un code promo lors de la commande
- Le code est vérifié et la réduction (en pourcentage) est appliquée au total

### PRO-b : Gestion des codes promo

**En tant qu'administrateur, je veux gérer les codes promotionnels afin de contrôler les réductions**

**Critères d'acceptation**

- CRUD des codes promotionnels avec leur pourcentage
- Statistiques d'utilisation des codes

### PRO-c : Promotions automatiques

**En tant que client, je veux bénéficier de promotions automatiques afin d'économiser sur mes achats**

**Critères d'acceptation**

- Le produit dont le stock est le plus élevé est en promotion (-20 %)
- Les prix barrés et promotionnels sont affichés
