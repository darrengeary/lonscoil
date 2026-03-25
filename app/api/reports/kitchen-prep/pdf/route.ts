import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { chromium } from "playwright";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";

export const runtime = "nodejs";

type AnyUser = {
  role?: "ADMIN" | "SCHOOLADMIN" | string;
  schoolId?: string | null;
};

type ReportView = "grouped" | "choices" | "individual-choices" | "student";

type TagCount = {
  name: string;
  qty: number;
};

type GroupedMealRow = {
  meal: string;
  count: number;
  tags: TagCount[];
};

type SplitMealRow = {
  meal: string;
  tagSig: string;
  count: number;
};

type IndividualChoiceRow = {
  choice: string;
  count: number;
};

type StudentMealRow = {
  pupilName: string;
  classroom: string;
  meal: string;
  tags: string[];
  tagSig: string;
};

type MealInstance = {
  orderId: string;
  mealKey: string;
  meal: string;
  pupilName: string;
  classroom: string;
  tags: Set<string>;
};

function signature(values: string[], emptyLabel: string) {
  return values.length ? values.join(" + ") : emptyLabel;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(args: {
  title: string;
  startDate: string;
  endDate: string;
  schoolLabel: string;
  classroomLabel: string;
  menuLabel: string;
  view: ReportView;
  totalMeals: number;
  secondaryLabel: string;
  secondaryValue: number;
  groupedMeals: GroupedMealRow[];
  splitMeals: SplitMealRow[];
  individualChoiceRows: IndividualChoiceRow[];
  studentRows: StudentMealRow[];
  schoolMealsLogoUrl: string;
  lunchlogLogoUrl: string;
}) {
  const {
    title,
    startDate,
    endDate,
    schoolLabel,
    classroomLabel,
    menuLabel,
    view,
    totalMeals,
    secondaryLabel,
    secondaryValue,
    groupedMeals,
    splitMeals,
    individualChoiceRows,
    studentRows,
    schoolMealsLogoUrl,
    lunchlogLogoUrl,
  } = args;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 16mm 12mm 18mm 12mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            margin: 0;
            font-size: 12px;
          }

          .branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 14px;
          }

          .branding-schoolmeals {
            height: 62px;
            width: auto;
            object-fit: contain;
          }

          .branding-lunchlog {
            height: 42px;
            width: auto;
            object-fit: contain;
            align-items: center;
            justify-content: center;
          }

          .header {
            border-bottom: 2px solid #d1d5db;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }

          .title {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 8px;
            text-align: center;
          }

          .meta {
            color: #4b5563;
            line-height: 1.5;
            margin-bottom: 12px;
          }

          .summary {
            display: flex;
            gap: 12px;
            margin-top: 10px;
          }

          .pill {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 10px 12px;
            min-width: 170px;
          }

          .pill-label {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .pill-value {
            font-size: 18px;
            font-weight: 700;
          }

          .section-title {
            margin: 18px 0 8px;
            font-size: 14px;
            font-weight: 700;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-bottom: 16px;
          }

          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 7px 8px;
            vertical-align: top;
            word-wrap: break-word;
          }

          th {
            background: #f1f5f9;
            text-align: left;
            font-weight: 700;
          }

          .empty {
            text-align: center;
            color: #6b7280;
            padding: 14px;
          }

          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 10px;
            color: #6b7280;
            text-align: right;
          }

          .page-number:before {
            content: counter(page);
          }

          .page-count:before {
            content: counter(pages);
          }
        </style>
      </head>
      <body>
        <div class="branding">
          <img
            class="branding-schoolmeals"
            src="${escapeHtml(schoolMealsLogoUrl)}"
            alt="SchoolMeals"
          />
        </div>

        <div class="header">
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">
            <div>Date Range: ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</div>
            <div>School: ${escapeHtml(schoolLabel)}</div>
            <div>Classroom: ${escapeHtml(classroomLabel)}</div>
            <div>Menu: ${escapeHtml(menuLabel)}</div>
            <div>View: ${escapeHtml(
              view === "grouped"
                ? "Grouped"
                : view === "choices"
                ? "Split by choice tags"
                : view === "individual-choices"
                ? "Individual choices only"
                : "By student"
            )}</div>
          </div>

          <div class="summary">
            <div class="pill">
              <div class="pill-label">Total Meals</div>
              <div class="pill-value">${totalMeals}</div>
            </div>
            <div class="pill">
              <div class="pill-label">${escapeHtml(secondaryLabel)}</div>
              <div class="pill-value">${secondaryValue}</div>
            </div>
          </div>
        </div>

        <div class="section-title">${escapeHtml(
          view === "grouped"
            ? "Grouped Meals"
            : view === "choices"
            ? "Meals Split by Choice Tags"
            : view === "individual-choices"
            ? "Individual Choices Only"
            : "Meals By Student"
        )}</div>

        ${
          view === "grouped"
            ? `
          <table>
            <thead>
              <tr>
                <th>Meal</th>
                <th>Choice Tags</th>
                <th style="width: 100px; text-align: right;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${
                groupedMeals.length
                  ? groupedMeals
                      .map((row) => {
                        const tagsText = row.tags.length
                          ? row.tags.map((x) => `${x.name}×${x.qty}`).join(", ")
                          : "No tags";

                        return `
                          <tr>
                            <td>${escapeHtml(row.meal)}</td>
                            <td>${escapeHtml(tagsText)}</td>
                            <td style="text-align: right;">${row.count}</td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `<tr><td colspan="3" class="empty">No data found for this report.</td></tr>`
              }
            </tbody>
          </table>
        `
            : view === "choices"
            ? `
          <table>
            <thead>
              <tr>
                <th>Meal</th>
                <th>Choice Tags</th>
                <th style="width: 100px; text-align: right;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${
                splitMeals.length
                  ? splitMeals
                      .map(
                        (row) => `
                    <tr>
                      <td>${escapeHtml(row.meal)}</td>
                      <td>${escapeHtml(row.tagSig)}</td>
                      <td style="text-align: right;">${row.count}</td>
                    </tr>
                  `
                      )
                      .join("")
                  : `<tr><td colspan="3" class="empty">No data found for this report.</td></tr>`
              }
            </tbody>
          </table>
        `
            : view === "individual-choices"
            ? `
          <table>
            <thead>
              <tr>
                <th>Choice</th>
                <th style="width: 100px; text-align: right;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${
                individualChoiceRows.length
                  ? individualChoiceRows
                      .map(
                        (row) => `
                    <tr>
                      <td>${escapeHtml(row.choice)}</td>
                      <td style="text-align: right;">${row.count}</td>
                    </tr>
                  `
                      )
                      .join("")
                  : `<tr><td colspan="2" class="empty">No data found for this report.</td></tr>`
              }
            </tbody>
          </table>
        `
            : `
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Classroom</th>
                <th>Meal</th>
                <th>Choice Tags</th>
              </tr>
            </thead>
            <tbody>
              ${
                studentRows.length
                  ? studentRows
                      .map((row) => `
                    <tr>
                      <td>${escapeHtml(row.pupilName)}</td>
                      <td>${escapeHtml(row.classroom)}</td>
                      <td>${escapeHtml(row.meal)}</td>
                      <td>${escapeHtml(row.tagSig)}</td>
                    </tr>
                  `)
                      .join("")
                  : `<tr><td colspan="4" class="empty">No data found for this report.</td></tr>`
              }
            </tbody>
          </table>
        `
        }

        <div class="footer">
          Page <span class="page-number"></span> of <span class="page-count"></span>
        </div>
      </body>
    </html>
  `;
}

