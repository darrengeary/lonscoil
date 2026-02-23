// components/supplier/PrepSummaryTable.tsx

export interface PrepSummaryRow {
  group: string;
  choice: string;
  count: number;
  extras?: { name: string; qty: number }[];
}

export interface PrepSplitRow {
  group: string;
  choice: string;
  extrasSig: string; // "No extras" or "Cheese + Tomato"
  count: number;
}

export interface ExtrasTotalRow {
  name: string;
  qty: number;
}

export type PrepViewMode = "grouped" | "split" | "extras";

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const TAG_STYLES = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "bg-lime-50 text-lime-800 border-lime-200",
];

function tagClass(name: string) {
  return TAG_STYLES[hashString(name) % TAG_STYLES.length];
}

function Tag({ name, qty }: { name: string; qty?: number }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        tagClass(name),
      ].join(" ")}
      title={qty != null ? `${name}: ${qty}` : name}
    >
      {name}
      {qty != null && <span className="font-extrabold opacity-80">×{qty}</span>}
    </span>
  );
}

// Condense extras to: first tag + “+more”
function TagsCondensed({
  extras,
  max = 1,
}: {
  extras: { name: string; qty: number }[];
  max?: number;
}) {
  if (!extras?.length) return null;

  const shown = extras.slice(0, max);
  const remaining = extras.length - shown.length;

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((ex, idx) => (
        <Tag key={idx} name={ex.name} qty={ex.qty} />
      ))}

      {remaining > 0 && (
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold text-muted-foreground whitespace-nowrap"
          title={extras
            .slice(max)
            .map((x) => `${x.name}×${x.qty}`)
            .join(", ")}
        >
          +{remaining} more
        </span>
      )}
    </div>
  );
}

function ExtrasTotalsTable({ rows }: { rows: ExtrasTotalRow[] }) {
  if (!rows || rows.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No extras selected.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl shadow-sm bg-white">
      <table className="min-w-[420px] w-full text-sm text-left rounded-2xl overflow-hidden">
        <thead>
          <tr className="bg-[#F4F7FA]">
            <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl">
              Extra / Ingredient
            </th>
            <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl">
              Total Qty
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors hover:bg-[#E7F1FA] bg-white">
              <td className="py-3 px-4">
                <Tag name={r.name} />
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-extrabold text-[#4C9EEB]">{r.qty}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrepSummaryTable({
  rows = [],
  splitRows = [],
  extrasTotals = [],
  mode = "grouped",
}: {
  rows?: PrepSummaryRow[];
  splitRows?: PrepSplitRow[];
  extrasTotals?: ExtrasTotalRow[];
  mode?: PrepViewMode;
}) {
  // EXTRAS ONLY mode
  if (mode === "extras") {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Totals of extras selected across all meals.
        </div>
        <ExtrasTotalsTable rows={extrasTotals} />
      </div>
    );
  }

  const hasData =
    mode === "split" ? (splitRows?.length ?? 0) > 0 : (rows?.length ?? 0) > 0;

  return (
    <>
      {/* MOBILE */}
      <div className="block md:hidden no-print space-y-3">
        {!hasData ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-muted-foreground">
            No data found for this date/filter.
          </div>
        ) : mode === "split" ? (
          splitRows.map((r, i) => (
            <div
              key={i}
              className={[
                "bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2",
                r.extrasSig !== "No extras" ? "border-l-4 border-gray-200" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#27364B] break-words">
                  {r.choice}
                  {r.extrasSig && ` — ${r.extrasSig}`}
                </span>
                <span className="text-xs text-gray-500 font-medium break-words">{r.group}</span>
              </div>

              <div className="flex justify-end">
                <span className="text-right font-extrabold text-[#4C9EEB]">{r.count}</span>
              </div>
            </div>
          ))
        ) : (
          rows.map((row, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#27364B] break-words">{row.choice}</span>
                <span className="text-xs text-gray-500 font-medium break-words">{row.group}</span>
              </div>

              <div className="flex justify-end">
                <span className="text-right font-extrabold text-[#4C9EEB]">{row.count}</span>
              </div>

              {!!row.extras?.length && (
                <div className="border-t pt-2">
                  <TagsCondensed extras={row.extras} max={1} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* DESKTOP + PRINT */}
      <div className="hidden md:block print:block overflow-x-auto rounded-2xl shadow-sm bg-white">
        <table className="min-w-[520px] w-full text-sm text-left rounded-2xl overflow-hidden">
          <thead>
            <tr className="bg-[#F4F7FA]">
              <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl w-[46%]">
                Choice
              </th>
              <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] w-[28%]">
                Meal Group
              </th>
              <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl w-[26%]">
                Quantity
              </th>
            </tr>
          </thead>

          <tbody>
            {!hasData ? (
              <tr className="bg-white">
                <td colSpan={3} className="py-10 px-4 text-center text-muted-foreground">
                  No data found for this date/filter.
                </td>
              </tr>
            ) : mode === "split" ? (
              splitRows.map((r, i) => (
                <tr
                  key={i}
                  className={[
                    "transition-colors align-top",
                    r.extrasSig !== "No extras"
                      ? "bg-gray-50 hover:bg-gray-100"
                      : "bg-white hover:bg-[#E7F1FA]",
                  ].join(" ")}
                >
                  <td className="py-3 px-4 text-[#27364B] font-medium break-words">
                    <span>
                      {r.choice}
                      {r.extrasSig && ` — ${r.extrasSig}`}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-[#27364B] font-medium break-words">{r.group}</td>

                  <td className="py-3 px-4 text-right">
                    <span className="font-extrabold text-[#4C9EEB]">{r.count}</span>
                  </td>
                </tr>
              ))
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-[#E7F1FA] bg-white align-top">
                  <td className="py-3 px-4 text-[#27364B] font-medium break-words">
                    <div>{row.choice}</div>

                    {!!row.extras?.length && (
                      <div className="mt-2">
                        <TagsCondensed extras={row.extras} max={1} />
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 text-[#27364B] font-medium break-words">{row.group}</td>

                  <td className="py-3 px-4 text-right">
                    <span className="font-extrabold text-[#4C9EEB]">{row.count}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}