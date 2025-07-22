"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

export default function SchoolClassroomsPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const { schoolId } = params as { schoolId: string };
  const [school, setSchool] = useState<any>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    async function fetchData() {
      setLoading(true);
      const [schoolRes, classroomsRes] = await Promise.all([
        fetch(`/api/schools/${schoolId}`),
        fetch(`/api/classrooms?schoolId=${schoolId}`),
      ]);
      const schoolData = await schoolRes.json();
      const classroomsData = await classroomsRes.json();
      setSchool(schoolData);
      setClassrooms(classroomsData);
      setLoading(false);
    }
    fetchData();
  }, [schoolId]);

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
        heading={school ? `${school.name} – Classrooms` : "Classrooms"}
        text="View all classrooms for this school."
      />
      <div className="flex items-center justify-between mb-4">
        <Link href="/admin/schools">
          <Button variant="outline">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Schools
          </Button>
        </Link>
      </div>
      <Card className="p-0 border-muted">
        {loading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : classrooms.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <Users className="w-10 h-10 mb-1 text-muted" />
            <div className="text-lg font-semibold">No classrooms found</div>
          </div>
        ) : (
          <div className="min-h-screen bg-[#F4F7FA] p-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {classrooms.map((cls, idx) => (
                <Link
                  key={cls.id}
                  href={`/admin/schools/${schoolId}/classrooms/${cls.id}`}
                  className="group"
                  tabIndex={0}
                  aria-label={`View details for ${cls.name}`}
                >
                  <div className="relative flex flex-col bg-white border border-transparent rounded-3xl p-7 shadow-sm hover:shadow-lg transition-all duration-150 cursor-pointer focus:ring-2 focus:ring-[#C9E7D6] outline-none">
                    <div className="text-xl font-bold text-[#27364B] truncate mb-4">
                      {cls.name}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div className="px-3 py-1 rounded-full bg-[#FFEB99] text-[#B79B46] font-semibold text-sm flex items-center">
                        Registered: <span className="ml-2 text-[#27364B] font-bold">{cls.registeredCount}</span>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-semibold text-sm flex items-center">
                        Total: <span className="ml-2 text-[#27364B] font-bold">{cls.unregisteredCount + cls.registeredCount}</span>
                      </div>
                    </div>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center h-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#56C596] opacity-80 transition group-hover:text-[#4C9EEB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 6l6 6-6 6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
