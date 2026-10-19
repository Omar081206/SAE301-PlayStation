#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tests des stocks, contre l'API, sans rien écrire en base :
#   - affichage de l'état du stock (STK-b) ;
#   - contraintes de stock dans le panier et à la commande (STK-c).
#
# Usage : tests/stock.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : jeu de données de sql/import.sql (stocks et seuil de 3, compte
# client@playstation.test). La commande testée est refusée : aucune n'est créée.
# Outils : curl et python3, aucune dépendance à installer.
# ---------------------------------------------------------------------------
set -u

BASE="${1:-http://localhost:8099/~hadj-zekri1/SAE301}/api"
COOKIES="$(mktemp)"
trap 'rm -f "$COOKIES"' EXIT
ECHECS=0

# Corps JSON d'une requête GET.
api() {
  local options=(-s)
  [ -n "${CURL_AUTH:-}" ] && options+=(-u "$CURL_AUTH")
  curl "${options[@]}" "$BASE/$1"
}

# Requête POST avec un corps JSON et la session : affiche « code<TAB>corps ».
poster() {
  local options=(-s -b "$COOKIES" -c "$COOKIES" -X POST -H "Content-Type: application/json" -d "$2" -w '\t%{http_code}')
  [ -n "${CURL_AUTH:-}" ] && options+=(-u "$CURL_AUTH")
  local reponse
  reponse="$(curl "${options[@]}" "$BASE/$1" | tr -d '\n')"
  printf '%s\t%s' "${reponse##*$'\t'}" "${reponse%$'\t'*}"
}

# Évalue une expression Python sur le JSON (variable d).
lire() {
  python3 -c 'import json,sys
d=json.loads(sys.argv[1])
print(eval(sys.argv[2]))' "$1" "$2"
}

verifier() {
  if [ "$2" = "$3" ]; then
    echo "  ok      $1"
  else
    echo "  ÉCHEC   $1 : attendu « $3 », obtenu « $2 »"
    ECHECS=$((ECHECS + 1))
  fi
}

etat() {
  lire "$CATALOGUE" "next(p['etat_stock'] for p in d['produits'] if p['slug']=='$1')"
}

echo "1. Catalogue : un état par produit (variante par défaut)"
CATALOGUE="$(api produits)"
verifier "Console PS5 (stock 12)"              "$(etat console-ps5)"        "en_stock"
verifier "PlayStation Portal blanche (stock 2)" "$(etat playstation-portal)" "bientot_epuise"
verifier "DualSense Edge blanche (stock 3 = seuil)" "$(etat dualsense-edge)" "bientot_epuise"
verifier "PS5 Pro (stock 0)"                   "$(etat ps5-pro)"            "epuise"
verifier "aucune quantité envoyée"             "$(lire "$CATALOGUE" "any('stock' in p for p in d['produits'])")" "False"

echo "2. Fiche : un état par variante"
FICHE="$(api 'produit?slug=ecouteurs-pulse-explore')"
verifier "Écouteurs blancs (stock 7)" "$(lire "$FICHE" "d['produit']['variantes'][0]['etat_stock']")" "en_stock"
verifier "Écouteurs noirs (stock 0)"  "$(lire "$FICHE" "d['produit']['variantes'][1]['etat_stock']")" "epuise"
verifier "badge principal = variante par défaut" "$(lire "$FICHE" "d['produit']['etat_stock']")" "en_stock"
verifier "aucune quantité envoyée" "$(lire "$FICHE" "any('stock' in v for v in d['produit']['variantes'])")" "False"

echo "3. Panier : quantités ramenées au stock (STK-c)"
IFS=$'\t' read -r code PANIER <<< "$(poster panier '{"lignes":[{"variantId":4,"quantite":5},{"variantId":21,"quantite":1},{"variantId":1,"quantite":2}]}')"
verifier "réponse" "$code" "200"
verifier "Portal blanche : 5 demandées, 2 accordées" "$(lire "$PANIER" "[l['quantite'] for l in d['lignes'] if l['variantId']==4][0]")" "2"
verifier "quantité maximale = stock" "$(lire "$PANIER" "[l['quantiteMax'] for l in d['lignes'] if l['variantId']==4][0]")" "2"
verifier "écouteurs noirs épuisés : ligne retirée" "$(lire "$PANIER" "any(l['variantId']==21 for l in d['lignes'])")" "False"
verifier "deux ajustements annoncés" "$(lire "$PANIER" "[(a['variantId'],a['accordee']) for a in d['ajustements']]")" "[(4, 2), (21, 0)]"
verifier "ligne dans le stock non modifiée" "$(lire "$PANIER" "[l['quantite'] for l in d['lignes'] if l['variantId']==1][0]")" "2"
verifier "total recalculé (2 × 219,99 + 2 × 549,99)" "$(lire "$PANIER" "d['total']")" "1539.96"

echo "4. Commande au-delà du stock refusée (STK-c)"
poster login '{"identifiant":"client@playstation.test","mdp":"client1234"}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(poster commande '{"lignes":[{"variantId":4,"quantite":5}]}')"
verifier "POST /commande Portal × 5 (stock 2)" "$code" "409"
IFS=$'\t' read -r code corps <<< "$(poster commande '{"lignes":[{"variantId":21,"quantite":1}]}')"
verifier "POST /commande variante épuisée" "$code" "409"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
