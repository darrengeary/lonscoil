"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, School2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => setSchools(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
    <div className="px-6 pt-6">
      <DashboardHeader
            heading="Schools"
            text="View all schools in the system."
          />  </div>
      <Card className="p-0 border-muted">
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <Loader className="w-7 h-7 animate-spin" />
            <div className="font-medium">Loading school data…</div>
            <div className="text-xs">Hang tight, fetching records from the server.</div>
          </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <School2 className="w-10 h-10 mb-1 text-muted" />
            <div className="text-lg font-semibold">No schools found</div>
            <div className="text-sm mb-2">Schools will appear here when added to the system.</div>
          </div>
              ) : (
<div className="min-h-screen bg-[#F4F7FA] px-6">
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    {schools.map((school) => (
      <Link
        key={school.id}
        href={`/admin/schools/${school.id}`}
        className="group"
        tabIndex={0}
        aria-label={`View details for ${school.name}`}
      >
        <div className="relative flex flex-col bg-white border border-transparent rounded-3xl p-7 shadow-sm hover:shadow-lg transition-all duration-150 cursor-pointer focus:ring-2 focus:ring-[#C9E7D6] outline-none">
          <div className="text-xl font-bold text-[#27364B] truncate mb-4">{school.name}</div>
          <div className="flex flex-wrap gap-2 mb-2">
            <div className="px-3 py-1 rounded-full bg-[#E7F8F0] text-[#56C596] font-semibold text-sm flex items-center">
              Classrooms: <span className="ml-2 text-[#27364B] font-bold">{school.classroomCount}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-semibold text-sm flex items-center">
              Total Students: <span className="ml-2 text-[#27364B] font-bold">{school.registeredCount + school.unregisteredCount}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-[#FFEB99] text-[#B79B46] font-semibold text-sm flex items-center">
              Registered: <span className="ml-2 text-[#27364B] font-bold">{school.registeredCount}</span>
            </div>
          </div>
          {/* Right Arrow */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center h-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#56C596] opacity-80 group-hover:text-[#4C9EEB] transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
