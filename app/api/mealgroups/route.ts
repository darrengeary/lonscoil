// app/api/mealgroups/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

export const GET = auth(async (req: Request) => {
  const { user } = (req as any).auth;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const groups = await prisma.mealGroup.findMany({
    include: { choices: true },
    orderBy: { name: "asc" },
  });
  return new Response(JSON.stringify(groups), { status: 200 });
});

export const POST = auth(async (req: Request) => {
  const { user } = (req as any).auth;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { name, maxSelections } = await req.json();
  const created = await prisma.mealGroup.create({
    data: { name, maxSelections },
  });
  return new Response(JSON.stringify(created), { status: 201 });
});
