export function photoUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${storagePath}`;
}

export function formatPrice(cents: number | null) {
  if (cents == null) return "Make offer";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function listingTag(id: string) {
  return `listing:${id}`;
}

export const PAID_PLANS = new Set(["founding_shop", "shop_pro", "founding_supply", "supply_house"]);
