// app/api/pupils/claim/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const POST = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { codes } = await req.json();
  if (!Array.isArray(codes) || codes.length === 0) {
    return new Response("No codes provided", { status: 400 });
  }

  await prisma.pupil.updateMany({
    where: { id: { in: codes }, status: "UNREGISTERED" },
    data: { parentId: user.id, status: "ACTIVE" },
  });

  return new Response(null, { status: 204 });
});
