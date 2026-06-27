"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MapPinOff, Loader2 } from "lucide-react";

import { POSITION_PING_INTERVAL_MS, POSITION_MIN_MOVE_M } from "@porttrack/shared";
import { recordPositionAction } from "./position-actions";

const STORAGE_KEY = "porttrack_geo_paused";

type Status = "starting" | "on" | "denied" | "unsupported" | "paused";

/** Distance en mètres entre deux points (Haversine). */
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Partage la position du chauffeur tant que la PWA est ouverte (premier plan).
 * Un point est envoyé toutes les ~60 s, et seulement si le camion a bougé d'au
 * moins 30 m depuis le dernier envoi (évite le bruit à l'arrêt). Le chauffeur
 * peut mettre en pause (la préférence est mémorisée).
 */
export function PositionTracker() {
  const [status, setStatus] = useState<Status>("starting");
  const lastSent = useRef<{ lat: number; lng: number } | null>(null);
  const sending = useRef(false);

  // Lit la préférence de pause au montage.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    setPaused(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (paused) { setStatus("paused"); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;

    const captureAndSend = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          setStatus("on");
          const { latitude, longitude, accuracy } = pos.coords;
          const prev = lastSent.current;
          // N'envoie que si premier point ou déplacement significatif.
          if (prev && distanceM(prev.lat, prev.lng, latitude, longitude) < POSITION_MIN_MOVE_M) {
            return;
          }
          if (sending.current) return;
          sending.current = true;
          try {
            const r = await recordPositionAction(latitude, longitude, accuracy ?? null);
            if (r.ok) lastSent.current = { lat: latitude, lng: longitude };
          } finally {
            sending.current = false;
          }
        },
        (err) => {
          if (cancelled) return;
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "starting");
        },
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
      );
    };

    captureAndSend(); // point immédiat au montage
    const id = setInterval(captureAndSend, POSITION_PING_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [paused]);

  function togglePause() {
    const next = !paused;
    setPaused(next);
    if (next) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  }

  // Pastille discrète au-dessus de la barre du bas.
  const label =
    status === "on" ? "Position partagée"
    : status === "starting" ? "Localisation…"
    : status === "paused" ? "Partage en pause"
    : status === "denied" ? "Localisation refusée"
    : "GPS indisponible";

  const live = status === "on";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center">
      <button
        type="button"
        onClick={togglePause}
        className={
          "pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] shadow-sm backdrop-blur " +
          (live
            ? "border-emerald-300 bg-emerald-50/90 text-emerald-800"
            : status === "denied" || status === "unsupported"
              ? "border-amber-300 bg-amber-50/90 text-amber-800"
              : "border-slate-300 bg-slate-50/90 text-slate-600")
        }
        title={paused ? "Reprendre le partage de position" : "Mettre en pause le partage de position"}
      >
        {status === "starting" ? <Loader2 className="size-3 animate-spin" />
          : paused || status === "denied" || status === "unsupported" ? <MapPinOff className="size-3" />
          : <MapPin className="size-3" />}
        {label}
      </button>
    </div>
  );
}
