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
  const schoolId = params?.id;
  if (!schoolId || (Array.isArray(schoolId) && schoolId.length === 0)) {
    return new Response("Invalid or missing school id", { status: 400 });
  }
  const schoolIdValue = Array.isArray(schoolId) ? schoolId[0] : schoolId;

  // SchoolAdmin: only allow access to their own school
  if (isSchoolAdmin(user) && user.schoolId !== schoolIdValue) {
    return new Response("Forbidden", { status: 403 });
  }

  const school = await prisma.school.findUnique({ where: { id: schoolIdValue } });
  if (!school) return new Response("Not found", { status: 404 });
  return Response.json(school);
});
