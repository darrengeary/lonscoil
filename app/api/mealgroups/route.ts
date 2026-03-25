import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

function parseMaxSelections(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function mapGroup(group: any) {
  return {
    id: group.id,
    name: group.name,
    maxSelections: group.maxSelections,
    active: group.active,
    choices: (group.choices ?? []).map((choice: any) => ({
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
      createdAt:
        choice.createdAt instanceof Date
          ? choice.createdAt.toISOString()
          : choice.createdAt,
      updatedAt:
        choice.updatedAt instanceof Date
          ? choice.updatedAt.toISOString()
          : choice.updatedAt,
    })),
  };
}

export const GET = auth(async (req: NextRequest & { auth?: any }) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const mealOptionId = searchParams.get("mealOptionId");

    if (!mealOptionId) {
      return NextResponse.json(
        { error: "mealOptionId is required" },
        { status: 400 }
      );
    }

    const groups = await prisma.mealGroup.findMany({
      where: {
        MealOptionMealGroup: {
          some: {
            mealOptionId,
          },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        choices: {
          include: {
            allergens: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    return NextResponse.json(groups.map(mapGroup));
  } catch (error) {
    console.error("GET /api/mealgroups error", error);
    return NextResponse.json(
      { error: "Failed to load meal groups" },
      { status: 500 }
    );
  }
});

export const POST = auth(async (req: NextRequest & { auth?: any }) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();

    const mealOptionId = String(body.mealOptionId || "");
    const name = String(body.name || "").trim();
    const active = body.active ?? true;
    const maxSelections = parseMaxSelections(body.maxSelections);
    const duplicateFromGroupId =
      body.duplicateFromGroupId && String(body.duplicateFromGroupId).trim()
        ? String(body.duplicateFromGroupId)
        : null;

    if (!mealOptionId) {
      return NextResponse.json(
        { error: "mealOptionId is required" },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const group = await tx.mealGroup.create({
        data: {
          name,
          maxSelections,
          active: Boolean(active),
        },
      });

      await tx.mealOptionMealGroup.create({
        data: {
          mealOptionId,
          groupId: group.id,
        },
      });

      if (duplicateFromGroupId) {
        const sourceChoices = await tx.mealChoice.findMany({
          where: { groupId: duplicateFromGroupId },
          include: {
            allergens: true,
          },
          orderBy: { createdAt: "asc" },
        });

        for (const choice of sourceChoices) {
          const newChoice = await tx.mealChoice.create({
            data: {
              groupId: group.id,
              name: choice.name,
              active: choice.active,
              extraSticker: choice.extraSticker,
              imageUrl: choice.imageUrl,
              ingredients: choice.ingredients,
              availStart: choice.availStart,
              availEnd: choice.availEnd,
              caloriesKcal: choice.caloriesKcal,
              proteinG: choice.proteinG,
              carbsG: choice.carbsG,
              sugarsG: choice.sugarsG,
              fatG: choice.fatG,
              saturatesG: choice.saturatesG,
              fibreG: choice.fibreG,
              saltG: choice.saltG,
            },
          });

          if (choice.allergens.length > 0) {
            await tx.mealChoice.update({
              where: { id: newChoice.id },
              data: {
                allergens: {
                  connect: choice.allergens.map((a) => ({ id: a.id })),
                },
              },
            });
          }
        }
      }

      return tx.mealGroup.findUniqueOrThrow({
        where: { id: group.id },
        include: {
          choices: {
            include: {
              allergens: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });
    });

    return NextResponse.json(mapGroup(created));
  } catch (error) {
    console.error("POST /api/mealgroups error", error);
    return NextResponse.json(
      { error: "Failed to create meal group" },
      { status: 500 }
    );
  }
});

export const PUT = auth(async (req: NextRequest & { auth?: any }) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();

    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    const active = body.active ?? true;
    const maxSelections = parseMaxSelections(body.maxSelections);

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.mealGroup.update({
      where: { id },
      data: {
        name,
        active: Boolean(active),
        maxSelections,
      },
      include: {
        choices: {
          include: {
            allergens: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    return NextResponse.json(mapGroup(updated));
  } catch (error) {
    console.error("PUT /api/mealgroups error", error);
    return NextResponse.json(
      { error: "Failed to update meal group" },
      { status: 500 }
    );
  }
});