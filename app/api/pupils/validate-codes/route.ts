// app/api/pupils/validate-codes/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  codes: z.array(z.string()).min(1).max(5),      // just “string” not .uuid()
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ valid: false, error: "Bad payload" }, { status: 200 });
  }

  const { codes } = parsed.data;
  const count = await prisma.pupil.count({
    where: { id: { in: codes }, status: "UNREGISTERED" },
  });

  return NextResponse.json({
    valid: count === codes.length,
    error: count === codes.length ? undefined : "Invalid or already claimed",
  }, { status: 200 });
}
