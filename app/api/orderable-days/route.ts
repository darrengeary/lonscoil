// /app/api/orderable-days/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  eachDayOfInterval,
  format,
  getDay,
  isAfter,
  startOfDay,
  endOfDay,
} from "date-fns";

const MAX_DAYS = 400;

const isWeekend = (d: Date) => {
  const dow = getDay(d); // 0 Sun, 6 Sat
  return dow === 0 || dow === 6;
};

function expandWeekdaysInclusive(start: Date, end: Date, cap = MAX_DAYS): string[] {
  const s = startOfDay(start);
  const e = endOfDay(end);
  const days = eachDayOfInterval({ start: s, end: e });
  const out: string[] = [];
  for (let i = 0; i < days.length && i < cap; i++) {
    if (!isWeekend(days[i])) out.push(format(days[i], "yyyy-MM-dd"));
  }
  return out;
}

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const pupilId = url.searchParams.get("pupilId");
  const schoolIdParam = url.searchParams.get("schoolId");

  // ---------- Resolve schoolId (with correct role rules) ----------
  let schoolId: string | null = null;

  // If pupilId is provided, resolve via pupil -> classroom -> school
  let pupil: { parentId: string | null; classroom: { schoolId: string } } | null = null;
  if (pupilId) {
    pupil = await prisma.pupil.findUnique({
      where: { id: pupilId },
      select: { parentId: true, classroom: { select: { schoolId: true } } },
    });
    if (!pupil?.classroom?.schoolId) return NextResponse.json({ orderable: [], holidays: [] });
    schoolId = pupil.classroom.schoolId;
  } else if (schoolIdParam && schoolIdParam !== "all") {
    schoolId = schoolIdParam;
  }

  // Role enforcement
  switch (user.role) {
    case "ADMIN": {
      // ADMIN can query any school; if none resolved, return empty
      if (!schoolId) return NextResponse.json({ orderable: [], holidays: [] });
      break;
    }
    case "SCHOOLADMIN": {
      if (!user.schoolId) return new Response("No school assigned", { status: 400 });
      // If a schoolId was resolved/passed, it must match the admin's school
      if (schoolId && schoolId !== user.schoolId) return new Response("Forbidden", { status: 403 });
      schoolId = user.schoolId; // lock
      break;
    }
    case "USER": {
      // Parents typically have no user.schoolId; that's fine.
      // They MUST provide pupilId and it MUST be their child.
      if (!pupilId || !pupil) return new Response("pupilId required", { status: 400 });
      if (pupil.parentId && pupil.parentId !== user.id) return new Response("Forbidden", { status: 403 });
      // use schoolId resolved from pupil
      break;
    }
    default:
      return new Response("Unauthorized", { status: 401 });
  }

  if (!schoolId) return NextResponse.json({ orderable: [], holidays: [] });

  // ---------- Fetch schedules ----------
  const [terms, holidays] = await Promise.all([
    prisma.schedule.findMany({
      where: { schoolId, type: "TERM" },
      select: { startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.schedule.findMany({
      where: { schoolId, type: "HOLIDAY" },
      select: { startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  // Expand sets
  const termSet = new Set<string>();
  for (const t of terms) {
    if (!t.startDate || !t.endDate || isAfter(t.startDate, t.endDate)) continue;
    for (const d of expandWeekdaysInclusive(t.startDate, t.endDate)) termSet.add(d);
  }

  const holidaySet = new Set<string>();
  for (const h of holidays) {
    if (!h.startDate || !h.endDate || isAfter(h.startDate, h.endDate)) continue;
    for (const d of expandWeekdaysInclusive(h.startDate, h.endDate, 120)) holidaySet.add(d);
  }

  // TERM \ HOLIDAY = orderable
  const orderable: string[] = [];
  for (const d of termSet) if (!holidaySet.has(d)) orderable.push(d);
  orderable.sort();

  const holidayList = Array.from(holidaySet).sort();

  return NextResponse.json({ orderable, holidays: holidayList });
});