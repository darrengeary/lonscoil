export interface PrepSummaryRow {
  group: string;
  choice: string;
  count: number;
}

export default function PrepSummaryTable({ rows }: { rows: PrepSummaryRow[] }) {
  const sorted = [...rows].sort((a, b) =>
    a.group === b.group
      ? a.choice.localeCompare(b.choice)
      : a.group.localeCompare(b.group)
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm mt-4 border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Meal Group</th>
            <th className="p-2">Choice</th>
            <th className="p-2">Total Quantity</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{row.group}</td>
              <td className="p-2">{row.choice}</td>
              <td className="p-2">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
