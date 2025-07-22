//app/api/classrooms/[classroomId]/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}
function isSchoolAdmin(user: any) {
  return user && user.role === "SCHOOLADMIN";
}

export const GET = auth(async (req, { params }) => {
  const user = req.auth?.user;
  if (!user || (!isAdmin(user) && !isSchoolAdmin(user))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const classroomId = params?.classroomId;
  if (!classroomId || (Array.isArray(classroomId) && classroomId.length === 0)) {
    return new Response("Invalid or missing classroom id", { status: 400 });
  }
  const id = Array.isArray(classroomId) ? classroomId[0] : classroomId;

  const classroom = await prisma.classroom.findUnique({ where: { id } });

  // Schooladmin: must only access classrooms for their own school!
  if (isSchoolAdmin(user) && classroom?.schoolId !== user.schoolId) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!classroom) return new Response("Not found", { status: 404 });
  return Response.json(classroom);
});
