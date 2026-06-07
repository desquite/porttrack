import { ImageResponse } from "next/og";

/**
 * Icône « apple-touch-icon » iOS (180×180), générée à la volée par Next
 * (next/og) — pas de PNG binaire à versionner, pas de dépendance native.
 *
 * iOS lit mal les SVG en icône d'écran d'accueil : il faut un PNG opaque.
 * Bonne pratique : fond plein (pas de coins arrondis ni de transparence) —
 * iOS applique lui-même son masque « squircle ». D'où le carré marine plein
 * ici, avec l'ancre PORTTRACK blanche centrée (même design que /icon.svg).
 *
 * Next injecte automatiquement <link rel="apple-touch-icon"> dans le <head>.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Ancre Lucide « anchor » en blanc, fond transparent (posée sur le carré marine).
const ANCHOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d3557",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={104}
          height={104}
          src={`data:image/svg+xml;utf8,${encodeURIComponent(ANCHOR_SVG)}`}
          alt="PORTTRACK"
        />
      </div>
    ),
    { ...size },
  );
}
