//app/api/classrooms/[classroomId]/add-unregistered-pupils/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}
function isSchoolAdmin(user: any) {
  return user && user.role === "SCHOOLADMIN";
}

export const POST = auth(async (req, { params }) => {
  const user = req.auth?.user;
  if (!user || (!isAdmin(user) && !isSchoolAdmin(user))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const classroomId = params?.classroomId;
  if (!classroomId || (Array.isArray(classroomId) && classroomId.length === 0)) {
    return new Response("Invalid or missing classroom id", { status: 400 });
  }
  const classroomIdValue = Array.isArray(classroomId) ? classroomId[0] : classroomId;

  // Schooladmin: fetch classroom, verify it's in their school!
  if (isSchoolAdmin(user)) {
    const classroom = await prisma.classroom.findUnique({ where: { id: classroomIdValue } });
    if (!classroom || classroom.schoolId !== user.schoolId) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Parse the count of pupils to add
  const { count } = await req.json();
  const addCount = Number(count);
  if (!addCount || addCount < 1 || addCount > 100) {
    return new Response("Invalid count. Must be 1-100.", { status: 400 });
  }

  const newPupils = Array.from({ length: addCount }, () => ({
    name: "",
    status: "UNREGISTERED",
    classroomId: classroomIdValue,
  }));

  const createdPupils = await Promise.all(
    newPupils.map((pupilData) => prisma.pupil.create({ data: pupilData }))
  );

  return Response.json(createdPupils);
});
