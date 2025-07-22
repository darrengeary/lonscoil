import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, isBefore } from "date-fns";

// GET /api/lunch-orders?pupilId=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
export const GET = auth(async (req) => {
  if (!req.auth) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const pupilId = searchParams.get("pupilId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!pupilId || !start || !end) {
    return new Response("Missing pupilId/start/end", { status: 400 });
  }

  const pupil = await prisma.pupil.findFirst({
    where: { id: pupilId, parentId: req.auth.user.id },
  });
  if (!pupil) return new Response("Invalid pupil", { status: 401 });

  const orders = await prisma.lunchOrder.findMany({
    where: {
      pupilId,
      date: {
        gte: startOfDay(new Date(start)),
        lte: endOfDay(new Date(end)),
      },
    },
    include: {
      items: true,
    },
    orderBy: { date: "asc" },
  });

  return Response.json(orders);
});

// BULK PUT: { pupilId, orders: [{date, items: [{choiceId}]}] }
export const PUT = auth(async (req) => {
  if (!req.auth) return new Response("Unauthorized", { status: 401 });

  try {
    const { pupilId, orders }: {
      pupilId: string;
      orders: { date: string; items: { choiceId: string }[] }[];
    } = await req.json();

    if (!pupilId || !Array.isArray(orders)) {
      return new Response("Missing pupilId or orders", { status: 400 });
    }

    // Authorize pupil
    const pupil = await prisma.pupil.findFirst({
      where: { id: pupilId, parentId: req.auth.user.id },
    });
    if (!pupil) return new Response("Invalid pupil", { status: 401 });

    const today = startOfDay(new Date());

    // Only update today or future!
    const validOrders = orders.filter(o => !isBefore(startOfDay(new Date(o.date)), today));
    if (validOrders.length !== orders.length) {
      return new Response("Cannot update past orders", { status: 400 });
    }

    // Upsert/delete all orders in a transaction (delete+create pattern)
    await prisma.$transaction(async (tx) => {
      for (const o of validOrders) {
        const dateStart = startOfDay(new Date(o.date));
        const dateEnd = endOfDay(new Date(o.date));
        // Remove existing order/items for that date
        const ex = await tx.lunchOrder.findMany({
          where: { pupilId, date: { gte: dateStart, lte: dateEnd } },
          select: { id: true },
        });
        const ids = ex.map(e => e.id);
        if (ids.length) {
          await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
          await tx.lunchOrder.deleteMany({ where: { id: { in: ids } } });
        }
        // Only create if there are items
        if (o.items.length > 0) {
          await tx.lunchOrder.create({
            data: {
              pupilId,
              date: dateStart,
              items: { create: o.items.map(i => ({ choiceId: i.choiceId })) },
            },
          });
        }
        // If items.length === 0, we have deleted the order for that day
      }
    });

    return new Response("Saved", { status: 200 });
  } catch (e: any) {
    console.error("[lunch-orders.BULK_PUT]", e);
    return new Response(e.message ?? "Unknown error", { status: 500 });
  }
});
