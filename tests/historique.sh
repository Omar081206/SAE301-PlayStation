#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test de l'historique des commandes du client (SUI-c, SUI-a), contre l'API.
#
# Usage : tests/historique.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : sql/import.sql importé (comptes client et admin, variante 17).
# Le test crée 11 commandes pour le client de test (pagination par 10), puis
# les annule avec le compte admin : le stock qu'elles avaient pris est rendu.
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
# Le client et l'administrateur ont chacun leur fichier de cookies.
COOKIES_ADMIN="$(mktemp)"
trap 'rm -f "$COOKIES" "$COOKIES_ADMIN"' EXIT
admin() {
  local sauvegarde="$COOKIES"
  COOKIES="$COOKIES_ADMIN"
  api "$@"
  COOKIES="$sauvegarde"
}
compter() { python3 -c 'import json,sys; print(json.loads(sys.argv[1])["compteurs"][sys.argv[2]])' "$1" "$2"; }

echo "1. Sans connexion, l'historique est refusé"
IFS=$'\t' read -r code corps <<< "$(api GET compte/commandes)"
verifier "GET /compte/commandes" "$code" "403"

api POST login '{"email":"client@playstation.test","mdp":"client1234"}' > /dev/null
admin POST admin/login '{"email":"admin@playstation.test","mdp":"admin1234"}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api GET 'compte/commandes?periode=tout')"
EN_COURS_AVANT="$(compter "$corps" en_cours)"

echo "2. Onze commandes, la plus récente en tête"
NUMEROS=()
for i in $(seq 1 11); do
  IFS=$'\t' read -r code corps <<< "$(api POST commande '{"lignes":[{"variantId":17,"quantite":1}]}')"
  NUMEROS+=("$(champ "$corps" commande.numero)")
done
verifier "onze commandes créées" "${#NUMEROS[@]}" "11"
IFS=$'\t' read -r code corps <<< "$(api GET compte/commandes)"
verifier "GET /compte/commandes" "$code" "200"
verifier "la plus récente d'abord" "$(champ "$corps" commandes.0.numero)" "${NUMEROS[10]}"
verifier "10 commandes par page" "$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["commandes"]))' "$corps")" "10"
verifier "compteur « en cours »" "$(compter "$corps" en_cours)" "$((EN_COURS_AVANT + 11))"

echo "3. Filtres et pagination"
IFS=$'\t' read -r code corps <<< "$(api GET 'compte/commandes?statut=en_cours&periode=30j&page=2')"
verifier "page 2 des commandes en cours" "$(champ "$corps" page)" "2"
verifier "dates décroissantes" "$(python3 -c 'import json,sys
d=[c["cree_le"] for c in json.loads(sys.argv[1])["commandes"]]
print(d == sorted(d, reverse=True))' "$corps")" "True"
verifier "seulement des commandes en cours" "$(python3 -c 'import json,sys; print({c["statut"] for c in json.loads(sys.argv[1])["commandes"]} <= {"en_cours"})' "$corps")" "True"
IFS=$'\t' read -r code corps <<< "$(api GET 'compte/commandes?statut=perdue')"
verifier "statut inconnu refusé" "$code" "400"
IFS=$'\t' read -r code corps <<< "$(api GET 'compte/commandes?periode=2ans')"
verifier "période inconnue refusée" "$code" "400"
IFS=$'\t' read -r code corps <<< "$(api GET 'compte/commandes?page=0')"
verifier "page 0 refusée" "$code" "400"

echo "4. Détail : options visibles, commandes des autres refusées"
IFS=$'\t' read -r code corps <<< "$(api GET "commande?numero=${NUMEROS[0]}")"
verifier "GET /commande d'une de ses commandes" "$code" "200"
verifier "coloris de la ligne" "$(champ "$corps" commande.lignes.0.coloris)" "Noir"
verifier "variante de la ligne (commander à nouveau)" "$(champ "$corps" commande.lignes.0.variantId)" "17"
IFS=$'\t' read -r code corps <<< "$(admin GET 'admin/commandes')"
AUTRE="$(python3 -c 'import json,sys
for c in json.loads(sys.argv[1])["commandes"]:
    if c["client"] != "Nathan Drake": print(c["numero"]); break' "$corps")"
if [ -n "$AUTRE" ]; then
  IFS=$'\t' read -r code corps <<< "$(api GET "commande?numero=$AUTRE")"
  verifier "commande d'un autre client" "$code" "404"
fi

echo "5. Remise en état : annulation des onze commandes (stock rendu)"
LISTE="$(printf '"%s",' "${NUMEROS[@]}")"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commandes/statut "{\"numeros\":[${LISTE%,}],\"statut\":\"annulee\"}")"
verifier "onze commandes annulées" "$(champ "$corps" changees)" "11"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
