"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { User, ArrowLeft, Loader } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

export default function ClassroomPupilsPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const { schoolId, classroomId } = params as { schoolId: string; classroomId: string };

  const [classroom, setClassroom] = useState<any>(null);
  const [pupils, setPupils] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // classroom details
      const classRes = await fetch(`/api/classrooms/${classroomId}`);
      const classroomData = await classRes.json();
      setClassroom(classroomData);
      // all pupils in this classroom
      const pupilsRes = await fetch(`/api/pupils?classroomId=${classroomId}`);
      const pupilsData = await pupilsRes.json();
      setPupils(pupilsData);
      setLoading(false);
    }
    fetchData();
  }, [classroomId]);

  if (status === "loading") {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }
  if (!userRole || userRole !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <span className="text-lg font-bold text-destructive">Unauthorized</span>
        <span className="text-muted-foreground mt-2">You do not have permission to view this page.</span>
      </div>
    );
  }

  return (
    <>
      <DashboardHeader
        heading={classroom ? `${classroom.name} – Pupils` : "Pupils"}
        text="View all pupils for this classroom."
      />
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/schools/${schoolId}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Classrooms
          </Button>
        </Link>
      </div>
<Card className="p-0 border-muted">
  {loading ? (
    <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
      <Loader className="w-7 h-7 animate-spin" />
      <div className="font-medium">Loading pupils…</div>
    </div>
  ) : pupils.length === 0 ? (
    <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
      <User className="w-10 h-10 mb-1 text-muted" />
      <div className="text-lg font-semibold">No pupils found</div>
    </div>
  ) : (
    <>
      {/* Modern Table on md+ */}
      <div className="hidden md:block overflow-x-auto rounded-2xl shadow-sm bg-white">
        <table className="min-w-[400px] w-full text-sm text-left rounded-2xl overflow-hidden">
          <thead>
            <tr className="bg-[#F4F7FA]">
              <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl">Code</th>
              <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B]">Name</th>
              <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tr-2xl">Status</th>
            </tr>
          </thead>
          <tbody>
            {pupils.map((pupil, idx) => (
              <tr
                key={pupil.id}
                className={
                  "transition-colors " +
                  (idx % 2 === 0 ? "bg-white" : "bg-[#F4F7FA]") +
                  " hover:bg-[#E7F1FA] focus-within:bg-[#E7F8F0]"
                }
              >
                <td className="py-3 px-4">
                  <span className="inline-block px-3 py-1 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-mono text-xs font-bold">
                    {pupil.id}
                  </span>
                </td>
                <td className="py-3 px-4 text-[#27364B] font-medium">
                  {pupil.name || <span className="italic text-muted-foreground">Not set</span>}
                </td>
                <td className="py-3 px-4">
                  {pupil.status === "UNREGISTERED" ? (
                    <span className="inline-block px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">
                      Unregistered
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full bg-[#E7F8F0] text-[#56C596] text-xs font-bold">
                      Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3 mt-3">
        {pupils.map((pupil) => (
          <div
            key={pupil.id}
            className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2"
          >
            <div className="flex justify-between items-center">
              <span className="inline-block px-3 py-1 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-mono text-xs font-bold">
                {pupil.id}
              </span>
              {pupil.status === "UNREGISTERED" ? (
                <span className="inline-block px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">
                  Unregistered
                </span>
              ) : (
                <span className="inline-block px-3 py-1 rounded-full bg-[#E7F8F0] text-[#56C596] text-xs font-bold">
                  Active
                </span>
              )}
            </div>
            <div className="text-[#27364B] font-medium text-base mt-1">
              {pupil.name || <span className="italic text-muted-foreground">Not set</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  )}
</Card>

    </>
  );
}
