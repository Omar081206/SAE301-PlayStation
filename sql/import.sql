-- ---------------------------------------------------------------------------
-- SAE301 — PlayStation Click & Collect : tables et jeu de données
--
-- Ce script ne crée PAS de base de données : il ajoute ses tables à une base
-- existante, la vôtre. Depuis phpMyAdmin, sélectionnez d'abord votre base dans
-- la colonne de gauche, puis importez ce fichier depuis l'onglet « Importer ».
--
-- Boutique : 15 produits en 4 catégories (3 manettes, 4 produits ailleurs). Chaque produit a une variante par
-- défaut, qui porte son prix et son stock (six produits ont aussi une variante
-- de coloris « Noir »), et une image principale (ordre 1) ;
-- les produits photographiés sous plusieurs angles ont une galerie.
-- Les tables film et genre du starter restent en place tant que la page
-- d'administration s'en sert.
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
DROP TABLE IF EXISTS ligne_commande;
DROP TABLE IF EXISTS commande;
DROP TABLE IF EXISTS utilisateur;
DROP TABLE IF EXISTS image;
DROP TABLE IF EXISTS variante;
DROP TABLE IF EXISTS produit;
DROP TABLE IF EXISTS categorie;
DROP TABLE IF EXISTS film;
DROP TABLE IF EXISTS genre;

