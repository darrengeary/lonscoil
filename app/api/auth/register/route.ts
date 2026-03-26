import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "abc123",
]);

const pupilInputSchema = z.object({
  code: z.string().min(1, "Code is required"),
  studentName: z.string().trim().min(1, "Student name is required"),
  allergies: z.array(z.string().trim().min(1)).default([]),
});

const bodySchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string(),
  codes: z.array(z.string().min(1)).min(1, "At least one code is required").max(5),
  pupils: z.array(pupilInputSchema).min(1, "At least one pupil is required").max(5),
});

function normalizeForComparison(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasSequentialPattern(password: string) {
  const lower = password.toLowerCase();

  const sequences = [
    "0123456789",
    "9876543210",
    "abcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcba",
    "qwertyuiop",
    "poiuytrewq",
    "asdfghjkl",
    "lkjhgfdsa",
    "zxcvbnm",
    "mnbvcxz",
  ];

  return sequences.some(seq => {
    for (let i = 0; i <= seq.length - 4; i++) {
      if (lower.includes(seq.slice(i, i + 4))) return true;
    }
    return false;
  });
}

function hasRepeatedChars(password: string) {
  return /(.)\1{3,}/.test(password);
}

function validatePassword(
  password: string,
  email: string,
  pupils: Array<{ studentName: string }>
) {
  if (password.length < 12) {
    return "Password must be at least 12 characters long";
  }

  if (password.length > 128) {
    return "Password must be no more than 128 characters long";
  }

  if (/\s/.test(password)) {
    return "Password must not contain spaces";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character";
  }

  const normalizedPassword = normalizeForComparison(password);
  const normalizedEmail = normalizeForComparison(email);
  const emailLocalPart = normalizeForComparison(email.split("@")[0] || "");

  if (normalizedEmail && normalizedPassword.includes(normalizedEmail)) {
    return "Password must not contain your email address";
  }

  if (
    emailLocalPart &&
    emailLocalPart.length >= 3 &&
    normalizedPassword.includes(emailLocalPart)
  ) {
    return "Password must not contain parts of your email address";
  }

  for (const pupil of pupils) {
    const normalizedName = normalizeForComparison(pupil.studentName);
    if (normalizedName.length >= 3 && normalizedPassword.includes(normalizedName)) {
      return "Password must not contain a student's name";
    }
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Please choose a stronger one";
  }

  if (hasSequentialPattern(password)) {
    return "Password must not contain common sequences like 1234 or abcd";
  }

  if (hasRepeatedChars(password)) {
    return "Password must not contain repeated characters like aaaa";
  }

  return null;
}

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
    const pupils = parsed.data.pupils.map(p => ({
      code: p.code.trim(),
      studentName: p.studentName.trim(),
      allergies: Array.from(
        new Set((p.allergies ?? []).map(a => a.trim()).filter(Boolean))
      ),
    }));

    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
      return NextResponse.json(
        { error: "Duplicate pupil codes are not allowed" },
        { status: 400 }
      );
    }

    const pupilMap = new Map(
      pupils.map(p => [
        p.code,
        {
          studentName: p.studentName,
          allergies: p.allergies,
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

    const allPupilCodesMatchCodes = pupils.every(p => codes.includes(p.code));
    if (!allPupilCodesMatchCodes) {
      return NextResponse.json(
        { error: "Pupil entries must match the submitted codes" },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password, email, pupils);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

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
            },
            select: { id: true },
          })
        : await tx.user.create({
            data: {
              email,
              hashedPassword,
              role: "USER",
              schoolId,
            },
            select: { id: true },
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const message =
      typeof e?.message === "string" && e.message.length > 0
        ? e.message
        : "Registration failed";

    const status =
      message === "Email already registered"
        ? 409
        : message.includes("Password")
          ? 400
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}