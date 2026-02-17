import { prisma } from "@/lib/db";

export const POST = async (req: Request, { params }: { params: { id: string } }) => {
  const body = await req.json().catch(() => ({}));
  const printedUpTo = Number(body?.printedUpTo);

  if (!Number.isFinite(printedUpTo) || printedUpTo < 0) {
    return new Response("printedUpTo required", { status: 400 });
  }

  const job = await prisma.printJob.findUnique({
    where: { id: params.id },
    select: { id: true, totalLabels: true },
  });
  if (!job) return new Response("Not found", { status: 404 });

  const nextSeq = Math.min(printedUpTo + 1, job.totalLabels + 1);

  await prisma.printJob.update({
    where: { id: job.id },
    data: {
      nextSeq,
      status: nextSeq > job.totalLabels ? "COMPLETED" : "PRINTING",
    },
  });

  return Response.json({ ok: true, nextSeq });
};
