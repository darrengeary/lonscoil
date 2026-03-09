// prisma/seed.js
const { PrismaClient, UserRole, ScheduleType, PupilStatus } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * CONFIG
 */
const SCHOOL_COUNT = 5;
const CLASSROOMS_PER_SCHOOL = 4;
const TEST_PUPILS = 10;
const RESET_SEED_DATA = true;

const SCHOOL_NAMES = [
  "Oakfield National School",
  "Riverbank National School",
  "St. Brigid's Primary School",
  "Ash Grove National School",
  "Greenhill National School",
];

const CLASSROOM_NAMES = [
  "Junior Infants",
  "Senior Infants",
  "1st Class",
  "2nd Class",
];

/**
 * HELPERS
 */
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekMon(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // Sun 0, Mon 1 ... Sat 6
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

function dateYMD(y, m, d) {
  return startOfDay(new Date(y, m - 1, d));
}

function emailify(prefix, i) {
  return `${prefix}${String(i).padStart(2, "0")}@school.io`;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome(arr, maxCount) {
  const n = Math.floor(Math.random() * (maxCount + 1));
  const copy = [...arr];
  const out = [];

  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }

  return out;
}

/**
 * Seed-specific identity helpers
 */
function schoolAdminEmail(i) {
  return `schooladmin${i}@school.io`;
}

function teacherEmail(i) {
  return `teacher${i}@school.io`;
}

function parentEmail(i) {
  return `parent${i}@school.io`;
}

/**
 * Order extras pools
 */
const lunchExtrasPool = ["No onions", "Extra cheese", "No sauce", "Ketchup", "Mayo", "Gluten-free"];
const snackExtrasPool = ["No nuts", "Extra fruit", "No yoghurt"];

/**
 * RESET
 */
async function wipeSeedData() {
  console.log("🧹 Wiping existing seed data...");

  // Delete most-dependent tables first
  await prisma.printJobItem.deleteMany();
  await prisma.printJob.deleteMany();

  await prisma.orderItem.deleteMany();
  await prisma.lunchOrder.deleteMany();

  await prisma.absence.deleteMany();
  await prisma.schedule.deleteMany();

  await prisma.menuMealChoice.deleteMany();
  await prisma.menuMealGroup.deleteMany();
  await prisma.menuSchool.deleteMany();

  await prisma.pupil.deleteMany();
  await prisma.classroom.deleteMany();

  await prisma.menu.deleteMany();
  await prisma.mealChoice.deleteMany();
  await prisma.mealGroup.deleteMany();

  // Keep allergens table clean for predictable reconnecting
  await prisma.allergen.deleteMany();

  // Disconnect school assignments before deleting schools
  await prisma.user.updateMany({
    where: {
      OR: [
        { email: { startsWith: "schooladmin" } },
        { email: { startsWith: "teacher" } },
        { email: { startsWith: "parent" } },
      ],
    },
    data: {
      schoolId: null,
    },
  });

  await prisma.school.deleteMany();

  // Remove seeded users except site admin
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "schooladmin" } },
        { email: { startsWith: "teacher" } },
        { email: { startsWith: "parent" } },
      ],
    },
  });

  console.log("✅ Existing seed data removed");
}

