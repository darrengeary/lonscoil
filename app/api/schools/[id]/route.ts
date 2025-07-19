import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const GET = auth(async (req, { params }) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const id = params?.id;
  if (!id || (Array.isArray(id) && id.length === 0)) {
    return new Response("Invalid or missing id", { status: 400 });
  }
  const schoolId = Array.isArray(id) ? id[0] : id;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return new Response("Not found", { status: 404 });
  return Response.json(school);
});

// (Optional) Add PUT and DELETE handlers here if you want to support edit/delete from the detail page.
