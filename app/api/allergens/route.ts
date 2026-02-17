import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const GET = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allergens = await prisma.allergen.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Response.json(allergens);
});
