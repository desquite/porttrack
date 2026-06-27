"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Polyline } from "leaflet";
import { MapPin, RefreshCw, Route, X, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LivePosition = {
  chauffeurId: string;
  nom: string;
  truck: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  capturedAt: string;
};

const ABIDJAN: [number, number] = [5.345, -4.024];
const REFRESH_MS = 20_000;
const FR_TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 42%)`;
}
function initials(name: string): string {
  return name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function SuiviMap() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const trailRef = useRef<Polyline | null>(null);

  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);

  // Init carte + polling.
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapDiv.current) return;
      LRef.current = L;
      const map = L.map(mapDiv.current).setView(ABIDJAN, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      setReady(true);

      const drawMarkers = (list: LivePosition[]) => {
        const group = markersRef.current;
        if (!group) return;
        group.clearLayers();
        const pts: [number, number][] = [];
        for (const p of list) {
          const color = colorFor(p.chauffeurId);
          const icon = L.divIcon({
            className: "",
            html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};color:#fff;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"><span style="transform:rotate(45deg)">${initials(p.nom)}</span></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 28],
          });
          const m = L.marker([p.lat, p.lng], { icon }).addTo(group);
          m.bindPopup(
            `<strong>${p.nom}</strong><br/>${p.truck ?? "Camion non désigné"}<br/>` +
            `<span style="color:#64748b">${FR_TIME.format(new Date(p.capturedAt))}${p.accuracy ? ` · ±${Math.round(p.accuracy)} m` : ""}</span>`,
          );
          pts.push([p.lat, p.lng]);
        }
        if (pts.length > 0 && !trailRef.current) {
          map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
        }
      };

      const refresh = async () => {
        try {
          const res = await fetch("/api/suivi/positions", { cache: "no-store" });
          if (!res.ok) return;
          const json = (await res.json()) as { positions: LivePosition[] };
          if (cancelled) return;
          setPositions(json.positions);
          setLastRefresh(new Date());
          drawMarkers(json.positions);
        } catch { /* réseau : on réessaiera au prochain tick */ }
      };
      await refresh();
      interval = setInterval(refresh, REFRESH_MS);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Trace du jour pour le chauffeur sélectionné.
  async function showTrail(chauffeurId: string) {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (trailRef.current) { trailRef.current.remove(); trailRef.current = null; }
    if (selected === chauffeurId) { setSelected(null); return; } // toggle off
    setSelected(chauffeurId);
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/suivi/trail?chauffeur=${chauffeurId}&date=${today}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { points: { lat: number; lng: number }[] };
    if (json.points.length < 2) return;
    const latlngs = json.points.map((p) => [p.lat, p.lng]) as [number, number][];
    trailRef.current = L.polyline(latlngs, { color: colorFor(chauffeurId), weight: 4, opacity: 0.8 }).addTo(map);
    map.fitBounds(latlngs, { padding: [40, 40] });
  }

  function clearTrail() {
    if (trailRef.current) { trailRef.current.remove(); trailRef.current = null; }
    setSelected(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* Carte */}
      <Card className="overflow-hidden">
        <div ref={mapDiv} className="h-[60vh] w-full" />
      </Card>

      {/* Liste latérale */}
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" />En ligne
                <Badge variant="secondary" className="text-[10px]">{positions.length}</Badge>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <RefreshCw className="size-3" />
                {lastRefresh ? FR_TIME.format(lastRefresh) : "—"}
              </span>
            </div>

            {!ready ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Chargement de la carte…</p>
            ) : positions.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                Aucun chauffeur en ligne. Un chauffeur apparaît ici dès qu&apos;il ouvre l&apos;app et partage sa position.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {positions.map((p) => (
                  <li key={p.chauffeurId}>
                    <button
                      type="button"
                      onClick={() => showTrail(p.chauffeurId)}
                      className={"flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors " + (selected === p.chauffeurId ? "border-primary bg-primary/10" : "border-input hover:bg-accent")}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: colorFor(p.chauffeurId) }}>
                        {initials(p.nom)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.nom}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{p.truck ?? "Camion non désigné"}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="size-3" />{FR_TIME.format(new Date(p.capturedAt))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Button variant="outline" size="sm" onClick={clearTrail} className="w-full gap-1.5">
            <X className="size-3.5" />Masquer la trace
          </Button>
        )}
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Route className="mt-0.5 size-3 shrink-0" />
          Clique sur un chauffeur pour afficher son trajet du jour.
        </p>
      </div>
    </div>
  );
}
