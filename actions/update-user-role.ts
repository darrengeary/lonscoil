"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { userRoleSchema } from "@/lib/validations/user";

export type FormData = {
  role: UserRole;
};

export async function updateUserRole(userId: string, data: FormData) {
  try {
    const session = await auth();

    // Allow any logged-in user to trigger this
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const { role } = userRoleSchema.parse(data);

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    revalidatePath("/settings");

    return { status: "success" };
  } catch (error) {
    console.error("updateUserRole error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
