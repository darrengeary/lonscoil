// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const pupilInputSchema = z.object({
  code: z.string().min(1, "Code is required"),
  studentName: z.string().trim().min(1, "Student name is required"),
  allergies: z.array(z.string().trim().min(1)).default([]),
});

const bodySchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  codes: z.array(z.string().min(1)).min(1, "At least one code is required").max(5),
  pupils: z.array(pupilInputSchema).min(1, "At least one pupil is required").max(5),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(", ") },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password;
    const codes = parsed.data.codes.map(code => code.trim());
    const pupils = parsed.data.pupils;

    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
      return NextResponse.json(
        { error: "Duplicate pupil codes are not allowed" },
        { status: 400 }
      );
    }

    const pupilMap = new Map(
      pupils.map(p => [
        p.code.trim(),
        {
          studentName: p.studentName.trim(),
          allergies: Array.from(
            new Set(
              (p.allergies ?? [])
                .map(a => a.trim())
                .filter(Boolean)
            )
          ),
        },
      ])
    );

    if (pupilMap.size !== codes.length) {
      return NextResponse.json(
        { error: "Each code must have exactly one matching pupil entry" },
        { status: 400 }
      );
    }

    const allCodesHaveDetails = codes.every(code => {
      const match = pupilMap.get(code);
      return !!match && match.studentName.length > 0;
    });

    if (!allCodesHaveDetails) {
      return NextResponse.json(
        { error: "Each validated code must include a student name" },
        { status: 400 }
      );
    }

    const allPupilCodesMatchCodes = pupils.every(p => codes.includes(p.code.trim()));
    if (!allPupilCodesMatchCodes) {
      return NextResponse.json(
        { error: "Pupil entries must match the submitted codes" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction(async tx => {
      const dbPupils = await tx.pupil.findMany({
        where: {
          id: { in: codes },
          status: "UNREGISTERED",
        },
        select: {
          id: true,
          classroom: {
            select: { schoolId: true },
          },
        },
      });

      if (dbPupils.length !== codes.length) {
        throw new Error("One or more pupil codes are invalid or already claimed");
      }

      const schoolIds = Array.from(new Set(dbPupils.map(p => p.classroom.schoolId)));
      if (schoolIds.length !== 1) {
        throw new Error("All pupil codes must be from the same school");
      }

      const schoolId = schoolIds[0];

      const user = await tx.user.create({
        data: {
          email,
          hashedPassword,
          role: "USER",
          schoolId,
        },
      });

      for (const code of codes) {
        const details = pupilMap.get(code);

        if (!details) {
          throw new Error(`Missing student details for code ${code}`);
        }

        const updated = await tx.pupil.updateMany({
          where: {
            id: code,
            status: "UNREGISTERED",
          },
          data: {
            parentId: user.id,
            status: "REGISTERED",
            studentName: details.studentName,
            allergies: details.allergies,
          },
        });

        if (updated.count !== 1) {
          throw new Error("Claim failed: one or more codes were claimed concurrently");
        }
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