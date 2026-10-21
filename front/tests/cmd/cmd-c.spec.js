import { test, expect, request } from "@playwright/test";
import { COMPTES, connecterClient } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";
import { requeteBase } from "../outils/serveur.js";

// CMD-c : authentification (docs/user-stories.md).

test.describe("CMD-c · DoD spécifique", () => {
  test("DoD : hashage sécurisé des mots de passe (bcrypt ou équivalent) @lecture", async () => {
    // Le haché n'est jamais lu : on compte seulement les comptes au format bcrypt ($2y$).
    let [compte] = requeteBase(
      "SELECT COUNT(*) AS total, SUM(mot_de_passe LIKE '$2y$%' AND CHAR_LENGTH(mot_de_passe) = 60) AS bcrypt FROM utilisateur",
    );
    expect(Number(compte.total)).toBeGreaterThan(0);
    expect(Number(compte.bcrypt), "comptes au format bcrypt").toBe(Number(compte.total));
  });

  test("DoD : gestion sécurisée des sessions (identifiant de session régénéré à la connexion) @lecture", async ({
    page,
  }, testInfo) => {
    // Une première requête ouvre une session anonyme.
    await page.request.get("api/session");
    let avant = (await page.context().cookies()).find((cookie) => cookie.name === "PHPSESSID");
    expect(avant, "cookie de session avant connexion").toBeDefined();

    await connecterClient(page);
    let apres = (await page.context().cookies()).find((cookie) => cookie.name === "PHPSESSID");
    expect(apres.value, "identifiant changé à la connexion").not.toBe(avant.value);

    // L'ancien identifiant ne donne pas accès au compte.
    let ancien = await request.newContext({
      baseURL: testInfo.project.use.baseURL,
      extraHTTPHeaders: { Cookie: `PHPSESSID=${avant.value}` },
    });
    expect((await ancien.get("api/compte")).status(), "ancien identifiant").toBe(403);
    await ancien.dispose();

    expect(COMPTES.client.email).not.toBe("");
  });
});

testerDodCommune("CMD-c", {
  pages: [{ chemin: "/connexion" }],
  formulaires: [
    { chemin: "/connexion", bouton: "Se connecter", api: { chemin: "login", corps: { email: "", mdp: "" } } },
    {
      chemin: "/connexion",
      // Les onglets n'existent qu'en mobile ; en desktop, les deux formulaires sont affichés.
      avant: async (page) => {
        let onglet = page.getByRole("button", { name: "Créer un compte" });
        if (await onglet.isVisible()) {
          await onglet.click();
        }
      },
      bouton: "Créer mon compte",
      api: { chemin: "inscription", corps: { prenom: "", nom: "", email: "", mdp: "" } },
    },
  ],
});
