#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Test des mouvements de stock (STK-a), contre l'API et la base.
#
# Usage : tests/mouvements-stock.sh [URL du projet]
#   URL par défaut : http://localhost:8099/~hadj-zekri1/SAE301
#   Sur mmi.unilim.fr (espace protégé par LDAP) : CURL_AUTH="login:motdepasse"
#
# Le test ÉCRIT en base (identifiants lus dans back/config/config.php) :
#   - il passe des commandes sur « Astro Bot » (variante 13) puis les annule,
#     ce qui rend le stock ;
#   - pour la concurrence, il fixe ce stock à 1, puis remet le stock d'origine.
# Il laisse donc des commandes annulées et leurs mouvements dans le journal.
# Prérequis : comptes de test de sql/import.sql. Outils : curl, mysql, php,
# python3.
# ---------------------------------------------------------------------------
set -u

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${1:-http://localhost:8099/~hadj-zekri1/SAE301}/api"
VARIANTE=13
PARALLELES=5
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
ECHECS=0

# Identifiants MySQL de l'application, sans les recopier ici.
lire_config() {
  php -r '$c = require $argv[1]; echo $c["bdd"][$argv[2]];' "$RACINE/back/config/config.php" "$1"
}
MYSQL=(mysql -N -h "$(lire_config hote)" -P "$(lire_config port)" -u "$(lire_config utilisateur)" -p"$(lire_config motdepasse)" "$(lire_config base)")
sql() { "${MYSQL[@]}" -e "$1"; }
stock() { sql "SELECT stock FROM variante WHERE id = $VARIANTE"; }

# Requête POST avec la session « $1 » : affiche « code<TAB>corps ».
poster() {
  local options=(-s -b "$TEMP/$1" -c "$TEMP/$1" -X POST -H "Content-Type: application/json" -d "$3" -w '\t%{http_code}')
  [ -n "${CURL_AUTH:-}" ] && options+=(-u "$CURL_AUTH")
  local reponse
  reponse="$(curl "${options[@]}" "$BASE/$2" | tr -d '\n')"
  printf '%s\t%s' "${reponse##*$'\t'}" "${reponse%$'\t'*}"
}

numero() { python3 -c 'import json,sys; print(json.loads(sys.argv[1])["commande"]["numero"])' "$1"; }

verifier() {
  if [ "$2" = "$3" ]; then
    echo "  ok      $1"
  else
    echo "  ÉCHEC   $1 : attendu « $3 », obtenu « $2 »"
    ECHECS=$((ECHECS + 1))
  fi
}

STOCK_ORIGINE="$(stock)"
poster client login '{"email":"client@playstation.test","mdp":"client1234"}' > /dev/null
poster admin admin/login '{"email":"admin@playstation.test","mdp":"admin1234"}' > /dev/null
COMMANDE_2='{"lignes":[{"variantId":13,"quantite":2}]}'

echo "1. La commande décrémente le stock et l'inscrit au journal"
IFS=$'\t' read -r code corps <<< "$(poster client commande "$COMMANDE_2")"
verifier "commande de 2 Astro Bot" "$code" "201"
NUMERO="$(numero "$corps")"
verifier "stock décrémenté de 2" "$(stock)" "$((STOCK_ORIGINE - 2))"
verifier "mouvement au journal" "$(sql "SELECT CONCAT(m.quantite, ' ', m.motif, ' ', m.stock_avant, '→', m.stock_apres) FROM mouvement_stock m JOIN commande c ON c.id = m.commande_id WHERE c.numero = '$NUMERO'")" "-2 commande $STOCK_ORIGINE→$((STOCK_ORIGINE - 2))"

echo "2. Les autres changements de statut ne touchent pas au stock"
IFS=$'\t' read -r code corps <<< "$(poster client admin/commande/statut "{\"numero\":\"$NUMERO\",\"statut\":\"annulee\"}")"
verifier "un client ne peut pas changer le statut" "$code" "403"
IFS=$'\t' read -r code corps <<< "$(poster admin admin/commande/statut "{\"numero\":\"$NUMERO\",\"statut\":\"disponible\"}")"
verifier "en cours → disponible" "$code" "200"
verifier "stock inchangé" "$(stock)" "$((STOCK_ORIGINE - 2))"

echo "3. L'annulation recrédite le stock, une seule fois"
IFS=$'\t' read -r code corps <<< "$(poster admin admin/commande/statut "{\"numero\":\"$NUMERO\",\"statut\":\"annulee\"}")"
verifier "disponible → annulée" "$code" "200"
verifier "stock recrédité" "$(stock)" "$STOCK_ORIGINE"
verifier "mouvement d'annulation au journal" "$(sql "SELECT CONCAT(m.quantite, ' ', m.motif) FROM mouvement_stock m JOIN commande c ON c.id = m.commande_id WHERE c.numero = '$NUMERO' AND m.motif = 'annulation'")" "2 annulation"
IFS=$'\t' read -r code corps <<< "$(poster admin admin/commande/statut "{\"numero\":\"$NUMERO\",\"statut\":\"annulee\"}")"
verifier "seconde annulation refusée" "$code" "422"
IFS=$'\t' read -r code corps <<< "$(poster admin admin/commande/statut "{\"numero\":\"$NUMERO\",\"statut\":\"retiree\"}")"
verifier "annulée → retirée refusée" "$code" "422"
verifier "stock toujours inchangé" "$(stock)" "$STOCK_ORIGINE"

echo "4. Concurrence : $PARALLELES commandes simultanées sur la dernière unité"
sql "UPDATE variante SET stock = 1 WHERE id = $VARIANTE"
COMMANDE_1='{"lignes":[{"variantId":13,"quantite":1}]}'
for i in $(seq 1 "$PARALLELES"); do
  # Une session par requête : chacune verrouille la variante de son côté.
  cp "$TEMP/client" "$TEMP/client$i"
  poster "client$i" commande "$COMMANDE_1" > "$TEMP/resultat$i" &
done
wait
CODES="$(for i in $(seq 1 "$PARALLELES"); do cut -f1 "$TEMP/resultat$i"; done | sort | tr '\n' ' ')"
verifier "une seule commande acceptée, les autres refusées" "$CODES" "201 $(printf '409 %.0s' $(seq 2 "$PARALLELES"))"
verifier "stock à 0, jamais négatif" "$(stock)" "0"
GAGNANTE="$(for i in $(seq 1 "$PARALLELES"); do [ "$(cut -f1 "$TEMP/resultat$i")" = "201" ] && numero "$(cut -f2- "$TEMP/resultat$i")"; done)"
verifier "un seul mouvement pour la dernière unité" "$(sql "SELECT COUNT(*) FROM mouvement_stock m JOIN commande c ON c.id = m.commande_id WHERE c.numero = '$GAGNANTE'")" "1"

# Remise en état : annulation de la commande gagnante, puis stock d'origine.
poster admin admin/commande/statut "{\"numero\":\"$GAGNANTE\",\"statut\":\"annulee\"}" > /dev/null
sql "UPDATE variante SET stock = $STOCK_ORIGINE WHERE id = $VARIANTE"
verifier "stock d'origine rétabli" "$(stock)" "$STOCK_ORIGINE"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "Tous les tests passent."
else
  echo "$ECHECS test(s) en échec."
  exit 1
fi
