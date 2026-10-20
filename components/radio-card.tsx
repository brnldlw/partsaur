import { cn } from "@/lib/utils";

/** Big tap-target radio button styled as a card. */
export function RadioCard({
  name,
  value,
  checked,
  onSelect,
  label,
  sublabel,
  highlightSublabel,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  sublabel?: string;
  highlightSublabel?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer flex-col justify-center rounded-lg border-2 px-3 py-2 text-left transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked ? "border-primary bg-primary/10" : "border-border hover:border-foreground/30",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="font-semibold">{label}</span>
      {sublabel && (
        <span
          className={cn(
            "text-xs",
            highlightSublabel ? "font-semibold text-primary" : "text-muted-foreground",
          )}
        >
          {sublabel}
        </span>
      )}
    </label>
  );
}
