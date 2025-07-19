import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const GET = auth(async (req) => {
  const user = (req as any).auth.user;
  if (!user || user.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const schoolId = searchParams.get("schoolId");
  const classroomId = searchParams.get("classroomId");

  if (!date) return new Response("Date required", { status: 400 });

  // Build filters
  const orderWhere: any = { date: new Date(date) };
  if (classroomId) {
    orderWhere.pupil = { classroomId };
  } else if (schoolId) {
    orderWhere.pupil = { classroom: { schoolId } };
  }

  // GroupBy for performance
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
