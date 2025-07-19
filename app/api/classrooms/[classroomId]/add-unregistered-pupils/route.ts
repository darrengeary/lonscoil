import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Helper to check if user is admin
function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const POST = auth(async (req, { params }) => {
  // Ensure the user is authenticated and is an ADMIN
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const classroomId = params?.classroomId;
  if (!classroomId || (Array.isArray(classroomId) && classroomId.length === 0)) {
    return new Response("Invalid or missing classroom id", { status: 400 });
  }
  const classroomIdValue = Array.isArray(classroomId) ? classroomId[0] : classroomId;

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
    // parentId not set at all if unregistered
  }));

  const createdPupils = await Promise.all(
    newPupils.map((pupilData) => prisma.pupil.create({ data: pupilData }))
  );


  // Return the list of new pupils, including their unique IDs
  return Response.json(createdPupils);
});
