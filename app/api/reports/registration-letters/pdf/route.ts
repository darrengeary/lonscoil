import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { chromium } from "playwright";

export const runtime = "nodejs";

type AnyUser = {
  role?: "ADMIN" | "SCHOOLADMIN" | string;
  schoolId?: string | null;
};

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(args: {
  schoolName: string;
  letters: {
    pupilId: string;
    pupilName: string | null;
    classroomName: string;
  }[];
  isaacbuttLogoUrl: string;
  lunchlogLogoUrl: string;
}) {
  const { schoolName, letters, isaacbuttLogoUrl, lunchlogLogoUrl } = args;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Registration Letters</title>
        <style>
          @page {
            size: A4;
            margin: 16mm;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
          }

          body {
            font-size: 14px;
          }

          .page {
            min-height: calc(297mm - 32mm);
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }

          .page:last-child {
            page-break-after: auto;
          }

          .top {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 22px;
          }

          .branding-isaacbutt {
            height: 84px;
            width: auto;
            object-fit: contain;
          }

          .logo {
            height: 84px;
            width: auto;
            object-fit: contain;
          }

          .school {
            text-align: center;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 18px;
          }

          .classroom {
            text-align: center;
            font-size: 28px;
            font-weight: 800;
            margin: 8px 0 28px;
            color: #111827;
          }

          .letter {
            border: 1px solid #d1d5db;
            border-radius: 16px;
            padding: 24px;
          }

          .intro {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
          }

          .site {
            font-weight: 700;
          }

          .code-wrap {
            margin: 30px 0 24px;
            text-align: center;
          }

          .code-label {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            margin-bottom: 10px;
          }

          .code {
            display: inline-block;
            border: 2px dashed #94a3b8;
            border-radius: 16px;
            padding: 18px 28px;
            font-size: 34px;
            font-weight: 800;
            letter-spacing: 0.08em;
            color: #0f172a;
            background: #f8fafc;
          }

          .footer {
            margin-top: 26px;
            font-size: 13px;
            color: #4b5563;
            line-height: 1.6;
          }

          .student-name {
            margin-top: 14px;
            text-align: center;
            font-size: 15px;
            color: #475569;
          }
        </style>
      </head>
      <body>
        ${letters
          .map(
            (letter) => `
          <div class="page">
            <div class="top">
              <img
                class="branding-isaacbutt"
                src="${escapeHtml(isaacbuttLogoUrl)}"
                alt="isaacbutt"
              />
            </div>

            <div class="school">${escapeHtml(schoolName)}</div>

            <div class="classroom">${escapeHtml(letter.classroomName)}</div>

            <div class="letter">
              <div class="intro">
                Dear Parent/Guardian,
                <br /><br />
                Your child has been added to Lunchlog for school meals.
                Please register now at
                <span class="site">isaacbutt.lunchlog.ie</span>
                using the code below.
              </div>

              <div class="code-wrap">
                <img class="logo" src="${escapeHtml(lunchlogLogoUrl)}" alt="Lunchlog" />
                <div class="code-label">Registration code</div>
                <div class="code">${escapeHtml(letter.pupilId)}</div>
              </div>

              ${
                letter.pupilName
                  ? `<div class="student-name">Student: ${escapeHtml(letter.pupilName)}</div>`
                  : ``
              }

              <div class="footer">
                Thank you,<br />
                School Meals Team
              </div>
            </div>
          </div>
        `
          )
          .join("")}
      </body>
    </html>
  `;
}

export const GET = auth(async (req) => {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const user = (req as any).auth?.user as AnyUser | undefined;

    if (!user?.role || (user.role !== "ADMIN" && user.role !== "SCHOOLADMIN")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const origin = url.origin;

    let schoolId = url.searchParams.get("schoolId");
    const classroomIdsRaw = url.searchParams.get("classroomIds") ?? "";

    const classroomIds = classroomIdsRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (user.role === "SCHOOLADMIN") {
      schoolId = user.schoolId ?? null;
      if (!schoolId) {
        return new Response("No school assigned", { status: 403 });
      }
    }

    if (!schoolId) {
      return new Response("schoolId is required", { status: 400 });
    }

    if (classroomIds.length === 0) {
      return new Response("At least one classroom must be selected", { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });

    if (!school) {
      return new Response("School not found", { status: 404 });
    }

    const classrooms = await prisma.classroom.findMany({
      where: {
        id: { in: classroomIds },
        schoolId: school.id,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    if (classrooms.length === 0) {
      return new Response("No valid classrooms found", { status: 404 });
    }

    const pupils = await prisma.pupil.findMany({
      where: {
        classroomId: { in: classrooms.map((c) => c.id) },
        status: "UNREGISTERED",
      },
      select: {
        id: true,
        name: true,
        classroom: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        {
          classroom: {
            name: "asc",
          },
        },
        { name: "asc" },
        { id: "asc" },
      ],
    });

    if (pupils.length === 0) {
      return new Response("No unregistered pupils found for the selected classrooms", {
        status: 404,
      });
    }

    const html = buildHtml({
      schoolName: school.name,
      letters: pupils.map((p) => ({
        pupilId: p.id,
        pupilName: p.name ?? null,
        classroomName: p.classroom?.name ?? "Classroom",
      })),
      isaacbuttLogoUrl: `${origin}/isaacbutt.jpg`,
      lunchlogLogoUrl: `${origin}/lunchlog.png`,
    });

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new Response(Uint8Array.from(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="registration-letters-${school.name}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Failed to generate registration letters PDF", { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});