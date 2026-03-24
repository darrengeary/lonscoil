import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

function mapChoice(choice: any) {
  return {
    id: choice.id,
    name: choice.name,
    groupId: choice.groupId,
    active: choice.active,
    extraSticker: choice.extraSticker,
    caloriesKcal: choice.caloriesKcal ?? null,
    proteinG: choice.proteinG ?? null,
    carbsG: choice.carbsG ?? null,
    sugarsG: choice.sugarsG ?? null,
    fatG: choice.fatG ?? null,
    saturatesG: choice.saturatesG ?? null,
    fibreG: choice.fibreG ?? null,
    saltG: choice.saltG ?? null,
    allergens: (choice.allergens ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
    })),
    createdAt: choice.createdAt.toISOString(),
    updatedAt: choice.updatedAt.toISOString(),
  };
}

function mapGroup(group: any) {
  return {
    id: group.id,
    name: group.name,
    maxSelections: group.maxSelections,
    active: group.active,
    choices: (group.choices ?? []).map(mapChoice),
  };
}

export const POST = auth(async (req: Request) => {
  const { user } = (req as any).auth;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const mealOptionId = (body?.mealOptionId ?? "").trim();
  const duplicateFromGroupId = (body?.duplicateFromGroupId ?? "").trim() || null;
  const maxSelections = Number(body?.maxSelections ?? 1);

  if (!mealOptionId) return new Response("mealOptionId required", { status: 400 });
  if (!name && !duplicateFromGroupId) return new Response("name or duplicateFromGroupId required", { status: 400 });
  if (!Number.isFinite(maxSelections) || maxSelections < 1) {
    return new Response("maxSelections invalid", { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const mealOption = await tx.mealOption.findUnique({
        where: { id: mealOptionId },
        select: { id: true },
      });

      if (!mealOption) {
        throw new Error("MEAL_OPTION_NOT_FOUND");
      }

      let group;

      if (duplicateFromGroupId) {
        const source = await tx.mealGroup.findUnique({
          where: { id: duplicateFromGroupId },
          include: {
            choices: {
              include: {
                allergens: true,
              },
            },
          },
        });

        if (!source) throw new Error("SOURCE_GROUP_NOT_FOUND");

        group = await tx.mealGroup.create({
          data: {
            name: name || `${source.name} Copy`,
            maxSelections: source.maxSelections,
            active: false,
          },
        });

        for (const sourceChoice of source.choices) {
          await tx.mealChoice.create({
            data: {
              name: sourceChoice.name,
              groupId: group.id,
              active: false,
              extraSticker: sourceChoice.extraSticker,
              caloriesKcal: sourceChoice.caloriesKcal,
              proteinG: sourceChoice.proteinG,
              carbsG: sourceChoice.carbsG,
              sugarsG: sourceChoice.sugarsG,
              fatG: sourceChoice.fatG,
              saturatesG: sourceChoice.saturatesG,
              fibreG: sourceChoice.fibreG,
              saltG: sourceChoice.saltG,
              allergens: sourceChoice.allergens.length
                ? {
                    connect: sourceChoice.allergens.map((a) => ({ id: a.id })),
                  }
                : undefined,
            },
          });
        }
      } else {
        group = await tx.mealGroup.create({
          data: {
            name,
            maxSelections,
            active: false,
          },
        });
      }

      await tx.mealOptionMealGroup.create({
        data: {
          mealOptionId,
          groupId: group.id,
        },
      });

      return tx.mealGroup.findUnique({
        where: { id: group.id },
        include: {
          choices: {
            orderBy: { name: "asc" },
            include: {
              allergens: true,
            },
          },
        },
      });
    });

    return NextResponse.json(mapGroup(created), { status: 201 });
  } catch (e: any) {
    if (e?.message === "MEAL_OPTION_NOT_FOUND") {
      return new Response("mealOption not found", { status: 404 });
    }
    if (e?.message === "SOURCE_GROUP_NOT_FOUND") {
      return new Response("source group not found", { status: 404 });
    }

    console.error(e);
    return new Response("server error", { status: 500 });
  }
});

export const PUT = auth(async (req: Request) => {
  const { user } = (req as any).auth;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").trim();
  const name = (body?.name ?? "").trim();
  const maxSelections = Number(body?.maxSelections ?? 1);
  const active = !!body?.active;

  if (!id) return new Response("id required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });
  if (!Number.isFinite(maxSelections) || maxSelections < 1) {
    return new Response("maxSelections invalid", { status: 400 });
  }

  try {
    const updated = await prisma.mealGroup.update({
      where: { id },
      data: {
        name,
        maxSelections,
        active,
      },
      include: {
        choices: {
          orderBy: { name: "asc" },
          include: {
            allergens: true,
          },
        },
      },
    });

    return NextResponse.json(mapGroup(updated));
  } catch (e: any) {
    if (e?.code === "P2025") {
      return new Response("group not found", { status: 404 });
    }

    console.error(e);
    return new Response("server error", { status: 500 });
  }
});