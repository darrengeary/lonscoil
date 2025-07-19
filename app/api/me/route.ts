import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.auth.user.id },
    include: { pupils: true },
  });
  return Response.json(user?.pupils ?? []);
});
