// Gabarit de module data. Copier vers front/src/data/<nom>.js
import { getRequest, postRequest } from "../lib/api-request.js";

let ExempleData = {};

/**
 * Un élément : GET /api/exemple?slug=…
 *
 * { elements: [ { id: 1, nom: "…", note_moyenne: 4.5 } ], choisi: null }
 */
ExempleData.fetchOne = async function (slug) {
  return getRequest(`exemple?slug=${encodeURIComponent(slug)}`);
};

/**
 * Enregistrement : POST /api/exemple/enregistrer, corps JSON { id }.
 */
ExempleData.save = async function (id) {
  return postRequest("exemple/enregistrer", { id });
};

export { ExempleData };
