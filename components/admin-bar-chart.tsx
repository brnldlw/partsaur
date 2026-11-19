/** Single-series daily bar chart for admin. Hover a bar for its value; a table view sits underneath. */
export function DailyBars({ title, rows }: { title: string; rows: { day: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((a, r) => a + r.n, 0);
  const label = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const last = rows[rows.length - 1];

  return (
    <figure className="rounded-xl border-2 bg-card p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted-foreground">
          {total} in {rows.length} days{last ? ` · today ${last.n}` : ""}
        </span>
      </figcaption>
      <div className="mt-3 flex h-32 items-end gap-[2px] border-b border-border" role="img" aria-label={`${title}: ${total} total over ${rows.length} days`}>
        {rows.map((r) => (
          <div key={r.day} className="group relative flex h-full flex-1 items-end" title={`${label(r.day)}: ${r.n}`}>
            <div
              className="w-full rounded-t-[4px] bg-primary group-hover:opacity-80"
              style={{ height: r.n ? `${Math.max(3, (r.n / max) * 100)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{rows[0] && label(rows[0].day)}</span>
        <span>peak {max}</span>
        <span>{last && label(last.day)}</span>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer py-1 text-muted-foreground">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.day} className="border-t"><td className="py-1">{label(r.day)}</td><td className="py-1 text-right font-semibold">{r.n}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Horizontal bars with labels and values written out (no hover needed). */
export function LabeledBars({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <figure className="rounded-xl border-2 bg-card p-4">
      <figcaption className="font-bold">{title}</figcaption>
      {rows.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="h-4 rounded-r-[4px] bg-primary" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} />
              <span className="text-right font-semibold">{r.n}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing yet.</p>
      )}
    </figure>
  );
}
