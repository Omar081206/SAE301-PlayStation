# Maquettes Figma → user stories

Fichier : <https://www.figma.com/design/Kf8f0uZp5iU3VRt0FCPgcw/SA%C3%A9-3.01---Maquettes-PlayStation>
(`fileKey` = `Kf8f0uZp5iU3VRt0FCPgcw`, page unique « Maquettes · Site client »).

Chaque écran existe en 3 formats : Mobile 375, Tablette 768, Desktop 1440.
Un `nodeId` s'écrit `8:51` pour le MCP (`8-51` dans l'URL).
Le cadre « Composants » (`80:2214`) contient Header, Footer, Card produit, Filtre catégorie… :
c'est la source des composants `front/src/ui/`.

| Écran | US concernées | Mobile 375 | Tablette 768 | Desktop 1440 |
|---|---|---|---|---|
| A · Catalogue | DEC-b | `8:179` | `26:601` | `8:51` |
| B · Catégorie Manettes | DEC-a | `8:303` | `26:714` | `8:244` |
| C · Fiche produit | DEC-c | `12:234` | `26:801` | `10:220` |
| D · Panier | CMD-b | `28:844` | `28:946` | `28:739` |
| E · Connexion / Inscription | CMD-c | `29:1032` (connexion), `29:1073` (inscription) | `64:1023`, `64:1060` | `29:972` |
| F · Récapitulatif | CMD-a | `29:1207` | `64:1094` | `29:1116` |
| G · Confirmation | CMD-a | `29:1341` | `64:1139` | `29:1292` |
| H · Espace personnel | SUI-b | `30:845` | `64:1397` | `30:739` |
| I · Mon profil | SUI-b | `30:961` | `64:1446` | `30:898` |
| J · Historique des commandes | SUI-c | `30:1158` | `64:1497` | `30:1017` |
| K · Détail d'une commande | SUI-c | `30:1314` | `64:1581` | `30:1243` |
| K2 · Commande renouvelée | SUI-a | `120:2417` | `120:2327` | `120:2231` |
| Menu | navigation (header) | `64:2630` | `64:2653` | — |
| L · Connexion administrateur | GOF-b | `33:1199` | `64:1961` | `31:739` |
| M · Tableau de bord | GOF-b | `33:1213` | `64:1975` | `31:759` |
| Menu admin | navigation (back-office) | `64:2676` | `64:2700` | — (barre latérale `80:2152`) |
| N · Commandes | PIL-b | `33:1264` | `64:1991` | `31:874` |
| N · Commandes — Modale d’annulation | PIL-b | `152:2674` | `152:2608` | `31:1070` |
| O · Détail commande | PIL-b | `152:2079` | `64:2047` | `31:1279` |
| P · Produits | GOF-a | `152:2175` | `64:2150` | `32:894` |
| P · Produits — Modale de suppression | GOF-a | `152:2848` | `152:2740` | `36:1646` |
| Q · Formulaire produit | GOF-a | `152:2287` | `64:2269` | `32:1078` |
| R · Catégories | GOF-c | `152:2401` | `64:2394` | `32:1237` |
| R · Catégories — Modale de suppression | GOF-c | `152:3032` | `152:2959` | `32:1338` |
| S · Statistiques | PIL-a | `152:2461` | `64:2473` | `32:1454` |

Back-office : section `29:1396` (écrans L à S). Aucune maquette pour : STK-a/b/c, OPT-a/b/c, PRO-a/b/c.
Pour ces US, l'agent s'appuie sur les composants du cadre « Composants » et **demande** à l'utilisateur
(plutôt que d'inventer un écran) quand un écran manque.

> Correspondance écran → US établie à partir des noms des cadres : à corriger ici si elle est fausse.
