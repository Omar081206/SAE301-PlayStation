#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test de la gestion des catégories du back-office (GOF-c), contre l'API.
#
# Usage : tests/categories.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : sql/import.sql importé (compte admin, catégories 1 à 4).
# Le test ÉCRIT en base (identifiants lus dans back/config/config.php) : il
# crée deux catégories de test, y place deux produits de « Jeux » (en SQL, la
# gestion des produits n'existant pas encore), puis supprime ces catégories en
# renvoyant les produits dans « Jeux ». Les catégories et les produits
# d'origine sont rendus tels quels ; seuls les auto-incréments avancent.
# Outils : curl, mysql, php et python3, aucune dépendance à installer.
# ---------------------------------------------------------------------------
set -u

BASE="${1:-http://localhost:8099/~hadj-zekri1/SAE301}/api"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"

lire_config() {
  php -r '$c = require $argv[1]; echo $c["bdd"][$argv[2]];' "$RACINE/back/config/config.php" "$1"
}
MYSQL=(mysql -N -h "$(lire_config hote)" -P "$(lire_config port)" -u "$(lire_config utilisateur)" -p"$(lire_config motdepasse)" "$(lire_config base)")
sql() { "${MYSQL[@]}" -e "$1" 2> /dev/null; }
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
# Nombre de produits d'une catégorie, lu dans GET /admin/categories.
nombre() {
  python3 -c 'import json,sys
for c in json.loads(sys.argv[1])["categories"]:
    if c["id"] == int(sys.argv[2]): print(c["nombre"])' "$(api GET admin/categories | cut -f2)" "$1"
}

echo "1. Sans session d'administration, tout est refusé"
IFS=$'\t' read -r code corps <<< "$(api GET admin/categories)"
verifier "GET /admin/categories" "$code" "403"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"Test","description":"Test"}')"
verifier "POST /admin/categorie/creer" "$code" "403"
api POST login '{"email":"client@playstation.test","mdp":"client1234"}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api GET admin/categories)"
verifier "session client" "$code" "403"
api POST logout '{}' > /dev/null
api POST admin/login '{"email":"admin@playstation.test","mdp":"admin1234"}' > /dev/null

echo "2. Liste"
IFS=$'\t' read -r code corps <<< "$(api GET admin/categories)"
verifier "GET /admin/categories" "$code" "200"
verifier "nombre de produits de « Jeux »" "$(nombre 4)" "4"
JEUX_AVANT="$(nombre 4)"

echo "3. Création, slug déduit du nom"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"  Éditions Collector & Rétro ","description":"Catégorie de test"}')"
verifier "POST /admin/categorie/creer" "$code" "201"
verifier "nom nettoyé" "$(champ "$corps" categorie.nom)" "Éditions Collector & Rétro"
verifier "slug" "$(champ "$corps" categorie.slug)" "editions-collector-retro"
A="$(champ "$corps" categorie.id)"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"Test GOF-c B","description":"Catégorie de test"}')"
B_ID="$(champ "$corps" categorie.id)"

echo "4. Validation"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"x","description":"Test"}')"
verifier "nom trop court" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"***","description":"Test"}')"
verifier "nom sans lettre" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"Nouvelle","description":"   "}')"
verifier "description vide" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"MANETTES","description":"Test"}')"
verifier "nom déjà pris (casse ignorée)" "$code" "409"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/creer '{"nom":"Éditions collector rétro","description":"Test"}')"
verifier "slug déjà pris" "$code" "409"

echo "5. Modification"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/modifier "{\"id\":$A,\"nom\":\"Test GOF-c A\",\"description\":\"Modifiée\"}")"
verifier "POST /admin/categorie/modifier" "$code" "200"
verifier "nouveau slug" "$(champ "$corps" categorie.slug)" "test-gof-c-a"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/modifier "{\"id\":$A,\"nom\":\"Test GOF-c A\",\"description\":\"Même nom\"}")"
verifier "garder son propre nom" "$code" "200"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/modifier "{\"id\":$A,\"nom\":\"Jeux\",\"description\":\"Test\"}")"
verifier "prendre le nom d'une autre" "$code" "409"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/modifier '{"id":250,"nom":"Inconnue","description":"Test"}')"
verifier "catégorie inexistante" "$code" "404"

echo "6. Suppression avec réaffectation"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/supprimer '{"id":4,"destination":null}')"
verifier "catégorie non vide sans destination" "$code" "409"
verifier "rien n'a bougé" "$(nombre 4)" "$JEUX_AVANT"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/supprimer '{"id":4,"destination":4}')"
verifier "destination = elle-même" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/supprimer '{"id":4,"destination":250}')"
verifier "destination inexistante" "$code" "422"
# Deux produits de « Jeux » sont placés dans A, puis A est supprimée en les
# renvoyant dans « Jeux ».
DEPLACES="$(sql "SELECT GROUP_CONCAT(id ORDER BY id) FROM (SELECT id FROM produit WHERE categorie_id = 4 ORDER BY id LIMIT 2) p")"
sql "UPDATE produit SET categorie_id = $A WHERE id IN ($DEPLACES)"
verifier "deux produits placés dans A" "$(nombre "$A")" "2"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/supprimer "{\"id\":$A,\"destination\":null}")"
verifier "A non vide, sans destination" "$code" "409"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/supprimer "{\"id\":$A,\"destination\":4}")"
verifier "A supprimée avec réaffectation" "$code" "200"
verifier "produits déplacés" "$(champ "$corps" deplaces)" "2"
verifier "« Jeux » retrouve ses produits" "$(nombre 4)" "$JEUX_AVANT"
verifier "les mêmes produits" "$(sql "SELECT GROUP_CONCAT(id ORDER BY id) FROM produit WHERE id IN ($DEPLACES) AND categorie_id = 4")" "$DEPLACES"
IFS=$'\t' read -r code corps <<< "$(api POST admin/categorie/supprimer "{\"id\":$B_ID,\"destination\":null}")"
verifier "catégorie vide supprimée sans destination" "$code" "200"
verifier "aucun produit déplacé" "$(champ "$corps" deplaces)" "0"
verifier "plus aucune catégorie de test" "$(sql "SELECT COUNT(*) FROM categorie WHERE id IN ($A, $B_ID)")" "0"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
