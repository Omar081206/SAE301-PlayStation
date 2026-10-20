# Maquettes Figma

Fichier : <https://www.figma.com/design/Kf8f0uZp5iU3VRt0FCPgcw/SA%C3%A9-3.01---Maquettes-PlayStation>
(`fileKey` = `Kf8f0uZp5iU3VRt0FCPgcw`).

La maquette évolue : aucun `nodeId` d'écran n'est recopié ici. On les lit dans Figma au moment d'implémenter.

## Organisation du fichier

- Chaque écran existe en 3 formats : **Mobile 375**, **Tablette 768**, **Desktop 1440**. Les cadres sont nommés
  « <lettre> · <écran> » (par exemple « A · Catalogue »), suivis du format.
- Le cadre **« Composants »** contient les blocs réutilisables (Header, Footer, Card produit, Filtre catégorie…) :
  c'est la source des composants `front/src/ui/` (un bloc = un dossier).
- Une section regroupe les écrans du **back-office** (connexion administrateur, tableau de bord, commandes,
  produits, catégories, statistiques), modales comprises.
- Un `nodeId` s'écrit `8:51` pour le MCP (`8-51` dans l'URL).

## Retrouver l'écran d'une US

1. Lien Figma donné dans la demande → en extraire le `nodeId`.
2. Sinon, `get_metadata` sur le fichier (ou la section back-office) pour lister les cadres, puis choisir ceux dont
   le nom correspond à l'écran de l'US (mots de l'US, nom de la page), aux trois formats.
3. Confirmer par `get_screenshot` que c'est le bon écran avant de lire `get_design_context`.
4. Aucun cadre ne correspond, ou plusieurs se disputent l'US : **demander** plutôt qu'inventer un écran.
   Une US sans écran s'appuie sur les blocs du cadre « Composants » et sur les écrans voisins ; le plan le signale.