-- ---------------------------------------------------------------------------
-- Genres
-- ---------------------------------------------------------------------------
CREATE TABLE genre (
    id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    libelle VARCHAR(40)      NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_genre_libelle (libelle)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Films
--
-- Les index sur annee et note_moyenne ne sont pas décoratifs : le catalogue
-- sera trié sur ces colonnes, et un tri sans index impose à MySQL de parcourir
-- puis d'ordonner toute la table.
-- ---------------------------------------------------------------------------
CREATE TABLE film (
    id            SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    titre         VARCHAR(160)      NOT NULL,
    realisateur   VARCHAR(120)      NOT NULL,
    annee         SMALLINT UNSIGNED NOT NULL,
    duree_minutes SMALLINT UNSIGNED NOT NULL,
    note_moyenne  DECIMAL(3,1)      NOT NULL,
    genre_id      TINYINT UNSIGNED  NOT NULL,

    PRIMARY KEY (id),
    KEY idx_film_titre (titre),
    KEY idx_film_annee (annee),
    KEY idx_film_note  (note_moyenne),
    KEY idx_film_genre (genre_id),

    CONSTRAINT fk_film_genre
        FOREIGN KEY (genre_id) REFERENCES genre (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Jeu de données
-- ---------------------------------------------------------------------------

INSERT INTO genre (id, libelle) VALUES
    (1, 'Animation'),
    (2, 'Aventure'),
    (3, 'Comédie'),
    (4, 'Documentaire'),
    (5, 'Drame'),
    (6, 'Horreur'),
    (7, 'Policier'),
    (8, 'Science-fiction');

INSERT INTO film (titre, realisateur, annee, duree_minutes, note_moyenne, genre_id) VALUES
    ('2001, l''Odyssée de l''espace',            'Stanley Kubrick',        1968, 149, 8.9, 8),
    ('Alien',                                    'Ridley Scott',           1979, 117, 8.4, 6),
    ('Apocalypse Now',                           'Francis Ford Coppola',   1979, 147, 8.5, 5),
    ('Blade Runner',                             'Ridley Scott',           1982, 117, 8.3, 8),
    ('Brazil',                                   'Terry Gilliam',          1985, 142, 7.9, 8),
    ('Dans la peau de John Malkovich',           'Spike Jonze',            1999, 112, 7.7, 3),
    ('Dune',                                     'Denis Villeneuve',       2021, 155, 8.0, 8),
    ('Fargo',                                    'Joel Coen',              1996,  98, 8.1, 7),
    ('Gravity',                                  'Alfonso Cuarón',         2013,  91, 7.7, 8),
    ('Her',                                      'Spike Jonze',            2013, 126, 8.0, 8),
    ('Intouchables',                             'Olivier Nakache',        2011, 112, 8.5, 3),
    ('Jurassic Park',                            'Steven Spielberg',       1993, 127, 8.2, 2),
    ('La Cité de Dieu',                          'Fernando Meirelles',     2002, 130, 8.6, 5),
    ('La Haine',                                 'Mathieu Kassovitz',      1995,  98, 8.0, 5),
    ('La Marche de l''empereur',                 'Luc Jacquet',            2005,  85, 7.5, 4),
    ('Là-haut',                                  'Pete Docter',            2009,  96, 8.2, 1),
    ('Le Château ambulant',                      'Hayao Miyazaki',         2004, 119, 8.2, 1),
    ('Le Cercle rouge',                          'Jean-Pierre Melville',   1970, 140, 7.9, 7),
    ('Le Dictateur',                             'Charlie Chaplin',        1940, 125, 8.4, 3),
    ('Le Fabuleux Destin d''Amélie Poulain',     'Jean-Pierre Jeunet',     2001, 122, 8.3, 3),
    ('Le Fils de Saul',                          'László Nemes',           2015, 107, 7.5, 5),
    ('Le Grand Bleu',                            'Luc Besson',             1988, 132, 7.6, 2),
    ('Le Labyrinthe de Pan',                     'Guillermo del Toro',     2006, 118, 8.2, 2),
    ('Le Mépris',                                'Jean-Luc Godard',        1963, 103, 7.6, 5),
    ('Le Parrain',                               'Francis Ford Coppola',   1972, 175, 9.2, 5),
    ('Le Roi Lion',                              'Roger Allers',           1994,  88, 8.5, 1),
    ('Le Silence des agneaux',                   'Jonathan Demme',         1991, 118, 8.6, 6),
    ('Le Tombeau des lucioles',                  'Isao Takahata',          1988,  89, 8.5, 1),
    ('Le Voyage de Chihiro',                     'Hayao Miyazaki',         2001, 125, 8.6, 1),
    ('Les Affranchis',                           'Martin Scorsese',        1990, 145, 8.7, 7),
    ('Les Dents de la mer',                      'Steven Spielberg',       1975, 124, 8.1, 6),
    ('Les Quatre Cents Coups',                   'François Truffaut',      1959,  99, 8.1, 5),
    ('Les Sept Samouraïs',                       'Akira Kurosawa',         1954, 207, 8.6, 2),
    ('Les Temps modernes',                       'Charlie Chaplin',        1936,  87, 8.5, 3),
    ('Mad Max : Fury Road',                      'George Miller',          2015, 120, 8.1, 2),
    ('Matrix',                                   'Lana et Lilly Wachowski',1999, 136, 8.7, 8),
    ('Mon oncle',                                'Jacques Tati',           1958, 117, 7.9, 3),
    ('Mon voisin Totoro',                        'Hayao Miyazaki',         1988,  86, 8.1, 1),
    ('Nuit et brouillard',                       'Alain Resnais',          1956,  32, 8.4, 4),
    ('Océans',                                   'Jacques Perrin',         2009, 104, 7.8, 4),
    ('Old Boy',                                  'Park Chan-wook',         2003, 120, 8.3, 7),
    ('Parasite',                                 'Bong Joon-ho',           2019, 132, 8.5, 5),
    ('Playtime',                                 'Jacques Tati',           1967, 124, 7.9, 3),
    ('Premier Contact',                          'Denis Villeneuve',       2016, 116, 7.9, 8),
    ('Princesse Mononoké',                       'Hayao Miyazaki',         1997, 134, 8.3, 1),
    ('Pulp Fiction',                             'Quentin Tarantino',      1994, 154, 8.9, 7),
    ('Ran',                                      'Akira Kurosawa',         1985, 162, 8.2, 5),
    ('Retour vers le futur',                     'Robert Zemeckis',        1985, 116, 8.5, 8),
    ('Roma',                                     'Alfonso Cuarón',         2018, 135, 7.7, 5),
    ('Rosemary''s Baby',                         'Roman Polanski',         1968, 137, 8.0, 6),
    ('Sans soleil',                              'Chris Marker',           1983, 100, 7.9, 4),
    ('Seven',                                    'David Fincher',          1995, 127, 8.6, 7),
    ('Shining',                                  'Stanley Kubrick',        1980, 146, 8.4, 6),
    ('Spider-Man : New Generation',              'Bob Persichetti',        2018, 117, 8.4, 1),
    ('Stalker',                                  'Andreï Tarkovski',       1979, 161, 8.1, 8),
    ('Sueurs froides',                           'Alfred Hitchcock',       1958, 128, 8.3, 7),
    ('The Thing',                                'John Carpenter',         1982, 109, 8.2, 6),
    ('Un prophète',                              'Jacques Audiard',        2009, 155, 7.9, 7),
    ('Wall-E',                                   'Andrew Stanton',         2008,  98, 8.4, 1),
    ('Whiplash',                                 'Damien Chazelle',        2014, 106, 8.5, 5);

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
-- désignent toujours une variante, et les options viendront s'y greffer sans
-- migration. Le stock ne peut pas être négatif (UNSIGNED).
-- coloris : NULL pour un produit sans choix de couleur ; sinon, chaque coloris
-- est une variante, avec son propre stock (la DualSense blanche, la noire…).
-- ---------------------------------------------------------------------------
CREATE TABLE variante (
    id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    produit_id SMALLINT UNSIGNED NOT NULL,
    coloris    VARCHAR(40)       NULL,
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
-- Images
--
-- fichier : nom du fichier dans front/public/images/produits/.
-- variante_id : NULL pour les images du produit (son coloris par défaut) ;
-- sinon, l'image montre ce coloris-là et ne sert qu'à lui.
-- L'image d'ordre 1 est l'image principale, affichée dans le catalogue.
-- ---------------------------------------------------------------------------
CREATE TABLE image (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    produit_id  SMALLINT UNSIGNED NOT NULL,
    variante_id INT UNSIGNED      NULL,
    fichier     VARCHAR(160)      NOT NULL,
    alt         VARCHAR(160)      NOT NULL,
    ordre       TINYINT UNSIGNED  NOT NULL DEFAULT 1,

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
-- images du produit) et une variante « Noir », au même prix.
INSERT INTO variante (id, produit_id, coloris, prix, stock) VALUES
    ( 1,  1, NULL,    549.99, 12),
    ( 2,  2, NULL,    499.99,  8),
    ( 3,  3, NULL,    799.99,  0),
    ( 4,  4, 'Blanc', 219.99,  2),
    ( 5,  5, 'Blanc',  74.99, 25),
    ( 6,  6, 'Blanc', 239.99,  3),
    ( 7,  7, 'Blanc',  84.99, 10),
    ( 8,  9, 'Blanc', 149.99,  9),
    ( 9, 10, 'Blanc', 219.99,  7),
    (10, 11, NULL,     39.99, 15),
    (11, 12, NULL,     29.99, 20),
    (12, 13, NULL,     79.99, 14),
    (13, 14, NULL,     69.99, 11),
    (14, 15, NULL,     79.99,  9),
    (15, 16, NULL,     49.99, 18),
    (16,  4, 'Noir',  219.99,  5),
    (17,  5, 'Noir',   74.99, 18),
    (18,  6, 'Noir',  239.99,  4),
    (19,  7, 'Noir',   84.99,  6),
    (20,  9, 'Noir',  149.99,  8),
    (21, 10, 'Noir',  219.99,  0);

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
-- coloris (fichiers -noir, -blanc) n'en font pas partie : ils serviront aux
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
-- d'administration.
-- ---------------------------------------------------------------------------
CREATE TABLE utilisateur (
    id           INT UNSIGNED            NOT NULL AUTO_INCREMENT,
    email        VARCHAR(180)            NOT NULL,
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
INSERT INTO utilisateur (email, mot_de_passe, role) VALUES
    ('client@playstation.test', '$2y$12$lJPa0JrD2Rw0ET8.r/Xp2umTobri5omSesmplBIX4zUn8xO8oFT2K', 'client'),
    ('admin@playstation.test',  '$2y$12$1puRSW6uY8T6pxGogeWEw.H9ufh93afp.iNCoMHWoKjYw8jIC5CNy', 'admin');

-- ---------------------------------------------------------------------------
-- Commandes
--
-- numero : PS-AAAAMMJJ-NNNN, construit à partir de l'identifiant juste après
-- l'insertion (NULL le temps de la transaction, d'où une colonne NULL : une
-- clé UNIQUE accepte plusieurs NULL). statut suit le retrait en magasin.
-- total : somme des lignes, figée au moment de la commande.
-- ---------------------------------------------------------------------------
CREATE TABLE commande (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    numero         VARCHAR(20)   NULL,
    utilisateur_id INT UNSIGNED  NOT NULL,
    statut         ENUM('en_cours', 'disponible', 'retiree', 'annulee') NOT NULL DEFAULT 'en_cours',
    total          DECIMAL(10,2) NOT NULL,
    cree_le        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_commande_numero (numero),
    KEY idx_commande_utilisateur (utilisateur_id),
    KEY idx_commande_statut (statut),
    KEY idx_commande_date (cree_le),

    CONSTRAINT fk_commande_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Lignes de commande
--
-- Le nom, le coloris et le prix unitaire sont recopiés au moment de la
-- commande : un changement de prix ou de nom ultérieur ne modifie pas une
-- commande passée. variante_id passe à NULL si la variante est supprimée.
-- ---------------------------------------------------------------------------
CREATE TABLE ligne_commande (
    id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    commande_id   INT UNSIGNED      NOT NULL,
    variante_id   INT UNSIGNED      NULL,
    nom           VARCHAR(120)      NOT NULL,
    coloris       VARCHAR(40)       NULL,
    prix_unitaire DECIMAL(8,2)      NOT NULL,
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
