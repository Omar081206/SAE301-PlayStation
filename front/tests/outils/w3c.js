import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Validateurs publics du W3C. Ils limitent le débit (429) : les envois sont
// espacés entre tous les workers, et un document déjà validé (même contenu,
// au caractère près) n'est pas renvoyé : son résultat est gardé d'un
// lancement à l'autre dans node_modules/.cache/w3c (hors du dépôt).
// Les envois passent par fetch (Node) et non par page.request : la protection
// du validateur (Cloudflare) refuse le client HTTP de Playwright (429).

const VALIDATEUR_HTML = "https://validator.w3.org/nu/?out=json";
const VALIDATEUR_CSS = "https://jigsaw.w3.org/css-validator/validator";

// Délai minimal entre deux envois au même validateur, tous workers confondus.
const ESPACEMENT = 6000;
// Attente maximale accordée à un validateur qui demande de patienter (Retry-After).
const ATTENTE_MAX = 300_000;

// Résultats des validations, gardés entre les lancements.
const CACHE = fileURLToPath(new URL("../../node_modules/.cache/w3c/", import.meta.url));

/**
 * Attend sans bloquer le processus.
 *
 * @param {number} millisecondes
 */
function patienter(millisecondes) {
  return new Promise((resoudre) => setTimeout(resoudre, millisecondes));
}

/**
 * Dossier partagé par les workers pendant un lancement, pour les verrous
 * (vidé par Playwright au lancement suivant, avec le reste de test-results).
 */
function dossierPartage() {
  let dossier = join(test.info().project.outputDir, ".w3c");
  mkdirSync(dossier, { recursive: true });
  return dossier;
}

/**
 * Exécute envoi seul (verrou : un dossier créé de façon atomique), au moins
 * ESPACEMENT après le précédent envoi au même validateur.
 *
 * @param {string} nom  « html » ou « css »
 * @param {() => Promise<any>} envoi
 */
async function chacunSonTour(nom, envoi) {
  let dossier = dossierPartage();
  let verrou = join(dossier, `${nom}.verrou`);
  let dernier = join(dossier, `${nom}.dernier`);

  for (;;) {
    try {
      mkdirSync(verrou);
      break;
    } catch {
      await patienter(200);
    }
  }

  try {
    let precedent = Number(readFileSync(dernier, { encoding: "utf8", flag: "a+" }) || 0);
    await patienter(Math.max(0, precedent + ESPACEMENT - Date.now()));
    return await envoi();
  } finally {
    writeFileSync(dernier, String(Date.now()));
    rmSync(verrou, { recursive: true, force: true });
  }
}

/**
 * Envoie un document à un validateur et renvoie son JSON. Résultat gardé en
 * cache (empreinte du document) pour le reste du lancement ; un 429 est
 * réessayé après le délai demandé.
 *
 * @param {string} nom  « html » ou « css »
 * @param {string} document
 * @param {() => Promise<Response>} envoi
 * @returns {Promise<Object>}
 */
async function valider(nom, document, envoi) {
  mkdirSync(CACHE, { recursive: true });
  let cache = join(CACHE, `${nom}-${createHash("sha1").update(document).digest("hex")}.json`);
  try {
    return JSON.parse(readFileSync(cache, "utf8"));
  } catch {
    // Document jamais validé : on l'envoie.
  }

  let attendu = 0;
  let reponse = await chacunSonTour(nom, envoi);
  while ([429, 503].includes(reponse.status) && attendu < ATTENTE_MAX) {
    let delai = Number(reponse.headers.get("retry-after") ?? 30) * 1000;
    attendu += delai;
    await patienter(delai);
    reponse = await chacunSonTour(nom, envoi);
  }
  expect(reponse.ok, `validateur ${nom.toUpperCase()} du W3C joignable (statut ${reponse.status})`).toBe(true);

  let resultat = await reponse.json();
  writeFileSync(cache, JSON.stringify(resultat));
  return resultat;
}

/**
 * Erreurs du validateur HTML du W3C pour le DOM rendu d'une page.
 *
 * @param {string} html
 * @returns {Promise<string[]>}
 */
export async function erreursHtml(html) {
  let { messages } = await valider("html", html, () =>
    fetch(VALIDATEUR_HTML, { method: "POST", headers: { "Content-Type": "text/html; charset=utf-8" }, body: html }),
  );
  return messages
    .filter((message) => message.type === "error")
    .map((message) => `ligne ${message.lastLine} : ${message.message} (${(message.extract ?? "").trim()})`);
}

/**
 * Erreurs du validateur CSS du W3C pour les feuilles de style d'une page.
 *
 * @param {string} css
 * @returns {Promise<string[]>}
 */
export async function erreursCss(css) {
  let { cssvalidation } = await valider("css", css, () => {
    let formulaire = new FormData();
    formulaire.append("file", new Blob([css], { type: "text/css" }), "page.css");
    formulaire.append("profile", "css3svg");
    formulaire.append("output", "json");
    formulaire.append("warning", "no");
    return fetch(VALIDATEUR_CSS, { method: "POST", body: formulaire });
  });
  return (cssvalidation.errors ?? []).map((erreur) => erreur.message.trim());
}