async function main() {
  if (RESET_SEED_DATA) {
    await wipeSeedData();
  }

  console.log("🌱 Seeding...");

  /**
   * 1) Site admin
   */
  await prisma.user.upsert({
    where: { email: "admin@school.io" },
    update: {
      name: "Site Admin",
      role: UserRole.ADMIN,
    },
    create: {
      email: "admin@school.io",
      name: "Site Admin",
      role: UserRole.ADMIN,
    },
  });

  /**
   * 2) Schools + school admins + teachers + classrooms
   */
  const schools = [];

  for (let i = 0; i < SCHOOL_COUNT; i++) {
    const school = await prisma.school.create({
      data: {
        name: SCHOOL_NAMES[i] || `Test School ${i + 1}`,
      },
    });

    const schoolAdmin = await prisma.user.upsert({
      where: { email: schoolAdminEmail(i + 1) },
      update: {
        name: `School Admin ${i + 1}`,
        role: UserRole.SCHOOLADMIN,
        schoolId: school.id,
      },
      create: {
        email: schoolAdminEmail(i + 1),
        name: `School Admin ${i + 1}`,
        role: UserRole.SCHOOLADMIN,
        schoolId: school.id,
      },
      select: { id: true, email: true, name: true },
    });

    const teacher = await prisma.user.upsert({
      where: { email: teacherEmail(i + 1) },
      update: {
        name: `Teacher ${i + 1}`,
        role: UserRole.TEACHER,
      },
      create: {
        email: teacherEmail(i + 1),
        name: `Teacher ${i + 1}`,
        role: UserRole.TEACHER,
      },
      select: { id: true, email: true, name: true },
    });

    const classrooms = [];

    for (let j = 0; j < CLASSROOMS_PER_SCHOOL; j++) {
      const classroom = await prisma.classroom.create({
        data: {
          name: CLASSROOM_NAMES[j] || `Classroom ${j + 1}`,
          schoolId: school.id,
          totalPupils: 0,
          teachers: {
            connect: [{ id: teacher.id }],
          },
        },
      });

      classrooms.push(classroom);
    }

    schools.push({
      school,
      schoolAdmin,
      teacher,
      classrooms,
    });
  }

  /**
   * 3) Allergens
   */
  const allergenNames = ["Gluten", "Dairy", "Egg", "Soy", "Peanuts", "Tree Nuts", "Fish", "Sesame"];

  await prisma.allergen.createMany({
    data: allergenNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const allergens = await prisma.allergen.findMany({
    select: { id: true, name: true },
  });

  /**
   * 4) Meal groups + choices
   */
  const lunchGroup = await prisma.mealGroup.create({
    data: {
      name: "Lunch",
      maxSelections: 1,
    },
  });

  const snackGroup = await prisma.mealGroup.create({
    data: {
      name: "Snack",
      maxSelections: 1,
    },
  });

  const lunchChoicesData = [
    { name: "Chicken Curry", nutrition: { kcal: 520, p: 28, c: 62, s: 7, f: 18, sat: 5, fib: 6, salt: 1.4 } },
    { name: "Pasta Bolognese", nutrition: { kcal: 610, p: 30, c: 72, s: 9, f: 22, sat: 7, fib: 7, salt: 1.6 } },
    { name: "Veggie Stir Fry", nutrition: { kcal: 460, p: 16, c: 68, s: 10, f: 12, sat: 2, fib: 8, salt: 1.2 } },
    { name: "Ham Sandwich", nutrition: { kcal: 390, p: 18, c: 38, s: 4, f: 16, sat: 5, fib: 3, salt: 1.3 } },
  ];

  const snackChoicesData = [
    { name: "Fruit Pot", nutrition: { kcal: 120, p: 1.5, c: 28, s: 22, f: 0.5, sat: 0.1, fib: 4, salt: 0.02 } },
    { name: "Yoghurt", nutrition: { kcal: 160, p: 8, c: 18, s: 16, f: 6, sat: 3.5, fib: 0, salt: 0.15 } },
    { name: "Granola Bar", nutrition: { kcal: 190, p: 4, c: 26, s: 11, f: 8, sat: 2, fib: 3, salt: 0.25 } },
  ];

  const lunchChoices = [];
  for (const item of lunchChoicesData) {
    const choice = await prisma.mealChoice.create({
      data: {
        name: item.name,
        groupId: lunchGroup.id,
        ingredients: lunchExtrasPool,
        active: true,
        caloriesKcal: item.nutrition.kcal,
        proteinG: item.nutrition.p,
        carbsG: item.nutrition.c,
        sugarsG: item.nutrition.s,
        fatG: item.nutrition.f,
        saturatesG: item.nutrition.sat,
        fibreG: item.nutrition.fib,
        saltG: item.nutrition.salt,
        allergens: {
          connect: pickSome(allergens, 2).map((a) => ({ id: a.id })),
        },
      },
    });

    lunchChoices.push(choice);
  }

  const snackChoices = [];
  for (const item of snackChoicesData) {
    const choice = await prisma.mealChoice.create({
      data: {
        name: item.name,
        groupId: snackGroup.id,
        ingredients: snackExtrasPool,
        active: true,
        caloriesKcal: item.nutrition.kcal,
        proteinG: item.nutrition.p,
        carbsG: item.nutrition.c,
        sugarsG: item.nutrition.s,
        fatG: item.nutrition.f,
        saturatesG: item.nutrition.sat,
        fibreG: item.nutrition.fib,
        saltG: item.nutrition.salt,
        allergens: {
          connect: pickSome(allergens, 2).map((a) => ({ id: a.id })),
        },
      },
    });

    snackChoices.push(choice);
  }

  /**
   * 5) Create one school with test pupils + parents + menu + fake orders
   * We'll use the first school as the populated test school.
   */
  const populatedSchool = schools[0];
  const populatedSchoolId = populatedSchool.school.id;

  // Create parents
  const parentRows = [];
  for (let i = 1; i <= TEST_PUPILS; i++) {
    parentRows.push({
      email: parentEmail(i),
      name: `Parent ${i}`,
      role: UserRole.USER,
    });
  }

  await prisma.user.createMany({
    data: parentRows,
    skipDuplicates: true,
  });

  const parents = await prisma.user.findMany({
    where: {
      email: {
        startsWith: "parent",
      },
    },
    orderBy: {
      email: "asc",
    },
    take: TEST_PUPILS,
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Create a menu for the populated school
  const standardMenu = await prisma.menu.create({
    data: {
      name: "Standard Menu",
      active: true,
      schoolLinks: {
        create: [{ schoolId: populatedSchoolId }],
      },
    },
  });

  await prisma.menuMealGroup.createMany({
    data: [
      { menuId: standardMenu.id, groupId: lunchGroup.id },
      { menuId: standardMenu.id, groupId: snackGroup.id },
    ],
    skipDuplicates: true,
  });

  await prisma.menuMealChoice.createMany({
    data: [...lunchChoices, ...snackChoices].map((choice) => ({
      menuId: standardMenu.id,
      choiceId: choice.id,
    })),
    skipDuplicates: true,
  });

  // Create 10 pupils in first school across its classrooms
  const pupilsToCreate = [];
  for (let i = 0; i < TEST_PUPILS; i++) {
    const classroom = populatedSchool.classrooms[i % populatedSchool.classrooms.length];
    const parent = parents[i];

    pupilsToCreate.push({
      name: `Test Pupil ${i + 1}`,
      status: PupilStatus.REGISTERED,
      classroomId: classroom.id,
      parentId: parent.id,
      menuId: standardMenu.id,
    });
  }

  await prisma.pupil.createMany({
    data: pupilsToCreate,
  });

  const testPupils = await prisma.pupil.findMany({
    where: {
      classroom: {
        schoolId: populatedSchoolId,
      },
    },
    include: {
      classroom: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Update classroom totals for all schools
  for (const schoolEntry of schools) {
    for (const classroom of schoolEntry.classrooms) {
      const count = await prisma.pupil.count({
        where: {
          classroomId: classroom.id,
        },
      });

      await prisma.classroom.update({
        where: { id: classroom.id },
        data: { totalPupils: count },
      });
    }
  }

  /**
   * 6) Schedules for each school
   */
  for (const schoolEntry of schools) {
    const schoolId = schoolEntry.school.id;

    await prisma.schedule.createMany({
      data: [
        {
          name: `School Year 2025/2026 - ${schoolEntry.school.name}`,
          type: ScheduleType.TERM,
          startDate: dateYMD(2025, 9, 1),
          endDate: dateYMD(2026, 6, 30),
          schoolId,
        },
        {
          name: `Christmas 2025/2026 - ${schoolEntry.school.name}`,
          type: ScheduleType.HOLIDAY,
          startDate: dateYMD(2025, 12, 22),
          endDate: dateYMD(2026, 1, 2),
          schoolId,
        },
        {
          name: `Easter 2026 - ${schoolEntry.school.name}`,
          type: ScheduleType.HOLIDAY,
          startDate: dateYMD(2026, 3, 30),
          endDate: dateYMD(2026, 4, 10),
          schoolId,
        },
      ],
      skipDuplicates: true,
    });
  }

  /**
   * 7) Fake orders for this week (Mon-Fri) for the 10 test pupils
   */
  console.log("🍱 Creating fake orders for this week...");

  const weekStart = startOfWeekMon(new Date());
  const weekDays = [0, 1, 2, 3, 4].map((i) => startOfDay(addDays(weekStart, i)));

  for (const pupil of testPupils) {
    for (const date of weekDays) {
      const lunchChoice = pickOne(lunchChoices);
      const snackChoice = Math.random() < 0.8 ? pickOne(snackChoices) : null;

      const lunchExtras = pickSome(lunchExtrasPool, 2);
      const snackExtras = snackChoice ? pickSome(snackExtrasPool, 1) : [];

      await prisma.lunchOrder.upsert({
        where: {
          pupilId_date: {
            pupilId: pupil.id,
            date,
          },
        },
        update: {
          items: {
            deleteMany: {},
            create: [
              {
                choiceId: lunchChoice.id,
                selectedIngredients: lunchExtras,
              },
              ...(snackChoice
                ? [
                    {
                      choiceId: snackChoice.id,
                      selectedIngredients: snackExtras,
                    },
                  ]
                : []),
            ],
          },
        },
        create: {
          pupilId: pupil.id,
          date,
          items: {
            create: [
              {
                choiceId: lunchChoice.id,
                selectedIngredients: lunchExtras,
              },
              ...(snackChoice
                ? [
                    {
                      choiceId: snackChoice.id,
                      selectedIngredients: snackExtras,
                    },
                  ]
                : []),
            ],
          },
        },
      });
    }
  }

  console.log("✅ Seed completed");
  console.log(`   Schools: ${schools.length}`);
  console.log(`   Classrooms per school: ${CLASSROOMS_PER_SCHOOL}`);
  console.log(`   Populated school: ${populatedSchool.school.name}`);
  console.log(`   Test pupils in populated school: ${testPupils.length}`);
  console.log(`   Orders created for week starting: ${weekStart.toDateString()}`);
  console.log(`   Site admin: admin@school.io`);
  console.log(`   Example school admin: ${schools[0].schoolAdmin.email}`);
  console.log(`   Example teacher: ${schools[0].teacher.email}`);
  console.log(`   Example parent: ${parents[0]?.email || "n/a"}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });