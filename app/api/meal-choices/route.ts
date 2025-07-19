import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const GET = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const mealChoices = await prisma.mealChoice.findMany();
  return Response.json(mealChoices);
});

export const POST = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const data = await req.json();
  const mealChoice = await prisma.mealChoice.create({ data });
  return Response.json(mealChoice);
});

export const PUT = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const data = await req.json();
  const { id, ...update } = data;
  const mealChoice = await prisma.mealChoice.update({ where: { id }, data: update });
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
