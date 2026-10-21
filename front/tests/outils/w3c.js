import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Validateurs publics du W3C. Ils limitent le débit : les envois sont espacés
// entre tous les workers, et un document déjà validé (même contenu, au
// caractère près) n'est pas renvoyé : son résultat est gardé d'un lancement à
// l'autre dans node_modules/.cache/w3c (hors du dépôt).
// Les envois passent par fetch (Node) et non par page.request : la protection
// du validateur (Cloudflare) refuse le client HTTP de Playwright (429).

// Validateur HTML : le Nu Html Checker, que le W3C fait tourner sur
// validator.w3.org/nu. Sa protection (Cloudflare) finit par refuser le serveur
// de l'IUT (429, page « Just a moment… »), parfois pour des heures : on passe
// alors par validator.nu, instance publique du même logiciel (mêmes règles,
// mêmes messages). Le rapport du test dit quelle instance a validé la page.
const INSTANCES_HTML = [
  { nom: "validator.w3.org", adresse: "https://validator.w3.org/nu/?out=json" },
  { nom: "validator.nu", adresse: "https://validator.nu/?out=json" },
];
const INSTANCES_CSS = [{ nom: "jigsaw.w3.org", adresse: "https://jigsaw.w3.org/css-validator/validator" }];

// Délai minimal entre deux envois à la même instance, tous workers confondus.
const ESPACEMENT = 6000;
// Une instance qui a refusé est laissée de côté pendant ce délai, pour tous les workers.
const MISE_A_L_ECART = 10 * 60_000;
// Si toutes les instances refusent : on réessaie toutes les 30 s, pendant ce délai au plus.
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
 * Dossier partagé par les workers pendant un lancement, pour les verrous et
 * les instances écartées (vidé par Playwright au lancement suivant, avec le
 * reste de test-results).
 */
function dossierPartage() {
  let dossier = join(test.info().project.outputDir, ".w3c");
  mkdirSync(dossier, { recursive: true });
  return dossier;
}

/**
 * Exécute envoi seul (verrou : un dossier créé de façon atomique), au moins
 * ESPACEMENT après le précédent envoi à la même instance.
 *
 * @param {string} instance  nom de l'instance (« validator.w3.org »…)
 * @param {() => Promise<any>} envoi
 */
async function chacunSonTour(instance, envoi) {
  let dossier = dossierPartage();
  let verrou = join(dossier, `${instance}.verrou`);
  let dernier = join(dossier, `${instance}.dernier`);

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
 * Vrai si l'instance a refusé un envoi il y a moins de MISE_A_L_ECART.
 *
 * @param {string} instance
 */
function estEcartee(instance) {
  let marque = join(dossierPartage(), `${instance}.refus`);
  return existsSync(marque) && Date.now() - statSync(marque).mtimeMs < MISE_A_L_ECART;
}

/**
 * Envoie un document à la première instance qui l'accepte et renvoie
 * { instance, resultat } (le JSON du validateur). Résultat gardé en cache
 * (empreinte du document). Instance qui refuse (429, 503, réponse illisible,
 * réseau) : on passe à la suivante ; toutes refusent : on réessaie toutes les
 * 30 s, puis le test échoue (« validateurs injoignables »), jamais « valide ».
 *
 * @param {string} type  « html » ou « css »
 * @param {string} document
 * @param {Array<{ nom: string, adresse: string }>} instances  dans l'ordre de préférence
 * @param {(adresse: string) => Promise<Response>} envoi
 * @returns {Promise<{ instance: string, resultat: Object }>}
 */
async function valider(type, document, instances, envoi) {
  mkdirSync(CACHE, { recursive: true });
  let cache = join(CACHE, `${type}-${createHash("sha1").update(document).digest("hex")}.json`);
  try {
    let enCache = JSON.parse(readFileSync(cache, "utf8"));
    if (enCache.resultat !== undefined) {
      return enCache;
    }
  } catch {
    // Document jamais validé : on l'envoie.
  }

  let refus = [];
  let debut = Date.now();

  for (;;) {
    // Les instances écartées passent après ; si toutes le sont, on les retente toutes.
    let candidates = instances.filter((instance) => !estEcartee(instance.nom));
    for (let instance of candidates.length > 0 ? candidates : instances) {
      let resultat = null;
      try {
        let reponse = await chacunSonTour(instance.nom, () => envoi(instance.adresse));
        resultat = reponse.ok ? await reponse.json().catch(() => null) : null;
        if (resultat === null) {
          refus.push(`${instance.nom} : ${reponse.status}`);
        }
      } catch (erreur) {
        refus.push(`${instance.nom} : ${erreur.message}`);
      }

      if (resultat !== null) {
        let valide = { instance: instance.nom, resultat };
        writeFileSync(cache, JSON.stringify(valide));
        return valide;
      }
      writeFileSync(join(dossierPartage(), `${instance.nom}.refus`), String(Date.now()));
    }

    if (Date.now() - debut >= ATTENTE_MAX) {
      break;
    }
    await patienter(30_000);
  }

  expect(refus, `validateurs ${type.toUpperCase()} du W3C injoignables`).toEqual([]);
}

/**
 * Erreurs du validateur HTML du W3C pour le DOM rendu d'une page. Validée
 * ailleurs que sur validator.w3.org : le rapport du test le note.
 *
 * @param {string} html
 * @returns {Promise<string[]>}
 */
export async function erreursHtml(html) {
  let { instance, resultat } = await valider("html", html, INSTANCES_HTML, (adresse) =>
    fetch(adresse, { method: "POST", headers: { "Content-Type": "text/html; charset=utf-8" }, body: html }),
  );
  if (instance !== INSTANCES_HTML[0].nom) {
    test.info().annotations.push({
      type: "validateur HTML",
      description: `${instance} (Nu Html Checker) : ${INSTANCES_HTML[0].nom} refuse le serveur (protection Cloudflare)`,
    });
  }
  return resultat.messages
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
  let { resultat } = await valider("css", css, INSTANCES_CSS, (adresse) => {
    let formulaire = new FormData();
    formulaire.append("file", new Blob([css], { type: "text/css" }), "page.css");
    formulaire.append("profile", "css3svg");
    formulaire.append("output", "json");
    formulaire.append("warning", "no");
    return fetch(adresse, { method: "POST", body: formulaire });
  });
  return (resultat.cssvalidation.errors ?? []).map((erreur) => erreur.message.trim());
}
