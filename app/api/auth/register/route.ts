// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
         // ← named import
import { env } from "@/env.mjs";

const bodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  codes:    z.array(z.string().min(1)).min(1).max(5),
});

export async function POST(req: Request) {
  // 1. Parse & validate
  const json   = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map(i => i.message).join(", ") },
      { status: 400 }
    );
  }
  const { email, password, codes } = parsed.data;

  // 2. Unique email check
  if (await prisma.user.count({ where: { email } })) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  // 3. Validate pupil IDs server-side (use `id`, not `code`)
  const validCount = await prisma.pupil.count({
    where: { id: { in: codes }, status: "UNREGISTERED" },
  });
  if (validCount !== codes.length) {
    return NextResponse.json(
      { error: "One or more pupil codes invalid or already claimed" },
      { status: 400 }
    );
  }

  // 4. Create user + claim pupils
  const hashed = await bcrypt.hash(password, 10);
  await prisma.$transaction(async tx => {
    const user = await tx.user.create({
      data: { email, hashedPassword: hashed, role: "USER" },
    });
    await tx.pupil.updateMany({
      where: { id: { in: codes }, status: "UNREGISTERED" },
      data:  { parentId: user.id, status: "REGISTERED" },
    });
  });


  return NextResponse.json({ ok: true });
}
