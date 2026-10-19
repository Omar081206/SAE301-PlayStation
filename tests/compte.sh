#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test des comptes (CMD-c, SUI-b), contre l'API : connexion par adresse
# e-mail, inscription (prénom, nom), espace personnel et profil.
#
# Usage : tests/compte.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Prérequis : sql/import.sql importé (comptes de test client et admin).
# Le test modifie le profil du client de test (prénom, adresse, mot de passe)
# puis le remet tel quel : Nathan Drake, client@playstation.test, client1234.
# Les inscriptions testées sont toutes refusées : aucun compte n'est créé.
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
profil() { api POST compte/profil "$1"; }

echo "1. Connexion par adresse e-mail"
IFS=$'\t' read -r code corps <<< "$(api GET compte)"
verifier "espace personnel sans connexion" "$code" "403"
IFS=$'\t' read -r code corps <<< "$(api POST login '{"email":"Client@PlayStation.test","mdp":"client1234"}')"
verifier "POST /login (casse ignorée)" "$code" "200"
verifier "prénom et nom renvoyés" "$(champ "$corps" prenom) $(champ "$corps" nom)" "Nathan Drake"
IFS=$'\t' read -r code corps <<< "$(api GET session)"
verifier "prénom en session" "$(champ "$corps" prenom)" "Nathan"
api POST logout '{}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api POST login '{"email":"client@playstation.test","mdp":"mauvais"}')"
verifier "mauvais mot de passe" "$code" "422"
verifier "message" "$(champ "$corps" erreur)" "Adresse e-mail ou mot de passe incorrect."
IFS=$'\t' read -r code corps <<< "$(api POST login '{"email":"admin@playstation.test","mdp":"admin1234"}')"
verifier "compte admin refusé côté boutique" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST admin/login '{"email":"admin@playstation.test","mdp":"admin1234"}')"
verifier "POST /admin/login" "$code" "200"
verifier "prénom de l'admin" "$(champ "$corps" prenom)" "Admin"
api POST admin/logout '{}' > /dev/null

echo "2. Inscription : prénom et nom obligatoires"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"nom":"Drake","email":"nouveau@playstation.test","mdp":"motdepasse1"}')"
verifier "sans prénom" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"prenom":"Elena","email":"nouveau@playstation.test","mdp":"motdepasse1"}')"
verifier "sans nom" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"prenom":"R2D2","nom":"Drake","email":"nouveau@playstation.test","mdp":"motdepasse1"}')"
verifier "prénom avec des chiffres" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(api POST inscription '{"prenom":"Élena","nom":"Fisher","email":"client@playstation.test","mdp":"motdepasse1"}')"
verifier "adresse déjà prise" "$code" "409"

echo "3. Espace personnel"
api POST login '{"email":"client@playstation.test","mdp":"client1234"}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api GET compte)"
verifier "GET /compte" "$code" "200"
verifier "profil" "$(champ "$corps" profil.prenom) $(champ "$corps" profil.nom) $(champ "$corps" profil.email)" "Nathan Drake client@playstation.test"
verifier "3 commandes au plus" "$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["commandes"]) <= 3)' "$corps")" "True"

echo "4. Profil : prénom et nom sans mot de passe"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Jean-Luc","nom":"D’Arc","email":"client@playstation.test"}')"
verifier "changer le prénom seul" "$code" "200"
verifier "session à jour" "$(champ "$corps" session.prenom)" "Jean-Luc"
IFS=$'\t' read -r code corps <<< "$(api GET session)"
verifier "GET /session à jour" "$(champ "$corps" prenom) $(champ "$corps" nom)" "Jean-Luc D’Arc"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"","nom":"Drake","email":"client@playstation.test"}')"
verifier "prénom vide refusé" "$code" "422"

echo "5. Profil : adresse et mot de passe exigent le mot de passe actuel"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Nathan","nom":"Drake","email":"autre@playstation.test"}')"
verifier "changer d'adresse sans mot de passe" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Nathan","nom":"Drake","email":"autre@playstation.test","mdpActuel":"mauvais"}')"
verifier "mauvais mot de passe actuel" "$code" "422"
verifier "message" "$(champ "$corps" erreur)" "Le mot de passe actuel est incorrect."
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Nathan","nom":"Drake","email":"client@playstation.test","nouveauMdp":"nouveau1234"}')"
verifier "changer de mot de passe sans l'actuel" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Nathan","nom":"Drake","email":"client@playstation.test","mdpActuel":"client1234","nouveauMdp":"court"}')"
verifier "nouveau mot de passe trop court" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Nathan","nom":"Drake","email":"admin@playstation.test","mdpActuel":"client1234"}')"
verifier "adresse d'un autre compte" "$code" "409"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Nathan","nom":"Drake","email":"autre@playstation.test","mdpActuel":"client1234","nouveauMdp":"nouveau1234"}')"
verifier "adresse et mot de passe changés" "$code" "200"
api POST logout '{}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api POST login '{"email":"autre@playstation.test","mdp":"nouveau1234"}')"
verifier "connexion avec les nouveaux identifiants" "$code" "200"

echo "6. Remise en état du compte de test"
IFS=$'\t' read -r code corps <<< "$(profil '{"prenom":"Nathan","nom":"Drake","email":"client@playstation.test","mdpActuel":"nouveau1234","nouveauMdp":"client1234"}')"
verifier "profil d'origine" "$code" "200"
api POST logout '{}' > /dev/null
IFS=$'\t' read -r code corps <<< "$(api POST login '{"email":"client@playstation.test","mdp":"client1234"}')"
verifier "client@playstation.test / client1234" "$code" "200"
verifier "Nathan Drake" "$(champ "$corps" prenom) $(champ "$corps" nom)" "Nathan Drake"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
