#!/usr/bin/env node
/**
 * Vérifie les conventions du starter SAE301 (front M/C/V, composants, data, PHP, SQL).
 *
 * Usage : node check-conventions.mjs [--all] [--root <dossier>] [fichier...]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative, sep } from "node:path";

const AIDE = `Vérifie les conventions du starter SAE301.

Usage : node check-conventions.mjs [--all] [--root <dossier>] [fichier...]

  (aucun argument)  fichiers modifiés ou nouveaux selon git (sinon, tous)
  --all             tous les fichiers de front/src/{pages,ui,data,layouts}, back/src/{Controller,Model}, sql/
  --root <dossier>  racine du projet (défaut : dossier courant)
  fichier...        fichiers précis

Code de sortie : 0 si OK, 1 s'il y a au moins une erreur. Les avertissements ne font pas échouer.
Ne couvre pas le W3C ni la logique métier : voir SKILL.md.`;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(AIDE);
  process.exit(0);
}

const indexRoot = args.indexOf("--root");
const racine = indexRoot >= 0 ? args[indexRoot + 1] : process.cwd();
const toutes = args.includes("--all");
const fichiersDemandes = args.filter((a, i) => !a.startsWith("--") && !(indexRoot >= 0 && i === indexRoot + 1));

const DOSSIERS = ["front/src/pages", "front/src/ui", "front/src/data", "front/src/layouts", "back/src/Controller", "back/src/Model", "sql"];

/** Liste récursive des fichiers d'un dossier. */
function lister(dossier) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? lister(chemin) : [chemin];
  });
}

/** Chemin relatif POSIX, depuis la racine du projet. */
function rel(chemin) {
  return relative(racine, chemin).split(sep).join("/");
}

