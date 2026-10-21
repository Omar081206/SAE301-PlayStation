-- ---------------------------------------------------------------------------
-- SAE301 — PlayStation Click & Collect : tables et jeu de données
--
-- Ce script ne crée PAS de base de données : il ajoute ses tables à une base
-- existante, la vôtre. Depuis phpMyAdmin, sélectionnez d'abord votre base dans
-- la colonne de gauche, puis importez ce fichier depuis l'onglet « Importer ».
--
-- Boutique : 15 produits en 4 catégories (3 manettes, 4 produits ailleurs). Chaque produit a une variante par
-- défaut, qui porte son prix et son stock (six produits ont une option
-- « Coloris » : une variante « Blanc » et une « Noir »), et une image
-- principale (ordre 1) ;
-- les produits photographiés sous plusieurs angles ont une galerie.
--
-- L'import est rejouable : les tables sont supprimées avant d'être recréées.
-- ATTENTION : une table existante de même nom serait supprimée elle aussi.
-- ---------------------------------------------------------------------------

-- Le jeu de caractères de la connexion est fixé explicitement : sans cela,
-- un client configuré en latin1 enregistrerait les accents en double encodage
-- et « Comédie » deviendrait « ComÃ©die » à la lecture par l'application.
SET NAMES utf8mb4;

-- Ordre inverse des clés étrangères : une table est supprimée avant celles
-- dont elle dépend.
DROP TABLE IF EXISTS journal_admin;
DROP TABLE IF EXISTS mouvement_stock;
DROP TABLE IF EXISTS parametre;
DROP TABLE IF EXISTS ligne_commande;
DROP TABLE IF EXISTS commande;
DROP TABLE IF EXISTS code_promo;
DROP TABLE IF EXISTS utilisateur;
DROP TABLE IF EXISTS image;
DROP TABLE IF EXISTS variante_valeur;
DROP TABLE IF EXISTS valeur_option;
DROP TABLE IF EXISTS option_produit;
DROP TABLE IF EXISTS variante;
DROP TABLE IF EXISTS produit;
DROP TABLE IF EXISTS categorie;

