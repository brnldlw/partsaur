# Partsaur — Build Spec (CLAUDE.md)

> Claude Code: read this whole file before doing anything. Build ONE phase at a time.
> At the end of each phase: run `npm run build`, fix errors, commit, push to `main`,
> then STOP and give Brian a plain-English summary + what he needs to click/test.
> Brian is a 30-year HVAC/R tech, not a career developer. Explain steps simply.
> Ask before adding any paid service, deleting data, or changing pricing.

---

## 1. What Partsaur is

A marketplace where trades businesses and techs **list overstock, dead stock, leftover-from-job,
and obsolete parts**, and where techs **find parts fast** — especially when a unit is down and the
part is weeks out from the supply house.

- **Domain:** partsaur.com
- **Launch trade:** HVAC/R (commercial focus). Electrical + Plumbing show as **"Coming Soon"** with a waitlist.
- **Core differentiators (do not lose these):**
  1. **Photo-to-listing** — snap the box label/nameplate, AI fills in brand, part #, specs. Listing in <30 sec.
  2. **Wanted board** — techs post "need part X by Friday within 150 mi"; Partsaur pings matching sellers.
  3. **Part-number SEO pages** — every part gets a public, Google-indexable page.
- **Owner:** Brian. Partsaur is a standalone product that must stay **separable** from his other apps
  (own Supabase project, own Stripe account, own user table). Cross-app links are a removable bridge.

---

## 2. Stack & rules

- Next.js (App Router, TypeScript) — started from the `with-supabase` template already in this repo
- Supabase: Postgres + Auth + Storage + PostGIS
- Tailwind + shadcn/ui (already in template)
- Vercel hosting (auto-deploys on push to `main`)
- Stripe (Checkout + Customer Portal + Connect later)
- Anthropic API for photo extraction (server-side only)
- Email: Resend (transactional)
- Maps: Leaflet + OpenStreetMap tiles (free) — no paid map API at launch

**Env vars** (names are fixed; never commit real values; `.env.local` is gitignored):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY          # server only, never NEXT_PUBLIC_
ANTHROPIC_API_KEY                  # server only
ANTHROPIC_MODEL=claude-sonnet-5-5  # server only, overridable
STRIPE_SECRET_KEY                  # server only
STRIPE_WEBHOOK_SECRET              # server only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RESEND_API_KEY                     # server only
NEXT_PUBLIC_SITE_URL=https://partsaur.com
BRIDGE_SHARED_SECRET               # server only (My HVAC/R Tool bridge, phase 7)
```
When a phase needs a new env var, tell Brian exactly: the name, where to get the value,
and that it must be added in **both** `.env.local` and Vercel (type **Config** for `NEXT_PUBLIC_`,
**Secret** for everything else).

**Coding rules**
- Every table has Row Level Security ON with explicit policies. No table left open.
- All schema changes go in `supabase/migrations/NNNN_name.sql`. Give Brian the SQL to run in
  Supabase → SQL Editor if the CLI isn't linked.
- Server Actions / Route Handlers for writes. Never call Anthropic or Stripe from the browser.
- Mobile-first UI. Techs use this on a phone in a mechanical room. Big tap targets, dark-mode friendly.
- Keep it simple: no microservices, no extra frameworks.

---

## 3. Data model (build incrementally; this is the target)

```
profiles            id (=auth.users.id), display_name, phone, trade ('hvacr'|'electrical'|'plumbing'),
                    role ('tech'|'shop'|'supply_house'), business_id, zip, location geography(Point),
                    epa608_verified bool, created_at
businesses          id, name, type ('contractor'|'supply_house'|'surplus'), owner_id, address, zip,
                    location geography(Point), plan ('free'|'founding_shop'|'shop_pro'|
                    'founding_supply'|'supply_house'), stripe_customer_id, created_at
parts               id, brand, part_number, part_number_normalized (uppercase, no spaces/dashes),
                    description, category, trade, slug (unique: brand-partnumber), created_at
