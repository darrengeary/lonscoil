// lib/reports/kitchen-prep-report.ts
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, parseISO, isValid, format } from "date-fns";

export type AnyUser = {
  id?: string;
  role?: "ADMIN" | "SCHOOLADMIN" | string;
  schoolId?: string | null;
};

export type PrepView = "grouped" | "extras" | "student";

export type PrepSummaryRow = {
  group: string;
  choice: string;
  count: number;
  extras?: { name: string; qty: number }[];
};

export type PrepSplitRow = {
  group: string;
  choice: string;
  extrasSig: string;
  count: number;
};

export type ExtrasTotalRow = {
  name: string;
  qty: number;
};

export type StudentPrepRow = {
  pupilName: string;
  classroom: string;
  group: string;
  choice: string;
  extras: string[];
  extrasSig: string;
  date: string;
};

export type KitchenPrepFilters = {
  startDate: string;
  endDate: string;
  schoolId?: string | null;
  classroomId?: string | null;
  mealGroupId?: string | null;
  view?: PrepView;
  page?: number;
  pageSize?: number;
};

export type KitchenPrepPageData = {
  view: PrepView;
  filters: {
    startDate: string;
    endDate: string;
    schoolId: string | null;
    classroomId: string | null;
    mealGroupId: string | null;
  };
  schools: { id: string; name: string }[];
  classrooms: { id: string; name: string }[];
  mealGroups: { id: string; name: string }[];
  meals: PrepSummaryRow[];
  splitMeals: PrepSplitRow[];
  extrasTotals: ExtrasTotalRow[];
  studentRows: StudentPrepRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  summary: {
    totalMeals: number;
    secondaryLabel: string;
    secondaryValue: number;
  };
};

function normalizeExtras(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const cleaned = input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
}

function extrasSignature(extras: string[]): string {
  return extras.length ? extras.join(" + ") : "No extras";
}

function parseRequiredDate(value: string, label: string) {
  const d = parseISO(value);
  if (!isValid(d)) {
    throw new Error(`Invalid ${label}`);
  }
  return d;
}

