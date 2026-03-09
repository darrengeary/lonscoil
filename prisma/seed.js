// prisma/seed.js
const { PrismaClient, UserRole, ScheduleType } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * CONFIG
 */
const SEED_SCHOOL_NAME = "Test National School";
const DAYS = 10; // extra orders (kept, but we’ll ALSO create a full Mon–Fri week for Jane Doe)
const PUPILS_PER_CLASS = 25;
const PARENTS = 30;
const RESET_TEST_SCHOOL = true;

/**
 * Helpers
 */
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfWeekMon(d) {
  // JS getDay(): Sun 0, Mon 1...Sat 6
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day; // move back to Monday
  return addDays(x, diff);
}
function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickSome(arr, maxCount) {
  const n = Math.floor(Math.random() * (maxCount + 1)); // 0..maxCount
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
function emailify(prefix, i) {
  return `${prefix}${String(i).padStart(2, "0")}@school.io`;
}
function dateYMD(y, m, d) {
  return startOfDay(new Date(y, m - 1, d));
}

/**
 * Extras pools (stored in MealChoice.ingredients, selected in OrderItem.selectedIngredients)
 */
const lunchExtrasPool = ["No onions", "Extra cheese", "No sauce", "Ketchup", "Mayo", "Gluten-free"];
const snackExtrasPool = ["No nuts", "Extra fruit", "No yoghurt"];

// DELETE EVERYTHING EXCEPT USERS
async function wipeAllExceptUsers() {
  console.log("🧹 Wiping orders + meals + schedules + menus links...");

  await prisma.orderItem.deleteMany();
  await prisma.lunchOrder.deleteMany();

  // menu link tables
  await prisma.menuMealChoice.deleteMany();
  await prisma.menuMealGroup.deleteMany();
  await prisma.menuSchool.deleteMany();

  // menus (safe to wipe in test seed)
  await prisma.menu.deleteMany();

  await prisma.mealChoice.deleteMany();
  await prisma.mealGroup.deleteMany();

  await prisma.schedule.deleteMany();

  console.log("✅ Wipe completed (Users preserved).");
}

async function main() {
  console.log("Wiping...");
  await wipeAllExceptUsers();

  console.log("🌱 Seeding...");

  /**
   * 0) Optional cleanup (delete existing school & dependents)
   */
  if (RESET_TEST_SCHOOL) {
    const existingSchool = await prisma.school.findFirst({
      where: { name: SEED_SCHOOL_NAME },
      select: { id: true },
    });

    if (existingSchool) {
      console.log("🧹 Resetting existing test school data...");

      const pupils = await prisma.pupil.findMany({
        where: { classroom: { schoolId: existingSchool.id } },
        select: { id: true },
      });
      const pupilIds = pupils.map((p) => p.id);

      if (pupilIds.length) {
        await prisma.lunchOrder.deleteMany({ where: { pupilId: { in: pupilIds } } });
      }

      await prisma.user.updateMany({
        where: { schoolId: existingSchool.id },
        data: { schoolId: null },
      });

      await prisma.pupil.deleteMany({ where: { classroom: { schoolId: existingSchool.id } } });
      await prisma.classroom.deleteMany({ where: { schoolId: existingSchool.id } });
      await prisma.schedule.deleteMany({ where: { schoolId: existingSchool.id } });
      await prisma.school.delete({ where: { id: existingSchool.id } });
    }
  }

  /**
   * 1) Users
   */
  await prisma.user.upsert({
    where: { email: "admin@school.io" },
    update: { role: UserRole.ADMIN, name: "Site Admin" },
    create: { email: "admin@school.io", name: "Site Admin", role: UserRole.ADMIN },
  });

  const school = await prisma.school.create({
    data: { name: SEED_SCHOOL_NAME },
  });

  await prisma.user.upsert({
    where: { email: "schooladmin@school.io" },
    update: { role: UserRole.SCHOOLADMIN, schoolId: school.id, name: "School Admin" },
    create: {
      email: "schooladmin@school.io",
      name: "School Admin",
      role: UserRole.SCHOOLADMIN,
      schoolId: school.id,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@school.io" },
    update: { role: UserRole.TEACHER, name: "Ms Teacher" },
    create: { email: "teacher@school.io", name: "Ms Teacher", role: UserRole.TEACHER },
  });

  // Parents
  const parentCreates = [];
  for (let i = 1; i <= PARENTS; i++) {
    parentCreates.push({
      email: emailify("parent", i),
      name: `Parent ${i}`,
      role: UserRole.USER,
    });
  }
  await prisma.user.createMany({ data: parentCreates, skipDuplicates: true });

  const parents = await prisma.user.findMany({
    where: { email: { startsWith: "parent" } },
    select: { id: true, email: true, name: true },
    take: PARENTS,
    orderBy: { email: "asc" },
  });

  /**
   * 2) Classrooms
   */
  const classroomNames = ["Junior Infants", "Senior Infants", "1st Class"];
  const classrooms = [];
  for (const name of classroomNames) {
    classrooms.push(
      await prisma.classroom.create({
        data: { name, schoolId: school.id, totalPupils: 0 },
      })
    );
  }

  // Assign teacher to all classrooms
  for (const c of classrooms) {
    await prisma.classroom.update({
      where: { id: c.id },
      data: { teachers: { connect: [{ id: teacher.id }] } },
    });
  }

  /**
   * 3) Pupils (linked to parents + classrooms)
   * plus one explicit pupil: "Jane Doe"
   */
  const pupilCreates = [];
  let pupilCounter = 1;

  for (const c of classrooms) {
    for (let i = 0; i < PUPILS_PER_CLASS; i++) {
      const parent = pickOne(parents);
      pupilCreates.push({
        name: `John Doe ${pupilCounter++}`,
        status: "REGISTERED",
        classroomId: c.id,
        parentId: parent.id,
      });
    }
  }

  await prisma.pupil.createMany({ data: pupilCreates, skipDuplicates: false });

  // Create Jane Doe (attach to first classroom + first parent for convenience)
  const janeParent = parents[0];
  const janeClassroom = classrooms[0];

  // if you rerun seed, just recreate; we wiped all pupils above when RESET_TEST_SCHOOL is true
  const jane = await prisma.pupil.create({
    data: {
      name: "Jane Doe",
      status: "REGISTERED",
      classroomId: janeClassroom.id,
      parentId: janeParent.id,
    },
    select: { id: true, name: true, classroomId: true },
  });

  for (const c of classrooms) {
    const count = await prisma.pupil.count({ where: { classroomId: c.id } });
    await prisma.classroom.update({
      where: { id: c.id },
      data: { totalPupils: count },
    });
  }

  const pupils = await prisma.pupil.findMany({
    where: { classroom: { schoolId: school.id } },
    select: { id: true, classroomId: true },
  });

  /**
   * 4) Allergens
   */
  const allergenNames = ["Gluten", "Dairy", "Egg", "Soy", "Peanuts", "Tree Nuts", "Fish", "Sesame"];
  await prisma.allergen.createMany({
    data: allergenNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const allergens = await prisma.allergen.findMany({ select: { id: true, name: true } });

  /**
   * 5) Meal groups + choices
   */
  const groupLunch = await prisma.mealGroup.create({
    data: { name: "Lunch", maxSelections: 1 },
  });
  const groupSnack = await prisma.mealGroup.create({
    data: { name: "Snack", maxSelections: 1 },
  });

  const lunchChoicesData = [
    { name: "Chicken Curry", nutrition: { kcal: 520, p: 28, c: 62, s: 7, f: 18, sat: 5, fib: 6, salt: 1.4 } },
    { name: "Pasta Bolognese", nutrition: { kcal: 610, p: 30, c: 72, s: 9, f: 22, sat: 7, fib: 7, salt: 1.6 } },
    { name: "Ham & Cheese Wrap", nutrition: { kcal: 540, p: 27, c: 48, s: 5, f: 24, sat: 9, fib: 4, salt: 1.8 } },
    { name: "Veggie Stir Fry", nutrition: { kcal: 460, p: 16, c: 68, s: 10, f: 12, sat: 2, fib: 8, salt: 1.2 } },
  ];

  const snackChoicesData = [
    { name: "Fruit Pot", nutrition: { kcal: 120, p: 1.5, c: 28, s: 22, f: 0.5, sat: 0.1, fib: 4, salt: 0.02 } },
    { name: "Yoghurt", nutrition: { kcal: 160, p: 8, c: 18, s: 16, f: 6, sat: 3.5, fib: 0, salt: 0.15 } },
    { name: "Granola Bar", nutrition: { kcal: 190, p: 4, c: 26, s: 11, f: 8, sat: 2, fib: 3, salt: 0.25 } },
  ];

  const lunchChoices = [];
  for (const ch of lunchChoicesData) {
    lunchChoices.push(
      await prisma.mealChoice.create({
        data: {
          name: ch.name,
          groupId: groupLunch.id,
          ingredients: lunchExtrasPool,
          active: true,
          caloriesKcal: ch.nutrition.kcal,
          proteinG: ch.nutrition.p,
          carbsG: ch.nutrition.c,
          sugarsG: ch.nutrition.s,
          fatG: ch.nutrition.f,
          saturatesG: ch.nutrition.sat,
          fibreG: ch.nutrition.fib,
          saltG: ch.nutrition.salt,
          allergens: { connect: pickSome(allergens, 2).map((a) => ({ id: a.id })) },
        },
      })
    );
  }

  const snackChoices = [];
  for (const ch of snackChoicesData) {
    snackChoices.push(
      await prisma.mealChoice.create({
        data: {
          name: ch.name,
          groupId: groupSnack.id,
          ingredients: snackExtrasPool,
          active: true,
          caloriesKcal: ch.nutrition.kcal,
          proteinG: ch.nutrition.p,
          carbsG: ch.nutrition.c,
          sugarsG: ch.nutrition.s,
          fatG: ch.nutrition.f,
          saturatesG: ch.nutrition.sat,
          fibreG: ch.nutrition.fib,
          saltG: ch.nutrition.salt,
          allergens: { connect: pickSome(allergens, 2).map((a) => ({ id: a.id })) },
        },
      })
    );
  }

  /**
   * 5.5) MENUS + LINKS (NEW)
   * - Standard menu linked to this school
   * - Optional “Dairy Free” menu as an example (linked too)
   * - Link groups to menus via MenuMealGroup
   * - Link choices to menus via MenuMealChoice
   */
  const menuStandard = await prisma.menu.create({
    data: {
      name: "Standard",
      active: true,
      schoolLinks: { create: [{ schoolId: school.id }] }, // menu available for this school
    },
    select: { id: true, name: true },
  });

  const menuDairyFree = await prisma.menu.create({
    data: {
      name: "Dairy Free",
      active: true,
      schoolLinks: { create: [{ schoolId: school.id }] },
    },
    select: { id: true, name: true },
  });

  // Attach groups to both menus (you can change overrides per menu if you want)
  await prisma.menuMealGroup.createMany({
    data: [
      { menuId: menuStandard.id, groupId: groupLunch.id },
      { menuId: menuStandard.id, groupId: groupSnack.id },
      { menuId: menuDairyFree.id, groupId: groupLunch.id },
      { menuId: menuDairyFree.id, groupId: groupSnack.id },
    ],
    skipDuplicates: true,
  });

  // Link ALL created choices to Standard menu
  await prisma.menuMealChoice.createMany({
    data: [...lunchChoices, ...snackChoices].map((c) => ({ menuId: menuStandard.id, choiceId: c.id })),
    skipDuplicates: true,
  });

  // Link a subset to Dairy Free menu (example: omit obvious dairy items)
  const dairyFreeChoiceNamesBlacklist = new Set(["Ham & Cheese Wrap", "Yoghurt"]);
  const dairyFreeChoices = [...lunchChoices, ...snackChoices].filter((c) => !dairyFreeChoiceNamesBlacklist.has(c.name));

  await prisma.menuMealChoice.createMany({
    data: dairyFreeChoices.map((c) => ({ menuId: menuDairyFree.id, choiceId: c.id })),
    skipDuplicates: true,
  });

  // Set Jane to Dairy Free menu (optional; remove if you want her on Standard)
  await prisma.pupil.update({
    where: { id: jane.id },
    data: { menuId: menuDairyFree.id },
  });

  /**
   * 6) Schedules
   */
  const schedules = [
    { name: "School Year 2025/2026", type: ScheduleType.TERM, startDate: dateYMD(2025, 9, 1), endDate: dateYMD(2026, 6, 30), schoolId: school.id },

    { name: "Halloween Midterm 2025", type: ScheduleType.HOLIDAY, startDate: dateYMD(2025, 10, 27), endDate: dateYMD(2025, 10, 31), schoolId: school.id },
    { name: "Christmas 2025/2026", type: ScheduleType.HOLIDAY, startDate: dateYMD(2025, 12, 22), endDate: dateYMD(2026, 1, 2), schoolId: school.id },

    { name: "St Brigid's Day 2026", type: ScheduleType.HOLIDAY, startDate: dateYMD(2026, 2, 2), endDate: dateYMD(2026, 2, 2), schoolId: school.id },
    { name: "February Midterm 2026", type: ScheduleType.HOLIDAY, startDate: dateYMD(2026, 2, 16), endDate: dateYMD(2026, 2, 20), schoolId: school.id },

    { name: "St Patrick's Day 2026", type: ScheduleType.HOLIDAY, startDate: dateYMD(2026, 3, 17), endDate: dateYMD(2026, 3, 17), schoolId: school.id },

    { name: "Easter 2026", type: ScheduleType.HOLIDAY, startDate: dateYMD(2026, 3, 30), endDate: dateYMD(2026, 4, 10), schoolId: school.id },

    { name: "May Bank Holiday 2026", type: ScheduleType.HOLIDAY, startDate: dateYMD(2026, 5, 4), endDate: dateYMD(2026, 5, 4), schoolId: school.id },
    { name: "June Bank Holiday 2026", type: ScheduleType.HOLIDAY, startDate: dateYMD(2026, 6, 1), endDate: dateYMD(2026, 6, 1), schoolId: school.id },
  ];

  await prisma.schedule.createMany({
    data: schedules,
    skipDuplicates: true,
  });

  /**
   * 7) Orders for everyone (kept from your seed)
   * NOTE: your original code was creating orders in the past (today - dayOffset).
   * I’m leaving it as-is, but you can flip to +dayOffset if you want future orders.
   */
  const today = startOfDay(new Date());

  const lunchChoiceIds = lunchChoices.map((c) => c.id);
  const snackChoiceIds = snackChoices.map((c) => c.id);

  console.log("🍱 Creating bulk orders...");

  const CHUNK = 250;

  for (let dayOffset = 0; dayOffset < DAYS; dayOffset++) {
    const date = startOfDay(addDays(today, -dayOffset));

    for (let i = 0; i < pupils.length; i += CHUNK) {
      const slice = pupils.slice(i, i + CHUNK);

      await prisma.$transaction(
        slice.map((p) => {
          const lunchChoiceId = pickOne(lunchChoiceIds);
          const snackChoiceId = Math.random() < 0.5 ? pickOne(snackChoiceIds) : null;

          const lunchExtras = pickSome(lunchExtrasPool, 2);
          const snackExtras = snackChoiceId ? pickSome(snackExtrasPool, 1) : [];

          return prisma.lunchOrder.upsert({
            where: { pupilId_date: { pupilId: p.id, date } },
            update: {
              items: {
                deleteMany: {},
                create: [
                  { choiceId: lunchChoiceId, selectedIngredients: lunchExtras },
                  ...(snackChoiceId ? [{ choiceId: snackChoiceId, selectedIngredients: snackExtras }] : []),
                ],
              },
            },
            create: {
              pupilId: p.id,
              date,
              items: {
                create: [
                  { choiceId: lunchChoiceId, selectedIngredients: lunchExtras },
                  ...(snackChoiceId ? [{ choiceId: snackChoiceId, selectedIngredients: snackExtras }] : []),
                ],
              },
            },
          });
        })
      );
    }
  }

  /**
   * 8) Create orders for the WEEK (Mon–Fri) for Jane Doe
   * - Uses Jane’s effective menu (her pupil.menuId, set above)
   * - Picks ONLY choices that are linked to that menu (MenuMealChoice)
   * - Ensures 1 lunch + 1 snack each day
   */
  console.log("🧑‍🎓 Creating Jane Doe week orders...");

  const janeFresh = await prisma.pupil.findUnique({
    where: { id: jane.id },
    select: { id: true, menuId: true },
  });

  const janeMenuId = janeFresh.menuId || menuStandard.id;

  const [janeMenuLunchChoices, janeMenuSnackChoices] = await Promise.all([
    prisma.mealChoice.findMany({
      where: {
        groupId: groupLunch.id,
        active: true,
        menuLinks: { some: { menuId: janeMenuId } }, // MenuMealChoice
      },
      select: { id: true, ingredients: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.mealChoice.findMany({
      where: {
        groupId: groupSnack.id,
        active: true,
        menuLinks: { some: { menuId: janeMenuId } },
      },
      select: { id: true, ingredients: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!janeMenuLunchChoices.length) throw new Error("No lunch choices linked to Jane’s menu");
  if (!janeMenuSnackChoices.length) throw new Error("No snack choices linked to Jane’s menu");

  const weekStart = startOfWeekMon(new Date()); // current week Mon
  const janeWeekDays = [0, 1, 2, 3, 4].map((i) => startOfDay(addDays(weekStart, i))); // Mon–Fri

  for (const date of janeWeekDays) {
    const lunchChoice = pickOne(janeMenuLunchChoices);
    const snackChoice = pickOne(janeMenuSnackChoices);

    const lunchExtras = pickSome(lunchChoice.ingredients?.length ? lunchChoice.ingredients : lunchExtrasPool, 2);
    const snackExtras = pickSome(snackChoice.ingredients?.length ? snackChoice.ingredients : snackExtrasPool, 1);

    await prisma.lunchOrder.upsert({
      where: { pupilId_date: { pupilId: jane.id, date } },
      update: {
        items: {
          deleteMany: {},
          create: [
            { choiceId: lunchChoice.id, selectedIngredients: lunchExtras },
            { choiceId: snackChoice.id, selectedIngredients: snackExtras },
          ],
        },
      },
      create: {
        pupilId: jane.id,
        date,
        items: {
          create: [
            { choiceId: lunchChoice.id, selectedIngredients: lunchExtras },
            { choiceId: snackChoice.id, selectedIngredients: snackExtras },
          ],
        },
      },
    });
  }

  console.log("✅ Seed completed");
  console.log(`   School: ${school.name}`);
  console.log(`   Menus: ${menuStandard.name}, ${menuDairyFree.name}`);
  console.log(`   Jane Doe: ${jane.name} (menu: ${menuDairyFree.name})`);
  console.log(`   Classrooms: ${classrooms.length}`);
  console.log(`   Pupils: ${pupils.length + 1}`);
  console.log(`   Days of bulk orders: ${DAYS}`);
  console.log(`   Admin login: admin@school.io`);
  console.log(`   SchoolAdmin login: schooladmin@school.io`);
  console.log(`   Teacher login: teacher@school.io`);
  console.log(`   Jane’s parent login: ${janeParent.email}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });