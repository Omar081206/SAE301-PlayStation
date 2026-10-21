import { defineConfig, devices } from "@playwright/test";

// Port réservé aux tests : un port fixe (strictPort) plutôt que 5173, que le
// serveur de développement d'un autre utilisateur de la machine peut occuper.
const PORT = 5273;

// Chemin du projet : identique à BASE dans vite.config.js.
const BASE = "/~hadj-zekri1/SAE301/";

// Navigateurs lancés : E2E_NAVIGATEURS="chromium,firefox,webkit". WebKit n'est
// pas lancé par défaut : il lui manque des bibliothèques système sur le
// serveur de l'IUT (le test « testé sur 3 navigateurs » le signale).
const NAVIGATEURS = (process.env.E2E_NAVIGATEURS ?? "chromium,firefox").split(",");

const APPAREILS = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
};

export default defineConfig({
  testDir: "./tests",

  // Les tests d'une US s'enchaînent dans l'ordre de la DoD ; les fichiers
  // (une US chacun) tournent en parallèle.
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 60_000,

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // Le front de travail (npm run dev) : les tests portent sur le code en
    // cours, l'API est celle du serveur (proxy de vite.config.js).
    baseURL: `http://localhost:${PORT}${BASE}`,
    locale: "fr-FR",
    // La maquette Desktop 1440 ; le test « responsive » change lui-même de taille.
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: NAVIGATEURS.map((nom) => ({
    name: nom,
    use: { ...APPAREILS[nom], viewport: { width: 1440, height: 900 } },
  })),

  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
