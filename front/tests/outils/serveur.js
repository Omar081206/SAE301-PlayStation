import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Ce qui ne passe ni par le navigateur ni par l'API : la base (requêtes de
// contrôle, nettoyage des données de test) et l'historique Git. Ces fonctions
// tournent sur le serveur, dans le processus des tests.

// Racine du projet, quel que soit le dossier d'où l'on lance les tests.
const RACINE = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * Identifiants de la base, lus dans back/config/config.php au moment du test :
 * ils ne sont recopiés nulle part.
 *
 * @returns {{ hote: string, port: number, base: string, utilisateur: string, motdepasse: string }}
 */
function configBase() {
  let php = 'echo json_encode((require "back/config/config.php")["bdd"]);';
  return JSON.parse(execFileSync("php", ["-r", php], { cwd: RACINE, encoding: "utf8" }));
}

/**
 * Exécute une requête SQL sur la base du projet et renvoie ses lignes.
 *
 * Réservée aux contrôles qu'aucune route n'expose (mot de passe haché, journal
 * des mouvements) et au nettoyage des lignes créées par les tests : jamais pour
 * préparer un état que l'application sait produire elle-même.
 *
 * @param {string} sql
 * @returns {Array<Object<string, string>>} une ligne par objet, valeurs en texte
 */
export function requeteBase(sql) {
  let config = configBase();
  let sortie = execFileSync(
    "mysql",
    ["-h", config.hote, "-P", String(config.port), "-u", config.utilisateur, "--batch", "-e", sql, config.base],
    // stderr capturé (et joint à l'erreur s'il y en a une) plutôt qu'affiché : le client mysql y
    // écrit un avertissement à chaque connexion locale sans TLS.
    { env: { ...process.env, MYSQL_PWD: config.motdepasse }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  let [entete, ...lignes] = sortie.trim().split("\n").filter((ligne) => ligne !== "");
  if (entete === undefined) {
    return [];
  }

  let colonnes = entete.split("\t");
  return lignes.map((ligne) => {
    let valeurs = ligne.split("\t");
    return Object.fromEntries(colonnes.map((colonne, i) => [colonne, valeurs[i]]));
  });
}

/**
 * Exécute une commande git à la racine du projet et renvoie sa sortie.
 *
 * @param {string[]} args
 * @returns {string}
 */
export function git(args) {
  return execFileSync("git", args, { cwd: RACINE, encoding: "utf8" }).trim();
}

/**
 * Exécute action seule, tous workers et navigateurs confondus : pour un test
 * qui change un état commun à toute la boutique (le produit en promotion).
 * Verrou : un dossier créé de façon atomique dans test-results.
 *
 * @template T
 * @param {string} nom
 * @param {() => Promise<T>} action
 * @returns {Promise<T>}
 */
export async function chacunSonTour(nom, action) {
  let verrou = join(RACINE, "front", "test-results", `.verrou-${nom}`);
  mkdirSync(join(RACINE, "front", "test-results"), { recursive: true });

  for (;;) {
    try {
      mkdirSync(verrou);
      break;
    } catch {
      await new Promise((resoudre) => setTimeout(resoudre, 250));
    }
  }

  try {
    return await action();
  } finally {
    rmSync(verrou, { recursive: true, force: true });
  }
}
