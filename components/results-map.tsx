"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { formatPrice } from "@/lib/listings";
import type { SearchHit, SearchLocation } from "@/lib/search";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Pins sit at zip-code centers (never a seller's address). One pin per zip. */
export function ResultsMap({ hits, center }: { hits: SearchHit[]; center: SearchLocation | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      mapRef.current?.remove();

      const map = L.map(ref.current, { scrollWheelZoom: false });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const byZip = new Map<string, SearchHit[]>();
      for (const h of hits) {
        if (h.zip_lat == null || h.zip_lng == null) continue;
        byZip.set(h.zip, [...(byZip.get(h.zip) ?? []), h]);
      }

      const bounds = L.latLngBounds([]);
      for (const group of byZip.values()) {
        const { zip_lat, zip_lng } = group[0];
        const point = L.latLng(zip_lat!, zip_lng!);
        bounds.extend(point);
        const items = group
          .slice(0, 8)
          .map((h) => `<li style="margin:4px 0"><a href="/listing/${h.id}" style="font-weight:600">${esc(h.title)}</a><br>${esc(formatPrice(h.price_cents))}</li>`)
          .join("");
        const more = group.length > 8 ? `<li>+${group.length - 8} more</li>` : "";
        L.circleMarker(point, { radius: 10 + Math.min(group.length, 10), color: "#c2410c", fillColor: "#f97316", fillOpacity: 0.85, weight: 2 })
          .addTo(map)
          .bindPopup(`<ul style="list-style:none;padding:0;margin:0;max-width:220px">${items}${more}</ul>`);
      }

      if (center) {
        L.circleMarker([center.lat, center.lng], { radius: 7, color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 1, weight: 3 })
          .addTo(map)
          .bindTooltip("You");
        bounds.extend([center.lat, center.lng]);
      }

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
      else map.setView([39.8, -98.6], 4); // continental US
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hits, center]);

  return <div ref={ref} className="z-0 h-[65vh] min-h-80 w-full overflow-hidden rounded-xl border" />;
}
