import { AdminData } from "../../data/admin.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { NavigationAdminView } from "../../ui/navigation-admin/index.js";
import template from "./template.html?raw";

/**
 * Layout du back-office : la navigation entre les sections d'administration,
 * puis la page affichée. Distinct du layout de la boutique (ni header ni
 * footer), il est choisi pour toute adresse commençant par /admin.
 *
 * Le slot nommé « navigation » est remplacé ici. Le slot sans nom est laissé
 * au routeur, qui y place la page.
 *
 * @returns {DocumentFragment}
 */
export function AdminLayout() {
  let layout = htmlToFragment(template);
  layout
    .querySelector('slot[name="navigation"]')
    .replaceWith(NavigationAdminView.dom({ surDeconnexion: seDeconnecter }));
  return layout;
}

/**
 * Ferme la session d'administration, puis revient à /admin, qui affiche le
 * formulaire de connexion. Une erreur réseau ne change rien : la page reste.
 */
async function seDeconnecter() {
  try {
    await AdminData.logout();
    naviguer("/admin");
  } catch (erreur) {
    // Le serveur n'a pas répondu : la session reste telle qu'il la connaît.
  }
}
