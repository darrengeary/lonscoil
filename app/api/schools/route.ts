import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(schools);
});