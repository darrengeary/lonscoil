const {
  PrismaClient,
  UserRole,
  ScheduleType,
  PupilStatus,
} = require("@prisma/client");

const prisma = new PrismaClient();

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
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

function nextWeekStartMon(d) {
  return addDays(startOfWeekMon(d), 7);
}

function dateYMD(y, m, d) {
  return startOfDay(new Date(y, m - 1, d));
}

function schoolAdminEmail(i) {
  return `schooladmin${i}@school.io`;
}

function teacherEmail(i) {
  return `teacher${i}@school.io`;
}

function parentEmail(i) {
  return `parent${i}@school.io`;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome(arr, maxCount) {
  const count = Math.floor(Math.random() * (maxCount + 1));
  const pool = [...arr];
  const out = [];

  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }

  return out;
}

async function wipeSeedData() {
  console.log("🧹 Wiping existing seed data...");

  await prisma.printJobItem.deleteMany();
  await prisma.printJob.deleteMany();

  await prisma.orderItem.deleteMany();
  await prisma.lunchOrder.deleteMany();

  await prisma.absence.deleteMany();
  await prisma.schedule.deleteMany();

  await prisma.mealOptionMealGroup.deleteMany();
  await prisma.mealOption.deleteMany();

  await prisma.menuMealChoice.deleteMany();
  await prisma.menuMealGroup.deleteMany();
  await prisma.menuSchool.deleteMany();

  await prisma.pupil.deleteMany();
  await prisma.classroom.deleteMany();

  await prisma.menu.deleteMany();
  await prisma.mealChoice.deleteMany();
  await prisma.mealGroup.deleteMany();

  await prisma.allergen.deleteMany();

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

async function createChoice({
  groupId,
  name,
  ingredients = [],
  allergens = [],
  nutrition = {},
}) {
  return prisma.mealChoice.create({
    data: {
      name,
      groupId,
      ingredients,
      active: true,
      caloriesKcal: nutrition.kcal ?? null,
      proteinG: nutrition.p ?? null,
      carbsG: nutrition.c ?? null,
      sugarsG: nutrition.s ?? null,
      fatG: nutrition.f ?? null,
      saturatesG: nutrition.sat ?? null,
      fibreG: nutrition.fib ?? null,
      saltG: nutrition.salt ?? null,
      allergens: allergens.length
        ? {
            connect: allergens.map((a) => ({ id: a.id })),
          }
        : undefined,
    },
  });
}

async function main() {
  if (RESET_SEED_DATA) {
    await wipeSeedData();
  }

  console.log("🌱 Seeding...");

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

  const allergenNames = [
    "Gluten",
    "Dairy",
    "Egg",
    "Soy",
    "Peanuts",
    "Tree Nuts",
    "Fish",
    "Sesame",
  ];

  await prisma.allergen.createMany({
    data: allergenNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const allergens = await prisma.allergen.findMany({
    select: { id: true, name: true },
  });

  const allergenByName = Object.fromEntries(allergens.map((a) => [a.name, a]));

  const sideGroup = await prisma.mealGroup.create({
    data: { name: "Side", maxSelections: 1 },
  });

  const vegGroup = await prisma.mealGroup.create({
    data: { name: "Veg", maxSelections: 1 },
  });

  const drinkGroup = await prisma.mealGroup.create({
    data: { name: "Drink", maxSelections: 1 },
  });

  const dessertGroup = await prisma.mealGroup.create({
    data: { name: "Dessert", maxSelections: 1 },
  });

  const soupGroup = await prisma.mealGroup.create({
    data: { name: "Soup", maxSelections: 1 },
  });

  const sandwichGroup = await prisma.mealGroup.create({
    data: { name: "Sandwich", maxSelections: 1 },
  });

  const sandwichExtrasGroup = await prisma.mealGroup.create({
    data: { name: "Sandwich Extras", maxSelections: 2 },
  });

  const rice = await createChoice({
    groupId: sideGroup.id,
    name: "Rice",
    ingredients: [],
    nutrition: { kcal: 180, p: 4, c: 38, s: 0, f: 1, sat: 0.2, fib: 1.2, salt: 0.02 },
  });

  const naan = await createChoice({
    groupId: sideGroup.id,
    name: "Naan Bread",
    ingredients: [],
    allergens: [allergenByName.Gluten, allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 220, p: 6, c: 36, s: 3, f: 5, sat: 1.8, fib: 1.5, salt: 0.55 },
  });

  const roastPotatoes = await createChoice({
    groupId: sideGroup.id,
    name: "Roast Potatoes",
    ingredients: [],
    nutrition: { kcal: 210, p: 4, c: 32, s: 1, f: 7, sat: 0.8, fib: 3.2, salt: 0.3 },
  });

  const pastaTwists = await createChoice({
    groupId: sideGroup.id,
    name: "Pasta Twists",
    ingredients: [],
    allergens: [allergenByName.Gluten].filter(Boolean),
    nutrition: { kcal: 240, p: 8, c: 44, s: 2, f: 3, sat: 0.6, fib: 2.4, salt: 0.08 },
  });

  const peas = await createChoice({
    groupId: vegGroup.id,
    name: "Peas",
    ingredients: [],
    nutrition: { kcal: 70, p: 5, c: 10, s: 4, f: 1, sat: 0.1, fib: 4.5, salt: 0.02 },
  });

  const sweetcorn = await createChoice({
    groupId: vegGroup.id,
    name: "Sweetcorn",
    ingredients: [],
    nutrition: { kcal: 85, p: 3, c: 16, s: 6, f: 1.5, sat: 0.2, fib: 2.5, salt: 0.03 },
  });

  const mixedVeg = await createChoice({
    groupId: vegGroup.id,
    name: "Mixed Vegetables",
    ingredients: [],
    nutrition: { kcal: 65, p: 3, c: 11, s: 5, f: 1, sat: 0.2, fib: 4, salt: 0.05 },
  });

  const water = await createChoice({
    groupId: drinkGroup.id,
    name: "Water",
    ingredients: [],
    nutrition: { kcal: 0, p: 0, c: 0, s: 0, f: 0, sat: 0, fib: 0, salt: 0 },
  });

  const orangeJuice = await createChoice({
    groupId: drinkGroup.id,
    name: "Orange Juice",
    ingredients: [],
    nutrition: { kcal: 90, p: 1.5, c: 20, s: 18, f: 0, sat: 0, fib: 0.3, salt: 0.02 },
  });

  const milk = await createChoice({
    groupId: drinkGroup.id,
    name: "Milk",
    ingredients: [],
    allergens: [allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 110, p: 6, c: 10, s: 10, f: 4.5, sat: 2.8, fib: 0, salt: 0.18 },
  });

  const fruitPot = await createChoice({
    groupId: dessertGroup.id,
    name: "Fruit Pot",
    ingredients: [],
    nutrition: { kcal: 120, p: 1.5, c: 28, s: 22, f: 0.5, sat: 0.1, fib: 4, salt: 0.02 },
  });

  const yoghurt = await createChoice({
    groupId: dessertGroup.id,
    name: "Yoghurt",
    ingredients: [],
    allergens: [allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 160, p: 8, c: 18, s: 16, f: 6, sat: 3.5, fib: 0, salt: 0.15 },
  });

  const granolaBar = await createChoice({
    groupId: dessertGroup.id,
    name: "Granola Bar",
    ingredients: [],
    allergens: [allergenByName.Gluten].filter(Boolean),
    nutrition: { kcal: 190, p: 4, c: 26, s: 11, f: 8, sat: 2, fib: 3, salt: 0.25 },
  });

  const tomatoSoup = await createChoice({
    groupId: soupGroup.id,
    name: "Tomato Soup",
    ingredients: [],
    allergens: [allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 140, p: 3, c: 18, s: 9, f: 6, sat: 2.5, fib: 2, salt: 0.9 },
  });

  const vegetableSoup = await createChoice({
    groupId: soupGroup.id,
    name: "Vegetable Soup",
    ingredients: [],
    nutrition: { kcal: 130, p: 3, c: 20, s: 8, f: 4, sat: 0.8, fib: 3, salt: 0.85 },
  });

  const chickenSandwich = await createChoice({
    groupId: sandwichGroup.id,
    name: "Chicken Sandwich",
    ingredients: [],
    allergens: [allergenByName.Gluten, allergenByName.Egg].filter(Boolean),
    nutrition: { kcal: 340, p: 18, c: 32, s: 4, f: 14, sat: 2.8, fib: 3, salt: 1.1 },
  });

  const hamSandwich = await createChoice({
    groupId: sandwichGroup.id,
    name: "Ham Sandwich",
    ingredients: [],
    allergens: [allergenByName.Gluten, allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 330, p: 17, c: 31, s: 4, f: 13, sat: 3.5, fib: 3, salt: 1.25 },
  });

  const cheeseSandwich = await createChoice({
    groupId: sandwichGroup.id,
    name: "Cheese Sandwich",
    ingredients: [],
    allergens: [allergenByName.Gluten, allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 320, p: 14, c: 30, s: 3, f: 15, sat: 6.2, fib: 3, salt: 1.05 },
  });

  const noButter = await createChoice({
    groupId: sandwichExtrasGroup.id,
    name: "No Butter",
    ingredients: [],
    nutrition: {},
  });

  const noMayo = await createChoice({
    groupId: sandwichExtrasGroup.id,
    name: "No Mayo",
    ingredients: [],
    nutrition: {},
  });

  const noLettuce = await createChoice({
    groupId: sandwichExtrasGroup.id,
    name: "No Lettuce",
    ingredients: [],
    nutrition: {},
  });

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
      email: { startsWith: "parent" },
    },
    orderBy: { email: "asc" },
    take: TEST_PUPILS,
    select: { id: true, email: true, name: true },
  });

  const populatedSchool = schools[0];
  const populatedSchoolId = populatedSchool.school.id;

  const standardMenu = await prisma.menu.create({
    data: {
      name: "Standard Menu",
      active: true,
      schoolLinks: {
        create: [{ schoolId: populatedSchoolId }],
      },
    },
  });

  const allChoices = [
    rice,
    naan,
    roastPotatoes,
    pastaTwists,
    peas,
    sweetcorn,
    mixedVeg,
    water,
    orangeJuice,
    milk,
    fruitPot,
    yoghurt,
    granolaBar,
    tomatoSoup,
    vegetableSoup,
    chickenSandwich,
    hamSandwich,
    cheeseSandwich,
    noButter,
    noMayo,
    noLettuce,
  ];

  await prisma.menuMealChoice.createMany({
    data: allChoices.map((choice) => ({
      menuId: standardMenu.id,
      choiceId: choice.id,
    })),
    skipDuplicates: true,
  });

  const allGroups = [
    sideGroup,
    vegGroup,
    drinkGroup,
    dessertGroup,
    soupGroup,
    sandwichGroup,
    sandwichExtrasGroup,
  ];

  await prisma.menuMealGroup.createMany({
    data: allGroups.map((group) => ({
      menuId: standardMenu.id,
      groupId: group.id,
    })),
    skipDuplicates: true,
  });

  const chickenCurryOption = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Chicken Curry",
      stickerCount: 1,
      imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe",
    },
  });

  const pastaBologneseOption = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Pasta Bolognese",
      stickerCount: 1,
      imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9",
    },
  });

  const veggieStirFryOption = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Veggie Stir Fry",
      stickerCount: 1,
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
    },
  });

  const soupAndSandwichOption = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Soup + Sandwich",
      stickerCount: 2,
      imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554",
    },
  });

  await prisma.mealOptionMealGroup.createMany({
    data: [
      { mealOptionId: chickenCurryOption.id, groupId: sideGroup.id },
      { mealOptionId: chickenCurryOption.id, groupId: vegGroup.id },
      { mealOptionId: chickenCurryOption.id, groupId: drinkGroup.id },
      { mealOptionId: chickenCurryOption.id, groupId: dessertGroup.id },

      { mealOptionId: pastaBologneseOption.id, groupId: vegGroup.id },
      { mealOptionId: pastaBologneseOption.id, groupId: drinkGroup.id },
      { mealOptionId: pastaBologneseOption.id, groupId: dessertGroup.id },

      { mealOptionId: veggieStirFryOption.id, groupId: sideGroup.id },
      { mealOptionId: veggieStirFryOption.id, groupId: vegGroup.id },
      { mealOptionId: veggieStirFryOption.id, groupId: drinkGroup.id },
      { mealOptionId: veggieStirFryOption.id, groupId: dessertGroup.id },

      { mealOptionId: soupAndSandwichOption.id, groupId: soupGroup.id },
      { mealOptionId: soupAndSandwichOption.id, groupId: sandwichGroup.id },
      { mealOptionId: soupAndSandwichOption.id, groupId: sandwichExtrasGroup.id },
      { mealOptionId: soupAndSandwichOption.id, groupId: drinkGroup.id },
    ],
    skipDuplicates: true,
  });

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
      allergies:
        i % 5 === 0
          ? ["Dairy"]
          : i % 7 === 0
          ? ["Gluten"]
          : [],
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

  for (const schoolEntry of schools) {
    for (const classroom of schoolEntry.classrooms) {
      const count = await prisma.pupil.count({
        where: { classroomId: classroom.id },
      });

      await prisma.classroom.update({
        where: { id: classroom.id },
        data: { totalPupils: count },
      });
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const academicStartYear = now.getMonth() >= 7 ? currentYear : currentYear - 1;
  const academicEndYear = academicStartYear + 1;

  for (const schoolEntry of schools) {
    const schoolId = schoolEntry.school.id;

    await prisma.schedule.createMany({
      data: [
        {
          name: `School Year ${academicStartYear}/${academicEndYear} - ${schoolEntry.school.name}`,
          type: ScheduleType.TERM,
          startDate: dateYMD(academicStartYear, 9, 1),
          endDate: dateYMD(academicEndYear, 6, 30),
          schoolId,
        },
        {
          name: `Christmas ${academicEndYear - 1}/${academicEndYear} - ${schoolEntry.school.name}`,
          type: ScheduleType.HOLIDAY,
          startDate: dateYMD(academicEndYear - 1, 12, 22),
          endDate: dateYMD(academicEndYear, 1, 2),
          schoolId,
        },
        {
          name: `Easter ${academicEndYear} - ${schoolEntry.school.name}`,
          type: ScheduleType.HOLIDAY,
          startDate: dateYMD(academicEndYear, 3, 30),
          endDate: dateYMD(academicEndYear, 4, 10),
          schoolId,
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log("🍱 Creating populated orders for NEXT week...");

  const nextWeekStart = nextWeekStartMon(new Date());
  const nextWeekDays = [0, 1, 2, 3, 4].map((i) => startOfDay(addDays(nextWeekStart, i)));

  const mealPlans = [
    {
      mealName: "Chicken Curry",
      buildItems: () => [
        pickOne([rice, naan]),
        pickOne([peas, sweetcorn, mixedVeg]),
        pickOne([water, orangeJuice, milk]),
        pickOne([fruitPot, yoghurt, granolaBar]),
      ],
    },
    {
      mealName: "Pasta Bolognese",
      buildItems: () => [
        pickOne([peas, sweetcorn, mixedVeg]),
        pickOne([water, orangeJuice, milk]),
        pickOne([fruitPot, yoghurt, granolaBar]),
      ],
    },
    {
      mealName: "Veggie Stir Fry",
      buildItems: () => [
        pickOne([rice, pastaTwists, roastPotatoes]),
        pickOne([peas, sweetcorn, mixedVeg]),
        pickOne([water, orangeJuice, milk]),
        pickOne([fruitPot, yoghurt, granolaBar]),
      ],
    },
    {
      mealName: "Soup + Sandwich",
      buildItems: () => {
        const base = [
          pickOne([tomatoSoup, vegetableSoup]),
          pickOne([chickenSandwich, hamSandwich, cheeseSandwich]),
          pickOne([water, orangeJuice, milk]),
        ];

        const extras = pickSome([noButter, noMayo, noLettuce], 2);

        return [...base, ...extras];
      },
    },
  ];

  for (const pupil of testPupils) {
    for (const date of nextWeekDays) {
      const plan = pickOne(mealPlans);
      const selectedChoices = plan.buildItems();

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
            create: selectedChoices.map((choice) => ({
              choiceId: choice.id,
              selectedIngredients: [],
            })),
          },
        },
        create: {
          pupilId: pupil.id,
          date,
          items: {
            create: selectedChoices.map((choice) => ({
              choiceId: choice.id,
              selectedIngredients: [],
            })),
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
  console.log(`   Orders created for next week starting: ${nextWeekStart.toDateString()}`);
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