import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { COMPTES, connecterClient } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// GOF-b : back-office (docs/user-stories.md).

// Pages du back-office (front/src/main.js) et routes d'administration
// (back/src/routes.php), relues à chaque lancement : une page ou une route
// ajoutée plus tard est contrôlée sans toucher à ce test.
const PAGES_ADMIN = [...readFileSync(new URL("../../src/main.js", import.meta.url), "utf8").matchAll(/addRoute\("(\/admin[^"]*)"/g)]
  .map(([, chemin]) => chemin.replace(":id", "1").replace(":numero", "PS-00000000-0000"));

const ROUTES_ADMIN = [
  ...readFileSync(new URL("../../../back/src/routes.php", import.meta.url), "utf8").matchAll(/'(GET|POST)\s+\/api\/(admin\/[^']+)'/g),
]
  .map(([, methode, chemin]) => ({ methode, chemin }))
  // Connexion, déconnexion et état de session sont ouverts à tous.
  .filter(({ chemin }) => !["admin/login", "admin/logout"].includes(chemin));

test.describe("GOF-b · DoD spécifique", () => {
  test("DoD : compte administrateur de test en base de données @lecture", async ({ page }) => {
    await page.goto("admin");
    await page.getByLabel(/e-mail/i).fill(COMPTES.admin.email);
    await page.getByLabel(/mot de passe/i).fill(COMPTES.admin.mdp);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  });

  test("DoD : aucune page /admin n'est accessible sans authentification administrateur @lecture", async ({ page }) => {
    expect(PAGES_ADMIN.length).toBeGreaterThan(5);

    for (let chemin of PAGES_ADMIN) {
      await page.goto(chemin.slice(1));
      await expect.soft(page.getByRole("heading", { name: "Back-office" }), `${chemin} sans session`).toBeVisible();
    }

    // Toutes les routes d'administration : 403 sans session, puis avec une session client.
    for (let session of ["aucune", "client"]) {
      if (session === "client") {
        await connecterClient(page);
      }
      for (let { methode, chemin } of ROUTES_ADMIN) {
        let reponse = methode === "GET" ? await page.request.get(`api/${chemin}`) : await page.request.post(`api/${chemin}`, { data: {} });
        expect.soft(reponse.status(), `${methode} /api/${chemin} (session : ${session})`).toBe(403);
      }
    }
  });
});

testerDodCommune("GOF-b", {
  pages: [{ chemin: "/admin", connexion: "admin" }, { chemin: "/admin" }],
  formulaires: [
    { chemin: "/admin", bouton: "Se connecter", api: { chemin: "admin/login", corps: { email: "", mdp: "" } } },
  ],
  reservees: [{ chemin: "/admin", droit: "admin", api: "admin/tableau-de-bord" }],
});
