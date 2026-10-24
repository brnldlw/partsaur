/**
 * Every trade Partsaur supports, with its categories. To add a trade, add one
 * entry here — no database change needed (the DB only checks the format of
 * trade/category codes; the server checks them against this list).
 */

export type CategoryDef = {
  /** Stored code. Unique within its trade (the same code can exist in two trades). */
  value: string;
  label: string;
  /** Big/heavy items: listings say "Pickup only" or "Ships by freight". */
  freight?: boolean;
  /** Seller must tick this before listing; shown as a caution on the listing. */
  confirm?: { label: string; caution: string };
};

export type TradeDef = {
  value: string;
  label: string;
  status: "live" | "coming_soon";
  /** What the photo AI should read off labels for this trade. */
  aiReads: string;
  categories: CategoryDef[];
};

export const TRADE_LIST: TradeDef[] = [
  {
    value: "hvacr",
    label: "HVAC/R",
    status: "live",
    aiReads: "voltage, phase, Hz, RLA/LRA/FLA, HP, RPM, MFD, tonnage/BTU, refrigerant type",
    categories: [
      { value: "compressors", label: "Compressors" },
      { value: "motors_fans", label: "Motors & Fans (incl. ECM)" },
      { value: "controls_boards", label: "Controls & Boards" },
      { value: "thermostats_sensors", label: "Thermostats & Sensors" },
      { value: "pressure_safety", label: "Pressure & Safety Controls" },
      { value: "valves", label: "Valves (TXV, EEV, reversing, solenoid)" },
      { value: "contactors_relays", label: "Contactors & Relays" },
      { value: "capacitors", label: "Capacitors" },
      { value: "defrost", label: "Defrost (timers, heaters, terminators)" },
      { value: "coils_heat_exchangers", label: "Coils & Heat Exchangers", freight: true },
      { value: "filter_driers_line", label: "Filter Driers & Line Parts" },
      { value: "refrigerant", label: "Refrigerant" },
      { value: "gas_ignition", label: "Gas & Ignition" },
      { value: "drives_vfds", label: "Drives & VFDs" },
      { value: "economizers_actuators", label: "Economizers & Actuators" },
      { value: "walkin_reachin", label: "Walk-in / Reach-in Parts (gaskets, heaters, door parts)" },
      { value: "ice_machine", label: "Ice Machine Parts" },
      { value: "belts_pulleys", label: "Belts & Pulleys" },
      { value: "tools", label: "Tools" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "electrical",
    label: "Electrical",
    status: "live",
    aiReads: "amps, voltage, poles, phase, kAIC/interrupting rating, NEMA enclosure type, wire gauge/AWG, kVA, frame/catalog number",
    categories: [
      { value: "breakers_panels", label: "Breakers & Panels" },
      { value: "disconnects_fuses", label: "Disconnects & Fuses" },
      { value: "wire_cable", label: "Wire & Cable" },
      { value: "conduit_fittings", label: "Conduit & Fittings" },
      { value: "boxes_covers", label: "Boxes & Covers" },
      { value: "switches_devices", label: "Switches, Receptacles & Devices" },
      { value: "lighting", label: "Lighting, Ballasts & LED Drivers" },
      { value: "motor_controls", label: "Motor Controls (starters, contactors, overloads)" },
      { value: "drives_vfds", label: "Drives & VFDs" },
      { value: "transformers", label: "Transformers", freight: true },
      { value: "generators_ats", label: "Generators & Transfer Switches", freight: true },
      { value: "meters_sockets", label: "Meters & Meter Sockets" },
      { value: "grounding_bonding", label: "Grounding & Bonding" },
      { value: "low_voltage", label: "Low Voltage & Controls" },
      { value: "tools", label: "Tools & Testers" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "plumbing",
    label: "Plumbing",
    status: "live",
    aiReads: "pipe/connection size, material (copper, PEX, PVC, CPVC, brass, cast iron), PSI/pressure rating, connection type (sweat, threaded, press, PEX), gallons, BTU, GPM",
    categories: [
      { value: "water_heaters", label: "Water Heaters & Parts", freight: true },
      { value: "valves", label: "Valves (ball, gate, check, PRV, mixing)" },
      { value: "pipe_fittings", label: "Pipe & Fittings (copper, PEX, PVC/CPVC, black iron, cast iron)" },
      { value: "fixtures", label: "Fixtures" },
      { value: "fixture_repair", label: "Fixture Repair Parts (cartridges, flush valves)" },
      { value: "commercial_restroom", label: "Commercial Restroom (flushometers, sensors)" },
      { value: "drains_traps", label: "Drains, Traps & Cleanouts" },
      { value: "pumps", label: "Pumps (sump, sewage, recirc)" },
      { value: "backflow", label: "Backflow Preventers" },
      { value: "boilers_hydronic", label: "Boilers & Hydronic Parts", freight: true },
      { value: "gas_piping", label: "Gas Piping & Fittings" },
      { value: "water_treatment", label: "Water Treatment & Filtration" },
      { value: "tools", label: "Tools" },
      { value: "other", label: "Other" },
    ],
  },
];

export const LIVE_TRADES = TRADE_LIST.filter((t) => t.status === "live");
export const TRADE_VALUES = TRADE_LIST.map((t) => t.value);
export const DEFAULT_TRADE = "hvacr";

export function getTrade(value: string | null | undefined) {
  return TRADE_LIST.find((t) => t.value === value) ?? null;
}

export function tradeLabel(value: string | null | undefined) {
  return getTrade(value)?.label ?? "Other";
}

export function isTrade(value: unknown): value is string {
  return typeof value === "string" && TRADE_VALUES.includes(value);
}

export function categoriesFor(trade: string | null | undefined) {
  return getTrade(trade)?.categories ?? [];
}

export function getCategory(trade: string | null | undefined, value: string | null | undefined) {
  if (!value) return null;
  if (trade) return categoriesFor(trade).find((c) => c.value === value) ?? null;
  for (const t of TRADE_LIST) {
    const c = t.categories.find((x) => x.value === value);
    if (c) return c;
  }
  return null;
}

export function isCategoryOf(trade: string, value: unknown): value is string {
  return typeof value === "string" && categoriesFor(trade).some((c) => c.value === value);
}

/** Every category code across trades (for the photo AI's answer format). */
export const ALL_CATEGORY_VALUES = [...new Set(TRADE_LIST.flatMap((t) => t.categories.map((c) => c.value)))] as [string, ...string[]];
