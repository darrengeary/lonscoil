import { prisma } from "@/lib/db";

function zplEscape(s: string) {
  return (s ?? "").replace(/[\u0000-\u001F]/g, " ").trim();
}

// Default layout: 4x2 inch @203dpi (adjust ^PW/^LL for your labels)
function renderLabelZPL(opts: {
  jobId: string;
  seq: number;
  total: number;
  pupilName: string;
  classroom: string;
  mealType: string;
  choice: string;
  extras: string[];
}) {
  const { jobId, seq, total, pupilName, classroom, mealType, choice, extras } = opts;

  const header = `${mealType}  #${seq}/${total}`;
  const extrasLine = extras?.length ? `Extras: ${extras.join(", ")}` : "";
  const qr = `JOB:${jobId};SEQ:${seq}`;

  return `^XA
^CI28
^PW812
^LL406
^MD20
^FO20,20^A0N,40,40^FD${zplEscape(header)}^FS
^FO20,70^A0N,34,34^FD${zplEscape(pupilName)}^FS
^FO20,110^A0N,28,28^FD${zplEscape(classroom)}^FS
^FO20,150^A0N,34,34^FD${zplEscape(choice)}^FS
${extrasLine ? `^FO20,195^A0N,24,24^FD${zplEscape(extrasLine)}^FS` : ""}
^FO620,40^BQN,2,6^FDLA,${zplEscape(qr)}^FS
^XZ
`;
}

export const GET = async (req: Request, { params }: { params: { id: string } }) => {
  const { searchParams } = new URL(req.url);
  const from = Math.max(1, Number(searchParams.get("from") ?? "1")); // 1-based
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "200")));

  const job = await prisma.printJob.findUnique({
    where: { id: params.id },
    select: { id: true, totalLabels: true },
  });
  if (!job) return new Response("Not found", { status: 404 });

  const end = Math.min(job.totalLabels, from + limit - 1);

  const items = await prisma.printJobItem.findMany({
    where: { jobId: job.id, seq: { gte: from, lte: end } },
    orderBy: { seq: "asc" },
    select: {
      seq: true,
      pupilName: true,
      classroom: true,
      mealType: true,
      choice: true,
      extras: true,
    },
  });

  const zpl = items
    .map((it) =>
      renderLabelZPL({
        jobId: job.id,
        seq: it.seq,
        total: job.totalLabels,
        pupilName: it.pupilName,
        classroom: it.classroom,
        mealType: it.mealType,
        choice: it.choice,
        extras: it.extras,
      })
    )
    .join("");

  return new Response(zpl, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
