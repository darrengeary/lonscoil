// app/api/mealgroups/[groupId]/choices/[choiceId]/route.ts

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

// Update a choice (PATCH or PUT)
const updateChoice = auth(
  async (
    req: Request,
    { params }: { params: { groupId: string; choiceId: string } }
  ) => {
    const user = (req as any).auth.user;
    if (!user || !isAdmin(user)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const data = await req.json(); // e.g. { name: "New name" }
    const updated = await prisma.mealChoice.update({
      where: { id: params.choiceId },
      data,
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  }
);

export const PATCH = updateChoice;
export const PUT = updateChoice;

// Delete a choice
export const DELETE = auth(
  async (
    req: Request,
    { params }: { params: { groupId: string; choiceId: string } }
  ) => {
    const user = (req as any).auth.user;
    if (!user || !isAdmin(user)) {
      return new Response("Unauthorized", { status: 401 });
    }
    await prisma.mealChoice.delete({ where: { id: params.choiceId } });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
);
