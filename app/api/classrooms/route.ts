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
  const schoolId = searchParams.get("schoolId");
  const where = schoolId ? { schoolId } : undefined;
  const classrooms = await prisma.classroom.findMany({ where });
  return Response.json(classrooms);
});

export const POST = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const data = await req.json();
  const classroom = await prisma.classroom.create({ data });
  return Response.json(classroom);
});

export const PUT = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const data = await req.json();
  const { id, ...update } = data;
  const classroom = await prisma.classroom.update({ where: { id }, data: update });
  return Response.json(classroom);
});

export const DELETE = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await req.json();
  await prisma.classroom.delete({ where: { id } });
  return Response.json({ success: true });
});
