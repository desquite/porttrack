import { PorttrackLoader } from "@/components/porttrack-loader";

/**
 * Loading UI automatique du route group (app).
 *
 * Next.js l'affiche pendant que les Server Components d'une page de l'app
 * authentifiée chargent leurs données (navigation entre Dashboard, Chauffeurs,
 * Flotte, Conteneurs, Affectations…). Remplacé par la vraie page dès que les
 * données sont prêtes.
 */
export default function AppLoading() {
  return <PorttrackLoader label="Chargement de votre espace…" />;
}
