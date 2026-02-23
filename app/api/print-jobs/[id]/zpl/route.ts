import { prisma } from "@/lib/db";
import { format } from "date-fns";

function zplEscape(s: string) {
  return (s ?? "").replace(/[\u0000-\u001F]/g, " ").trim();
}

function ellipsize(s: string, maxChars: number) {
  const clean = (s ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...";
}

function ellipsizeForLines(s: string, charsPerLine: number, lines: number) {
  return ellipsize(s, charsPerLine * lines);
}

// Portrait 52mm x 70mm @203dpi ≈ 416 x 560
function renderLabelZPL(opts: {
  jobId: string;
  seq: number;
  total: number;
  schoolName: string;
  dateStr: string;
  pupilName: string;
  classroom: string;
  choice: string;
  extras: string[];
  allergens: string[];
}) {
  const {
    jobId,
    seq,
    total,
    schoolName,
    dateStr,
    pupilName,
    classroom,
    choice,
    extras,
    allergens,
  } = opts;

  const shortJob = jobId.slice(-6).toUpperCase();
  const stickerId = `${shortJob}-${String(seq).padStart(4, "0")}`;

  const schoolLine = ellipsize(schoolName, 26);
  const dateLine = ellipsize(dateStr, 18);
  const seqLine = `${String(seq).padStart(3, "0")}/${total}`;

  const nameLine = ellipsize(pupilName.toUpperCase(), 18);
  const classLine = ellipsize(classroom, 18);

  const choiceText = ellipsizeForLines(choice, 20, 2);

  const extrasLine = extras?.length ? `Extras: ${extras.join(", ")}` : "";
  const extrasText = extrasLine
    ? ellipsizeForLines(extrasLine, 24, 2)
    : "";

  const allergLine =
    allergens?.length
      ? `Allergens: ${allergens.join(", ")}`
      : "Allergens: None";

  const allergText = ellipsize(allergLine, 30);

  return `^XA
^CI28
^PW416
^LL560
^LH0,0
^MD20

^FO14,10^A0N,22,22^FD${zplEscape(schoolLine)}^FS
^FO14,34^A0N,20,20^FD${zplEscape(dateLine)}^FS
^FO300,34^A0N,20,20^FD${zplEscape(seqLine)}^FS

^FO14,62^A0N,52,52^FD${zplEscape(nameLine)}^FS
^FO14,118^A0N,24,24^FDClass: ${zplEscape(classLine)}^FS

^FO14,150^A0N,34,34^FB388,2,2,L,0^FD${zplEscape(choiceText)}^FS

${extrasText ? `^FO14,234^A0N,22,22^FB388,2,2,L,0^FD${zplEscape(extrasText)}^FS` : ""}

^FO14,308^A0N,20,20^FD${zplEscape(allergText)}^FS

^FO230,534^A0N,18,18^FDID:${zplEscape(stickerId)}^FS

^XZ
`;
}

export const GET = async (req: Request, { params }: { params: { id: string } }) => {
  const job = await prisma.printJob.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      totalLabels: true,
      date: true,
    },
  });

  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const dateStr = format(job.date, "EEE dd/MM/yyyy");

  // 👇 LIMIT TO FIRST 50 ONLY (for now)
  const items = await prisma.printJobItem.findMany({
    where: { jobId: job.id },
    orderBy: { seq: "asc" },
    take: 50,
    select: {
      seq: true,
      schoolName: true,   // must exist in schema
      pupilName: true,
      classroom: true,
      choice: true,
      extras: true,
      allergens: true,
    },
  });

  const zpl = items
    .map((it) =>
      renderLabelZPL({
        jobId: job.id,
        seq: it.seq,
        total: job.totalLabels,
        schoolName: it.schoolName ?? "School",
        dateStr,
        pupilName: it.pupilName,
        classroom: it.classroom,
        choice: it.choice,
        extras: it.extras ?? [],
        allergens: it.allergens ?? [],
      })
    )
    .join("");

  return new Response(zpl, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="printjob_${job.id}_first50.zpl"`,
    },
  });
};