function clampPage(n?: number) {
  if (!n || !Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function clampPageSize(n?: number) {
  if (!n || !Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(10, Math.floor(n)));
}

export async function getKitchenPrepFilterOptions(user: AnyUser) {
  let schoolScopeId: string | null = null;

  if (user?.role === "SCHOOLADMIN") {
    schoolScopeId = user.schoolId ?? null;
    if (!schoolScopeId) throw new Error("No school assigned");
  } else if (user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const [schools, mealGroups] = await Promise.all([
    prisma.school.findMany({
      where: schoolScopeId ? { id: schoolScopeId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.mealGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { schools, mealGroups };
}

export async function getClassroomsForSchool(user: AnyUser, schoolId: string | null) {
  if (user?.role !== "ADMIN" && user?.role !== "SCHOOLADMIN") {
    throw new Error("Unauthorized");
  }

  let scopedSchoolId = schoolId;
  if (user?.role === "SCHOOLADMIN") {
    scopedSchoolId = user.schoolId ?? null;
    if (!scopedSchoolId) throw new Error("No school assigned");
  }

  if (!scopedSchoolId || scopedSchoolId === "all") {
    return [];
  }

  return prisma.classroom.findMany({
    where: { schoolId: scopedSchoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildKitchenPrepReportHtml(data: KitchenPrepPageData) {
  const title =
    data.view === "grouped"
      ? "Kitchen Prep Report — Grouped"
      : data.view === "extras"
      ? "Kitchen Prep Report — Split by Extras"
      : "Kitchen Prep Report — By Student";

  const filters = [
    `Date range: ${data.filters.startDate} to ${data.filters.endDate}`,
    data.filters.schoolId ? `School filter applied` : `All schools`,
    data.filters.classroomId ? `Classroom filter applied` : `All classrooms`,
    data.filters.mealGroupId ? `Meal group filter applied` : `All meal groups`,
  ];

  const summaryHtml = `
    <div class="summary-row">
      <div class="pill">
        <div class="pill-label">Total Meals</div>
        <div class="pill-value">${data.summary.totalMeals}</div>
      </div>
      <div class="pill">
        <div class="pill-label">${escapeHtml(data.summary.secondaryLabel)}</div>
        <div class="pill-value">${data.summary.secondaryValue}</div>
      </div>
    </div>
  `;

  const groupedRows =
    data.view === "extras"
      ? data.splitMeals
          .map(
            (r) => `
        <tr>
          <td>${escapeHtml(r.choice)}${r.extrasSig ? ` — ${escapeHtml(r.extrasSig)}` : ""}</td>
          <td>${escapeHtml(r.group)}</td>
          <td class="num">${r.count}</td>
        </tr>
      `
          )
          .join("")
      : data.meals
          .map(
            (r) => `
        <tr>
          <td>
            <div>${escapeHtml(r.choice)}</div>
            ${
              r.extras?.length
                ? `<div class="extras-subline">${escapeHtml(
                    r.extras.map((x) => `${x.name}×${x.qty}`).join(", ")
                  )}</div>`
                : ""
            }
          </td>
          <td>${escapeHtml(r.group)}</td>
          <td class="num">${r.count}</td>
        </tr>
      `
          )
          .join("");

  const studentRows = data.studentRows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.pupilName)}</td>
        <td>${escapeHtml(r.classroom)}</td>
        <td>${escapeHtml(r.group)}</td>
        <td>${escapeHtml(r.choice)}</td>
        <td>${escapeHtml(r.extrasSig)}</td>
      </tr>
    `
    )
    .join("");

  const extrasTotalsRows = data.extrasTotals
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td class="num">${r.qty}</td>
      </tr>
    `
    )
    .join("");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 12mm 16mm 12mm;
    }

    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      margin: 0;
      font-size: 12px;
    }

    .header {
      margin-bottom: 14px;
      border-bottom: 2px solid #d1d5db;
      padding-bottom: 10px;
    }

    .title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .meta {
      color: #4b5563;
      line-height: 1.5;
      margin-bottom: 10px;
    }

    .summary-row {
      display: flex;
      gap: 12px;
      margin: 10px 0 16px;
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
      font-size: 14px;
      font-weight: 700;
      margin: 18px 0 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
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

    .num {
      text-align: right;
      width: 90px;
      white-space: nowrap;
    }

    .extras-subline {
      margin-top: 4px;
      color: #6b7280;
      font-size: 11px;
    }

    .muted {
      color: #6b7280;
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
  <div class="header">
    <div class="title">${escapeHtml(title)}</div>
    <div class="meta">
      ${filters.map((x) => `<div>${escapeHtml(x)}</div>`).join("")}
    </div>
    ${summaryHtml}
  </div>

  ${
    data.view === "student"
      ? `
      <div class="section-title">Student Orders</div>
      <table>
        <thead>
          <tr>
            <th style="width: 90px;">Date</th>
            <th>Student</th>
            <th>Classroom</th>
            <th>Meal Group</th>
            <th>Choice</th>
            <th>Extras</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows || `<tr><td colspan="6" class="muted">No data found.</td></tr>`}
        </tbody>
      </table>
    `
      : `
      <div class="section-title">${
        data.view === "extras" ? "Orders Split by Extras" : "Grouped Orders"
      }</div>
      <table>
        <thead>
          <tr>
            <th>Choice</th>
            <th>Meal Group</th>
            <th class="num">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${groupedRows || `<tr><td colspan="3" class="muted">No data found.</td></tr>`}
        </tbody>
      </table>

      <div class="section-title">Extras Totals</div>
      <table>
        <thead>
          <tr>
            <th>Extra / Ingredient</th>
            <th class="num">Total Qty</th>
          </tr>
        </thead>
        <tbody>
          ${extrasTotalsRows || `<tr><td colspan="2" class="muted">No extras selected.</td></tr>`}
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

export async function getKitchenPrepData(
  user: AnyUser,
  filters: KitchenPrepFilters,
  opts?: { forPdf?: boolean }
): Promise<KitchenPrepPageData> {
  if (user?.role !== "ADMIN" && user?.role !== "SCHOOLADMIN") {
    throw new Error("Unauthorized");
  }

  const start = parseRequiredDate(filters.startDate, "startDate");
  const end = parseRequiredDate(filters.endDate, "endDate");
  const view: PrepView = filters.view ?? "grouped";
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);

  let schoolId = filters.schoolId ?? null;
  const classroomId = filters.classroomId && filters.classroomId !== "all" ? filters.classroomId : null;
  const mealGroupId = filters.mealGroupId && filters.mealGroupId !== "all" ? filters.mealGroupId : null;

  if (user.role === "SCHOOLADMIN") {
    schoolId = user.schoolId ?? null;
    if (!schoolId) throw new Error("No school assigned");
  } else if (schoolId === "all") {
    schoolId = null;
  }

  const [schools, mealGroups, classrooms] = await Promise.all([
    prisma.school.findMany({
      where: schoolId ? { id: schoolId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.mealGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    schoolId
      ? prisma.classroom.findMany({
          where: { schoolId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  let filterChoiceIds: string[] | undefined;
  if (mealGroupId) {
    const group = await prisma.mealGroup.findUnique({
      where: { id: mealGroupId },
      select: { choices: { select: { id: true } } },
    });

    if (!group) {
      throw new Error("Meal group not found");
    }

    filterChoiceIds = group.choices.map((c) => c.id);
  }

  const itemWhere: any = {
    order: {
      date: {
        gte: startOfDay(start),
        lte: endOfDay(end),
      },
    },
  };

  if (filterChoiceIds !== undefined) {
    itemWhere.choiceId = { in: filterChoiceIds };
  }

  const pupilScope: any = {};

  if (classroomId) {
    pupilScope.classroomId = classroomId;
  }

  if (schoolId) {
    pupilScope.classroom = { schoolId };
  }

  if (Object.keys(pupilScope).length > 0) {
    itemWhere.order.pupil = pupilScope;
  }

  if (view === "student") {
    const totalRows = await prisma.orderItem.count({ where: itemWhere });

    const usePagination = !opts?.forPdf;
    const skip = usePagination ? (page - 1) * pageSize : 0;
    const take = usePagination ? pageSize : undefined;

    const items = await prisma.orderItem.findMany({
      where: itemWhere,
      ...(usePagination ? { skip, take } : {}),
      orderBy: [
        { order: { date: "asc" } },
        { order: { pupil: { classroom: { name: "asc" } } } },
        { order: { pupil: { name: "asc" } } },
        { choice: { group: { name: "asc" } } },
        { choice: { name: "asc" } },
      ],
      select: {
        selectedIngredients: true,
        choice: {
          select: {
            name: true,
            group: { select: { name: true } },
          },
        },
        order: {
          select: {
            date: true,
            pupil: {
              select: {
                name: true,
                classroom: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const studentRows: StudentPrepRow[] = items.map((it) => {
      const extras = normalizeExtras(it.selectedIngredients ?? []);
      return {
        date: format(it.order.date, "yyyy-MM-dd"),
        pupilName: it.order.pupil.name ?? "Unknown",
        classroom: it.order.pupil.classroom?.name ?? "Unknown",
        group: it.choice.group?.name ?? "Unknown",
        choice: it.choice.name ?? "Unknown",
        extras,
        extrasSig: extrasSignature(extras),
      };
    });

    return {
      view,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        schoolId,
        classroomId,
        mealGroupId,
      },
      schools,
      classrooms,
      mealGroups,
      meals: [],
      splitMeals: [],
      extrasTotals: [],
      studentRows,
      pagination: {
        page,
        pageSize,
        totalRows,
        totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
      },
      summary: {
        totalMeals: totalRows,
        secondaryLabel: "Students Listed",
        secondaryValue: totalRows,
      },
    };
  }

  const items = await prisma.orderItem.findMany({
    where: itemWhere,
    select: {
      choiceId: true,
      selectedIngredients: true,
      choice: {
        select: {
          name: true,
          group: { select: { name: true } },
        },
      },
    },
  });

  const mealCount = new Map<string, number>();
  const label = new Map<string, { group: string; choice: string }>();
  const extrasTotals = new Map<string, number>();
  const extrasByChoice = new Map<string, Map<string, number>>();
  const splitCount = new Map<string, number>();

  for (const it of items) {
    if (!it.choiceId) continue;

    mealCount.set(it.choiceId, (mealCount.get(it.choiceId) ?? 0) + 1);

    if (!label.has(it.choiceId)) {
      label.set(it.choiceId, {
        group: it.choice.group?.name ?? "Unknown",
        choice: it.choice.name ?? "Unknown",
      });
    }

    const extras = normalizeExtras(it.selectedIngredients ?? []);

    for (const ex of extras) {
      extrasTotals.set(ex, (extrasTotals.get(ex) ?? 0) + 1);

      if (!extrasByChoice.has(it.choiceId)) {
        extrasByChoice.set(it.choiceId, new Map());
      }

      const m = extrasByChoice.get(it.choiceId)!;
      m.set(ex, (m.get(ex) ?? 0) + 1);
    }

    const sig = extrasSignature(extras);
    const splitKey = `${it.choiceId}||${sig}`;
    splitCount.set(splitKey, (splitCount.get(splitKey) ?? 0) + 1);
  }

  const meals: PrepSummaryRow[] = Array.from(mealCount.entries())
    .map(([choiceId, count]) => {
      const meta = label.get(choiceId) ?? { group: "Unknown", choice: "Unknown" };
      const perChoice = extrasByChoice.get(choiceId);

      return {
        group: meta.group,
        choice: meta.choice,
        count,
        extras: perChoice
          ? Array.from(perChoice.entries())
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .map(([name, qty]) => ({ name, qty }))
          : [],
      };
    })
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group) || a.choice.localeCompare(b.choice));

  const splitMeals: PrepSplitRow[] = Array.from(splitCount.entries())
    .map(([key, count]) => {
      const sep = key.indexOf("||");
      const choiceId = sep >= 0 ? key.slice(0, sep) : key;
      const sig = sep >= 0 ? key.slice(sep + 2) : "No extras";
      const meta = label.get(choiceId) ?? { group: "Unknown", choice: "Unknown" };

      return {
        group: meta.group,
        choice: meta.choice,
        extrasSig: sig,
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group) || a.choice.localeCompare(b.choice));

  const extrasTotalsArr: ExtrasTotalRow[] = Array.from(extrasTotals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, qty]) => ({ name, qty }));

  const totalMeals =
    view === "extras"
      ? splitMeals.reduce((sum, r) => sum + (r.count ?? 0), 0)
      : meals.reduce((sum, r) => sum + (r.count ?? 0), 0);

  return {
    view,
    filters: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      schoolId,
      classroomId,
      mealGroupId,
    },
    schools,
    classrooms,
    mealGroups,
    meals,
    splitMeals,
    extrasTotals: extrasTotalsArr,
    studentRows: [],
    pagination: {
      page: 1,
      pageSize: opts?.forPdf ? Math.max(items.length, 1) : pageSize,
      totalRows: view === "extras" ? splitMeals.length : meals.length,
      totalPages: 1,
    },
    summary: {
      totalMeals,
      secondaryLabel: view === "extras" ? "Unique Choice Combos" : "Unique Choices",
      secondaryValue: view === "extras" ? splitMeals.length : meals.length,
    },
  };
}