import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const GET = auth(async (req, ctx) => {
  const user = req.auth?.user;
  if (!user) return jsonError("Unauthorized", 401);

  const rawStudentId = ctx.params?.studentId;
  const studentId = Array.isArray(rawStudentId) ? rawStudentId[0] : rawStudentId;

  if (!studentId) {
    return jsonError("Student not found", 404);
  }

  const { searchParams } = new URL(req.url);

  const cursor = searchParams.get("cursor");
  const takeRaw = Number(searchParams.get("take") ?? "20");
  const take = Math.min(Math.max(takeRaw, 1), 50);

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const pupil = await prisma.pupil.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      status: true,
      allergies: true,
      parentId: true,
      parent: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      menu: {
        select: {
          name: true,
        },
      },
      classroom: {
        select: {
          id: true,
          name: true,
          schoolId: true,
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!pupil) return jsonError("Student not found", 404);

  if (user.role === UserRole.SCHOOLADMIN) {
    if (!user.schoolId || pupil.classroom.schoolId !== user.schoolId) {
      return jsonError("Forbidden", 403);
    }
  } else if (user.role === UserRole.USER) {
    if (pupil.parentId !== user.id) {
      return jsonError("Forbidden", 403);
    }
  } else if (user.role !== UserRole.ADMIN) {
    return jsonError("Forbidden", 403);
  }

  const where: any = {
    pupilId: studentId,
  };

  if (fromParam) {
    const fromDate = parseISO(fromParam);
    if (!isValid(fromDate)) return jsonError("Invalid from date", 400);
    where.date = {
      ...(where.date ?? {}),
      gte: startOfDay(fromDate),
    };
  }

  if (toParam) {
    const toDate = parseISO(toParam);
    if (!isValid(toDate)) return jsonError("Invalid to date", 400);
    where.date = {
      ...(where.date ?? {}),
      lte: endOfDay(toDate),
    };
  }

  const orders = await prisma.lunchOrder.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      date: true,
      items: {
        select: {
          id: true,
          selectedIngredients: true,
          choice: {
            select: {
              id: true,
              name: true,
              group: {
                select: {
                  name: true,
                },
              },
              allergens: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const hasMore = orders.length > take;
  const pageItems = hasMore ? orders.slice(0, take) : orders;
  const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null;

  return Response.json({
    pupil: {
      id: pupil.id,
      name: pupil.name?.trim() || "Unnamed",
      status: pupil.status,
      allergies: pupil.allergies ?? [],
      classroom: pupil.classroom.name,
      school: pupil.classroom.school.name,
      menuName: pupil.menu?.name ?? null,
      parent: pupil.parent
        ? {
            id: pupil.parent.id,
            name: pupil.parent.name?.trim() || "Unnamed",
            email: pupil.parent.email ?? "—",
          }
        : null,
    },
    orders: pageItems.map((order) => ({
      id: order.id,
      date: format(order.date, "yyyy-MM-dd"),
      items: order.items.map((item) => ({
        id: item.id,
        choice: item.choice.name,
        mealGroup: item.choice.group.name,
        extras: item.selectedIngredients ?? [],
        allergens: item.choice.allergens.map((a) => a.name),
      })),
    })),
    pageInfo: {
      hasMore,
      nextCursor,
    },
  });
});