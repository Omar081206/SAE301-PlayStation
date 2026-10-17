#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test de l'affichage des stocks (STK-b), contre l'API, en lecture seule.
#
# Usage : tests/stock.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : jeu de données de sql/import.sql (stocks et seuil de 3).
# Outils : curl et python3, aucune dépendance à installer.
# ---------------------------------------------------------------------------
set -u

BASE="${1:-http://localhost:8099/~hadj-zekri1/SAE301}/api"
ECHECS=0

# Corps JSON d'une requête GET.
api() {
  local options=(-s)
  [ -n "${CURL_AUTH:-}" ] && options+=(-u "$CURL_AUTH")
  curl "${options[@]}" "$BASE/$1"
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

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
