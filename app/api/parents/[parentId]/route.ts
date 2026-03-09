// app/api/parents/[parentId]/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export const GET = auth(async (req, { params }) => {
  const user = req.auth?.user;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parentId = params?.parentId as string | undefined;
  if (!parentId) return Response.json({ error: "Missing parentId" }, { status: 400 });

  // ADMIN can view any parent
  if (user.role === UserRole.ADMIN) {
    // ok
  } else if (user.role === UserRole.SCHOOLADMIN) {
    // Only if this parent has a pupil in the schooladmin’s school
    const ok = await prisma.pupil.findFirst({
      where: { parentId, classroom: { schoolId: user.schoolId! } },
      select: { id: true },
    });
    if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
  } else {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parent = await prisma.user.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      schoolId: true,
      createdAt: true,
    },
  });

  if (!parent) return Response.json({ error: "Not found" }, { status: 404 });

  const pupils = await prisma.pupil.findMany({
    where: { parentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      classroom: { select: { id: true, name: true, schoolId: true } },
    },
  });

  return Response.json({ parent, pupils });
});