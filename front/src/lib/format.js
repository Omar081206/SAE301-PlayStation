/**
 * Petites fonctions de mise en forme, sans dépendance.
 */

/**
 * 549.99 -> « 549,99 € » (format monétaire français)
 */
export function formaterPrix(prix) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(prix);
}
