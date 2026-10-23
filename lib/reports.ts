export const REPORT_REASONS = [
  { value: "prohibited", label: "Prohibited item" },
  { value: "refrigerant", label: "Reclaimed or unverified refrigerant" },
  { value: "recalled", label: "Recalled item" },
  { value: "scam", label: "Scam or fake listing" },
  { value: "wrong_info", label: "Wrong part / misleading info" },
  { value: "other", label: "Something else" },
] as const;

export function reportReasonLabel(value: string) {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}