-- ---------------------------------------------------------------------------
-- Catégories
-- ---------------------------------------------------------------------------
CREATE TABLE categorie (
    id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nom         VARCHAR(60)      NOT NULL,
    slug        VARCHAR(80)      NOT NULL,
    description TEXT             NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_categorie_slug (slug)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Produits
--
-- Le prix et le stock ne sont pas ici : ils appartiennent à la variante.
-- ---------------------------------------------------------------------------
CREATE TABLE produit (
    id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    categorie_id TINYINT UNSIGNED  NOT NULL,
    nom          VARCHAR(120)      NOT NULL,
    slug         VARCHAR(140)      NOT NULL,
    description  TEXT              NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_produit_slug (slug),
    KEY idx_produit_categorie (categorie_id),

    CONSTRAINT fk_produit_categorie
        FOREIGN KEY (categorie_id) REFERENCES categorie (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Variantes
--
-- Une variante par défaut dès le départ : le panier et les commandes
-- désignent toujours une variante. Le stock ne peut pas être négatif
-- (UNSIGNED). Un produit à options a une variante par combinaison de valeurs
-- (la DualSense blanche, la noire…), chacune avec son prix et son stock : voir
-- les tables d'options ci-dessous.
-- ---------------------------------------------------------------------------
CREATE TABLE variante (
    id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    produit_id SMALLINT UNSIGNED NOT NULL,
    prix       DECIMAL(8,2)      NOT NULL,
    stock      SMALLINT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_variante_produit (produit_id),

    CONSTRAINT fk_variante_produit
        FOREIGN KEY (produit_id) REFERENCES produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Options
--
-- Les options sont définies par produit (option_produit : « Coloris »,
-- « Édition »…), avec leurs valeurs possibles (valeur_option : « Blanc »,
-- « Noir »…). Une variante est une combinaison de valeurs, une par option du
-- produit (variante_valeur). Un produit sans option a une seule variante, sans
-- valeur. ordre : ordre d'affichage sur la fiche.
-- ---------------------------------------------------------------------------
CREATE TABLE option_produit (
    id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    produit_id SMALLINT UNSIGNED NOT NULL,
    nom        VARCHAR(40)       NOT NULL,
    ordre      TINYINT UNSIGNED  NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    UNIQUE KEY uq_option_nom (produit_id, nom),

    CONSTRAINT fk_option_produit
        FOREIGN KEY (produit_id) REFERENCES produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE valeur_option (
    id        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    option_id INT UNSIGNED     NOT NULL,
    valeur    VARCHAR(60)      NOT NULL,
    ordre     TINYINT UNSIGNED NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    UNIQUE KEY uq_valeur_option (option_id, valeur),

    CONSTRAINT fk_valeur_option
        FOREIGN KEY (option_id) REFERENCES option_produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE variante_valeur (
    variante_id INT UNSIGNED NOT NULL,
    valeur_id   INT UNSIGNED NOT NULL,

    PRIMARY KEY (variante_id, valeur_id),
    KEY idx_variante_valeur (valeur_id),

    CONSTRAINT fk_variante_valeur_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_variante_valeur_valeur
        FOREIGN KEY (valeur_id) REFERENCES valeur_option (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Images
--
-- fichier : nom du fichier dans front/public/images/produits/.
-- variante_id : NULL pour les images du produit (sa variante par défaut) ;
-- sinon, l'image montre cette variante-là (un coloris) et ne sert qu'à elle.
-- L'image d'ordre 1 est l'image principale. affichage : où l'image sert. Les
-- cartes du catalogue et le panier prennent la première image « partout » ou
-- « catalogue » (une jaquette carrée) ; la galerie de la fiche, les images
-- « partout » ou « fiche » (des visuels en paysage).
-- ---------------------------------------------------------------------------
CREATE TABLE image (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    produit_id  SMALLINT UNSIGNED NOT NULL,
    variante_id INT UNSIGNED      NULL,
    fichier     VARCHAR(160)      NOT NULL,
    alt         VARCHAR(160)      NOT NULL,
    ordre       TINYINT UNSIGNED  NOT NULL DEFAULT 1,
    affichage   ENUM('partout', 'catalogue', 'fiche') NOT NULL DEFAULT 'partout',

    PRIMARY KEY (id),
    UNIQUE KEY uq_image_ordre (produit_id, variante_id, ordre),
    KEY idx_image_variante (variante_id),

    CONSTRAINT fk_image_produit
        FOREIGN KEY (produit_id) REFERENCES produit (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_image_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Jeu de données de la boutique
-- ---------------------------------------------------------------------------

INSERT INTO categorie (id, nom, slug, description) VALUES
    (1, 'Consoles',              'consoles',             'Les consoles PS5 et le lecteur à distance PlayStation Portal.'),
    (2, 'Manettes',              'manettes',             'Manettes sans fil DualSense, éditions limitées et modèle pro.'),
    (3, 'Casques & accessoires', 'casques-accessoires',  'Audio PULSE, recharge et télécommande pour votre PS5.'),
    (4, 'Jeux',                  'jeux',                 'Les exclusivités PlayStation Studios en version physique.');

INSERT INTO produit (id, categorie_id, nom, slug, description) VALUES
    ( 1, 1, 'Console PS5',                             'console-ps5',                        'La console PS5 avec lecteur de disque Ultra HD Blu-ray, SSD ultra-rapide de 1 To et manette sans fil DualSense.'),
    ( 2, 1, 'PS5 Édition numérique',                   'ps5-edition-numerique',              'La PS5 sans lecteur de disque : vos jeux s''achètent et se téléchargent depuis le PlayStation Store.'),
    ( 3, 1, 'PS5 Pro',                                 'ps5-pro',                            'La PS5 la plus puissante : GPU amélioré, ray tracing avancé et upscaling PSSR pour des jeux plus fluides et plus nets.'),
    ( 4, 1, 'PlayStation Portal',                      'playstation-portal',                 'Le lecteur à distance qui diffuse les jeux de votre PS5 en Wi-Fi sur un écran LCD de 8 pouces, avec les fonctions de la DualSense.'),
    ( 5, 2, 'Manette sans fil DualSense',              'manette-sans-fil-dualsense',         'Retour haptique, gâchettes adaptatives et micro intégré : la manette de référence de la PS5.'),
    ( 6, 2, 'DualSense Edge',                          'dualsense-edge',                     'La manette sans fil pro : sticks remplaçables, boutons arrière, profils personnalisés et étui de transport.'),
    ( 7, 2, 'DualSense Édition limitée GTA VI',        'dualsense-edition-limitee-gta-vi',   'Une DualSense aux couleurs de Grand Theft Auto VI, reflets néon façon Vice City.'),
    ( 9, 3, 'Casque PULSE Elite',                      'casque-pulse-elite',                 'Casque sans fil à haut-parleurs magnétiques planaires, micro rétractable et connexion PlayStation Link.'),
    (10, 3, 'Écouteurs PULSE Explore',                 'ecouteurs-pulse-explore',            'Écouteurs sans fil à haut-parleurs magnétiques planaires, avec étui de recharge.'),
    (11, 3, 'Station de charge DualSense',             'station-de-charge-dualsense',        'Rechargez deux manettes DualSense en même temps, sans les brancher à la console.'),
    (12, 3, 'Télécommande multimédia',                 'telecommande-multimedia',            'Pilotez vos films, séries et applications de streaming sur PS5, avec touches dédiées.'),
    (13, 4, 'Ghost of Yōtei',                          'ghost-of-yotei',                     'Au Japon en 1603, une mercenaire parcourt les terres sauvages autour du mont Yōtei pour accomplir sa vengeance.'),
    (14, 4, 'Astro Bot',                               'astro-bot',                          'Astro part à la recherche de son équipage dans plus de 50 planètes, en tirant parti de la DualSense.'),
    (15, 4, 'Marvel''s Spider-Man 2',                  'marvels-spider-man-2',               'Peter Parker et Miles Morales unissent leurs forces face à Kraven et au symbiote Venom.'),
    (16, 4, 'Gran Turismo 7',                          'gran-turismo-7',                     'Le simulateur de conduite de référence : plus de 400 voitures, circuits légendaires et mode GT Café.');

-- Stocks choisis pour couvrir les trois états : en stock, bientôt épuisé
-- (PlayStation Portal, DualSense Edge) et épuisé (PS5 Pro).
-- Les produits proposés en deux coloris ont une variante « Blanc » (celle des
-- images du produit) et une variante « Noir », au même prix (voir les options).
INSERT INTO variante (id, produit_id, prix, stock) VALUES
    ( 1,  1,  549.99, 12),
    ( 2,  2,  499.99,  8),
    ( 3,  3,  799.99,  0),
    ( 4,  4,  219.99,  2),
    ( 5,  5,   74.99, 25),
    ( 6,  6,  239.99,  3),
    ( 7,  7,   84.99, 10),
    ( 8,  9,  149.99,  9),
    ( 9, 10,  219.99,  7),
    (10, 11,   39.99, 15),
    (11, 12,   29.99, 20),
    (12, 13,   79.99, 14),
    (13, 14,   69.99, 11),
    (14, 15,   79.99,  9),
    (15, 16,   49.99, 18),
    (16,  4,  219.99,  5),
    (17,  5,   74.99, 18),
    (18,  6,  239.99,  4),
    (19,  7,   84.99,  6),
    (20,  9,  149.99,  8),
    (21, 10,  219.99,  0);

-- Option « Coloris » des six produits proposés en blanc et en noir. La
-- variante « Blanc » est celle des images du produit.
INSERT INTO option_produit (id, produit_id, nom, ordre) VALUES
    (1,  4, 'Coloris', 1),
    (2,  5, 'Coloris', 1),
    (3,  6, 'Coloris', 1),
    (4,  7, 'Coloris', 1),
    (5,  9, 'Coloris', 1),
    (6, 10, 'Coloris', 1);

INSERT INTO valeur_option (id, option_id, valeur, ordre) VALUES
    ( 1, 1, 'Blanc', 1), ( 2, 1, 'Noir', 2),
    ( 3, 2, 'Blanc', 1), ( 4, 2, 'Noir', 2),
    ( 5, 3, 'Blanc', 1), ( 6, 3, 'Noir', 2),
    ( 7, 4, 'Blanc', 1), ( 8, 4, 'Noir', 2),
    ( 9, 5, 'Blanc', 1), (10, 5, 'Noir', 2),
    (11, 6, 'Blanc', 1), (12, 6, 'Noir', 2);

INSERT INTO variante_valeur (variante_id, valeur_id) VALUES
    ( 4,  1), (16,  2),
    ( 5,  3), (17,  4),
    ( 6,  5), (18,  6),
    ( 7,  7), (19,  8),
    ( 8,  9), (20, 10),
    ( 9, 11), (21, 12);

INSERT INTO image (produit_id, fichier, alt, ordre) VALUES
    ( 1, 'console-ps5.webp',                              'Console PS5 blanche, posée à la verticale',             1),
    ( 2, 'ps5-edition-numerique.webp',                    'PS5 Édition numérique, posée à la verticale',           1),
    ( 3, 'ps5-pro.webp',                                  'PS5 Pro et sa manette DualSense',                       1),
    ( 4, 'playstation-portal.webp',                       'Lecteur à distance PlayStation Portal',                 1),
    ( 5, 'manette-sans-fil-dualsense.webp',               'Manette sans fil DualSense blanche',                    1),
    ( 6, 'dualsense-edge.webp',                           'Manette DualSense Edge noire',                          1),
    ( 7, 'dualsense-edition-limitee-gta-vi.webp',        'DualSense Édition limitée GTA VI, coloris blanc',       1),
    ( 9, 'casque-pulse-elite.webp',                       'Casque sans fil PULSE Elite',                           1),
    (10, 'ecouteurs-pulse-explore.webp',                  'Écouteurs sans fil PULSE Explore',                      1),
    (11, 'station-de-charge-dualsense.webp',              'Station de charge avec deux manettes DualSense',        1),
    (12, 'telecommande-multimedia.webp',                  'Télécommande multimédia blanche',                       1),
    (13, 'ghost-of-yotei.jpg',                           'Jaquette du jeu Ghost of Yōtei',                        1),
    (14, 'astro-bot.jpg',                                'Jaquette du jeu Astro Bot',                             1),
    (15, 'marvels-spider-man-2.jpg',                     'Jaquette du jeu Marvel''s Spider-Man 2',                1),
    (16, 'gran-turismo-7.webp',                           'Jaquette du jeu Gran Turismo 7',                        1);

-- Autres vues du même produit, pour la galerie de la fiche produit. Les
-- coloris (fichiers -noir, -blanc) n'en font pas partie : ils servent aux
-- options de couleur.
INSERT INTO image (produit_id, fichier, alt, ordre) VALUES
    ( 1, 'console-ps5-2.webp',                   'Console PS5, vue 2',                   2),
    ( 1, 'console-ps5-3.webp',                   'Console PS5, vue 3',                   3),
    ( 1, 'console-ps5-4.webp',                   'Console PS5, vue 4',                   4),
    ( 2, 'ps5-edition-numerique-2.webp',         'PS5 Édition numérique, vue 2',         2),
    ( 2, 'ps5-edition-numerique-3.webp',         'PS5 Édition numérique, vue 3',         3),
    ( 2, 'ps5-edition-numerique-4.webp',         'PS5 Édition numérique, vue 4',         4),
    ( 3, 'ps5-pro-2.webp',                       'PS5 Pro, vue 2',                       2),
    ( 3, 'ps5-pro-3.webp',                       'PS5 Pro, vue 3',                       3),
    ( 3, 'ps5-pro-4.webp',                       'PS5 Pro, vue 4',                       4),
    ( 4, 'playstation-portal-2.webp',            'PlayStation Portal, vue 2',            2),
    ( 4, 'playstation-portal-3.webp',            'PlayStation Portal, vue 3',            3),
    ( 4, 'playstation-portal-4.webp',            'PlayStation Portal, vue 4',            4),
    ( 5, 'manette-sans-fil-dualsense-2.webp',    'Manette sans fil DualSense, vue 2',    2),
    ( 5, 'manette-sans-fil-dualsense-3.webp',    'Manette sans fil DualSense, vue 3',    3),
    ( 5, 'manette-sans-fil-dualsense-4.webp',    'Manette sans fil DualSense, vue 4',    4),
    ( 6, 'dualsense-edge-2.webp',                'DualSense Edge, vue 2',                2),
    ( 6, 'dualsense-edge-3.webp',                'DualSense Edge, vue 3',                3),
    ( 6, 'dualsense-edge-4.webp',                'DualSense Edge, vue 4',                4),
    ( 7, 'dualsense-edition-limitee-gta-vi-2.webp', 'DualSense Édition limitée GTA VI, vue 2', 2),
    ( 7, 'dualsense-edition-limitee-gta-vi-3.webp', 'DualSense Édition limitée GTA VI, vue 3', 3),
    ( 7, 'dualsense-edition-limitee-gta-vi-4.webp', 'DualSense Édition limitée GTA VI, vue 4', 4),
    ( 9, 'casque-pulse-elite-2.webp',            'Casque PULSE Elite, vue 2',            2),
    ( 9, 'casque-pulse-elite-3.webp',            'Casque PULSE Elite, vue 3',            3),
    ( 9, 'casque-pulse-elite-4.webp',            'Casque PULSE Elite, vue 4',            4),
    (10, 'ecouteurs-pulse-explore-2.webp',       'Écouteurs PULSE Explore, vue 2',       2),
    (10, 'ecouteurs-pulse-explore-3.webp',       'Écouteurs PULSE Explore, vue 3',       3),
    (10, 'ecouteurs-pulse-explore-4.webp',       'Écouteurs PULSE Explore, vue 4',       4),
    (11, 'station-de-charge-dualsense-2.webp',   'Station de charge DualSense, vue 2',   2),
    (11, 'station-de-charge-dualsense-3.webp',   'Station de charge DualSense, vue 3',   3),
    (12, 'telecommande-multimedia-2.webp',       'Télécommande multimédia, vue 2',       2),
    (12, 'telecommande-multimedia-3.webp',       'Télécommande multimédia, vue 3',       3),
    (12, 'telecommande-multimedia-4.webp',       'Télécommande multimédia, vue 4',       4);

-- Images des coloris « Noir » : rattachées à leur variante, elles ne figurent
-- ni dans le catalogue ni dans la galerie du coloris par défaut.
INSERT INTO image (produit_id, variante_id, fichier, alt, ordre) VALUES
    ( 4, 16, 'playstation-portal-noir.webp',             'PlayStation Portal, coloris noir',             1),
    ( 4, 16, 'playstation-portal-noir-2.webp',           'PlayStation Portal, coloris noir, vue 2',      2),
    ( 4, 16, 'playstation-portal-noir-3.webp',           'PlayStation Portal, coloris noir, vue 3',      3),
    ( 4, 16, 'playstation-portal-noir-4.webp',           'PlayStation Portal, coloris noir, vue 4',      4),
    ( 5, 17, 'manette-sans-fil-dualsense-noir.webp',     'Manette sans fil DualSense, coloris noir',     1),
    ( 5, 17, 'manette-sans-fil-dualsense-noir-2.webp',   'Manette sans fil DualSense, coloris noir, vue 2', 2),
    ( 5, 17, 'manette-sans-fil-dualsense-noir-3.webp',   'Manette sans fil DualSense, coloris noir, vue 3', 3),
    ( 5, 17, 'manette-sans-fil-dualsense-noir-4.webp',   'Manette sans fil DualSense, coloris noir, vue 4', 4),
    ( 6, 18, 'dualsense-edge-noir.webp',                 'DualSense Edge, coloris noir',                 1),
    ( 6, 18, 'dualsense-edge-noir-2.webp',               'DualSense Edge, coloris noir, vue 2',          2),
    ( 6, 18, 'dualsense-edge-noir-3.webp',               'DualSense Edge, coloris noir, vue 3',          3),
    ( 6, 18, 'dualsense-edge-noir-4.webp',               'DualSense Edge, coloris noir, vue 4',          4),
    ( 7, 19, 'dualsense-edition-limitee-gta-vi-noir.webp', 'DualSense Édition limitée GTA VI, coloris noir', 1),
    ( 7, 19, 'dualsense-edition-limitee-gta-vi-noir-2.webp', 'DualSense Édition limitée GTA VI, coloris noir, vue 2', 2),
    ( 7, 19, 'dualsense-edition-limitee-gta-vi-noir-3.webp', 'DualSense Édition limitée GTA VI, coloris noir, vue 3', 3),
    ( 7, 19, 'dualsense-edition-limitee-gta-vi-noir-4.webp', 'DualSense Édition limitée GTA VI, coloris noir, vue 4', 4),
    ( 9, 20, 'casque-pulse-elite-noir.webp',             'Casque PULSE Elite, coloris noir',             1),
    ( 9, 20, 'casque-pulse-elite-noir-2.webp',           'Casque PULSE Elite, coloris noir, vue 2',      2),
    ( 9, 20, 'casque-pulse-elite-noir-3.webp',           'Casque PULSE Elite, coloris noir, vue 3',      3),
    ( 9, 20, 'casque-pulse-elite-noir-4.webp',           'Casque PULSE Elite, coloris noir, vue 4',      4),
    (10, 21, 'ecouteurs-pulse-explore-noir.webp',        'Écouteurs PULSE Explore, coloris noir',        1);

-- ---------------------------------------------------------------------------
-- Utilisateurs
--
-- mot_de_passe : empreinte bcrypt produite par password_hash(), jamais le mot
-- de passe lui-même. role : 'client' pour la boutique, 'admin' pour la zone
-- d'administration. On se connecte avec l'adresse e-mail (unique). prenom et
-- nom sont saisis à l'inscription et modifiables dans « Mon profil » ; ils ne
-- sont pas uniques (deux clients peuvent s'appeler Omar). L'en-tête affiche
-- « Prénom N. ».
-- ---------------------------------------------------------------------------
CREATE TABLE utilisateur (
    id           INT UNSIGNED            NOT NULL AUTO_INCREMENT,
    email        VARCHAR(180)            NOT NULL,
    prenom       VARCHAR(60)             NOT NULL,
    nom          VARCHAR(60)             NOT NULL,
    mot_de_passe VARCHAR(255)            NOT NULL,
    role         ENUM('client', 'admin') NOT NULL DEFAULT 'client',
    cree_le      DATETIME                NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_utilisateur_email (email)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Comptes de test (voir README) : client@playstation.test / client1234 et
-- admin@playstation.test / admin1234.
INSERT INTO utilisateur (email, prenom, nom, mot_de_passe, role) VALUES
    ('client@playstation.test', 'Nathan', 'Drake',       '$2y$12$lJPa0JrD2Rw0ET8.r/Xp2umTobri5omSesmplBIX4zUn8xO8oFT2K', 'client'),
    ('admin@playstation.test',  'Admin',  'PlayStation', '$2y$12$1puRSW6uY8T6pxGogeWEw.H9ufh93afp.iNCoMHWoKjYw8jIC5CNy', 'admin');

-- ---------------------------------------------------------------------------
-- Codes promotionnels
--
-- Un code (en majuscules, unique) donne une réduction en pourcentage sur le
-- total d'une commande. Les commandes qui l'ont utilisé gardent leur remise
-- s'il est supprimé (voir commande.code_promo_id).
-- ---------------------------------------------------------------------------
CREATE TABLE code_promo (
    id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code        VARCHAR(20)       NOT NULL,
    pourcentage TINYINT UNSIGNED  NOT NULL,
    cree_le     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_code_promo_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

INSERT INTO code_promo (code, pourcentage) VALUES
    ('PS10',      10),
    ('RENTREE26', 15),
    ('ETE25',     20);

-- ---------------------------------------------------------------------------
-- Commandes
--
-- numero : PS-AAAAMMJJ-NNNN, construit à partir de l'identifiant juste après
-- l'insertion (NULL le temps de la transaction, d'où une colonne NULL : une
-- clé UNIQUE accepte plusieurs NULL). statut suit le retrait en magasin.
-- total : montant payé (somme des lignes, moins la remise), figé au moment
-- de la commande.
-- code_promo_id, remise : code utilisé et montant déduit, figé lui aussi.
-- Le code supprimé, code_promo_id passe à NULL (ON DELETE SET NULL) : la
-- commande garde sa remise, mais ne compte plus dans les statistiques du code.
-- code_promo, pourcentage_promo : texte et réduction du code, recopiés comme
-- le nom et le prix des lignes, pour l'affichage (« Code PS10 (−10 %) »).
-- ---------------------------------------------------------------------------
CREATE TABLE commande (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    numero         VARCHAR(20)   NULL,
    utilisateur_id INT UNSIGNED  NOT NULL,
    statut         ENUM('en_cours', 'disponible', 'retiree', 'annulee') NOT NULL DEFAULT 'en_cours',
    total          DECIMAL(10,2) NOT NULL,
    code_promo_id  SMALLINT UNSIGNED NULL,
    code_promo     VARCHAR(20)   NULL,
    pourcentage_promo TINYINT UNSIGNED NULL,
    remise         DECIMAL(10,2) NOT NULL DEFAULT 0,
    cree_le        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_commande_numero (numero),
    KEY idx_commande_utilisateur (utilisateur_id),
    KEY idx_commande_statut (statut),
    KEY idx_commande_date (cree_le),
    KEY idx_commande_code_promo (code_promo_id),

    CONSTRAINT fk_commande_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_commande_code_promo
        FOREIGN KEY (code_promo_id) REFERENCES code_promo (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Lignes de commande
--
-- Le nom, les options choisies (texte figé, « Coloris : Noir ») et le prix
-- unitaire sont recopiés au moment de la commande : un changement de prix, de
-- nom ou d'options ultérieur ne modifie pas une commande passée. variante_id passe à NULL si la variante est supprimée.
-- prix_initial : prix d'origine quand le produit était en promotion automatique
-- (prix_unitaire est alors le prix réduit), NULL sinon ; figé lui aussi.
-- ---------------------------------------------------------------------------
CREATE TABLE ligne_commande (
    id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    commande_id   INT UNSIGNED      NOT NULL,
    variante_id   INT UNSIGNED      NULL,
    nom           VARCHAR(120)      NOT NULL,
    options       VARCHAR(255)      NULL,
    prix_unitaire DECIMAL(8,2)      NOT NULL,
    prix_initial  DECIMAL(8,2)      NULL,
    quantite      SMALLINT UNSIGNED NOT NULL,

    PRIMARY KEY (id),
    KEY idx_ligne_commande (commande_id),
    KEY idx_ligne_variante (variante_id),

    CONSTRAINT fk_ligne_commande
        FOREIGN KEY (commande_id) REFERENCES commande (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_ligne_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Paramètres de la boutique
--
-- Réglages modifiables sans toucher au code (l'administration pourra les
-- changer). valeur est une chaîne : chaque contrôleur la convertit.
-- ---------------------------------------------------------------------------
CREATE TABLE parametre (
    cle         VARCHAR(60)  NOT NULL,
    valeur      VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,

    PRIMARY KEY (cle)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Avec un seuil de 3 : PS5 Pro épuisée, PlayStation Portal et DualSense Edge
-- (coloris Blanc) bientôt épuisées, Écouteurs PULSE Explore noirs épuisés.
INSERT INTO parametre (cle, valeur, description) VALUES
    ('seuil_bientot_epuise', '3', 'Stock à partir duquel une variante est « Bientôt épuisé » (stock de 1 à ce seuil).');

-- ---------------------------------------------------------------------------
-- Journal des mouvements de stock
--
-- Une ligne par variante et par mouvement : quantite est signée (-2 pour une
-- commande, +2 pour son annulation), stock_avant / stock_apres permettent de
-- reconstituer l'historique. utilisateur_id : qui a provoqué le mouvement
-- (le client qui commande, l'administrateur qui annule ou qui corrige le
-- stock dans le back-office : motif « ajustement », sans commande).
-- ---------------------------------------------------------------------------
CREATE TABLE mouvement_stock (
    id             INT UNSIGNED                     NOT NULL AUTO_INCREMENT,
    variante_id    INT UNSIGNED                     NULL,
    commande_id    INT UNSIGNED                     NULL,
    utilisateur_id INT UNSIGNED                     NULL,
    quantite       SMALLINT                         NOT NULL,
    motif          ENUM('commande', 'annulation', 'ajustement') NOT NULL,
    stock_avant    SMALLINT UNSIGNED                NOT NULL,
    stock_apres    SMALLINT UNSIGNED                NOT NULL,
    cree_le        DATETIME                         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_mouvement_variante (variante_id),
    KEY idx_mouvement_commande (commande_id),
    KEY idx_mouvement_date (cree_le),

    CONSTRAINT fk_mouvement_variante
        FOREIGN KEY (variante_id) REFERENCES variante (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_mouvement_commande
        FOREIGN KEY (commande_id) REFERENCES commande (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_mouvement_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Journal des administrateurs
--
-- Une ligne par changement de statut d'une commande fait depuis le
-- back-office : qui (utilisateur_id, l'administrateur), quand, et le passage
-- ancien_statut → nouveau_statut. Écrite dans la même transaction que le
-- changement. Les effets sur le stock (annulation) sont, eux, dans
-- mouvement_stock.
-- ---------------------------------------------------------------------------
CREATE TABLE journal_admin (
    id             INT UNSIGNED                                         NOT NULL AUTO_INCREMENT,
    commande_id    INT UNSIGNED                                         NOT NULL,
    utilisateur_id INT UNSIGNED                                         NULL,
    ancien_statut  ENUM('en_cours', 'disponible', 'retiree', 'annulee') NOT NULL,
    nouveau_statut ENUM('en_cours', 'disponible', 'retiree', 'annulee') NOT NULL,
    cree_le        DATETIME                                             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_journal_commande (commande_id),
    KEY idx_journal_date (cree_le),

    CONSTRAINT fk_journal_commande
        FOREIGN KEY (commande_id) REFERENCES commande (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_journal_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
