import { Anchor } from "lucide-react";

/**
 * Loader PORTTRACK — prototype B : ancre centrée + ondes concentriques
 * qui s'éloignent en rythme (effet "vagues autour de l'ancre").
 *
 * Auto-contenu : les keyframes sont dans une balise <style> locale pour ne
 * dépendre d'aucune config externe. Respecte prefers-reduced-motion.
 *
 * Server Component (animation 100% CSS, aucun JS nécessaire).
 */
export function PorttrackLoader({
  label = "Chargement…",
  fullscreen = false,
}: {
  label?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center gap-6 " +
        (fullscreen ? "min-h-screen" : "min-h-[60vh]")
      }
    >
      <style>{`
        @keyframes ptl-ripple {
          0%   { transform: scale(0.4); opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes ptl-bob {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%      { transform: translateY(-4px) rotate(4deg); }
        }
        .ptl-ripple {
          animation: ptl-ripple 2.4s cubic-bezier(0.22,0.61,0.36,1) infinite;
        }
        .ptl-bob {
          animation: ptl-bob 2.8s ease-in-out infinite;
          transform-origin: 50% 20%;
        }
        @media (prefers-reduced-motion: reduce) {
          .ptl-ripple, .ptl-bob { animation: none; }
        }
      `}</style>

      {/* Zone ancre + ondes */}
      <div className="relative flex size-32 items-center justify-center">
        {/* Ondes concentriques (3 cercles décalés dans le temps) */}
        <span
          className="ptl-ripple absolute inset-0 rounded-full border-2 border-primary/40"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="ptl-ripple absolute inset-0 rounded-full border-2 border-primary/40"
          style={{ animationDelay: "0.8s" }}
        />
        <span
          className="ptl-ripple absolute inset-0 rounded-full border-2 border-primary/40"
          style={{ animationDelay: "1.6s" }}
        />

        {/* Disque central + ancre */}
        <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Anchor className="ptl-bob size-8" />
        </span>
      </div>

      {/* Marque + label */}
      <div className="text-center">
        <div className="text-lg font-semibold tracking-tight text-foreground">
          PORTTRACK
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
