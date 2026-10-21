"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Uses the phone's GPS for this search only (rounded to ~1 km; never saved). */
export function LocationButton({ basePath = "/search" }: { basePath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) {
      setError("Your browser can't share location. Enter a zip instead.");
      return;
    }
    setPending(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("lat", pos.coords.latitude.toFixed(2));
        params.set("lng", pos.coords.longitude.toFixed(2));
        params.delete("zip");
        params.delete("page");
        router.push(`${basePath}?${params.toString()}`);
        setPending(false);
      },
      () => {
        setPending(false);
        setError("Couldn't get your location. Enter a zip instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" className="h-12 px-4 text-base" onClick={locate} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Crosshair />}
        Use my location
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
