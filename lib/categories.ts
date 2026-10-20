export const CATEGORIES = [
  { value: "compressors", label: "Compressors" },
  { value: "motors_fans", label: "Motors & Fans (incl. ECM)" },
  { value: "controls_boards", label: "Controls & Boards" },
  { value: "thermostats_sensors", label: "Thermostats & Sensors" },
  { value: "pressure_safety", label: "Pressure & Safety Controls" },
  { value: "valves", label: "Valves (TXV, EEV, reversing, solenoid)" },
  { value: "contactors_relays", label: "Contactors & Relays" },
  { value: "capacitors", label: "Capacitors" },
  { value: "defrost", label: "Defrost (timers, heaters, terminators)" },
  { value: "coils_heat_exchangers", label: "Coils & Heat Exchangers" },
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
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];
export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [Category, ...Category[]];

export const CONDITIONS = [
  { value: "new_in_box", label: "New in box", hint: "Sealed or unused, original packaging" },
  { value: "new_open_box", label: "New, open box", hint: "Unused, box opened" },
  { value: "new_old_stock", label: "New old stock", hint: "Never installed, sat on a shelf a while" },
  { value: "used_working", label: "Used, working", hint: "Pulled from service, tested good" },
  { value: "for_parts", label: "For parts / not working", hint: "As-is" },
] as const;

export type Condition = (typeof CONDITIONS)[number]["value"];
export const CONDITION_VALUES = CONDITIONS.map((c) => c.value) as [Condition, ...Condition[]];

export function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export function conditionLabel(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}

export const FREE_LISTING_LIMIT = 10;
export const MAX_PHOTOS = 6;
