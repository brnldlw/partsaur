import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { SITE_URL } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

async function partEntries(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await createPublicClient().rpc("sitemap_parts");
  if (error) {
    console.error("sitemap_parts failed:", error.message);
    return [];
  }
  return (data as { slug: string; last_modified: string }[]).map((p) => ({
    url: `${SITE_URL}/part/${p.slug}`,
    lastModified: p.last_modified,
    changeFrequency: "daily",
    priority: 0.7,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.6 },
    ...(await partEntries()),
  ];
}
