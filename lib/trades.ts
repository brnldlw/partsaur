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
  {
    value: "appliance",
    label: "Appliance Repair",
    status: "live",
    aiReads: "model/serial plate, OEM part number, voltage, amps, watts, gas type (NG/LP), BTU",
    categories: [
      { value: "refrigeration", label: "Refrigeration (reach-ins, prep tables)" },
      { value: "ice_machine", label: "Ice Machine Parts" },
      { value: "cooking_parts", label: "Cooking Equipment Parts (ovens, fryers, griddles)" },
      { value: "thermostats_controls", label: "Thermostats & Controls" },
      { value: "gas_valves_burners", label: "Gas Valves & Burners" },
      { value: "heating_elements", label: "Heating Elements" },
      { value: "motors_fans", label: "Motors & Fans" },
      { value: "pumps_drains", label: "Pumps & Drain Parts" },
      { value: "dishwasher", label: "Dishwasher Parts" },
      { value: "laundry", label: "Commercial Laundry Parts (washers, dryers)" },
      { value: "gaskets_hinges", label: "Door Gaskets & Hinges" },
      { value: "boards_timers", label: "Boards & Timers" },
      { value: "tools", label: "Tools" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "fire_protection",
    label: "Fire Protection & Sprinkler",
    status: "live",
    aiReads: "SIN/model number, K-factor, temperature rating, response type (QR/SR), orientation (pendent/upright/sidewall), thread size, UL/FM listing, pipe size, PSI, GPM, voltage for alarm devices",
    categories: [
      { value: "sprinkler_heads", label: "Sprinkler Heads" },
      { value: "valves", label: "Valves (OS&Y, butterfly, check, alarm)" },
      { value: "backflow", label: "Backflow & Double Checks" },
      { value: "pipe_grooved", label: "Pipe & Grooved Fittings" },
      { value: "fire_pumps", label: "Fire Pumps & Controllers", freight: true },
      { value: "alarm_panels", label: "Fire Alarm Panels" },
      { value: "detectors_pulls", label: "Detectors & Pull Stations" },
      { value: "notification", label: "Horns, Strobes & Notification" },
      { value: "extinguishers", label: "Extinguishers & Cabinets" },
      { value: "hangers_supports", label: "Hangers & Supports" },
      { value: "signage_tags", label: "Signage & Tags" },
      { value: "tools", label: "Tools" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "building_automation",
    label: "Building Automation & Low Voltage",
    status: "live",
    aiReads: "model number, supply voltage (24VAC/DC, PoE), protocol (BACnet, Modbus, LON), I/O points, sensor range, output signal (0-10V, 4-20mA), port count, resolution for cameras",
    categories: [
      { value: "bas_controllers", label: "BAS Controllers & Modules" },
      { value: "sensors", label: "Sensors (temp, humidity, CO2, pressure)" },
      { value: "actuators_dampers", label: "Actuators & Dampers" },
      { value: "thermostats_zone", label: "Thermostats & Zone Controls" },
      { value: "access_control", label: "Access Control" },
      { value: "cameras_nvr", label: "Security Cameras & NVRs" },
      { value: "intercoms", label: "Intercoms" },
      { value: "network_data", label: "Network & Data (switches, patch panels)" },
      { value: "cable_connectors", label: "Cable & Connectors" },
      { value: "power_supplies", label: "Power Supplies & Transformers" },
      { value: "fiber", label: "Fiber" },
      { value: "tools", label: "Tools & Testers" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "generators",
    label: "Generators & Backup Power",
    status: "live",
    aiReads: "kW/kVA rating, fuel type (diesel, natural gas, LP, gasoline), phase, voltage, engine make/model, run hours, transfer switch amps",
    categories: [
      { value: "standby_generators", label: "Standby Generators", freight: true },
      { value: "portable_generators", label: "Portable Generators" },
      { value: "transfer_switches", label: "Transfer Switches (ATS/MTS)" },
      { value: "controllers_boards", label: "Controllers & Boards" },
      { value: "engine_parts", label: "Engine Parts" },
      { value: "batteries_chargers", label: "Batteries & Chargers" },
      { value: "filters_kits", label: "Filters & Maintenance Kits" },
      { value: "voltage_regulators", label: "Voltage Regulators" },
      { value: "enclosures", label: "Enclosures" },
      { value: "ups", label: "UPS Systems" },
      { value: "fuel_system", label: "Fuel System Parts" },
      { value: "load_banks", label: "Load Banks", freight: true },
      { value: "tools", label: "Tools" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "diesel",
    label: "Diesel & Trucking",
    status: "live",
    aiReads: "engine make/model (e.g. Cummins ISX15, Detroit DD15, PACCAR MX-13), OEM part number, cross-reference numbers, new vs. remanufactured, core charge info",
    categories: [
      { value: "engine_parts", label: "Engine Parts" },
      { value: "turbos", label: "Turbos" },
      { value: "fuel_injectors", label: "Fuel System & Injectors" },
      { value: "emissions", label: "Emissions (DPF, DEF, EGR)" },
      { value: "electrical_sensors", label: "Electrical & Sensors" },
      { value: "brakes_air", label: "Brakes & Air System" },
      { value: "suspension_steering", label: "Suspension & Steering" },
      { value: "transmission_drivetrain", label: "Transmission & Drivetrain" },
      { value: "cooling", label: "Cooling System" },
      { value: "lighting", label: "Lighting" },
      { value: "tires_wheels", label: "Tires & Wheels" },
      { value: "trailer_parts", label: "Trailer Parts" },
      { value: "reefer", label: "Reefer Units & Parts", freight: true },
      { value: "cab_body", label: "Cab & Body" },
      { value: "tools", label: "Tools & Diagnostics" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "welding",
    label: "Welding & Metal Fab",
    status: "live",
    aiReads: "process (MIG, TIG, stick, flux-core, multi-process), output amps, duty cycle, input voltage and phase, wire/rod size and type, gas type for regulators",
    categories: [
      { value: "welders", label: "Welders (MIG, TIG, stick, multi-process)", freight: true },
      { value: "plasma", label: "Plasma Cutters", freight: true },
      { value: "torches_regulators", label: "Torches & Regulators" },
      { value: "consumables", label: "Consumables (wire, rod, tips, nozzles)" },
      {
        value: "gas_cylinders",
        label: "Gas Cylinders (empty/exchange only)",
        confirm: {
          label: "This cylinder is empty or for exchange only — it's not a full cylinder of gas.",
          caution: "Empty / exchange cylinders only. Full compressed-gas cylinders can't be sold on Partsaur. Check the hydro-test date before you buy.",
        },
      },
      { value: "grinders_abrasives", label: "Grinders & Abrasives" },
      { value: "saws_shears", label: "Saws & Shears" },
      { value: "brakes_benders", label: "Brakes & Benders" },
      { value: "clamps_fixtures", label: "Clamps & Fixtures" },
      { value: "safety_gear", label: "Safety Gear (helmets, gloves)" },
      { value: "steel_stock", label: "Steel & Stock" },
      { value: "tools", label: "Tools" },
      { value: "other", label: "Other" },
    ],
  },
  {
    value: "warehouse",
    label: "Warehouse & Material Handling",
    status: "live",
    aiReads: "load capacity (lbs), dimensions, lift height, power type (electric, LP, diesel, manual), battery voltage, model and serial plate",
    categories: [
      { value: "dock_levelers", label: "Dock Levelers & Dock Equipment (seals, bumpers, restraints)", freight: true },
      { value: "doors", label: "Overhead & Dock Doors", freight: true },
      { value: "pallet_racking", label: "Pallet Racking", freight: true },
      { value: "shelving_storage", label: "Shelving & Storage" },
      { value: "forklifts", label: "Forklifts & Parts", freight: true },
      { value: "pallet_jacks", label: "Pallet Jacks" },
      { value: "carts_dollies", label: "Carts & Dollies" },
      { value: "conveyors", label: "Conveyors", freight: true },
      { value: "lifts_hoists", label: "Lifts & Hoists", freight: true },
      { value: "ladders_platforms", label: "Ladders & Platforms" },
      { value: "workbenches_cabinets", label: "Workbenches & Cabinets" },
      { value: "totes_bins", label: "Totes & Bins" },
      { value: "strapping_packaging", label: "Strapping & Packaging" },
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
