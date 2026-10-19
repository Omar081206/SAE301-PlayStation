#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test de bout en bout du processus de commande (CMD-a), contre l'API.
#
# Usage : tests/commande.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : sql/import.sql importé (comptes de test, variantes 5 et 17).
# Le test crée deux commandes pour client@playstation.test, puis les annule
# (compte admin) : le stock qu'elles avaient pris est rendu.
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

echo "1. Sans connexion, la commande est refusée"
IFS=$'\t' read -r code corps <<< "$(api POST commande "$PANIER")"
verifier "POST /commande non connecté" "$code" "403"

echo "2. Connexion du client de test"
IFS=$'\t' read -r code corps <<< "$(api POST login '{"email":"client@playstation.test","mdp":"client1234"}')"
verifier "POST /login" "$code" "200"

echo "3. Panier vide refusé"
IFS=$'\t' read -r code corps <<< "$(api POST commande '{"lignes":[]}')"
verifier "POST /commande panier vide" "$code" "422"

echo "4. Commande enregistrée, prix relus en base (le prix envoyé est ignoré)"
IFS=$'\t' read -r code corps <<< "$(api POST commande '{"lignes":[{"variantId":5,"quantite":2,"prix":0.01},{"variantId":17,"quantite":1}]}')"
verifier "POST /commande" "$code" "201"
NUMERO1="$(champ "$corps" commande.numero)"
verifier "format du numéro" "$(echo "$NUMERO1" | grep -Ec '^PS-[0-9]{8}-[0-9]{4,}$')" "1"
verifier "statut" "$(champ "$corps" commande.statut)" "en_cours"
verifier "total (2 × 74,99 + 74,99)" "$(champ "$corps" commande.total)" "224.97"
verifier "prix unitaire figé" "$(champ "$corps" commande.lignes.0.prix_unitaire)" "74.99"
verifier "options recopiées" "$(champ "$corps" commande.lignes.1.options)" "Coloris : Noir"

echo "5. La commande se relit"
IFS=$'\t' read -r code corps <<< "$(api GET "commande?numero=$NUMERO1")"
verifier "GET /commande" "$code" "200"
verifier "même numéro" "$(champ "$corps" commande.numero)" "$NUMERO1"

echo "6. Une deuxième commande reçoit un autre numéro"
IFS=$'\t' read -r code corps <<< "$(api POST commande "$PANIER")"
NUMERO2="$(champ "$corps" commande.numero)"
verifier "numéros différents" "$([ "$NUMERO1" != "$NUMERO2" ] && echo oui)" "oui"

echo "7. Séparation client / administrateur"
IFS=$'\t' read -r code corps <<< "$(api POST login '{"email":"admin@playstation.test","mdp":"admin1234"}')"
verifier "un compte admin ne se connecte pas côté boutique" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST admin/commande/statut "{\"numero\":\"$NUMERO1\",\"statut\":\"annulee\"}")"
verifier "une session client n'a pas accès à l'administration" "$code" "403"
api POST logout '{}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api GET "commande?numero=$NUMERO1")"
verifier "GET /commande après déconnexion" "$code" "403"
IFS=$'\t' read -r code corps <<< "$(api POST admin/login '{"email":"admin@playstation.test","mdp":"admin1234"}')"
verifier "connexion au back-office" "$code" "200"
IFS=$'\t' read -r code corps <<< "$(api GET "commande?numero=$NUMERO1")"
verifier "une session admin ne voit pas les commandes côté client" "$code" "403"

echo "8. Remise en état : annulation des deux commandes (stock rendu)"
for n in "$NUMERO1" "$NUMERO2"; do
  IFS=$'\t' read -r code corps <<< "$(api POST admin/commande/statut "{\"numero\":\"$n\",\"statut\":\"annulee\"}")"
  verifier "annulation de $n" "$code" "200"
done

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
