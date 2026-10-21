import { getRequest } from "../lib/api-request.js";

let AdminStatistiqueData = {};

/**
 * Statistiques du back-office : GET /api/admin/statistiques
 * 403 sans connexion administrateur. Recalculées à chaque appel.
 *
 * { periode: 7,
 *   commandes: { total, en_cours, disponible, retiree, annulee },
 *   revenus: { jours: [ { jour: "2026-10-15", total } ], total },
 *   stocks: [ { nom, options, stock, etat_stock } ],
 *   meilleuresVentes: [ { nom, ventes } ] }
 * Commandes et revenus : les 7 derniers jours ; options : valeurs d'options
 * de la variante (« Blanc »), ou null.
 */
AdminStatistiqueData.fetchAll = async function () {
  return getRequest("admin/statistiques");
};

export { AdminStatistiqueData };
