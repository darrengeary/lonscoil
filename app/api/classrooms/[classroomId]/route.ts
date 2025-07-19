import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const GET = auth(async (req, { params }) => {
  // OLD (incorrect after rename):
  // const classroomId = params?.id;

  // NEW (matches your folder name!):
  const classroomId = params?.classroomId;
  if (!classroomId || (Array.isArray(classroomId) && classroomId.length === 0)) {
    return new Response("Invalid or missing classroom id", { status: 400 });
  }
  const id = Array.isArray(classroomId) ? classroomId[0] : classroomId;
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom) return new Response("Not found", { status: 404 });
  return Response.json(classroom);
});


// You can add PUT and DELETE here if you want to support editing/deleting by ID.
