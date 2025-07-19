// app/api/mealgroups/[groupId]/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

// This handles both PUT and PATCH:
const updateGroup = auth(
  async (req: Request, { params }: { params: { groupId: string } }) => {
    const user = (req as any).auth.user;
    if (!isAdmin(user)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const data = await req.json(); // { name?: string, maxSelections?: number }
    const updated = await prisma.mealGroup.update({
      where: { id: params.groupId },
      data,
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  }
);

export const PUT = updateGroup;
export const PATCH = updateGroup;

export const DELETE = auth(
  async (req: Request, { params }: { params: { groupId: string } }) => {
    const user = (req as any).auth.user;
    if (!isAdmin(user)) {
      return new Response("Unauthorized", { status: 401 });
    }
    await prisma.mealGroup.delete({ where: { id: params.groupId } });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
);
