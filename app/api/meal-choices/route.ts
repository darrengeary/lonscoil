import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}


export const GET = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");

  const mealChoices = await prisma.mealChoice.findMany({
    where: groupId ? { groupId } : undefined,
    include: { allergens: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(mealChoices);
});


export const POST = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await req.json();
  const { active, ...safe } = data; // <-- drop active

  const mealChoice = await prisma.mealChoice.create({ data: safe });
  return Response.json(mealChoice);
});

export const PUT = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await req.json();
  const { id, allergenIds, ...rest } = data;

  const mealChoice = await prisma.mealChoice.update({
    where: { id },
    data: {
      ...rest,
      ...(Array.isArray(allergenIds)
        ? { allergens: { set: allergenIds.map((aid: string) => ({ id: aid })) } }
        : {}),
    },
    include: { allergens: true },
  });

  return Response.json(mealChoice);
});

export const DELETE = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await req.json();
  await prisma.mealChoice.delete({ where: { id } });
  return Response.json({ success: true });
});
