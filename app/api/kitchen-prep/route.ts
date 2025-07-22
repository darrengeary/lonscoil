import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export const GET = auth(async (req) => {
  const user = (req as any).auth.user;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  let schoolId = searchParams.get("schoolId"); // For ADMIN only
  const classroomId = searchParams.get("classroomId");

  if (!date) return new Response("Date required", { status: 400 });

  // --- Role-based access control ---
  if (user?.role === "SCHOOLADMIN") {
    // SCHOOLADMIN: can only see their own school, ignore schoolId param
    schoolId = user.schoolId;
    if (!schoolId) return new Response("No school assigned", { status: 403 });
  } else if (user?.role === "ADMIN") {
    // ADMIN: can specify schoolId or "all" (or omit for all schools)
    if (!schoolId || schoolId === "all") schoolId = null;
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  // --- Build query filter ---
  const day = new Date(date);
  const orderWhere: any = {
    date: { gte: startOfDay(day), lte: endOfDay(day) }
  };

  if (classroomId && classroomId !== "all") {
    orderWhere.pupil = { classroomId };
  } else if (schoolId) {
    // Filter by school if set (ADMIN with schoolId or SCHOOLADMIN)
    orderWhere.pupil = { classroom: { schoolId } };
  }
  // If no schoolId, ADMIN sees all schools for the date

  // --- Data aggregation ---
  const summary = await prisma.orderItem.groupBy({
    by: ['choiceId'],
    where: { order: orderWhere },
    _count: { choiceId: true },
  });

  const choices = await prisma.mealChoice.findMany({
    where: { id: { in: summary.map(s => s.choiceId) } },
    include: { group: true },
  });

  const choiceMap = Object.fromEntries(
    choices.map(choice => [
      choice.id,
      { group: choice.group.name, choice: choice.name }
    ])
  );

  const result = summary.map(row => ({
    group: choiceMap[row.choiceId]?.group || "Unknown",
    choice: choiceMap[row.choiceId]?.choice || "Unknown",
    count: row._count.choiceId,
  }));

  return new Response(JSON.stringify(result), { status: 200 });
});
