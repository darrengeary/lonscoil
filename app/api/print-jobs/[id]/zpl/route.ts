// app/api/print-jobs/[id]/zpl/route.ts
import { prisma } from "@/lib/db";
import { format } from "date-fns";

function zplEscape(s: string) {
  return (s ?? "")
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\^/g, " ")
    .replace(/~/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ellipsize(s: string, maxChars: number) {
  const clean = (s ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...";
}
function ellipsizeForLines(s: string, charsPerLine: number, lines: number) {
  return ellipsize(s, charsPerLine * lines);
}function renderSingleLabelBody(opts: {
  jobId: string;
  seq: number;
  schoolName: string;
  dateStr: string;
  pupilName: string;
  classroom: string;
  choice: string;
  extras: string[];
  allergens: string[];
  nutritionLine?: string;
}) {
  const {
    jobId,
    seq,
    schoolName,
    dateStr,
    pupilName,
    classroom,
    choice,
    extras,
    allergens,
    nutritionLine,
  } = opts;

  const shortJob = jobId.slice(-6).toUpperCase();
  const ref = `${shortJob}-${String(seq).padStart(4, "0")}`;

  // school ALL CAPS
  const schoolLine = ellipsize((schoolName ?? "School").toUpperCase(), 26);
  const dateLine = ellipsize(dateStr, 20);

  // pupil name unchanged size, but keep caps
  const nameLine = ellipsize((pupilName ?? "").toUpperCase(), 18);
  const classLine = ellipsize(classroom, 22);

  const choiceText = ellipsizeForLines(choice, 22, 2);

  const extrasText =
    extras?.length > 0 ? `Extras: ${extras.join(", ")}` : "";

  const allergText =
    allergens?.length > 0
      ? `Allergens: ${allergens.join(", ")}`
      : "Allergens: None";

  const nutritionText = nutritionLine ? nutritionLine : "";

  // More margin
  const X = 28;
  const W = 360;

  return `
^FO${X},18^A0N,26,26^FD${zplEscape(schoolLine)}^FS
^FO${X},46^A0N,22,22^FD${zplEscape(dateLine)}^FS

^FO${X},76^GB${W},2,2^FS

^FO${X},96^A0N,48,48^FD${zplEscape(nameLine)}^FS
^FO${X},152^A0N,26,26^FDClass: ${zplEscape(classLine)}^FS

^FO${X},186^GB${W},2,2^FS

^FO${X},206^A0N,36,36^FB${W},2,3,L,0^FD${zplEscape(choiceText)}^FS

${extrasText ? `^FO${X},266^A0N,26,26^FB${W},2,3,L,0^FD${zplEscape(extrasText)}^FS` : ""}

^FO${X},322^A0N,24,24^FB${W},2,3,L,0^FD${zplEscape(allergText)}^FS

${nutritionText ? `^FO${X},372^A0N,22,22^FB${W},2,3,L,0^FD${zplEscape(nutritionText)}^FS` : ""}

^FO260,530^A0N,18,18^FDRef: ${zplEscape(ref)}^FS
`.trim();
}

function buildNutritionLine(choice: {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  saltG: number | null;
}) {
  const kcal = choice.caloriesKcal;
  if (kcal == null) return "";

  const parts: string[] = [];
  parts.push(`Nutrition: ${kcal}kcal`);
  if (choice.proteinG != null) parts.push(`P ${choice.proteinG}g`);
  if (choice.carbsG != null) parts.push(`C ${choice.carbsG}g`);
  if (choice.fatG != null) parts.push(`F ${choice.fatG}g`);
  if (choice.saltG != null) parts.push(`Salt ${choice.saltG}g`);
  return parts.join(" | ");
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function mmToDots(mm: number, dpi = 203) {
  return Math.round((mm / 25.4) * dpi);
}

export const GET = async (
  req: Request,
  { params }: { params: { id: string } }
) => {
  const { searchParams } = new URL(req.url);

  const from = Math.max(1, parseInt(searchParams.get("from") ?? "1", 10));
  const limit = Math.min(
    2000,
    Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10))
  );

  // ---- HARD DEFAULTS: 3 across, 1mm gap ----
  const across = 3;

  // keep dpi param if you want; default 203
  const dpi = parseInt(searchParams.get("dpi") ?? "203", 10);

  // label size (your design): 52mm x 70mm
  const labelWmm = parseFloat(searchParams.get("labelWmm") ?? "52");
  const labelHmm = parseFloat(searchParams.get("labelHmm") ?? "70");

  // DEFAULT 1mm gap (you said 1mm)
  const gapMm = parseFloat(searchParams.get("gapMm") ?? "1");

  const labelW = mmToDots(labelWmm, dpi); // 52mm @203 ≈ 416
  const labelH = mmToDots(labelHmm, dpi); // 70mm @203 ≈ 560
  const gap = mmToDots(gapMm, dpi);       // 1mm @203 ≈ 8

  const sheetW = across * labelW + (across - 1) * gap;

  const job = await prisma.printJob.findUnique({
    where: { id: params.id },
    select: { id: true, totalLabels: true, date: true },
  });
  if (!job) return new Response("Not found", { status: 404 });

  const dateStr = format(job.date, "EEE dd/MM/yyyy");
  const to = from + limit - 1;

  const items = await prisma.printJobItem.findMany({
    where: { jobId: job.id, seq: { gte: from, lte: to } },
    orderBy: { seq: "asc" },
    select: {
      seq: true,
      schoolName: true,
      pupilName: true,
      classroom: true,
      choice: true,
      choiceId: true,
      extras: true,
      allergens: true,
    },
  });

  const choiceIds = Array.from(
    new Set(items.map((i) => i.choiceId).filter(Boolean) as string[])
  );

  const choices = choiceIds.length
    ? await prisma.mealChoice.findMany({
        where: { id: { in: choiceIds } },
        select: {
          id: true,
          caloriesKcal: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          saltG: true,
        },
      })
    : [];

  const nutritionByChoiceId = new Map(
    choices.map((c) => [c.id, buildNutritionLine(c)])
  );

  const rows = chunk(items, across);

  const zpl = rows
    .map((row) => {
      const parts: string[] = [];

      parts.push(`^XA
^CI28
^PW${sheetW}
^LL${labelH}
^LH0,0
^MD10`);

      row.forEach((it, colIdx) => {
        const xOffset = colIdx * (labelW + gap);

        // Shift origin for this label "column"
        parts.push(`^LH${xOffset},0`);

        parts.push(
          renderSingleLabelBody({
            jobId: job.id,
            seq: it.seq,
            schoolName: it.schoolName ?? "School",
            dateStr,
            pupilName: it.pupilName,
            classroom: it.classroom,
            choice: it.choice,
            extras: it.extras ?? [],
            allergens: it.allergens ?? [],
            nutritionLine: it.choiceId
              ? nutritionByChoiceId.get(it.choiceId) ?? ""
              : "",
          })
        );
      });

      parts.push(`^LH0,0
^XZ`);

      return parts.join("\n");
    })
    .join("\n");

  return new Response(zpl, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="printjob_${job.id}_${from}-${from + items.length - 1}.zpl"`,
      "Cache-Control": "no-store",
    },
  });
};