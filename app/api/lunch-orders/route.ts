// app/api/lunch-orders/route.ts

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// GET /api/lunch-orders
export const GET = auth(async (req) => {
  // Guard against unauthenticated access
  if (!req.auth) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parentId = req.auth.user.id;

  // Fetch all pupils for this parent, including their orders and items
  const pupilsWithOrders = await prisma.pupil.findMany({
    where: { parentId },
    include: {
      orders: {
        include: {
          items: {
            include: { choice: true },
          },
        },
      },
    },
  });

  // Flatten into a single array of orders, adding pupilName for context
  const orders = pupilsWithOrders.flatMap((pupil) =>
    pupil.orders.map((order) => ({
      ...order,
      pupilName: pupil.name,
    }))
  );

  return new Response(JSON.stringify(orders), {
    headers: { "Content-Type": "application/json" },
  });
});

// POST /api/lunch-orders
export const POST = auth(async (req) => {
  // Guard against unauthenticated access
  if (!req.auth) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parentId = req.auth.user.id;

  // Parse and validate request body
  const { pupilId, date, items }: {
    pupilId: string;
    date: string;
    items: { choiceId: string }[];
  } = await req.json();

  // Verify this pupil belongs to the authenticated parent
  const pupil = await prisma.pupil.findFirst({
    where: { id: pupilId, parentId },
  });
  if (!pupil) {
    return new Response("Invalid pupil", { status: 400 });
  }

  // Create the LunchOrder along with its OrderItems
  const order = await prisma.lunchOrder.create({
    data: {
      date: new Date(date),
      pupilId,
      items: {
        create: items.map((i) => ({ choiceId: i.choiceId })),
      },
    },
    include: {
      items: {
        include: { choice: true },
      },
    },
  });

  return new Response(JSON.stringify(order), {
    headers: { "Content-Type": "application/json" },
  });
});
