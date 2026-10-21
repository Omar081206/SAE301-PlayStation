import { test, expect } from "@playwright/test";
import { connecterClient, envoyer, lire } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";

// SUI-b : espace personnel (docs/user-stories.md).

test.describe("SUI-b · DoD spécifique", () => {
  test("DoD : la modification du mot de passe exige le mot de passe actuel @lecture", async ({ page }) => {
    await connecterClient(page);
    let { profil } = await lire(page, "compte");
    let identite = { prenom: profil.prenom, nom: profil.nom, email: profil.email };

    // Les deux refus ne changent rien au compte.
    let sansActuel = await envoyer(page, "compte/profil", { ...identite, mdpActuel: "", nouveauMdp: "nouveau-mdp-e2e" });
    expect(sansActuel.statut, "sans mot de passe actuel").toBe(422);
    expect(sansActuel.corps.erreur).toMatch(/mot de passe actuel/);

    let faux = await envoyer(page, "compte/profil", { ...identite, mdpActuel: "faux-mdp-e2e", nouveauMdp: "nouveau-mdp-e2e" });
    expect(faux.statut, "mot de passe actuel faux").toBe(422);
    expect(faux.corps.erreur).toMatch(/incorrect/);

    // Le formulaire affiche le refus.
    await page.goto("compte/profil");
    await page.getByLabel(/nouveau mot de passe/i).fill("nouveau-mdp-e2e");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page.getByText(/mot de passe actuel/i).filter({ visible: true }).last()).toBeVisible();
  });
});

testerDodCommune("SUI-b", {
  pages: [
    { chemin: "/compte", connexion: "client" },
    { chemin: "/compte/profil", connexion: "client" },
  ],
  formulaires: [
    {
      chemin: "/compte/profil",
      connexion: "client",
      bouton: "Enregistrer les modifications",
      api: { chemin: "compte/profil", corps: { prenom: "", nom: "", email: "", mdpActuel: "", nouveauMdp: "" } },
    },
  ],
  reservees: [
    { chemin: "/compte", droit: "client", api: "compte" },
    { chemin: "/compte/profil", droit: "client", api: "compte" },
  ],
});
