import { test, expect } from "@playwright/test";
import { PREFIXE, lire } from "../outils/api.js";
import { testerDodCommune } from "../outils/dod-commune.js";
import { requeteBase } from "../outils/serveur.js";

// OPT-b : variantes et stock par variante (docs/user-stories.md).

test.describe("OPT-b · DoD spécifique", () => {
  test("DoD : modélisation des variantes en base de données @lecture", async ({ page }) => {
    // Les produits des tests @ecriture lancés en même temps (e2e-…) peuvent disparaître : écartés.
    let { produits } = await lire(page, "produits");

    for (let resume of produits.filter((element) => !element.slug.startsWith(`${PREFIXE}-`))) {
      let { produit } = await lire(page, `produit?slug=${resume.slug}`);
      expect.soft(produit.variantes.length, `variantes de ${produit.slug}`).toBeGreaterThan(0);

      let combinaisons = new Set();
      for (let variante of produit.variantes) {
        // Une valeur par option, son prix et son état de stock propres.
        expect.soft(variante.valeurs, `valeurs d'une variante de ${produit.slug}`).toHaveLength(produit.options.length);
        expect.soft(typeof variante.prix).toBe("number");
        expect.soft(["en_stock", "bientot_epuise", "epuise"]).toContain(variante.etat_stock);
        combinaisons.add(variante.valeurs.join("|"));
      }
      expect.soft(combinaisons.size, `combinaisons distinctes de ${produit.slug}`).toBe(produit.variantes.length);
    }
  });

  test("DoD : migration des données et du code existants vers ce modèle @lecture", async () => {
    // Plus de prix ni de stock au niveau du produit : tout est porté par la variante.
    let colonnes = requeteBase("SHOW COLUMNS FROM produit").map((colonne) => colonne.Field);
    expect(colonnes).not.toContain("stock");
    expect(colonnes).not.toContain("prix");

    let [orphelins] = requeteBase(
      "SELECT COUNT(*) AS nombre FROM produit p WHERE NOT EXISTS (SELECT 1 FROM variante v WHERE v.produit_id = p.id)",
    );
    expect(Number(orphelins.nombre), "produits sans variante").toBe(0);

    let colonnesLignes = requeteBase("SHOW COLUMNS FROM ligne_commande").map((colonne) => colonne.Field);
    expect(colonnesLignes, "lignes de commande identifiées par variante").toContain("variante_id");
  });
});

testerDodCommune("OPT-b", {
  pages: [{ chemin: "/produit/facades-console-ps5" }],
});
