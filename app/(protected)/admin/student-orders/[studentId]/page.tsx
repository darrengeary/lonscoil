//app/(protected)/admin/student-orders/[studentId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";

type OrderItem = {
  id: string;
  choice: string;
  mealGroup: string;
  extras: string[];
  allergens: string[];
};

type OrderRow = {
  id: string;
  date: string;
  items: OrderItem[];
};

type StudentOrderHistoryResponse = {
  pupil: {
    id: string;
    name: string;
    classroom: string;
    school: string;
    status: string;
    allergies: string[];
    menuName: string | null;
    parent: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  orders: OrderRow[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export default function StudentOrderHistoryPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [pupil, setPupil] = useState<StudentOrderHistoryResponse["pupil"] | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadOrders(opts?: { cursor?: string; append?: boolean }) {
    const append = opts?.append ?? false;
    const cursor = opts?.cursor;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      let url = `/api/pupils/${studentId}/orders?take=20`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load orders");
      }

      setPupil(data.pupil);
      setOrders((prev) => (append ? [...prev, ...data.orders] : data.orders));
      setHasMore(Boolean(data.pageInfo?.hasMore));
      setNextCursor(data.pageInfo?.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!studentId) return;
    loadOrders();
  }, [studentId]);

  if (loading) {
    return (
      <div className="bg-[#F4F7FA] p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8">Loading student order history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#F4F7FA] p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-red-600">{error}</div>
      </div>
    );
  }

  if (!pupil) {
    return (
      <div className="bg-[#F4F7FA] p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8">Student not found.</div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F7FA] p-6 space-y-6">
      <DashboardHeader
        heading={`Order History: ${pupil.name?.trim() || "Unnamed"}`}
        text="Past lunch orders for this student."
      />

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-[#27364B]">Student:</span>{" "}
            {pupil.name?.trim() || "Unnamed"}
          </div>
          <div>
            <span className="font-semibold text-[#27364B]">Classroom:</span> {pupil.classroom}
          </div>
          <div>
            <span className="font-semibold text-[#27364B]">School:</span> {pupil.school}
          </div>
          <div>
            <span className="font-semibold text-[#27364B]">Status:</span> {pupil.status}
          </div>
          <div>
            <span className="font-semibold text-[#27364B]">Menu:</span> {pupil.menuName ?? "—"}
          </div>
          <div>
            <span className="font-semibold text-[#27364B]">Allergies:</span>{" "}
            {pupil.allergies.length ? pupil.allergies.join(", ") : "None"}
          </div>
          <div>
            <span className="font-semibold text-[#27364B]">Parent:</span>{" "}
            {pupil.parent?.name?.trim() || "Unnamed"}
          </div>
          <div>
            <span className="font-semibold text-[#27364B]">Parent Email:</span>{" "}
            {pupil.parent?.email?.trim() || "—"}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-muted-foreground">
            No past orders found for this student.
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[#27364B]">{order.date}</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Choice</th>
                      <th className="text-left p-3">Meal Group</th>
                      <th className="text-left p-3">Extras</th>
                      <th className="text-left p-3">Allergens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="p-3">{item.choice}</td>
                        <td className="p-3">{item.mealGroup}</td>
                        <td className="p-3">
                          {item.extras.length ? item.extras.join(", ") : "No extras"}
                        </td>
                        <td className="p-3">
                          {item.allergens.length ? item.allergens.join(", ") : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && nextCursor && (
        <div className="flex justify-center">
          <Button
            onClick={() => loadOrders({ cursor: nextCursor, append: true })}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}