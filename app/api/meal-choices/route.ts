import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

function parseNullableNumber(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapChoice(choice: any) {
  return {
    id: choice.id,
    name: choice.name,
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
    allergens: choice.allergens.map((a: any) => ({
      id: a.id,
      name: a.name,
      color: null,
    })),
  };
}

export const GET = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId")?.trim();

  if (!groupId) return new Response("groupId required", { status: 400 });

  const choices = await prisma.mealChoice.findMany({
    where: { groupId },
    orderBy: { name: "asc" },
    include: {
      allergens: true,
    },
  });

  return NextResponse.json(choices.map(mapChoice));
});

export const POST = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const groupId = (body?.groupId ?? "").trim();
  const active = !!body?.active;

  if (!name) return new Response("name required", { status: 400 });
  if (!groupId) return new Response("groupId required", { status: 400 });

  const created = await prisma.mealChoice.create({
    data: {
      name,
      groupId,
      active,
      extraSticker: false,
    },
    include: {
      allergens: true,
    },
  });

  return NextResponse.json(mapChoice(created), { status: 201 });
});

export const PUT = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").trim();
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const active = typeof body?.active === "boolean" ? body.active : undefined;
  const extraSticker =
    typeof body?.extraSticker === "boolean" ? body.extraSticker : undefined;
  const allergenIds = Array.isArray(body?.allergenIds) ? body.allergenIds : undefined;

  if (!id) return new Response("id required", { status: 400 });

  const data: any = {};

  if (name !== undefined && name !== "") data.name = name;
  if (active !== undefined) data.active = active;
  if (extraSticker !== undefined) data.extraSticker = extraSticker;

  if ("caloriesKcal" in (body ?? {})) data.caloriesKcal = parseNullableNumber(body.caloriesKcal);
  if ("proteinG" in (body ?? {})) data.proteinG = parseNullableNumber(body.proteinG);
  if ("carbsG" in (body ?? {})) data.carbsG = parseNullableNumber(body.carbsG);
  if ("sugarsG" in (body ?? {})) data.sugarsG = parseNullableNumber(body.sugarsG);
  if ("fatG" in (body ?? {})) data.fatG = parseNullableNumber(body.fatG);
  if ("saturatesG" in (body ?? {})) data.saturatesG = parseNullableNumber(body.saturatesG);
  if ("fibreG" in (body ?? {})) data.fibreG = parseNullableNumber(body.fibreG);
  if ("saltG" in (body ?? {})) data.saltG = parseNullableNumber(body.saltG);

  if (allergenIds !== undefined) {
    data.allergens = {
      set: allergenIds.map((id: string) => ({ id })),
    };
  }

  const updated = await prisma.mealChoice.update({
    where: { id },
    data,
    include: {
      allergens: true,
    },
  });

  return NextResponse.json(mapChoice(updated));
});