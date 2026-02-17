// prisma/seed.js
const { PrismaClient, UserRole, ScheduleType } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * CONFIG
 */
const SEED_SCHOOL_NAME = "Test National School";
const DAYS = 10; // how many days of orders to generate (including today)
const PUPILS_PER_CLASS = 25; // total pupils per classroom
const PARENTS = 30; // number of parent accounts

// If true, wipe the existing test school (and cascading dependents) before reseeding.
// Safer in dev; set false if you don't want deletions.
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
// DELETE EVERYTHING EXCEPT USERS
// Note: we keep User rows. We ALSO keep auth tables (Account/Session/etc) by default.
// If you want to wipe those too, see the optional section below.
async function wipeAllExceptUsers() {
  console.log("🧹 Wiping orders...");

  // 1) Orders (children first)
  await prisma.orderItem.deleteMany();     // OrderItem depends on LunchOrder + MealChoice
  await prisma.lunchOrder.deleteMany();    // LunchOrder depends on Pupil

  // 3) Meal setup
  // MealChoice depends on MealGroup; and many-to-many with Allergen creates a join table
  // Prisma will manage the join table deletes automatically when MealChoice is deleted
  await prisma.mealChoice.deleteMany();
  await prisma.mealGroup.deleteMany();

  console.log("✅ Wipe completed (Users preserved).");
}

