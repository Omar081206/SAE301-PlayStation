import { test, expect } from "@playwright/test";
import { connecterAdmin, connecterClient, envoyer, preparerPanier } from "./api.js";
import { git } from "./serveur.js";
import { erreursCss, erreursHtml } from "./w3c.js";

// Definition of Done commune (docs/user-stories.md) : six points, vérifiés
// pour chaque US sur ses propres pages, formulaires et routes réservées.
// Chaque fichier d'US appelle testerDodCommune une fois.

// Les trois tailles des maquettes.
const TAILLES = [
  { nom: "mobile", width: 375, height: 812 },
  { nom: "tablette", width: 768, height: 1024 },
  { nom: "desktop", width: 1440, height: 900 },
];

// Erreurs du validateur CSS dues à Tailwind 4 et non à notre code : le
// validateur ne connaît pas encore ces règles. Elles sont listées dans le
// rapport (annotation), pas ignorées en silence.
const ALERTES_TAILWIND = [/Unrecognized at-rule “@property”/, /Property “margin-trim” doesn't exist/];

/**
 * Ouvre une page de l'application, après avoir ouvert la session demandée (et
 * rempli le panier), et attend que ses données soient arrivées. Renvoie le
 * chemin ouvert.
 *
 * @param {import("@playwright/test").Page} page
 * @param {Cible} cible
 * @returns {Promise<string>}
 */
export async function ouvrir(page, cible) {
  if (cible.connexion === "client") {
    await connecterClient(page);
  } else if (cible.connexion === "admin") {
    await connecterAdmin(page);
  }
  if (cible.panier !== undefined) {
    await preparerPanier(page, cible.panier);
  }

  // Un chemin qui dépend des données (numéro de commande…) est calculé une fois la session ouverte.
  let chemin = typeof cible.chemin === "function" ? await cible.chemin(page) : cible.chemin;
  await page.goto(chemin.replace(/^\//, ""));
  await page.waitForLoadState("networkidle");
  if (cible.avant !== undefined) {
    await cible.avant(page);
  }

  return chemin;
}

/**
 * @typedef {Object} Cible  une page de l'US
 * @property {string | ((page: import("@playwright/test").Page) => Promise<string>)} chemin
 * @property {"client" | "admin" | null} [connexion]  session ouverte avant
 * @property {Array<{ variantId: number, quantite: number }>} [panier]  panier du localStorage
 * @property {(page: import("@playwright/test").Page) => Promise<void>} [avant]  geste à faire
 *   une fois la page chargée (ouvrir un onglet, un formulaire)
 */

/**
 * Déclare les six tests de la DoD commune d'une US.
 *
 * @param {string} us  ex. « CMD-a »
 * @param {Object} perimetre ce que l'US ajoute ou modifie :
 * @param {Cible[]} perimetre.pages
 * @param {Array<Cible & { bouton: string, api: { chemin: string, corps: Object } }>} [perimetre.formulaires]
 *   bouton : nom accessible du bouton d'envoi ; api : la même saisie invalide,
 *   envoyée directement au serveur
 * @param {Array<{ chemin: string, droit: "client" | "admin", api: string }>} [perimetre.reservees]
 *   api : une route GET réservée de l'US (ex. « compte »)
 */
export function testerDodCommune(us, { pages, formulaires = [], reservees = [] }) {
  test.describe(`${us} · DoD commune`, () => {
    test("DoD : code dans une branche dédiée à l'US, commits explicites, puis fusion @lecture", async () => {
      let prefixe = `us/${us.toLowerCase()}-`;
      let branches = git(["branch", "--list", `${prefixe}*`, "--format=%(refname:short)"]).split("\n").filter(Boolean);
      expect(branches, `une branche ${prefixe}…`).not.toHaveLength(0);

      let fusionnees = git(["branch", "--merged", "main", "--format=%(refname:short)"]).split("\n");
      let courante = git(["branch", "--show-current"]);
      let enCours = branches.filter((branche) => !fusionnees.includes(branche));

      if (branches.includes(courante)) {
        // L'US est en cours d'implémentation sur sa branche (sans commit, git la voit déjà « fusionnée ») :
        // le commit et la fusion viennent après la vérification.
        test.info().annotations.push({ type: "en attente", description: `${courante} : commit et fusion après accord` });
        return;
      }

      expect(enCours, "branches de l'US non fusionnées dans main").toEqual([]);
      let commits = git(["log", "main", "--oneline", "--fixed-strings", `--grep=(${us}):`]);
      expect(commits, `au moins un commit « (${us}): … » dans main`).not.toBe("");
    });

    test("DoD : HTML et CSS valides (validateur W3C) @lecture", async ({ page }) => {
      // Le HTML et le CSS sont les mêmes d'un navigateur à l'autre : un seul les envoie au
      // validateur, pour rester sous la limite de débit du W3C.
      let premier = test.info().config.projects[0].name;
      test.skip(test.info().project.name !== premier, `validé une fois, dans ${premier}`);
      test.setTimeout(600_000);
      // Une page par US (la première de « pages ») : le validateur public limite le débit. Le
      // CSS est le même sur toute l'application, validé sur cette même page.
      let chemin = await ouvrir(page, pages[0]);

      let html = "<!doctype html>\n" + (await page.evaluate(() => document.documentElement.outerHTML));
      expect.soft(await erreursHtml(html), `HTML de ${chemin}`).toEqual([]);

      let css = await page.evaluate(() =>
        [...document.styleSheets].flatMap((feuille) => [...feuille.cssRules].map((regle) => regle.cssText)).join("\n"),
      );
      let erreurs = await erreursCss(css);
      let alertes = new Set(erreurs.filter((erreur) => ALERTES_TAILWIND.some((motif) => motif.test(erreur))));
      expect
        .soft(erreurs.filter((erreur) => !ALERTES_TAILWIND.some((motif) => motif.test(erreur))), `CSS de ${chemin}`)
        .toEqual([]);

      for (let alerte of alertes) {
        test.info().annotations.push({ type: "alerte CSS (Tailwind 4)", description: alerte });
      }
    });

    test("DoD : charte graphique PlayStation respectée, responsive (375 / 768 / 1440) @lecture", async ({ page }) => {
      for (let cible of pages) {
        let chemin = await ouvrir(page, cible);

        let police = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
        expect.soft(police, `police de la charte sur ${chemin}`).toContain("SST");

        for (let taille of TAILLES) {
          await page.setViewportSize({ width: taille.width, height: taille.height });
          let largeurs = await page.evaluate(() => ({
            contenu: document.documentElement.scrollWidth,
            fenetre: document.documentElement.clientWidth,
          }));
          expect.soft(largeurs.contenu, `débordement horizontal sur ${chemin} (${taille.nom})`).toBeLessThanOrEqual(
            largeurs.fenetre,
          );
        }
      }

      test.info().annotations.push({
        type: "à faire à la main",
        description: "comparaison avec la maquette Figma (skill verifier-front)",
      });
    });

    test("DoD : testé sur 3 navigateurs @lecture", async ({ page, browserName }) => {
      let erreurs = [];
      page.on("pageerror", (erreur) => erreurs.push(erreur.message));

      for (let cible of pages) {
        let chemin = await ouvrir(page, cible);
        await expect(page.locator("main"), `${chemin} s'affiche dans ${browserName}`).toBeVisible();
      }
      expect(erreurs, `erreurs JavaScript dans ${browserName}`).toEqual([]);

      let lances = test.info().config.projects.map((projet) => projet.name);
      let absents = ["chromium", "firefox", "webkit"].filter((nom) => !lances.includes(nom));
      if (absents.length > 0) {
        test.info().annotations.push({ type: "non vérifié", description: `navigateur non lancé : ${absents.join(", ")}` });
      }
    });

    test("DoD : formulaires validés côté client ET serveur, messages d'erreur clairs en français @lecture", async ({
      page,
    }) => {
      test.skip(formulaires.length === 0, `Sans objet : ${us} n'ajoute pas de formulaire`);

      for (let cible of formulaires) {
        let chemin = await ouvrir(page, cible);

        // Côté client : formulaire envoyé vide, aucune requête ne part.
        let envois = [];
        page.on("request", (requete) => requete.url().includes(`/api/${cible.api.chemin}`) && envois.push(requete));

        let bouton = page.getByRole("button", { name: cible.bouton, exact: true });
        let formulaire = page.locator("form").filter({ has: bouton });
        for (let champ of await formulaire.locator("input[required], textarea[required]").all()) {
          await champ.fill("");
        }
        let texteAvant = await page.locator("main").innerText();
        await bouton.click();

        // Le navigateur bloque (champ :invalid) ou la page affiche son propre message.
        await expect
          .poll(
            async () =>
              (await formulaire.locator(":invalid").count()) > 0 ||
              (await page.locator("main").innerText()) !== texteAvant,
            { message: `saisie vide signalée dans ${chemin}`, timeout: 5000 },
          )
          .toBe(true);
        expect.soft(envois, `requête envoyée malgré la saisie vide (${chemin})`).toEqual([]);

        // Côté serveur : la même saisie invalide, envoyée directement.
        let { statut, corps } = await envoyer(page, cible.api.chemin, cible.api.corps);
        expect.soft(statut, `POST /api/${cible.api.chemin} invalide`).toBe(422);
        expect.soft(corps?.erreur ?? "", `message d'erreur de /api/${cible.api.chemin}`).toMatch(/^[A-ZÀ-Ý].*\p{L}/u);
      }
    });

    test("DoD : pages et actions réservées inaccessibles sans les droits @lecture", async ({ page, browser }) => {
      test.skip(reservees.length === 0, `Sans objet : ${us} n'a pas de page réservée`);

      for (let cible of reservees) {
        // Sans aucune session.
        await page.goto(cible.chemin.replace(/^\//, ""));
        await page.waitForLoadState("networkidle");
        if (cible.droit === "client") {
          await expect.soft(page, `${cible.chemin} sans session`).toHaveURL(/\/connexion/);
        } else {
          await expect.soft(page.getByRole("heading", { name: "Back-office" }), `${cible.chemin} sans session`).toBeVisible();
        }

        let reponse = await page.request.get(`api/${cible.api}`);
        expect.soft(reponse.status(), `GET /api/${cible.api} sans session`).toBe(403);

        // Avec la session de l'autre espace : client sur le back-office, admin sur l'espace client.
        let contexte = await browser.newContext({ baseURL: test.info().project.use.baseURL });
        let autre = await contexte.newPage();
        if (cible.droit === "admin") {
          await connecterClient(autre);
        } else {
          await connecterAdmin(autre);
        }
        let refus = await autre.request.get(`api/${cible.api}`);
        expect.soft(refus.status(), `GET /api/${cible.api} avec la mauvaise session`).toBe(403);
        await contexte.close();
      }
    });
  });
}
