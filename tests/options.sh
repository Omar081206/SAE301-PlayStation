#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test des options de produit (OPT-c), contre l'API. Lecture seule.
#
# Usage : tests/options.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : sql/import.sql importé (DualSense en blanc et en noir, Astro Bot
# sans option).
# Outils : curl et python3 (lecture du JSON), aucune dépendance à installer.
# ---------------------------------------------------------------------------
set -u

BASE="${1:-http://localhost:8099/~hadj-zekri1/SAE301}/api"
COOKIES="$(mktemp)"
trap 'rm -f "$COOKIES"' EXIT

ECHECS=0

# Appel à l'API : méthode, chemin, corps JSON (facultatif).
# Affiche « code<TAB>corps ».
api() {
  local options=(-s -b "$COOKIES" -c "$COOKIES" -X "$1" -H "Content-Type: application/json" -w '\t%{http_code}')
  [ -n "${CURL_AUTH:-}" ] && options+=(-u "$CURL_AUTH")
  [ $# -ge 3 ] && options+=(-d "$3")
  local reponse
  # Le JSON de l'API est indenté sur plusieurs lignes : on le remet sur une
  # seule, pour que « read » le lise en entier.
  reponse="$(curl "${options[@]}" "$BASE/$2" | tr -d '\n')"
  printf '%s\t%s' "${reponse##*$'\t'}" "${reponse%$'\t'*}"
}

# Valeur d'un chemin dans un JSON, par exemple « commande.numero ».
champ() {
  python3 -c 'import json,sys
v=json.loads(sys.argv[1])
for c in sys.argv[2].split("."):
    v=v[int(c)] if c.isdigit() else v[c]
print(v)' "$1" "$2"
}

verifier() {
  if [ "$2" = "$3" ]; then
    echo "  ok      $1"
  else
    echo "  ÉCHEC   $1 : attendu « $3 », obtenu « $2 »"
    ECHECS=$((ECHECS + 1))
  fi
}

PANIER='{"lignes":[{"variantId":5,"quantite":2},{"variantId":17,"quantite":1}]}'
# Évalue une expression Python sur le JSON (variable d).
lire() { python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(eval(sys.argv[2]))' "$1" "$2"; }

echo "1. Produit à options : la DualSense"
IFS=$'\t' read -r code corps <<< "$(api GET 'produit?slug=manette-sans-fil-dualsense')"
verifier "GET /produit" "$code" "200"
verifier "option « Coloris »" "$(lire "$corps" "[o['nom'] for o in d['produit']['options']]")" "['Coloris']"
verifier "valeurs dans l'ordre" "$(lire "$corps" "[v['valeur'] for v in d['produit']['options'][0]['valeurs']]")" "['Blanc', 'Noir']"
verifier "une valeur par variante" "$(lire "$corps" "all(len(v['valeurs']) == 1 for v in d['produit']['variantes'])")" "True"
verifier "images propres au noir" "$(lire "$corps" "[v['images'][0]['fichier'] for v in d['produit']['variantes']]")" "['manette-sans-fil-dualsense.webp', 'manette-sans-fil-dualsense-noir.webp']"
verifier "prix et état par variante" "$(lire "$corps" "all('prix' in v and 'etat_stock' in v and 'stock' not in v for v in d['produit']['variantes'])")" "True"

echo "2. Produit sans option : Astro Bot"
IFS=$'\t' read -r code corps <<< "$(api GET 'produit?slug=astro-bot')"
verifier "aucune option" "$(lire "$corps" "d['produit']['options']")" "[]"
verifier "une variante, sans valeur" "$(lire "$corps" "[v['valeurs'] for v in d['produit']['variantes']]")" "[[]]"

echo "3. Le panier décrit les options de chaque variante"
IFS=$'\t' read -r code corps <<< "$(api POST panier '{"lignes":[{"variantId":17,"quantite":1},{"variantId":13,"quantite":1}]}')"
verifier "variante noire" "$(lire "$corps" "[l['options'] for l in d['lignes'] if l['variantId'] == 17][0]")" "Coloris : Noir"
verifier "produit sans option" "$(lire "$corps" "[l['options'] for l in d['lignes'] if l['variantId'] == 13][0]")" "None"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