listings            id, seller_id (profiles), business_id null, part_id null, title, brand, part_number,
                    part_number_normalized, description, category, trade,
                    condition ('new_in_box'|'new_open_box'|'new_old_stock'|'used_working'|'for_parts'),
                    quantity, price_cents null (null = "make offer"), pickup bool, ships bool,
                    zip, location geography(Point), status ('draft'|'active'|'sold'|'removed'),
                    is_refrigerant bool, ai_extracted jsonb, created_at, updated_at
listing_photos      id, listing_id, storage_path, sort_order
wanted_requests     id, requester_id, part_number, part_number_normalized, brand, description,
                    trade, needed_by date, radius_miles int default 150, zip, location geography(Point),
                    status ('open'|'filled'|'closed'), boosted_until timestamptz null, created_at
matches             id, wanted_id, listing_id null, seller_id, match_type ('exact'|'likely'|'ping'),
                    notified_at, seller_response ('have_it'|'no'|null)
conversations       id, listing_id null, wanted_id null, buyer_id, seller_id, created_at
messages            id, conversation_id, sender_id, body, created_at, read_at
certifications      id, profile_id, type ('epa608'), cert_number, storage_path (private bucket),
                    status ('pending'|'approved'|'rejected'), reviewed_at
reports             id, reporter_id, listing_id, reason, created_at
waitlist            id, email, trade, role, zip, created_at
```

Storage buckets: `listing-photos` (public read), `certifications` (private, owner + admin only).

Radius search: SQL function `search_listings(q text, lat float, lng float, radius_miles int)`
using `ST_DWithin`. Same pattern for matching wanted requests.

Normalization: `part_number_normalized = upper(regexp_replace(part_number, '[^A-Za-z0-9]', '', 'g'))`.
All part-number search/matching uses the normalized column.

---

## 4. Pricing (show plainly on /pricing — no surprises)

| Who | Price | Gets |
|---|---|---|
| Buyers / techs | Free | Search, contact sellers, post Wanted requests |
| Individual sellers | Free | Up to 10 active listings |
| **Founding Shop** (first 50) | **$19/mo locked for life** | Unlimited listings, storefront page, bulk CSV upload, priority in Wanted matches |
| Shop Pro (after 50) | $39/mo | Same as Founding Shop |
| **Founding Supply House** (first 10) | **$99/mo locked** | Everything + multi-location, dead-stock feed, regional reach, analytics |
| Supply House (after 10) | $199/mo per branch | Same |
| Urgent Wanted Boost | $9 one-time | Wider radius ping + pinned to top for 72 hrs |

V1 transactions happen off-platform (buyer + seller arrange pickup/payment). Stripe Connect
in-app payments come later (phase 8). Founding counts are enforced in code.

---

## 5. Build phases (do in order; stop after each)

### Phase 0 — Landing page, waitlist, Founding presale  ← START HERE
Goal: partsaur.com live and collecting emails + money before the marketplace exists.
- Replace the template home page with a Partsaur landing page:
  - Hero: "Find the part. Sell the dead stock." Sub: unit's down, part's 3 weeks out — someone nearby has it on a shelf.
  - Three sections: For Techs (find parts fast) / For Shops (turn dead stock into cash) / For Supply Houses (clear obsolete inventory)
  - Trade selector: HVAC/R (Launching) · Electrical (Coming Soon) · Plumbing (Coming Soon)
  - Waitlist form → `waitlist` table (email, trade, role, zip). Thank-you state.
  - Founding offer block with live counter ("37 of 50 Founding Shop spots left") read from DB.
- `/pricing` page from section 4.
- Founding presale: Stripe Checkout (subscription mode) for Founding Shop and Founding Supply House.
  Webhook `/api/stripe/webhook` records the purchase (create minimal `founding_signups` table:
  email, plan, stripe_customer_id, stripe_subscription_id, created_at) and decrements the counter.
  If Stripe keys aren't set yet, show "Reserve your spot" that saves to waitlist with role + plan interest instead.
- Basic SEO: title, meta description, Open Graph image, `sitemap.xml`, `robots.txt`.
- Simple logo wordmark "Partsaur" (text-based is fine) + favicon.
- Footer: Terms, Privacy (placeholder pages clearly marked draft), contact email.
**Done when:** landing + pricing render on mobile, waitlist saves, Checkout works in Stripe test mode.

### Phase 1 — Accounts
- Supabase Auth: email magic link + Google.
- Onboarding: trade, role (tech / shop / supply house), zip → geocode zip to lat/lng
  (use a free zip-centroid dataset loaded into a `zip_codes` table — no paid geocoder).
- Business profile for shop/supply_house roles.
- `/account` page: edit profile, see plan.

### Phase 2 — Listings + photo-to-listing
- `/sell/new`: upload 1–6 photos (camera on mobile). First photo → server action sends image to
  Anthropic API with a prompt to return strict JSON:
  `{brand, part_number, description, category, trade, condition_guess, specs:{voltage, refrigerant, hp, etc}, confidence}`.
  Prefill the form; seller confirms/edits; save `ai_extracted` raw.
- Manual entry fallback always available.
- Listing detail page `/listing/[id]` with photos, condition badge, seller, distance, "Contact seller".
- Seller dashboard `/dashboard/listings`: edit, mark sold, remove.
- Bulk CSV upload for Founding Shop / Supply House plans (template download, preview, import).
- Enforce free-tier 10 active listing limit.
- Refrigerant listings: `is_refrigerant` auto-flag; buyers must have approved EPA 608 cert to contact seller.

### Phase 3 — Search, map, SEO part pages
- `/search?q=&zip=&radius=` — part number, brand, keyword. Results list + Leaflet map toggle.
- Sort: exact part # match first, then distance.
- `/part/[slug]` public SEO page per part: listings near the viewer, "Post a Wanted request" CTA,
  JSON-LD Product markup. Auto-create `parts` rows from listings.
- Add part pages to sitemap.

### Phase 4 — Wanted board + matching (the differentiator)
- `/wanted/new`: part #, brand, description, needed-by, radius. `/wanted` public board.
- On create: find exact matches (normalized part #) within radius → `matches` + email sellers.
  Find "likely" matches (same brand + category within radius, and sellers whose past listings
  include that brand) → "Someone 40 mi away needs X. Have one?" email with one-click Have it / No.
- Seller "Have it" → opens conversation with requester.
- Boost ($9 Stripe Checkout one-time) → widens radius ×2, pins 72 hrs.
- Emails via Resend; keep templates plain and short.

### Phase 5 — Messaging & trust
- In-app conversations (buyer ↔ seller), unread badges, email notification on new message.
- Report listing button → `reports`. Simple `/admin` (Brian only, by email allowlist):
  reports queue, EPA 608 cert approvals, remove listings, see signups.
- Condition standards page. Prohibited items: recalled items, unverified/reclaimed refrigerant.

### Phase 6 — Subscriptions live
- Stripe Checkout for all plans + Customer Portal for cancel/update card.
- Webhooks set `businesses.plan`. Founding price IDs locked; Founding counters enforced.
- Plan-gated features (bulk upload, storefront, unlimited listings) check plan server-side.

### Phase 7 — App + My HVAC/R Tool bridge
- Capacitor wrap (iOS + Android): camera listing, push notifications for Wanted matches + messages.
- Bridge: `/connect?token=` accepts a JWT signed with `BRIDGE_SHARED_SECRET` from My HVAC/R Tool
  (claims: email, name, exp ≤ 5 min). Creates or links a Partsaur account. Partsaur owns its users.
  Bridge can be disabled with one env flag.
- Deep link: `/search?q=<part#>&ref=myhvacrtool`.

### Phase 8 — Later
- Stripe Connect in-app payments (5–8% fee) with buyer protection.
- Open Electrical + Plumbing (flip "Coming Soon" based on waitlist counts).
- Seller ratings, saved searches, price history.

---

## 6. How Brian works with you
- He pastes into VS Code / Codespace. Give copy-paste-ready commands and SQL.
- Before each phase: list what you'll build and any accounts/keys he must create first.
- After each phase: what changed, how to test it on his phone, anything he must click in
  Supabase / Vercel / Stripe — step by step, assume nothing.