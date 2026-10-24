import { getCategory } from "@/lib/trades";

export const CONDITIONS = [
  { value: "new_in_box", label: "New in box", hint: "Sealed or unused, original packaging" },
  { value: "new_open_box", label: "New, open box", hint: "Unused, box opened" },
  { value: "new_old_stock", label: "New old stock", hint: "Never installed, sat on a shelf a while" },
  { value: "used_working", label: "Used, working", hint: "Pulled from service, tested good" },
  { value: "for_parts", label: "For parts / not working", hint: "As-is" },
] as const;

export type Condition = (typeof CONDITIONS)[number]["value"];
export const CONDITION_VALUES = CONDITIONS.map((c) => c.value) as [Condition, ...Condition[]];

/** Pass the trade when you have it — some codes (valves, tools…) exist in more than one trade. */
export function categoryLabel(value: string, trade?: string | null) {
  return getCategory(trade, value)?.label ?? "Other";
}

export function conditionLabel(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}

export const FREE_LISTING_LIMIT = 10;
export const MAX_PHOTOS = 6;
