// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  codes: z.array(z.string().min(1)).min(1).max(5),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map(i => i.message).join(", ") },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { password, codes } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async tx => {
      // 1) Load pupils + their schoolId via classroom
      const pupils = await tx.pupil.findMany({
        where: { id: { in: codes }, status: "UNREGISTERED" },
        select: {
          id: true,
          classroom: { select: { schoolId: true } },
        },
      });

      if (pupils.length !== codes.length) {
        throw new Error("One or more pupil codes invalid or already claimed");
      }

      // 2) Enforce single-school claim (for this sprint)
      const schoolIds = Array.from(new Set(pupils.map(p => p.classroom.schoolId)));
      if (schoolIds.length !== 1) {
        throw new Error("All pupil codes must be from the same school");
      }
      const schoolId = schoolIds[0];

      // 3) Create user with schoolId
      const user = await tx.user.create({
        data: {
          email,
          hashedPassword,
          role: "USER",
          schoolId,
        },
      });

      // 4) Claim pupils, and ensure all rows were actually updated (race-safe)
      const res = await tx.pupil.updateMany({
        where: { id: { in: codes }, status: "UNREGISTERED" },
        data: { parentId: user.id, status: "ACTIVE" },
      });

      if (res.count !== codes.length) {
        throw new Error("Claim failed: one or more codes were claimed concurrently.");
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Registration failed" },
      { status: 400 }
    );
  }
}