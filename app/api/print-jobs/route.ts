// app/api/print-jobs/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";
import net from "node:net";

export const runtime = "nodejs";

type AnyUser = {
  id?: string;
  role?: "ADMIN" | "SCHOOLADMIN" | string;
  schoolId?: string | null;
};

function normalizeExtras(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
}

/** ---------------------------
 *  ZPL (2-up) settings
 *  -------------------------- */
const LABEL_W = 416; // dots (your single sticker width)
const LABEL_H = 560; // dots (your single sticker height)
const GAP_X = 24; // dots gap between columns
const PW = LABEL_W + GAP_X + LABEL_W;
const RIGHT_X0 = LABEL_W + GAP_X;
const INSET_X = 16;
const INSET_Y = 16;

function zplEscape(s: string) {
  return (s ?? "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
}

function ellipsize(s: string, maxChars: number) {
  const clean = zplEscape(s);
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...";
}

type LabelData = {
  jobId: string;
  seq: number;
  schoolName: string;
  dateStr: string;
  pupilName: string;
  classroom: string;
  mealType: string;
  choice: string;
  extras: string[];
  allergens: string[];
};

function renderSingleLabel(d: LabelData, originX: number) {
  const x = originX + INSET_X;
  let y = INSET_Y;

  const lineGap = 6;
  const H1 = { h: 34, w: 28 };
  const H2 = { h: 28, w: 22 };
  const TXT = { h: 24, w: 20 };
  const SM = { h: 20, w: 18 };

  const maxWidthDots = LABEL_W - INSET_X * 2;
  const charsPerLine = Math.floor(maxWidthDots / (TXT.w * 0.7));

  const school = ellipsize(d.schoolName, Math.max(18, Math.floor(charsPerLine * 1.1)));
  const pupil = ellipsize(d.pupilName, Math.max(20, Math.floor(charsPerLine * 1.2)));
  const choice = ellipsize(d.choice, Math.max(22, Math.floor(charsPerLine * 1.2)));
  const extrasStr = d.extras?.length ? ellipsize(d.extras.join(", "), Math.floor(charsPerLine * 2)) : "None";
  const allergensStr = d.allergens?.length
    ? ellipsize(d.allergens.join(", "), Math.floor(charsPerLine * 2))
    : "None";

  return [
    `^FO${x},${y}^A0N,${H2.h},${H2.w}^FD${school}^FS`,
    (y += H2.h + lineGap),

    `^FO${x},${y}^A0N,${SM.h},${SM.w}^FD${zplEscape(d.dateStr)}  •  #${d.seq}^FS`,
    (y += SM.h + lineGap + 6),

    `^FO${x},${y}^A0N,${H1.h},${H1.w}^FD${pupil}^FS`,
    (y += H1.h + lineGap),

    `^FO${x},${y}^A0N,${TXT.h},${TXT.w}^FDClass: ${zplEscape(d.classroom)}^FS`,
    (y += TXT.h + lineGap),

    `^FO${x},${y}^A0N,${TXT.h},${TXT.w}^FDMeal: ${zplEscape(d.mealType)}^FS`,
    (y += TXT.h + lineGap + 4),

    `^FO${x},${y}^GB${LABEL_W - INSET_X * 2},2,2^FS`,
    (y += 10),

    `^FO${x},${y}^A0N,${H2.h},${H2.w}^FD${choice}^FS`,
    (y += H2.h + lineGap + 6),

    `^FO${x},${y}^A0N,${SM.h},${SM.w}^FDExtras: ${zplEscape(extrasStr)}^FS`,
    (y += SM.h + lineGap),

    `^FO${x},${y}^A0N,${SM.h},${SM.w}^FDAllergens: ${zplEscape(allergensStr)}^FS`,

    `^FO${x},${LABEL_H - INSET_Y - 22}^A0N,18,16^FD${zplEscape(d.jobId)}^FS`,
  ].join("\n");
}

function zplForTwoUp(labels: LabelData[]) {
  const out: string[] = [];
  for (let i = 0; i < labels.length; i += 2) {
    const left = labels[i];
    const right = labels[i + 1];

    out.push(
      [
        "^XA",
        `^PW${PW}`, // ✅ CRITICAL: if this is 416, right column gets clipped
        `^LL${LABEL_H}`,
        "^LH0,0",
        "^CI28",
        "^MMT",
        "^PR4",
        "^MD0",

        left ? renderSingleLabel(left, 0) : "",
        right ? renderSingleLabel(right, RIGHT_X0) : "",

        "^XZ",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return out.join("\n");
}

async function sendToZebraRaw(zpl: string) {
  const host = process.env.PRINTER_HOST;
  const port = Number(process.env.PRINTER_PORT ?? "9100");
  if (!host) throw new Error("Missing PRINTER_HOST env var");

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    socket.once("error", reject);
    socket.connect(port, host, () => {
      socket.write(zpl, "utf8", () => socket.end());
    });
    socket.once("close", () => resolve());
  });
}

export const POST = auth(async (req) => {
  const user = (req as any).auth?.user as AnyUser | undefined;

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  let schoolId = searchParams.get("schoolId");
  const classroomId = searchParams.get("classroomId");

  // NEW: optional behaviour flags
  const splitByExtras = searchParams.get("splitByExtras") === "1";
  const mode = searchParams.get("mode") ?? "job"; // "job" | "zpl" | "print"

  if (!dateStr) return new Response("date required", { status: 400 });

  // ---- RBAC ----
  if (user?.role === "SCHOOLADMIN") {
    schoolId = user.schoolId ?? null;
    if (!schoolId) return new Response("No school assigned", { status: 403 });
  } else if (user?.role === "ADMIN") {
    if (!schoolId || schoolId === "all") schoolId = null;
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  const day = parseISO(dateStr);

  const orderWhere: any = {
    date: { gte: startOfDay(day), lte: endOfDay(day) },
  };

  if (classroomId && classroomId !== "all") {
    orderWhere.pupil = { classroomId };
  } else if (schoolId) {
    orderWhere.pupil = { classroom: { schoolId } };
  }

  // ---- Fetch Orders ----
  const orders = await prisma.lunchOrder.findMany({
    where: orderWhere,
    select: {
      pupil: {
        select: {
          id: true,
          name: true,
          classroom: {
            select: {
              id: true,
              name: true,
              schoolId: true,
              school: { select: { name: true } },
            },
          },
        },
      },
      items: {
        select: {
          selectedIngredients: true,
          choiceId: true,
          choice: {
            select: {
              name: true,
              group: { select: { name: true } },
              allergens: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { pupil: { name: "asc" } },
  });

  const inferredSchoolId =
    schoolId ??
    (classroomId && classroomId !== "all"
      ? orders[0]?.pupil?.classroom?.schoolId ?? null
      : null);

  // ---- Build Label Rows ----
  const labelRows: Array<{
    pupilId: string;
    pupilName: string;
    classroom: string;
    schoolName: string;
    choiceId: string;
    choiceName: string;
    extras: string[];
    allergens: string[];
    mealGroupName: string;
  }> = [];

  for (const o of orders) {
    const pupilId = o.pupil.id;
    const pupilName = o.pupil.name;
    const classroomName = o.pupil.classroom?.name ?? "Unknown";
    const schoolName = o.pupil.classroom?.school?.name ?? "School";

    const itemsSorted = [...o.items].sort((a, b) => {
      const ga = (a.choice.group?.name ?? "").toLowerCase();
      const gb = (b.choice.group?.name ?? "").toLowerCase();
      if (ga !== gb) return ga.localeCompare(gb);
      return (a.choice.name ?? "").localeCompare(b.choice.name ?? "");
    });

    for (const it of itemsSorted) {
      if (!it.choiceId) continue;

      const extras = normalizeExtras(it.selectedIngredients);

      if (splitByExtras && extras.length) {
        // split into one label per extra (simple rule; change if you want grouped splitting)
        for (const ex of extras) {
          labelRows.push({
            pupilId,
            pupilName,
            classroom: classroomName,
            schoolName,
            choiceId: it.choiceId,
            choiceName: it.choice.name ?? "Unknown",
            extras: [ex],
            allergens: (it.choice.allergens ?? []).map((a) => a.name).sort((a, b) => a.localeCompare(b)),
            mealGroupName: it.choice.group?.name ?? "Meal",
          });
        }
      } else {
        labelRows.push({
          pupilId,
          pupilName,
          classroom: classroomName,
          schoolName,
          choiceId: it.choiceId,
          choiceName: it.choice.name ?? "Unknown",
          extras,
          allergens: (it.choice.allergens ?? []).map((a) => a.name).sort((a, b) => a.localeCompare(b)),
          mealGroupName: it.choice.group?.name ?? "Meal",
        });
      }
    }
  }

  // ---- Create Job + Items ----
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.printJob.create({
      data: {
        createdById: user?.id ?? null,
        date: startOfDay(day),
        schoolId: inferredSchoolId,
        classroomId: classroomId && classroomId !== "all" ? classroomId : null,
        status: "CREATED",
        nextSeq: 1,
        totalLabels: labelRows.length,
      },
      select: { id: true, totalLabels: true, nextSeq: true },
    });

    if (labelRows.length) {
      await tx.printJobItem.createMany({
        data: labelRows.map((r, idx) => ({
          jobId: created.id,
          seq: idx + 1,

          pupilId: r.pupilId,
          pupilName: r.pupilName,
          classroom: r.classroom,
          schoolName: r.schoolName,

          mealType: r.mealGroupName,
          choiceId: r.choiceId,
          choice: r.choiceName,
          extras: r.extras,
          allergens: r.allergens,
        })),
      });
    }

    return created;
  });

  // ---- OPTIONAL: generate ZPL from what we just created ----
  if (mode === "zpl" || mode === "print") {
    const items = await prisma.printJobItem.findMany({
      where: { jobId: job.id },
      orderBy: { seq: "asc" },
      select: {
        jobId: true,
        seq: true,
        schoolName: true,
        pupilName: true,
        classroom: true,
        mealType: true,
        choice: true,
        extras: true,
        allergens: true,
      },
    });

    const labels: LabelData[] = items.map((it) => ({
      jobId: it.jobId,
      seq: it.seq,
      schoolName: it.schoolName ?? "School",
      dateStr: format(startOfDay(day), "yyyy-MM-dd"),
      pupilName: it.pupilName ?? "",
      classroom: it.classroom ?? "",
      mealType: it.mealType ?? "Meal",
      choice: it.choice ?? "",
      extras: Array.isArray(it.extras) ? it.extras : [],
      allergens: Array.isArray(it.allergens) ? it.allergens : [],
    }));

    const zpl = zplForTwoUp(labels);

    if (mode === "print") {
      await sendToZebraRaw(zpl);
      return Response.json({
        ok: true,
        jobId: job.id,
        printed: labels.length,
        rows: Math.ceil(labels.length / 2),
        pw: PW,
        labelW: LABEL_W,
        gapX: GAP_X,
      });
    }

    return new Response(zpl, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return Response.json(job);
});