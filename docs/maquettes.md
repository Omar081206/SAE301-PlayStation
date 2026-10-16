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

Aucune maquette pour : STK-a/b/c, OPT-a/b/c, GOF-a/b/c, PIL-a/b, PRO-a/b/c.
Pour ces US, l'agent s'appuie sur les composants du cadre « Composants » et **demande** à l'utilisateur
(plutôt que d'inventer un écran) quand un écran manque.

> Correspondance écran → US établie à partir des noms des cadres : à corriger ici si elle est fausse.
