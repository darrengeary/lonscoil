// app/api/print-jobs/[id]/preview/route.ts
import { prisma } from "@/lib/db";

export const GET = async (req: Request, { params }: { params: { id: string } }) => {
  const { searchParams } = new URL(req.url);
  const from = Math.max(1, Number(searchParams.get("from") ?? "1"));
  const limit = Math.min(12, Math.max(1, Number(searchParams.get("limit") ?? "3"))); // keep small for preview
  const dpi = Number(searchParams.get("dpi") ?? "203");

  const job = await prisma.printJob.findUnique({
    where: { id: params.id },
    select: { id: true, totalLabels: true },
  });
  if (!job) return new Response("Not found", { status: 404 });

  const end = Math.min(job.totalLabels, from + limit - 1);

  const items = await prisma.printJobItem.findMany({
    where: { jobId: job.id, seq: { gte: from, lte: end } },
    orderBy: { seq: "asc" },
    select: { seq: true, pupilName: true, classroom: true, mealType: true, choice: true, extras: true },
  });

  // --- ZPL generator (label size 53mm x 67mm) ---
  const PW = dpi === 300 ? 627 : 424; // 53mm at 300dpi ≈ 627
  const LL = dpi === 300 ? 792 : 536; // 67mm at 300dpi ≈ 792

  const zpl = items.map((it) => {
    const header = `${it.mealType}  #${it.seq}/${job.totalLabels}`;
    const extrasLine = it.extras?.length ? `Extras: ${it.extras.join(", ")}` : "";
    const qr = `JOB:${job.id};SEQ:${it.seq}`;

    return `^XA
^CI28
^PW${PW}
^LL${LL}
^MD10
^FO18,18^A0N,34,34^FD${header}^FS
^FO18,62^A0N,30,30^FD${it.pupilName}^FS
^FO18,98^A0N,24,24^FD${it.classroom}^FS
^FO18,132^A0N,28,28^FD${it.choice}^FS
${extrasLine ? `^FO18,168^A0N,22,22^FD${extrasLine}^FS` : ""}
^FO${PW - (dpi === 300 ? 190 : 150)},18^BQN,2,5^FDLA,${qr}^FS
^XZ
`;
  }).join("\n");

  // Render with Labelary (one image per label when you request /labels/{dpi}dpmm/{w}x{h}/)
  // dpmm = dpi / 25.4; 203dpi ≈ 8dpmm, 300dpi ≈ 12dpmm
  const dpmm = dpi === 300 ? 12 : 8;
  const wIn = 53 / 25.4;
  const hIn = 67 / 25.4;

  const labelaryUrl = `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${wIn.toFixed(3)}x${hIn.toFixed(3)}/0/`;

  const r = await fetch(labelaryUrl, {
    method: "POST",
    headers: { "Accept": "image/png" },
    body: zpl,
  });

  if (!r.ok) {
    const txt = await r.text();
    return new Response(`Labelary render failed: ${txt}`, { status: 500 });
  }

  const buf = await r.arrayBuffer();
  return new Response(buf, { headers: { "Content-Type": "image/png" } });
};