async function main() {
  console.log("Wiping...");
  await wipeAllExceptUsers();

  console.log("🌱 Seeding...");
  /**
   * 0) Optional cleanup
   */
  if (RESET_TEST_SCHOOL) {
    const existingSchool = await prisma.school.findFirst({
      where: { name: SEED_SCHOOL_NAME },
      select: { id: true },
    });

    if (existingSchool) {
      console.log("🧹 Resetting existing test school data...");

      // Delete LunchOrders for pupils in this school (cascade deletes OrderItem)
      const pupils = await prisma.pupil.findMany({
        where: { classroom: { schoolId: existingSchool.id } },
        select: { id: true },
      });
      const pupilIds = pupils.map((p) => p.id);

      if (pupilIds.length) {
        await prisma.lunchOrder.deleteMany({ where: { pupilId: { in: pupilIds } } });
      }

      // Unlink users from school (so school deletion doesn't fail if FK constraints exist)
      await prisma.user.updateMany({
        where: { schoolId: existingSchool.id },
        data: { schoolId: null },
      });

      // Delete pupils + classrooms + schedules + school
      await prisma.pupil.deleteMany({ where: { classroom: { schoolId: existingSchool.id } } });
      await prisma.classroom.deleteMany({ where: { schoolId: existingSchool.id } });
      await prisma.schedule.deleteMany({ where: { schoolId: existingSchool.id } });
      await prisma.school.delete({ where: { id: existingSchool.id } });
    }
  }

  /**
   * 1) Users
   */
  const admin = await prisma.user.upsert({
    where: { email: "admin@school.io" },
    update: { role: UserRole.ADMIN, name: "Site Admin" },
    create: { email: "admin@school.io", name: "Site Admin", role: UserRole.ADMIN },
  });

  // Create school first so we can attach schooladmin/teacher
  const school = await prisma.school.create({
    data: { name: SEED_SCHOOL_NAME },
  });

  const schoolAdmin = await prisma.user.upsert({
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
  // createMany ignores duplicates if skipDuplicates true
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

  // Assign teacher to all classrooms (optional)
  for (const c of classrooms) {
    await prisma.classroom.update({
      where: { id: c.id },
      data: { teachers: { connect: [{ id: teacher.id }] } },
    });
  }

  /**
   * 3) Pupils (linked to parents + classrooms)
   */
  const pupilCreates = [];
  let pupilCounter = 1;

  for (const c of classrooms) {
    for (let i = 0; i < PUPILS_PER_CLASS; i++) {
      const parent = pickOne(parents);
      pupilCreates.push({
        name: `Pupil ${pupilCounter++}`,
        status: "REGISTERED",
        classroomId: c.id,
        parentId: parent.id,
      });
    }
  }

  await prisma.pupil.createMany({ data: pupilCreates, skipDuplicates: false });

  // Update classroom totals
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
    { name: "Chicken Curry", ingredients: ["Rice", "Chicken", "Curry Sauce"] },
    { name: "Pasta Bolognese", ingredients: ["Pasta", "Beef", "Tomato"] },
    { name: "Ham & Cheese Wrap", ingredients: ["Wrap", "Ham", "Cheese"] },
    { name: "Veggie Stir Fry", ingredients: ["Noodles", "Veg", "Soy"] },
  ];

  const snackChoicesData = [
    { name: "Fruit Pot", ingredients: ["Apple", "Grapes", "Orange"] },
    { name: "Yoghurt", ingredients: ["Dairy"] },
    { name: "Granola Bar", ingredients: ["Oats", "Honey"] },
  ];

  // Create choices
  const lunchChoices = [];
  for (const ch of lunchChoicesData) {
    lunchChoices.push(
      await prisma.mealChoice.create({
        data: {
          name: ch.name,
          groupId: groupLunch.id,
          ingredients: ch.ingredients,
          active: true,
          // randomly attach 0-2 allergens
          allergens: {
            connect: pickSome(allergens, 2).map((a) => ({ id: a.id })),
          },
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
          ingredients: ch.ingredients,
          active: true,
          allergens: {
            connect: pickSome(allergens, 2).map((a) => ({ id: a.id })),
          },
        },
      })
    );
  }

  /**
   * 6) Schedules (optional)
   */
  await prisma.schedule.createMany({
    data: [
      {
        name: "Term 1",
        type: ScheduleType.TERM,
        startDate: startOfDay(addDays(new Date(), -30)),
        endDate: startOfDay(addDays(new Date(), 60)),
        schoolId: school.id,
      },
    ],
    skipDuplicates: true,
  });

  /**
   * 7) LunchOrders + OrderItems
   *
   * IMPORTANT:
   * Your schema enforces @@unique([pupilId, date]) on LunchOrder.
   * So we can safely upsert orders per pupil/day.
   *
   * Each order gets exactly:
   *  - 1 Lunch item
   *  - optionally 1 Snack item (50% chance)
   *
   * selectedIngredients are "extras" as strings.
   */
  const lunchExtrasPool = ["No onions", "Extra cheese", "No sauce", "Ketchup", "Mayo", "Gluten-free"];
  const snackExtrasPool = ["No nuts", "Extra fruit", "No yoghurt"];

  const today = startOfDay(new Date());

  // Preload choice IDs
  const lunchChoiceIds = lunchChoices.map((c) => c.id);
  const snackChoiceIds = snackChoices.map((c) => c.id);

  console.log("🍱 Creating orders...");

  // Batch in chunks to avoid huge transaction
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
              // Replace items each time to keep deterministic seed re-runs
              items: {
                deleteMany: {},
                create: [
                  {
                    choiceId: lunchChoiceId,
                    selectedIngredients: lunchExtras,
                  },
                  ...(snackChoiceId
                    ? [
                        {
                          choiceId: snackChoiceId,
                          selectedIngredients: snackExtras,
                        },
                      ]
                    : []),
                ],
              },
            },
            create: {
              pupilId: p.id,
              date,
              items: {
                create: [
                  {
                    choiceId: lunchChoiceId,
                    selectedIngredients: lunchExtras,
                  },
                  ...(snackChoiceId
                    ? [
                        {
                          choiceId: snackChoiceId,
                          selectedIngredients: snackExtras,
                        },
                      ]
                    : []),
                ],
              },
            },
          });
        })
      );
    }
  }

  console.log("✅ Seed completed");
  console.log(`   School: ${school.name}`);
  console.log(`   Classrooms: ${classrooms.length}`);
  console.log(`   Pupils: ${pupils.length}`);
  console.log(`   Days of orders: ${DAYS}`);
  console.log(`   Admin login: admin@school.io`);
  console.log(`   SchoolAdmin login: schooladmin@school.io`);
  console.log(`   Teacher login: teacher@school.io`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
