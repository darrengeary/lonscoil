// app/api/mealgroups/[groupId]/choices/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

export const GET = auth(async (req: Request, { params }: { params: { groupId: string } }) => {
  const { user } = (req as any).auth;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const choices = await prisma.mealChoice.findMany({
    where: { groupId: params.groupId },
    orderBy: { name: "asc" },
  });
  return new Response(JSON.stringify(choices), { status: 200 });
});

export const POST = auth(async (req: Request, { params }: { params: { groupId: string } }) => {
  const { user } = (req as any).auth;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { name } = await req.json();
  const created = await prisma.mealChoice.create({
    data: { name, groupId: params.groupId },
  });
  return new Response(JSON.stringify(created), { status: 201 });
});
