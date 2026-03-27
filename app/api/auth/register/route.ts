import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const pupilInputSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  pupilName: z.string().trim().min(1, "Pupil name is required"),
  allergies: z.array(z.string().trim().min(1)).default([]),
});

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password must be no more than 128 characters long"),
  codes: z
    .array(z.string().trim().min(1))
    .min(1, "At least one code is required")
    .max(5, "You can register up to 5 pupil codes"),
  pupils: z
    .array(pupilInputSchema)
    .min(1, "At least one pupil is required")
    .max(5, "You can register up to 5 pupils"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const name = parsed.data.name.trim();
    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    const codes = parsed.data.codes.map((code) => code.trim());

    const pupils = parsed.data.pupils.map((pupil) => ({
      code: pupil.code.trim(),
      pupilName: pupil.pupilName.trim(),
      allergies: Array.from(
        new Set((pupil.allergies ?? []).map((a) => a.trim()).filter(Boolean))
      ),
    }));

    const uniqueCodes = new Set(codes.map((code) => code.toLowerCase()));
    if (uniqueCodes.size !== codes.length) {
      return NextResponse.json(
        { error: "Duplicate pupil codes are not allowed" },
        { status: 400 }
      );
    }

    const pupilMap = new Map(
      pupils.map((pupil) => [
        pupil.code,
        {
          pupilName: pupil.pupilName,
          allergies: pupil.allergies,
        },
      ])
    );

    if (pupilMap.size !== codes.length) {
      return NextResponse.json(
        { error: "Each code must have exactly one matching pupil entry" },
        { status: 400 }
      );
    }

    const allCodesHaveDetails = codes.every((code) => {
      const match = pupilMap.get(code);
      return !!match && match.pupilName.length > 0;
    });

    if (!allCodesHaveDetails) {
      return NextResponse.json(
        { error: "Each validated code must include a pupil name" },
        { status: 400 }
      );
    }

    const allPupilCodesMatchCodes = pupils.every((pupil) =>
      codes.includes(pupil.code)
    );

    if (!allPupilCodesMatchCodes) {
      return NextResponse.json(
        { error: "Pupil entries must match the submitted codes" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
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

      const schoolIds = Array.from(
        new Set(dbPupils.map((pupil) => pupil.classroom.schoolId))
      );

      if (schoolIds.length !== 1) {
        throw new Error("All pupil codes must be from the same school");
      }

      const schoolId = schoolIds[0];

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          hashedPassword: true,
        },
      });

      if (existingUser) {
        const claimedPupilCount = await tx.pupil.count({
          where: { parentId: existingUser.id },
        });

        const isFullyRegistered =
          Boolean(existingUser.hashedPassword) || claimedPupilCount > 0;

        if (isFullyRegistered) {
          throw new Error("Email already registered");
        }
      }

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              hashedPassword,
              role: "USER",
              schoolId,
              // name, // uncomment if your User model has a name field
            },
            select: { id: true },
          })
        : await tx.user.create({
            data: {
              email,
              hashedPassword,
              role: "USER",
              schoolId,
              // name, // uncomment if your User model has a name field
            },
            select: { id: true },
          });

      for (const code of codes) {
        const details = pupilMap.get(code);

        if (!details) {
          throw new Error(`Missing pupil details for code ${code}`);
        }

        const updated = await tx.pupil.updateMany({
          where: {
            id: code,
            status: "UNREGISTERED",
          },
          data: {
            parentId: user.id,
            status: "REGISTERED",
            studentName: details.pupilName,
            allergies: details.allergies,
          },
        });

        if (updated.count !== 1) {
          throw new Error("Claim failed: one or more codes were claimed concurrently");
        }
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const message =
      typeof e?.message === "string" && e.message.length > 0
        ? e.message
        : "Registration failed";

    const status = message === "Email already registered" ? 409 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}