/** Fichiers modifiés ou non suivis selon git, ou null si git est indisponible. */
function fichiersGit() {
  try {
    const sortie = execSync("git status --porcelain -uall", { cwd: racine, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return sortie
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => join(racine, l.slice(3).trim().replace(/^"|"$/g, "")));
  } catch (e) {
    return null;
  }
}

let candidats;
if (fichiersDemandes.length > 0) {
  candidats = fichiersDemandes.map((f) => join(racine, f));
} else if (toutes) {
  candidats = DOSSIERS.flatMap((d) => lister(join(racine, d)));
} else {
  candidats = fichiersGit() ?? DOSSIERS.flatMap((d) => lister(join(racine, d)));
}

const fichiers = candidats
  .map(rel)
  .filter((f) => DOSSIERS.some((d) => f.startsWith(d + "/")) && /\.(js|html|php|sql)$/.test(f) && existsSync(join(racine, f)));

const violations = [];

/** Enregistre une violation ; niveau « erreur » ou « avertissement ». */
function signaler(fichier, ligne, message, niveau = "erreur") {
  violations.push({ fichier, ligne, message, niveau });
}

/** Numéro de ligne (1-based) d'une position dans un texte. */
function ligneDe(texte, position) {
  return texte.slice(0, position).split("\n").length;
}

/** Remplace les commentaires par des espaces (mêmes positions), pour ne pas les analyser. */
function sansCommentaires(texte, php) {
  let sortie = texte.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  sortie = sortie.replace(/(^|[^:"'\\])\/\/[^\n]*/g, (m, avant) => avant + " ".repeat(m.length - avant.length));
  if (php) sortie = sortie.replace(/(^|[^\w$])#[^\n[]*/g, (m, avant) => avant + " ".repeat(m.length - avant.length));
  return sortie;
}

/** Signale chaque occurrence d'un motif. */
function interdire(fichier, texte, motif, message, niveau = "erreur") {
  for (const m of texte.matchAll(motif)) {
    signaler(fichier, ligneDe(texte, m.index), message, niveau);
  }
}

/** Texte entre deux repères (le premier trouvé), ou "" si le début est absent. */
function region(texte, debut, fin) {
  const i = texte.search(debut);
  if (i < 0) return { texte: "", decalage: 0 };
  const reste = texte.slice(i);
  const j = fin ? reste.slice(1).search(fin) : -1;
  return { texte: j < 0 ? reste : reste.slice(0, j + 1), decalage: i };
}

// --- JavaScript ---------------------------------------------------------------

function verifierJs(fichier, brut) {
  const texte = sansCommentaires(brut, false);

  interdire(fichier, texte, /(?<![.\w])fetch\s*\(/g, "`fetch` interdit ici : passer par data/ et lib/api-request.js");
  interdire(fichier, texte, /\binnerHTML\b/g, "`innerHTML` interdit : utiliser genericRenderer / htmlToFragment");
  interdire(fichier, texte, /["'`](?:text|bg|border|p|m|w|h|gap)-["'`]\s*\+|`(?:text|bg|border)-\$\{/g, "classe Tailwind assemblée : l'écrire en entier");
  if (!fichier.startsWith("front/src/data/")) {
    interdire(fichier, texte, /\b(?:localStorage|sessionStorage)\b/g, "stockage navigateur à placer dans data/ (avec try/catch)");
  }

  if (/^front\/src\/pages\/[^/]+\/page\.js$/.test(fichier)) verifierPage(fichier, texte);
  else if (/^front\/src\/ui\/[^/]+\/index\.js$/.test(fichier)) verifierComposant(fichier, texte);
  else if (/^front\/src\/data\/[^/]+\.js$/.test(fichier)) verifierData(fichier, texte, brut);
}

function verifierPage(fichier, texte) {
  const aM = /\blet M\s*=/.test(texte);
  const aC = /\blet C\s*=/.test(texte);
  const aV = /\blet V\s*=/.test(texte);

  if (!aM && !aC && !aV) return; // page statique (404)

  for (const [ok, motif] of [
    [aM, "let M = { ... }"], [aC, "let C = {}"], [aV, "let V = {}"],
    [/\bC\.init\s*=\s*async function/.test(texte), "C.init = async function"],
    [/\bV\.racine\b/.test(texte), "V.racine"],
    [/\bV\.init\s*=\s*function/.test(texte), "V.init"],
    [/\bV\.rafraichir\s*=\s*function/.test(texte), "V.rafraichir"],
    [/\bV\.createPageFragment\s*=\s*function/.test(texte), "V.createPageFragment"],
    [/export function \w+Page\s*\(/.test(texte), "export function <Nom>Page"],
  ]) {
    if (!ok) signaler(fichier, 1, `élément obligatoire absent : ${motif}`);
  }

  const iM = texte.search(/\blet M\s*=/);
  const iC = texte.search(/\blet C\s*=/);
  const iV = texte.search(/\blet V\s*=/);
  if (aM && aC && aV && !(iM < iC && iC < iV)) signaler(fichier, 1, "ordre attendu dans le fichier : M, puis C, puis V");

  const blocM = texte.slice(iM, iC > iM ? iC : undefined);
  const blocC = texte.slice(iC, iV > iC ? iV : undefined);
  const blocV = texte.slice(iV);

  if (aM) {
    interdire(fichier, blocM, /\b(?:document|window|V\.|C\.)|\bfunction\b|=>/g, "M ne contient que de l'état (ni DOM, ni V/C, ni fonction)")
  }
  if (aC) {
    for (const m of blocC.matchAll(/\b(?:document\.|querySelector|addEventListener|createElement|window\.(?!scrollTo))/g)) {
      signaler(fichier, ligneDe(texte, iC + m.index), "C ne touche pas au DOM (seul window.scrollTo est toléré)");
    }
    if (!/C\.handler_\w+|C\.charger/.test(blocC)) signaler(fichier, ligneDe(texte, iC), "C sans méthode C.charger / C.handler_<action>", "avertissement");
  }
  if (aV) {
    for (const m of blocV.matchAll(/\b\w+Data\.\w+|(?<![.\w])fetch\s*\(/g)) {
      signaler(fichier, ligneDe(texte, iV + m.index), "V n'appelle ni data/ ni l'API : c'est le travail de C");
    }
    for (const m of blocV.matchAll(/\bM\.\w+\s*=[^=]/g)) {
      signaler(fichier, ligneDe(texte, iV + m.index), "V ne modifie pas M");
    }
  }
}

function verifierComposant(fichier, texte) {
  if (!/\blet \w+View\s*=\s*\{/.test(texte)) signaler(fichier, 1, "composant attendu : let <Nom>View = { html, dom }");
  if (!/export\s*\{[^}]*View[^}]*\}/.test(texte)) signaler(fichier, 1, "export { <Nom>View } absent");
  if (!/\b(?:dom|html)\s*:\s*(?:async\s+)?function/.test(texte)) signaler(fichier, 1, "méthode `dom` ou `html` absente");
  interdire(fichier, texte, /from\s+["'][^"']*\/data\//g, "un composant n'importe pas data/");
  interdire(fichier, texte, /\b[MCV]\.\w+/g, "un composant ne référence ni M, ni C, ni V : il reçoit data et actions");
  interdire(fichier, texte, /\bAuthData|\bgetRequest|\bpostRequest/g, "un composant n'appelle pas l'API");
  const dossier = fichier.replace(/index\.js$/, "");
  if (!existsSync(join(racine, dossier, "template.html"))) signaler(fichier, 1, "template.html manquant dans le dossier du composant");
}

function verifierData(fichier, texte, brut) {
  if (!/\blet \w+Data\s*=\s*\{\}/.test(texte)) signaler(fichier, 1, "module attendu : let <Nom>Data = {}");
  if (!/export\s*\{[^}]*Data[^}]*\}/.test(texte)) signaler(fichier, 1, "export { <Nom>Data } absent");
  interdire(fichier, texte, /\b(?:document|window)\b/g, "data/ ne touche pas au DOM");
  const lignes = brut.split("\n");
  for (let i = 0; i < lignes.length; i++) {
    if (/\b\w+Data\.\w+\s*=\s*(?:async\s+)?function/.test(lignes[i])) {
      let j = i - 1;
      while (j >= 0 && lignes[j].trim() === "") j--;
      if (j < 0 || !lignes[j].trim().endsWith("*/")) signaler(fichier, i + 1, "fonction sans JSDoc (route appelée + forme de la réponse)");
    }
  }
}

// --- Templates HTML ----------------------------------------------------------

function verifierHtml(fichier, texte) {
  interdire(fichier, texte, /\bon[a-z]+\s*=\s*["']/g, "gestionnaire d'événement inline interdit : addEventListener dans le composant");
  interdire(fichier, texte, /<script\b/gi, "<script> interdit dans un template");
  interdire(fichier, texte, /\[#[0-9a-fA-F]{3,8}\]|style\s*=\s*"[^"]*#[0-9a-fA-F]{3,8}/g, "couleur en dur : utiliser un token (global.css)");
  interdire(fichier, texte, /<img\b(?![^>]*\balt\s*=)[^>]*>/gi, "<img> sans attribut alt");
  interdire(fichier, texte, /<(?:center|font|marquee|b|i)\b/gi, "balise obsolète ou de présentation");
  interdire(fichier, texte, /\sid\s*=\s*"/g, "id dans un template (instancié plusieurs fois) : préférer class / data-*", "avertissement");
  interdire(fichier, texte, /<(?:a|button)\b[^>]*>\s*<\/(?:a|button)>/g, "lien ou bouton sans contenu accessible", "avertissement");
}

// --- PHP ----------------------------------------------------------------------

function verifierPhp(fichier, brut) {
  const texte = sansCommentaires(brut, true);

  if (!/declare\(strict_types=1\);/.test(texte)) signaler(fichier, 1, "declare(strict_types=1); absent");
  interdire(fichier, texte, /\b(?:echo|print|die)\b|\bexit\b(?!;\s*$)|\bheader\s*\(/g, "sortie directe interdite : Response::json() / Response::erreur()");
  interdire(fichier, texte, /\$_(?:GET|POST|REQUEST)\b/g, "lire la requête via Request (parametre() / corps())");
  interdire(fichier, texte, /\bfunction\s+(?!__construct\b)\w+\s*\([^)]*\)\s*\{/g, "méthode sans type de retour");
  interdire(fichier, texte, /\b(?:public|private|protected)\s+(?!function|const|static|readonly|array|string|int|float|bool|\?|[A-Z])\$\w+/g, "propriété non typée");

  if (fichier.startsWith("back/src/Model/")) {
    interdire(fichier, texte, /\bResponse::|\$_(?:SESSION|COOKIE|SERVER)\b/g, "un modèle ne répond pas et ne lit pas la session");
    interdire(fichier, texte, /\{\$\w+\}|"\s*\.\s*\$\w+/g, "variable insérée dans du SQL : valeur → paramètre lié ; identifiant → liste blanche du contrôleur", "avertissement");
    if (!/final class \w+Model/.test(texte)) signaler(fichier, 1, "attendu : final class <Nom>Model");
  }

  if (fichier.startsWith("back/src/Controller/")) {
    const classe = /final class (\w+Controller)/.exec(texte);
    if (!classe) {
      signaler(fichier, 1, "attendu : final class <Nom>Controller");
    } else {
      const routes = lireSiExiste("back/src/routes.php");
      const index = lireSiExiste("back/index.php");
      if (routes !== null && !routes.includes(`${classe[1]}::class`)) signaler(fichier, 1, `${classe[1]} absent de back/src/routes.php`);
      if (index !== null && !index.includes(`${classe[1]}::class`)) signaler(fichier, 1, `${classe[1]} non enregistré dans le tableau $controleurs de back/index.php`);
    }
    interdire(fichier, texte, /\bPDO\b|->prepare\(|->query\(/g, "un contrôleur n'interroge pas la base : passer par son modèle");
  }
}

function lireSiExiste(chemin) {
  const complet = join(racine, chemin);
  return existsSync(complet) ? readFileSync(complet, "utf8") : null;
}

// --- SQL ----------------------------------------------------------------------

function verifierSql(fichier, brut) {
  if (!/SET NAMES utf8mb4/i.test(brut)) signaler(fichier, 1, "SET NAMES utf8mb4; absent");
  for (const m of brut.matchAll(/CREATE TABLE\s+`?(\w+)`?/gi)) {
    const table = m[1];
    if (!new RegExp(`DROP TABLE IF EXISTS\\s+\`?${table}\`?`, "i").test(brut)) {
      signaler(fichier, ligneDe(brut, m.index), `table ${table} sans DROP TABLE IF EXISTS (script non rejouable)`);
    }
    const suite = brut.slice(m.index, brut.indexOf(";", m.index));
    if (!/ENGINE\s*=\s*InnoDB/i.test(suite)) signaler(fichier, ligneDe(brut, m.index), `table ${table} : ENGINE = InnoDB attendu`);
  }
}

// --- Exécution ----------------------------------------------------------------

for (const fichier of fichiers) {
  const brut = readFileSync(join(racine, fichier), "utf8");
  if (fichier.endsWith(".js")) verifierJs(fichier, brut);
  else if (fichier.endsWith(".html")) verifierHtml(fichier, brut);
  else if (fichier.endsWith(".php")) verifierPhp(fichier, brut);
  else if (fichier.endsWith(".sql")) verifierSql(fichier, brut);
}

const erreurs = violations.filter((v) => v.niveau === "erreur");
const lignes = violations.map((v) => `[${v.niveau === "erreur" ? "ERREUR" : "AVERT."}] ${v.fichier}:${v.ligne}  ${v.message}`);

console.log(`${fichiers.length} fichier(s) analysé(s).`);
if (lignes.length > 0) console.log(lignes.join("\n"));
console.log(erreurs.length === 0 ? "OK" : `${erreurs.length} erreur(s) à corriger.`);
process.exit(erreurs.length === 0 ? 0 : 1);
