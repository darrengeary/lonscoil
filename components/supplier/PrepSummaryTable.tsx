// components/supplier/PrepSummaryTable.tsx
export interface PrepSummaryRow {
  group: string;
  choice: string;
  count: number;
}

export default function PrepSummaryTable({ rows }: { rows: PrepSummaryRow[] }) {
  // Nothing to show
  if (!rows.length) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No data found for this date/filter.
      </div>
    );
  }

  return (
    <>
      {/* MOBILE: Card list */}
      <div className="block md:hidden no-print space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-1"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="block font-bold text-[#27364B] break-words">{row.choice}</span>
              <span className="block text-xs text-gray-500 font-medium break-words">{row.group}</span>
            </div>
            <div className="flex justify-end">
              <span className="text-right font-extrabold text-[#4C9EEB]">{row.count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP: Table, always shows on print */}
      <div className="hidden md:block print:block overflow-x-auto rounded-2xl shadow-sm bg-white">
        <table className="min-w-[400px] w-full text-sm text-left rounded-2xl overflow-hidden">
          <thead>
            <tr className="bg-[#F4F7FA]">
              <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl w-[40%]">Choice</th>
              <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] w-[30%]">Meal Group</th>
              <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl w-[30%]">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-[#E7F1FA] focus-within:bg-[#E7F8F0] bg-white"
              >
                <td className="py-3 px-4 text-[#27364B] font-medium break-words max-w-[220px]" title={row.choice}>{row.choice}</td>
                <td className="py-3 px-4 text-[#27364B] font-medium break-words max-w-[120px]" title={row.group}>{row.group}</td>
                <td className="py-3 px-4 text-right">
                  <span className="font-extrabold text-[#4C9EEB]">{row.count}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
