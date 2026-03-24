//app/api/lunch-orders/route.ts

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
    select: { id: true },
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
    select: {
      date: true,
      items: {
        select: {
          choiceId: true,
          selectedIngredients: true, // ✅ requires schema field
        },
      },
    },
    orderBy: { date: "asc" },
  });

  return Response.json(orders);
});

// BULK PUT: { pupilId, orders: [{date, items: [{choiceId, selectedIngredients?}]}] }
export const PUT = auth(async (req) => {
  if (!req.auth) return new Response("Unauthorized", { status: 401 });

  try {
    const body = (await req.json()) as {
      pupilId: string;
      orders: {
        date: string;
        items: { choiceId: string; selectedIngredients?: string[] }[];
      }[];
    };

    const { pupilId, orders } = body;

    if (!pupilId || !Array.isArray(orders)) {
      return new Response("Missing pupilId or orders", { status: 400 });
    }

    const pupil = await prisma.pupil.findFirst({
      where: { id: pupilId, parentId: req.auth.user.id },
      select: { id: true },
    });
    if (!pupil) return new Response("Invalid pupil", { status: 401 });

    const today = startOfDay(new Date());

    // Only update today or future
    const validOrders = orders.filter(
      (o) => !isBefore(startOfDay(new Date(o.date)), today)
    );
    if (validOrders.length !== orders.length) {
      return new Response("Cannot update past orders", { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const o of validOrders) {
        const dateStart = startOfDay(new Date(o.date));
        const dateEnd = endOfDay(new Date(o.date));

        // delete existing order+items for that day
        const existing = await tx.lunchOrder.findMany({
          where: { pupilId, date: { gte: dateStart, lte: dateEnd } },
          select: { id: true },
        });

        const ids = existing.map((e) => e.id);
        if (ids.length) {
          await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
          await tx.lunchOrder.deleteMany({ where: { id: { in: ids } } });
        }

        // create new order if items exist
        if (o.items?.length) {
          await tx.lunchOrder.create({
            data: {
              pupilId,
              date: dateStart,
              items: {
                create: o.items.map((i) => ({
                  choiceId: i.choiceId,
                  selectedIngredients: i.selectedIngredients ?? [],
                })),
              },
            }
          });
        }
      }
    });

    return new Response("Saved", { status: 200 });
  } catch (e: any) {
    console.error("[lunch-orders.BULK_PUT]", e);
    return new Response(e?.message ?? "Unknown error", { status: 500 });
  }
});
