import type { MetadataRoute } from "next";

/**
 * Manifest PWA — cible : l'app chauffeur (« Ajouter à l'écran d'accueil »).
 * Icône = /public/icon.svg (ancre PORTTRACK sur fond bleu marine, vectoriel
 * donc net à toutes les tailles). Référencée 2× : « any » (sans masque) +
 * « maskable » (Android adaptive icon) car le design respecte la safe area
 * de 80 % (l'ancre est dans le carré central, le fond va jusqu'aux bords).
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
    theme_color: "#1d3557",
    lang: "fr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
