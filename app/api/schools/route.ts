import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const GET = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const schools = await prisma.school.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return Response.json(schools);
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
});

export const POST = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { name } = await req.json();
    if (!name) return new Response("Name is required", { status: 400 });
    const school = await prisma.school.create({ data: { name } });
    return Response.json(school);
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
});

export const PUT = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { id, name } = await req.json();
    if (!id || !name) return new Response("ID and Name are required", { status: 400 });
    const school = await prisma.school.update({ where: { id }, data: { name } });
    return Response.json(school);
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
});

export const DELETE = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { id } = await req.json();
    if (!id) return new Response("ID is required", { status: 400 });
    await prisma.school.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
});
