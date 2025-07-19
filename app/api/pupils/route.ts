// app/api/pupils/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get("classroomId");

  // 1) Admin: they can filter by classroom
  if (user.role === UserRole.ADMIN) {
    if (!classroomId) {
      // No classroomId: return empty array (JSON)
      return Response.json([]);
    }
    const pupils = await prisma.pupil.findMany({
      where: { classroomId },
      orderBy: { createdAt: "asc" },
      include: { classroom: { select: { name: true } } },
    });
    return Response.json(pupils);
  }

  // 2) User (parent): only show their own pupils, with classroom name
  if (user.role === UserRole.USER) {
    const pupils = await prisma.pupil.findMany({
      where: { parentId: user.id },
      orderBy: { createdAt: "asc" },
      include: { classroom: { select: { name: true } } },
    });
    return Response.json(pupils);
  }

  // 3) Shouldn’t happen, but block any other role
  return Response.json({ error: "Forbidden" }, { status: 403 });
});

// Add your PUT handler from earlier in the file!
export const PUT = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name } = await req.json();
  if (!id || typeof name !== "string") {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  // Only allow editing own pupils unless admin
  const where =
    user.role === UserRole.ADMIN
      ? { id }
      : { id, parentId: user.id };

  const updated = await prisma.pupil.updateMany({
    where,
    data: { name },
  });

  if (updated.count === 0) {
    return Response.json({ error: "Not found or forbidden" }, { status: 404 });
  }
  return Response.json({ success: true });
});