function resolveMealOptionForChoice(input: {
  choiceGroupId: string;
  pupilMenu:
    | {
        id: string;
        mealOptions: {
          id: string;
          name: string;
          MealOptionMealGroup: { groupId: string }[];
        }[];
      }
    | null;
}) {
  const menu = input.pupilMenu;

  if (!menu) {
    return {
      mealKey: `unknown:${input.choiceGroupId}`,
      mealName: "Unknown Meal",
    };
  }

  const matches = menu.mealOptions.filter((mealOption) =>
    mealOption.MealOptionMealGroup.some((link) => link.groupId === input.choiceGroupId)
  );

  if (matches.length === 1) {
    return {
      mealKey: matches[0].id,
      mealName: matches[0].name,
    };
  }

  if (matches.length > 1) {
    return {
      mealKey: matches[0].id,
      mealName: matches[0].name,
    };
  }

  return {
    mealKey: `unknown:${input.choiceGroupId}`,
    mealName: "Unknown Meal",
  };
}

async function buildReportData(reqUrl: string, user: AnyUser | undefined) {
  const { searchParams } = new URL(reqUrl);

  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  let schoolId = searchParams.get("schoolId");
  const classroomId = searchParams.get("classroomId");
  const menuId = searchParams.get("menuId");
  const rawView = (searchParams.get("view") ?? "grouped") as ReportView;

  if (!startDateStr || !endDateStr) {
    return { error: "startDate and endDate are required", status: 400 as const };
  }

  const startDate = parseISO(startDateStr);
  const endDate = parseISO(endDateStr);

  if (!isValid(startDate) || !isValid(endDate)) {
    return { error: "Invalid date range", status: 400 as const };
  }

  if (endDate < startDate) {
    return { error: "endDate cannot be before startDate", status: 400 as const };
  }

  const isSingleDay = startDateStr === endDateStr;

  if (rawView === "student" && !isSingleDay) {
    return { error: "Student view is only available for a single day", status: 400 as const };
  }

  if (user?.role === "SCHOOLADMIN") {
    schoolId = user.schoolId ?? null;
    if (!schoolId) {
      return { error: "No school assigned", status: 403 as const };
    }
  } else if (user?.role === "ADMIN") {
    if (!schoolId || schoolId === "all") schoolId = null;
  } else {
    return { error: "Unauthorized", status: 401 as const };
  }

  const orderWhere: any = {
    date: {
      gte: startOfDay(startDate),
      lte: endOfDay(endDate),
    },
  };

  const pupilWhere: any = {};

  if (classroomId && classroomId !== "all") {
    pupilWhere.classroomId = classroomId;
  }

  if (schoolId) {
    pupilWhere.classroom = { schoolId };
  }

  if (menuId && menuId !== "all") {
    pupilWhere.menuId = menuId;
  }

  if (Object.keys(pupilWhere).length > 0) {
    orderWhere.pupil = pupilWhere;
  }

  const schoolLabel = schoolId
    ? (await prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      }))?.name ?? "Selected School"
    : "All Schools";

  const classroomLabel =
    classroomId && classroomId !== "all"
      ? (await prisma.classroom.findUnique({
          where: { id: classroomId },
          select: { name: true },
        }))?.name ?? "Selected Classroom"
      : "All Classrooms";

  const menuLabel =
    menuId && menuId !== "all"
      ? (await prisma.menu.findUnique({
          where: { id: menuId },
          select: { name: true },
        }))?.name ?? "Selected Menu"
      : "All Menus";

  const items = await prisma.orderItem.findMany({
    where: {
      order: orderWhere,
    },
    select: {
      id: true,
      orderId: true,
      order: {
        select: {
          id: true,
          pupil: {
            select: {
              id: true,
              name: true,
              menuId: true,
              classroom: {
                select: {
                  name: true,
                },
              },
              menu: {
                select: {
                  id: true,
                  mealOptions: {
                    select: {
                      id: true,
                      name: true,
                      MealOptionMealGroup: {
                        select: {
                          groupId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      choice: {
        select: {
          id: true,
          name: true,
          groupId: true,
        },
      },
    },
  });

  const mealInstances = new Map<string, MealInstance>();
  const individualChoiceCounts = new Map<string, number>();

  for (const item of items) {
    const choiceName = item.choice.name ?? "Unknown";
    individualChoiceCounts.set(choiceName, (individualChoiceCounts.get(choiceName) ?? 0) + 1);

    const resolvedMeal = resolveMealOptionForChoice({
      choiceGroupId: item.choice.groupId,
      pupilMenu: item.order.pupil.menu,
    });

    const instanceKey = `${item.orderId}||${resolvedMeal.mealKey}`;

    if (!mealInstances.has(instanceKey)) {
      mealInstances.set(instanceKey, {
        orderId: item.orderId,
        mealKey: resolvedMeal.mealKey,
        meal: resolvedMeal.mealName,
        pupilName: item.order.pupil.name ?? "Unknown",
        classroom: item.order.pupil.classroom?.name ?? "Unknown",
        tags: new Set<string>(),
      });
    }

    mealInstances.get(instanceKey)!.tags.add(choiceName);
  }

  const instances = Array.from(mealInstances.values());

  const groupedMap = new Map<
    string,
    {
      meal: string;
      count: number;
      tagCounts: Map<string, number>;
    }
  >();

  const splitMap = new Map<string, SplitMealRow>();
  const studentRows: StudentMealRow[] = [];

  for (const instance of instances) {
    const tags = Array.from(instance.tags).sort((a, b) => a.localeCompare(b));
    const tagSig = signature(tags, "No tags");

    if (!groupedMap.has(instance.meal)) {
      groupedMap.set(instance.meal, {
        meal: instance.meal,
        count: 0,
        tagCounts: new Map<string, number>(),
      });
    }

    const grouped = groupedMap.get(instance.meal)!;
    grouped.count += 1;

    for (const tag of tags) {
      grouped.tagCounts.set(tag, (grouped.tagCounts.get(tag) ?? 0) + 1);
    }

    const splitKey = `${instance.meal}||${tagSig}`;
    const existingSplit = splitMap.get(splitKey);

    if (existingSplit) {
      existingSplit.count += 1;
    } else {
      splitMap.set(splitKey, {
        meal: instance.meal,
        tagSig,
        count: 1,
      });
    }

    studentRows.push({
      pupilName: instance.pupilName,
      classroom: instance.classroom,
      meal: instance.meal,
      tags,
      tagSig,
    });
  }

  const groupedMeals: GroupedMealRow[] = Array.from(groupedMap.values())
    .map((row) => ({
      meal: row.meal,
      count: row.count,
      tags: Array.from(row.tagCounts.entries())
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.count - a.count || a.meal.localeCompare(b.meal));

  const splitMeals: SplitMealRow[] = Array.from(splitMap.values()).sort(
    (a, b) => b.count - a.count || a.meal.localeCompare(b.meal) || a.tagSig.localeCompare(b.tagSig)
  );

  const individualChoiceRows: IndividualChoiceRow[] = Array.from(individualChoiceCounts.entries())
    .map(([choice, count]) => ({ choice, count }))
    .sort((a, b) => b.count - a.count || a.choice.localeCompare(b.choice));

  studentRows.sort((a, b) => {
    const classroomCompare = a.classroom.localeCompare(b.classroom);
    if (classroomCompare !== 0) return classroomCompare;

    const pupilCompare = a.pupilName.localeCompare(b.pupilName);
    if (pupilCompare !== 0) return pupilCompare;

    return a.meal.localeCompare(b.meal);
  });

  const totalMeals =
    rawView === "student"
      ? studentRows.length
      : rawView === "choices"
      ? splitMeals.reduce((sum, row) => sum + row.count, 0)
      : rawView === "individual-choices"
      ? individualChoiceRows.reduce((sum, row) => sum + row.count, 0)
      : groupedMeals.reduce((sum, row) => sum + row.count, 0);

  const secondaryLabel =
    rawView === "student"
      ? "Students Listed"
      : rawView === "choices"
      ? "Unique Meal Tag Combos"
      : rawView === "individual-choices"
      ? "Unique Individual Choices"
      : "Unique Meals";

  const secondaryValue =
    rawView === "student"
      ? studentRows.length
      : rawView === "choices"
      ? splitMeals.length
      : rawView === "individual-choices"
      ? individualChoiceRows.length
      : groupedMeals.length;

  return {
    data: {
      title: "Kitchen Prep Report",
      startDate: startDateStr,
      endDate: endDateStr,
      schoolLabel,
      classroomLabel,
      menuLabel,
      view: rawView,
      totalMeals,
      secondaryLabel,
      secondaryValue,
      groupedMeals,
      splitMeals,
      individualChoiceRows,
      studentRows,
    },
  };
}

export const GET = auth(async (req) => {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const user = (req as any).auth?.user as AnyUser | undefined;
    const url = new URL(req.url);
    const { searchParams, origin } = url;
    const format = searchParams.get("format");

    const result = await buildReportData(req.url, user);

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }

    if (format === "json") {
      return Response.json(result.data, {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      });
    }

    const html = buildHtml({
      title: result.data.title,
      startDate: result.data.startDate,
      endDate: result.data.endDate,
      schoolLabel: result.data.schoolLabel,
      classroomLabel: result.data.classroomLabel,
      menuLabel: result.data.menuLabel,
      view: result.data.view,
      totalMeals: result.data.totalMeals,
      secondaryLabel: result.data.secondaryLabel,
      secondaryValue: result.data.secondaryValue,
      groupedMeals: result.data.groupedMeals,
      splitMeals: result.data.splitMeals,
      individualChoiceRows: result.data.individualChoiceRows,
      studentRows: result.data.studentRows,
      schoolMealsLogoUrl: `${origin}/schoolmeals.png`,
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
        "content-disposition": `inline; filename="kitchen-prep-${result.data.startDate}-to-${result.data.endDate}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Failed to generate PDF report", { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});