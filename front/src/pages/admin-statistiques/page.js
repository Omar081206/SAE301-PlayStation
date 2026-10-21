import { AdminStatistiqueData } from "../../data/admin-statistique.js";
import { naviguer } from "../../lib/navigation.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MeilleuresVentesView } from "../../ui/meilleures-ventes/index.js";
import { MessageView } from "../../ui/message/index.js";
import { RevenusSemaineView } from "../../ui/revenus-semaine/index.js";
import { StatistiquesCommandesView } from "../../ui/statistiques-commandes/index.js";
import { StockProduitsView } from "../../ui/stock-produits/index.js";
import template from "./template.html?raw";

/**
 * Page « Statistiques » du back-office : commandes et revenus des 7 derniers
 * jours, stock de chaque variante, produits les plus vendus, et leur export.
 *
 * Comme la page Catégories, elle ne protège rien : sans session
 * d'administration (403), elle renvoie à /admin, qui affiche la connexion.
 * Les statistiques sont redemandées au serveur à chaque ouverture de la page
 * et avant chaque export : rien n'est gardé d'une visite à l'autre.
 */

let M = {
  statistiques: null, // réponse du serveur, ou null
  message: null, // { type, texte }, ou null
};

let C = {};

/**
 * Demande les statistiques. Renvoie faux sans session d'administration (403).
 */
C.charger = async function () {
  try {
    M.statistiques = await AdminStatistiqueData.fetchAll();
    M.message = null;
  } catch (erreur) {
    M.statistiques = null;

    if (erreur.statut === 403) {
      return false;
    }
    M.message = { type: "erreur", texte: `Impossible de charger les statistiques : ${erreur.message}` };
  }

  return true;
};

/**
 * Le contenu du fichier CSV, une section par bloc de la page. Point-virgule
 * et virgule décimale : le format qu'attend un tableur réglé en français.
 */
C.csv = function () {
  let s = M.statistiques;
  let nombre = (valeur) => valeur.toFixed(2).replace(".", ",");
  // Chaque champ entre guillemets (doublés à l'intérieur) : un nom de produit
  // peut contenir un point-virgule.
  let ligne = (...champs) => champs.map((champ) => `"${String(champ).replaceAll('"', '""')}"`).join(";");

  let lignes = [
    ligne(`Commandes des ${s.periode} derniers jours`),
    ligne("Statut", "Nombre"),
    ligne("Total", s.commandes.total),
    ligne("En cours", s.commandes.en_cours),
    ligne("Disponibles", s.commandes.disponible),
    ligne("Retirées", s.commandes.retiree),
    ligne("Annulées", s.commandes.annulee),
    "",
    ligne(`Revenus des ${s.periode} derniers jours`),
    ligne("Jour", "Revenus (€)"),
    ...s.revenus.jours.map((jour) => ligne(jour.jour, nombre(jour.total))),
    ligne("Total", nombre(s.revenus.total)),
    "",
    ligne("Stock par produit"),
    ligne("Produit", "Options", "Stock", "État"),
    ...s.stocks.map((variante) =>
      ligne(variante.nom, variante.options ?? "", variante.stock, variante.etat_stock)
    ),
    "",
    ligne("Produits les plus vendus"),
    ligne("Produit", "Ventes"),
    ...s.meilleuresVentes.map((produit) => ligne(produit.nom, produit.ventes)),
  ];

  return lignes.join("\r\n");
};

C.handler_exporter = async function () {
  // Statistiques redemandées : le fichier contient les chiffres du moment.
  if (!(await C.charger())) {
    naviguer("/admin");
    return;
  }

  V.rafraichir();

  if (M.statistiques !== null) {
    // Le dernier jour de la période est la date du serveur.
    let jours = M.statistiques.revenus.jours;
    V.telecharger(C.csv(), `statistiques-${jours[jours.length - 1].jour}.csv`);
  }
};

C.init = async function () {
  M.message = null;

  if (!(await C.charger())) {
    naviguer("/admin");
    // Le routeur affichera la connexion : ce contenu ne sera pas montré.
    return "";
  }

  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

// Même principe que la page Catalogue : toute la page se reconstruit à partir
// du modèle.
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

/**
 * Propose le texte en téléchargement, sous ce nom de fichier. L'API ne
 * renvoie que du JSON : le fichier est fabriqué ici. Le BOM indique l'UTF-8
 * au tableur (accents).
 */
V.telecharger = function (texte, nomFichier) {
  let adresse = URL.createObjectURL(new Blob(["﻿" + texte], { type: "text/csv;charset=utf-8" }));
  let lien = document.createElement("a");
  lien.href = adresse;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(adresse);
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  let slots = {};
  for (let nom of ["commandes", "stocks", "revenus", "ventes"]) {
    slots[nom] = pageFragment.querySelector(`slot[name="${nom}"]`);
  }

  let bouton = pageFragment.querySelector('[data-action="exporter"]');

  if (M.statistiques === null) {
    Object.values(slots).forEach((slot) => slot.remove());
    bouton.remove();
    return pageFragment;
  }

  bouton.addEventListener("click", C.handler_exporter);

  slots.commandes.replaceWith(StatistiquesCommandesView.dom(M.statistiques));
  slots.stocks.replaceWith(StockProduitsView.dom(M.statistiques.stocks));
  slots.revenus.replaceWith(RevenusSemaineView.dom(M.statistiques));
  slots.ventes.replaceWith(MeilleuresVentesView.dom(M.statistiques.meilleuresVentes));

  return pageFragment;
};

export function AdminStatistiquesPage() {
  return C.init();
}
