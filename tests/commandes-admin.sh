#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test de la gestion des commandes du back-office (PIL-b), contre l'API.
#
# Usage : tests/commandes-admin.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : sql/import.sql importé (comptes client et admin, variantes 5 et
# 17). Le test ÉCRIT en base (identifiants lus dans back/config/config.php) :
# il crée trois commandes pour le client de test, les fait changer de statut,
# puis annule celles qui peuvent l'être ; le stock pris par la commande
# retirée est rendu en SQL à la fin. Le stock des variantes 5 et 17 est
# vérifié identique avant et après.
# Outils : curl, mysql, php et python3, aucune dépendance à installer.
# ---------------------------------------------------------------------------
set -u

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${1:-http://localhost:8099/~hadj-zekri1/SAE301}/api"
COOKIES="$(mktemp)"

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
lire_config() {
  php -r '$c = require $argv[1]; echo $c["bdd"][$argv[2]];' "$RACINE/back/config/config.php" "$1"
}
MYSQL=(mysql -N -h "$(lire_config hote)" -P "$(lire_config port)" -u "$(lire_config utilisateur)" -p"$(lire_config motdepasse)" "$(lire_config base)")
sql() { "${MYSQL[@]}" -e "$1" 2> /dev/null; }
stock() { sql "SELECT stock FROM variante WHERE id = $1"; }

# Le client et l'administrateur ont chacun leur fichier de cookies.
COOKIES_ADMIN="$(mktemp)"
trap 'rm -f "$COOKIES" "$COOKIES_ADMIN"' EXIT
admin() {
  local sauvegarde="$COOKIES"
  COOKIES="$COOKIES_ADMIN"
  api "$@"
  COOKIES="$sauvegarde"
}

STOCK5="$(stock 5)"
STOCK17="$(stock 17)"

echo "1. Sans session d'administration, tout est refusé"
IFS=$'\t' read -r code corps <<< "$(admin GET admin/commandes)"
verifier "GET /admin/commandes" "$code" "403"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commandes/statut '{"numeros":["PS-x"],"statut":"annulee"}')"
verifier "POST /admin/commandes/statut" "$code" "403"

echo "2. Trois commandes du client de test"
api POST login '{"identifiant":"client","mdp":"client1234"}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api POST commande '{"lignes":[{"variantId":5,"quantite":1}]}')"
N1="$(champ "$corps" commande.numero)"
IFS=$'\t' read -r code corps <<< "$(api POST commande '{"lignes":[{"variantId":17,"quantite":2}]}')"
N2="$(champ "$corps" commande.numero)"
IFS=$'\t' read -r code corps <<< "$(api POST commande '{"lignes":[{"variantId":5,"quantite":1},{"variantId":17,"quantite":1}]}')"
N3="$(champ "$corps" commande.numero)"
verifier "trois commandes créées" "$([ -n "$N1" ] && [ -n "$N2" ] && [ -n "$N3" ] && echo oui)" "oui"
admin POST admin/login '{"identifiant":"admin","mdp":"admin1234"}' > /dev/null

echo "3. Liste et tris"
IFS=$'\t' read -r code corps <<< "$(admin GET admin/commandes)"
verifier "GET /admin/commandes" "$code" "200"
verifier "par défaut, la plus récente d'abord" "$(champ "$corps" commandes.0.numero)" "$N3"
verifier "client affiché" "$(champ "$corps" commandes.0.client)" "client"
verifier "nombre d'articles" "$(champ "$corps" commandes.0.articles)" "2"
IFS=$'\t' read -r code corps <<< "$(admin GET 'admin/commandes?tri=montant&sens=asc')"
verifier "tri par montant croissant" "$(python3 -c 'import json,sys
t=[c["total"] for c in json.loads(sys.argv[1])["commandes"]]
print(t == sorted(t))' "$corps")" "True"
IFS=$'\t' read -r code corps <<< "$(admin GET 'admin/commandes?tri=statut&sens=asc')"
verifier "tri par statut (ordre du retrait)" "$(python3 -c 'import json,sys
o=["en_cours","disponible","retiree","annulee"]
t=[o.index(c["statut"]) for c in json.loads(sys.argv[1])["commandes"]]
print(t == sorted(t))' "$corps")" "True"
IFS=$'\t' read -r code corps <<< "$(admin GET 'admin/commandes?tri=prix')"
verifier "tri inconnu refusé" "$code" "400"

echo "4. En cours → disponible → retirée, sans toucher au stock"
APRES_COMMANDES="$(stock 5)"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commande/statut "{\"numero\":\"$N1\",\"statut\":\"retiree\"}")"
verifier "en cours → retirée directement refusé" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commande/statut "{\"numero\":\"$N1\",\"statut\":\"disponible\"}")"
verifier "en cours → disponible" "$code" "200"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commande/statut "{\"numero\":\"$N1\",\"statut\":\"retiree\"}")"
verifier "disponible → retirée" "$code" "200"
verifier "stock inchangé" "$(stock 5)" "$APRES_COMMANDES"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commande/statut "{\"numero\":\"$N1\",\"statut\":\"annulee\"}")"
verifier "une commande retirée ne s'annule pas" "$code" "422"

echo "5. Détail et journal des administrateurs"
IFS=$'\t' read -r code corps <<< "$(admin GET "admin/commande?numero=$N1")"
verifier "GET /admin/commande" "$code" "200"
verifier "client" "$(champ "$corps" commande.client.email)" "client@playstation.test"
verifier "deux changements au journal" "$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["commande"]["historique"]))' "$corps")" "2"
verifier "premier changement" "$(champ "$corps" commande.historique.0.ancien) → $(champ "$corps" commande.historique.0.nouveau) par $(champ "$corps" commande.historique.0.par)" "en_cours → disponible par admin"
verifier "plus aucun statut possible" "$(champ "$corps" commande.suivants)" "[]"
IFS=$'\t' read -r code corps <<< "$(admin GET "admin/commande?numero=$N2")"
verifier "statuts possibles depuis « en cours »" "$(champ "$corps" commande.suivants)" "['disponible', 'annulee']"
IFS=$'\t' read -r code corps <<< "$(admin GET "admin/commande?numero=PS-00000000-0000")"
verifier "commande inconnue" "$code" "404"

echo "6. Annulation en lot, une par une"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commandes/statut "{\"numeros\":[\"$N1\",\"$N2\",\"$N3\",\"$N3\"],\"statut\":\"annulee\"}")"
verifier "POST /admin/commandes/statut" "$code" "200"
verifier "deux commandes annulées (doublon ignoré)" "$(champ "$corps" changees)" "2"
verifier "la commande retirée est refusée" "$(champ "$corps" resultats.0.numero) $(champ "$corps" resultats.0.change)" "$N1 False"
verifier "stock de la variante 17 rendu" "$(stock 17)" "$STOCK17"
verifier "journal : annulation en lot" "$(sql "SELECT COUNT(*) FROM journal_admin j JOIN commande c ON c.id = j.commande_id WHERE c.numero IN ('$N2','$N3') AND j.nouveau_statut = 'annulee'")" "2"
IFS=$'\t' read -r code corps <<< "$(admin POST admin/commandes/statut '{"numeros":[],"statut":"annulee"}')"
verifier "lot vide refusé" "$code" "422"

echo "7. Remise en état : le stock pris par la commande retirée est rendu"
sql "UPDATE variante SET stock = stock + 1 WHERE id = 5"
verifier "stock de la variante 5 d'origine" "$(stock 5)" "$STOCK5"
verifier "stock de la variante 17 d'origine" "$(stock 17)" "$STOCK17"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
