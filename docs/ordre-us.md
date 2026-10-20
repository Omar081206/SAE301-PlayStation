# Ordre de réalisation des US

Source : graphe FigJam du projet (<https://www.figma.com/board/degJIK32MAEBn88tAUN3sC/graphe>).
Une US est **terminée** quand sa branche `us/<us>-<nom>` est fusionnée dans `main` (`git branch --merged main`).

| N° | US | N° | US | N° | US |
|---|---|---|---|---|---|
| 1 | DEC-b | 9 | GOF-b | 17 | OPT-a |
| 2 | DEC-a | 10 | STK-a | 18 | GOF-c |
| 3 | DEC-c | 11 | PIL-b | 19 | GOF-a |
| 4 | CMD-b | 12 | SUI-b | 20 | PIL-a |
| 5 | CMD-c | 13 | SUI-c | 21 | PRO-b (si le temps le permet) |
| 6 | CMD-a | 14 | SUI-a | 22 | PRO-a |
| 7 | STK-b | 15 | OPT-c | 23 | PRO-c |
| 8 | STK-c | 16 | OPT-b | | |

- STK-a et PIL-b sont livrées ensemble.
- Une US dépend des US qui la précèdent dans son epic et de celles qui fournissent ses données
  (une commande suppose panier et comptes, la gestion admin suppose GOF-b). En cas de doute, demander.
- Si le temps manque, on coupe dans cet ordre : Promotions, puis PIL-a, puis GOF-a et GOF-c.
