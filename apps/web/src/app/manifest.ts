import type { MetadataRoute } from "next";

/**
 * Manifest PWA — cible : l'app chauffeur (« Ajouter à l'écran d'accueil »).
 * Les icônes dédiées (192/512) seront ajoutées dans une passe de polish ;
 * en leur absence le navigateur retombe sur la favicon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PORTTRACK Chauffeur",
    short_name: "PORTTRACK",
    description: "Application chauffeur PORTTRACK — désignation, check-list, livraisons.",
    start_url: "/fr/chauffeur",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "fr",
  };
}
