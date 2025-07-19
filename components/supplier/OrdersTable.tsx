// components/supplier/OrdersTable.tsx
"use client";

import { format } from "date-fns";

export interface Order {
  id: string;
  date: string;
  pupil: { name: string; classroom: { name: string } };
  items: { choice: { name: string }; mealGroup: { name: string } }[];
}

interface Props {
  orders: Order[];
}

export default function OrdersTable({ orders }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Pupil</th>
            <th className="p-2">Classroom</th>
            <th className="p-2">Meals</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b">
              <td className="p-2">{format(new Date(o.date), "yyyy-MM-dd")}</td>
              <td className="p-2">{o.pupil.name}</td>
              <td className="p-2">{o.pupil.classroom.name}</td>
              <td className="p-2">
                {o.items.map((it, i) => (
                  <div key={i}>
                    <strong>{it.mealGroup.name}:</strong> {it.choice.name}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
