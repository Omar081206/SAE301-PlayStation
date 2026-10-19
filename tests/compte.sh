#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test de la connexion par pseudo ou adresse e-mail, contre l'API.
#
# Usage : tests/compte.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : sql/import.sql importé (comptes de test client et admin).
# Lecture seule : les inscriptions testées sont toutes refusées, aucun compte
# n'est créé.
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
echo "1. Connexion client par pseudo, puis par adresse e-mail"
IFS=$'\t' read -r code corps <<< "$(api POST login '{"identifiant":"client","mdp":"client1234"}')"
verifier "POST /login par pseudo" "$code" "200"
verifier "pseudo renvoyé" "$(champ "$corps" pseudo)" "client"
IFS=$'\t' read -r code corps <<< "$(api GET session)"
verifier "pseudo en session" "$(champ "$corps" pseudo)" "client"
api POST logout '{}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api POST login '{"identifiant":"Client@PlayStation.test","mdp":"client1234"}')"
verifier "POST /login par adresse (casse ignorée)" "$code" "200"
verifier "pseudo renvoyé" "$(champ "$corps" pseudo)" "client"
api POST logout '{}' > /dev/null

echo "2. Refus, toujours avec le même message"
IFS=$'\t' read -r code corps <<< "$(api POST login '{"identifiant":"client","mdp":"mauvais"}')"
verifier "mauvais mot de passe" "$code" "422"
verifier "message" "$(champ "$corps" erreur)" "Identifiant ou mot de passe incorrect."
IFS=$'\t' read -r code corps <<< "$(api POST login '{"identifiant":"inconnu","mdp":"client1234"}')"
verifier "pseudo inconnu" "$code" "422"
verifier "même message" "$(champ "$corps" erreur)" "Identifiant ou mot de passe incorrect."
IFS=$'\t' read -r code corps <<< "$(api POST login '{"identifiant":"admin","mdp":"admin1234"}')"
verifier "compte admin refusé côté boutique" "$code" "422"

echo "3. Back-office : pseudo ou adresse, comptes admin seulement"
IFS=$'\t' read -r code corps <<< "$(api POST admin/login '{"identifiant":"client","mdp":"client1234"}')"
verifier "compte client refusé" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST admin/login '{"identifiant":"admin","mdp":"admin1234"}')"
verifier "POST /admin/login par pseudo" "$code" "200"
IFS=$'\t' read -r code corps <<< "$(api GET admin/session)"
verifier "pseudo en session admin" "$(champ "$corps" pseudo)" "admin"
api POST admin/logout '{}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api POST admin/login '{"identifiant":"admin@playstation.test","mdp":"admin1234"}')"
verifier "POST /admin/login par adresse" "$code" "200"
api POST admin/logout '{}' > /dev/null

echo "4. Inscription : pseudo obligatoire, bien formé et libre"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"email":"nouveau@playstation.test","mdp":"motdepasse1"}')"
verifier "sans pseudo" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"email":"nouveau@playstation.test","pseudo":"a@b","mdp":"motdepasse1"}')"
verifier "pseudo avec « @ »" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"email":"nouveau@playstation.test","pseudo":"ab","mdp":"motdepasse1"}')"
verifier "pseudo trop court" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"email":"nouveau@playstation.test","pseudo":"CLIENT","mdp":"motdepasse1"}')"
verifier "pseudo déjà pris (casse ignorée)" "$code" "409"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"email":"client@playstation.test","pseudo":"libre","mdp":"motdepasse1"}')"
verifier "adresse déjà prise" "$code" "409"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
