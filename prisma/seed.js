const {
  PrismaClient,
  UserRole,
  ScheduleType,
  PupilStatus,
} = require("@prisma/client");

const prisma = new PrismaClient();

const SCHOOL_COUNT = 10;
const CLASSROOMS_PER_SCHOOL = 4;
const PUPILS_PER_CLASSROOM = 3;
const RESET_SEED_DATA = true;

const TEST_USER_EMAIL = "parent@test.ie";
const TEST_ADMIN_EMAIL = "admin@test.ie";
const TEST_NAME = "Galina";
const TEST_PASSWORD_HASH =
  "$2b$10$VzLVLLN8O9JncHt8VDv/3uE.1UqypQkS1OBK0pgJ9V7mrc.FrGkGK";

const SCHOOL_NAMES = [
  "Scoil Mhuire, Letterkenny",
  "St. Mary's National School, Buncrana",
  "St. Patrick's National School, Donegal Town",
  "St. Columba's National School, Stranorlar",
  "St. Bridget's National School, Convoy",
  "St. Aidan's National School, Raphoe",
  "St. Joseph's National School, Carndonagh",
  "Scoil Iosagain, Ballybofey",
  "St. Anne's National School, Falcarragh",
  "St. Oran's National School, Dungloe",
];

const CLASSROOM_NAMES = [
  "Junior Infants",
  "Senior Infants",
  "1st Class",
  "2nd Class",
];

const PUPIL_FIRST_NAMES = [
  "Jack",
  "Noah",
  "James",
  "Daniel",
  "Conor",
  "Ryan",
  "Luke",
  "Adam",
  "Ben",
  "Charlie",
  "Emily",
  "Grace",
  "Sophie",
  "Ella",
  "Lucy",
  "Chloe",
  "Emma",
  "Katie",
  "Molly",
  "Sarah",
  "Sean",
  "Oisin",
  "Evan",
  "Cian",
  "Harry",
  "Anna",
  "Mia",
  "Kate",
  "Ava",
  "Holly",
];

const PUPIL_LAST_NAMES = [
  "Murphy",
  "Kelly",
  "Byrne",
  "Ryan",
  "O'Brien",
  "Walsh",
  "Doyle",
  "McCarthy",
  "Gallagher",
  "Kennedy",
  "Lynch",
  "Murray",
  "Quinn",
  "Moore",
  "Flynn",
  "Burke",
  "Dunne",
  "Regan",
  "Nolan",
  "Power",
  "Fitzgerald",
  "Keane",
  "Doherty",
  "McLaughlin",
  "Boyle",
  "Brennan",
  "Hogan",
  "Meehan",
  "Donnelly",
  "Rooney",
];

const PARENT_FIRST_NAMES = [
  "Sarah",
  "Emma",
  "Aoife",
  "Claire",
  "Lisa",
  "Rachel",
  "Maria",
  "Karen",
  "Nicola",
  "Louise",
  "John",
  "Michael",
  "David",
  "Paul",
  "Mark",
  "Brian",
  "Patrick",
  "Stephen",
  "Martin",
  "Declan",
];

const MENU_ITEM_IMAGES = {
  standardChickenCurry:
    "https://res.cloudinary.com/dvwuge9k7/image/upload/v1774518984/meal-options/ekncvg0ycurcnuqz5v2p.jpg",
  halalChickenCurry:
    "https://res.cloudinary.com/dvwuge9k7/image/upload/v1774518984/meal-options/ekncvg0ycurcnuqz5v2p.jpg",
  pizzaSliceWithSide:
    "https://res.cloudinary.com/dvwuge9k7/image/upload/v1774519007/meal-options/cogjjh3orphlcpjwetbq.jpg",
  standardSoupSandwich:
    "https://res.cloudinary.com/dvwuge9k7/image/upload/v1774519055/meal-options/vfp9jsrzxtfvegrnbejl.jpg",
  wrap:
    "https://res.cloudinary.com/dvwuge9k7/image/upload/v1774519116/meal-options/ocojrlmwpohrwkstalhd.webp",
  halalSoupSandwich:
    "https://res.cloudinary.com/dvwuge9k7/image/upload/v1774519130/meal-options/pdvlbqtnwc2vqi3ip9yf.jpg",
};

const MEAL_OPTION_NUTRITION = {
  chickenCurry: {
    kcal: 540,
    p: 30,
    c: 42,
    s: 6,
    f: 24,
    sat: 6,
    fib: 5,
    salt: 1.4,
  },
  halalChickenCurry: {
    kcal: 540,
    p: 30,
    c: 42,
    s: 6,
    f: 24,
    sat: 6,
    fib: 5,
    salt: 1.4,
  },
  pizzaSliceWithSide: {
    kcal: 480,
    p: 16,
    c: 52,
    s: 4,
    f: 22,
    sat: 7,
    fib: 4,
    salt: 1.45,
  },
  soupAndSandwich: {
    kcal: 470,
    p: 22,
    c: 46,
    s: 7,
    f: 20,
    sat: 6,
    fib: 4,
    salt: 1.8,
  },
  wrap: {
    kcal: 455,
    p: 24,
    c: 34,
    s: 4,
    f: 20,
    sat: 4,
    fib: 4,
    salt: 1.25,
  },
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function createMealOption({
  menuId,
  name,
  stickerCount,
  imageUrl,
  nutrition = {},
}) {
  return prisma.mealOption.create({
    data: {
      menuId,
      name,
      stickerCount,
      active: true,
      imageUrl: imageUrl ?? null,
      caloriesKcal: nutrition.kcal ?? null,
      proteinG: nutrition.p ?? null,
      carbsG: nutrition.c ?? null,
      sugarsG: nutrition.s ?? null,
      fatG: nutrition.f ?? null,
      saturatesG: nutrition.sat ?? null,
      fibreG: nutrition.fib ?? null,
      saltG: nutrition.salt ?? null,
    },
  });
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dateYMD(y, m, d) {
  return startOfDay(new Date(y, m - 1, d));
}

function nextSevenDays(from = new Date()) {
  return Array.from({ length: 7 }, (_, i) => startOfDay(addDays(from, i)));
}

function schoolAdminEmail(i) {
  return `schooladmin${i}@school.io`;
}

function teacherEmail(i, j) {
  return `teacher${i}_${j}@school.io`;
}

function parentEmail(i, j, k) {
  return `parent_${i}_${j}_${k}@school.io`;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makePupilName(index) {
  const first = PUPIL_FIRST_NAMES[index % PUPIL_FIRST_NAMES.length];
  const last =
    PUPIL_LAST_NAMES[
      Math.floor(index / PUPIL_FIRST_NAMES.length) % PUPIL_LAST_NAMES.length
    ];
  return `${first} ${last}`;
}

function makeParentName(index, pupilLastName) {
  const first = PARENT_FIRST_NAMES[index % PARENT_FIRST_NAMES.length];
  return `${first} ${pupilLastName}`;
}

async function wipeSeedData() {
  console.log("🧹 Wiping existing seed data...");

  await prisma.printJobItem.deleteMany();
  await prisma.printJob.deleteMany();

  await prisma.orderItem.deleteMany();
  await prisma.lunchOrder.deleteMany();

  await prisma.pupilMealWeekPatternItem.deleteMany();
  await prisma.pupilMealWeekPattern.deleteMany();

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
        { email: { startsWith: "parent_" } },
        { email: TEST_USER_EMAIL },
        { email: TEST_ADMIN_EMAIL },
        { email: "admin@school.io" },
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
        { email: { startsWith: "parent_" } },
        { email: TEST_USER_EMAIL },
        { email: TEST_ADMIN_EMAIL },
        { email: "admin@school.io" },
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
  extraSticker = false,
}) {
  return prisma.mealChoice.create({
    data: {
      name,
      groupId,
      ingredients,
      active: true,
      extraSticker,
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

async function createBaseMealData() {
  const allergenNames = [
    "Gluten",
    "Dairy",
    "Egg",
    "Soy",
    "Peanuts",
    "Tree Nuts",
    "Fish",
    "Sesame",
    "Mustard",
  ];

  await prisma.allergen.createMany({
    data: allergenNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const allergens = await prisma.allergen.findMany({
    select: { id: true, name: true },
  });

  const allergenByName = Object.fromEntries(allergens.map((a) => [a.name, a]));

  const soupGroup = await prisma.mealGroup.create({
    data: { name: "Soup", maxSelections: 1, active: true },
  });

  const sandwichTypeGroup = await prisma.mealGroup.create({
    data: { name: "Sandwich Type", maxSelections: 1, active: true },
  });

  const sauceGroup = await prisma.mealGroup.create({
    data: { name: "Sauce", maxSelections: 1, active: true },
  });

  const drinkGroup = await prisma.mealGroup.create({
    data: { name: "Drink", maxSelections: 1, active: true },
  });

  const sideGroup = await prisma.mealGroup.create({
    data: { name: "Side", maxSelections: 1, active: true },
  });

  const vegGroup = await prisma.mealGroup.create({
    data: { name: "Veg", maxSelections: 1, active: true },
  });

  const wrapFillingsGroup = await prisma.mealGroup.create({
    data: { name: "Wrap Filling", maxSelections: 1, active: true },
  });

  const tomatoSoup = await createChoice({
    groupId: soupGroup.id,
    name: "Tomato Soup",
    allergens: [allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 140, p: 3, c: 18, s: 9, f: 6, sat: 2.5, fib: 2, salt: 0.9 },
    extraSticker: true,
  });

  const vegetableSoup = await createChoice({
    groupId: soupGroup.id,
    name: "Vegetable Soup",
    nutrition: { kcal: 130, p: 3, c: 20, s: 8, f: 4, sat: 0.8, fib: 3, salt: 0.85 },
    extraSticker: true,
  });

  const chickenNoodleSoup = await createChoice({
    groupId: soupGroup.id,
    name: "Chicken Noodle Soup",
    allergens: [allergenByName.Gluten].filter(Boolean),
    nutrition: { kcal: 155, p: 9, c: 15, s: 2, f: 6, sat: 1.2, fib: 1.5, salt: 0.95 },
    extraSticker: true,
  });

  const chickenSandwich = await createChoice({
    groupId: sandwichTypeGroup.id,
    name: "Chicken Sandwich",
    allergens: [allergenByName.Gluten, allergenByName.Egg].filter(Boolean),
    nutrition: { kcal: 340, p: 18, c: 32, s: 4, f: 14, sat: 2.8, fib: 3, salt: 1.1 },
  });

  const hamSandwich = await createChoice({
    groupId: sandwichTypeGroup.id,
    name: "Ham Sandwich",
    allergens: [allergenByName.Gluten, allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 330, p: 17, c: 31, s: 4, f: 13, sat: 3.5, fib: 3, salt: 1.25 },
  });

  const cheeseSandwich = await createChoice({
    groupId: sandwichTypeGroup.id,
    name: "Cheese Sandwich",
    allergens: [allergenByName.Gluten, allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 320, p: 14, c: 30, s: 3, f: 15, sat: 6.2, fib: 3, salt: 1.05 },
  });

  const tunaSandwich = await createChoice({
    groupId: sandwichTypeGroup.id,
    name: "Tuna Sandwich",
    allergens: [allergenByName.Gluten, allergenByName.Fish, allergenByName.Egg].filter(Boolean),
    nutrition: { kcal: 335, p: 19, c: 29, s: 3, f: 14, sat: 2.5, fib: 2.8, salt: 1.1 },
  });

  const ketchup = await createChoice({
    groupId: sauceGroup.id,
    name: "Ketchup",
    nutrition: { kcal: 20, p: 0, c: 5, s: 4, f: 0, sat: 0, fib: 0.1, salt: 0.18 },
  });

  const tomatoSauce = await createChoice({
    groupId: sauceGroup.id,
    name: "Tomato Sauce",
    nutrition: { kcal: 18, p: 0, c: 4, s: 3, f: 0, sat: 0, fib: 0.1, salt: 0.16 },
  });

  const mildCurrySauce = await createChoice({
    groupId: sauceGroup.id,
    name: "Mild Curry Sauce",
    allergens: [allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 45, p: 1, c: 5, s: 2, f: 2, sat: 1, fib: 0.3, salt: 0.28 },
  });

  const gravy = await createChoice({
    groupId: sauceGroup.id,
    name: "Gravy",
    nutrition: { kcal: 25, p: 1, c: 3, s: 0.5, f: 1, sat: 0.2, fib: 0.1, salt: 0.35 },
  });

  const water = await createChoice({
    groupId: drinkGroup.id,
    name: "Water",
    nutrition: { kcal: 0, p: 0, c: 0, s: 0, f: 0, sat: 0, fib: 0, salt: 0 },
  });

  const orangeJuice = await createChoice({
    groupId: drinkGroup.id,
    name: "Orange Juice",
    nutrition: { kcal: 90, p: 1.5, c: 20, s: 18, f: 0, sat: 0, fib: 0.3, salt: 0.02 },
  });

  const milk = await createChoice({
    groupId: drinkGroup.id,
    name: "Milk",
    allergens: [allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 110, p: 6, c: 10, s: 10, f: 4.5, sat: 2.8, fib: 0, salt: 0.18 },
  });

  const rice = await createChoice({
    groupId: sideGroup.id,
    name: "Steamed Rice",
    nutrition: { kcal: 180, p: 4, c: 38, s: 0, f: 1, sat: 0.2, fib: 1.2, salt: 0.02 },
  });

  const roastPotatoes = await createChoice({
    groupId: sideGroup.id,
    name: "Roast Potatoes",
    nutrition: { kcal: 210, p: 4, c: 32, s: 1, f: 7, sat: 0.8, fib: 3.2, salt: 0.3 },
  });

  const chips = await createChoice({
    groupId: sideGroup.id,
    name: "Oven Chips",
    nutrition: { kcal: 230, p: 3, c: 33, s: 0.5, f: 9, sat: 1, fib: 3, salt: 0.4 },
  });

  const naan = await createChoice({
    groupId: sideGroup.id,
    name: "Naan Bread",
    allergens: [allergenByName.Gluten, allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 220, p: 6, c: 36, s: 3, f: 5, sat: 1.8, fib: 1.5, salt: 0.55 },
  });

  const peas = await createChoice({
    groupId: vegGroup.id,
    name: "Peas",
    nutrition: { kcal: 70, p: 5, c: 10, s: 4, f: 1, sat: 0.1, fib: 4.5, salt: 0.02 },
  });

  const sweetcorn = await createChoice({
    groupId: vegGroup.id,
    name: "Sweetcorn",
    nutrition: { kcal: 85, p: 3, c: 16, s: 6, f: 1.5, sat: 0.2, fib: 2.5, salt: 0.03 },
  });

  const mixedVeg = await createChoice({
    groupId: vegGroup.id,
    name: "Mixed Vegetables",
    nutrition: { kcal: 65, p: 3, c: 11, s: 5, f: 1, sat: 0.2, fib: 4, salt: 0.05 },
  });

  const salad = await createChoice({
    groupId: vegGroup.id,
    name: "Side Salad",
    nutrition: { kcal: 40, p: 2, c: 6, s: 3, f: 1, sat: 0.1, fib: 2, salt: 0.06 },
  });

  const chickenTikkaWrap = await createChoice({
    groupId: wrapFillingsGroup.id,
    name: "Chicken Tikka Wrap",
    allergens: [allergenByName.Gluten].filter(Boolean),
    nutrition: { kcal: 355, p: 21, c: 30, s: 3, f: 15, sat: 2.5, fib: 3, salt: 1.05 },
  });

  const falafelWrap = await createChoice({
    groupId: wrapFillingsGroup.id,
    name: "Falafel Wrap",
    allergens: [allergenByName.Gluten, allergenByName.Sesame].filter(Boolean),
    nutrition: { kcal: 340, p: 12, c: 36, s: 4, f: 14, sat: 1.8, fib: 6, salt: 0.9 },
  });

  const periPeriChickenWrap = await createChoice({
    groupId: wrapFillingsGroup.id,
    name: "Peri Peri Chicken Wrap",
    allergens: [allergenByName.Gluten].filter(Boolean),
    nutrition: { kcal: 360, p: 22, c: 31, s: 3, f: 15, sat: 2.6, fib: 3.2, salt: 1.1 },
  });

  return {
    allergenByName,
    groups: {
      soupGroup,
      sandwichTypeGroup,
      sauceGroup,
      drinkGroup,
      sideGroup,
      vegGroup,
      wrapFillingsGroup,
    },
    choices: {
      tomatoSoup,
      vegetableSoup,
      chickenNoodleSoup,
      chickenSandwich,
      hamSandwich,
      cheeseSandwich,
      tunaSandwich,
      ketchup,
      tomatoSauce,
      mildCurrySauce,
      gravy,
      water,
      orangeJuice,
      milk,
      rice,
      roastPotatoes,
      chips,
      naan,
      peas,
      sweetcorn,
      mixedVeg,
      salad,
      chickenTikkaWrap,
      falafelWrap,
      periPeriChickenWrap,
    },
  };
}

async function linkAllGroupsAndChoicesToMenu(menuId, mealData) {
  const allGroups = Object.values(mealData.groups);
  const allChoices = Object.values(mealData.choices);

  await prisma.menuMealGroup.createMany({
    data: allGroups.map((group) => ({
      menuId,
      groupId: group.id,
    })),
    skipDuplicates: true,
  });

  await prisma.menuMealChoice.createMany({
    data: allChoices.map((choice) => ({
      menuId,
      choiceId: choice.id,
    })),
    skipDuplicates: true,
  });
}

async function createGlobalMenus(mealData) {
  const standardMenu = await prisma.menu.create({
    data: {
      name: "Standard",
      active: true,
    },
  });

  const halalMenu = await prisma.menu.create({
    data: {
      name: "HALAL",
      active: true,
    },
  });

  await linkAllGroupsAndChoicesToMenu(standardMenu.id, mealData);
  await linkAllGroupsAndChoicesToMenu(halalMenu.id, mealData);

  const standardChickenCurry = await createMealOption({
    menuId: standardMenu.id,
    name: "Chicken Curry",
    stickerCount: 1,
    imageUrl: MENU_ITEM_IMAGES.standardChickenCurry,
    nutrition: MEAL_OPTION_NUTRITION.chickenCurry,
  });

  const standardPizzaSliceWithSide = await createMealOption({
    menuId: standardMenu.id,
    name: "Pizza Slice w/ Side",
    stickerCount: 1,
    imageUrl: MENU_ITEM_IMAGES.pizzaSliceWithSide,
    nutrition: MEAL_OPTION_NUTRITION.pizzaSliceWithSide,
  });

  const standardSoupSandwich = await createMealOption({
    menuId: standardMenu.id,
    name: "Soup + Sandwich",
    stickerCount: 2,
    imageUrl: MENU_ITEM_IMAGES.standardSoupSandwich,
    nutrition: MEAL_OPTION_NUTRITION.soupAndSandwich,
  });

  await prisma.mealOptionMealGroup.createMany({
    data: [
      {
        mealOptionId: standardChickenCurry.id,
        groupId: mealData.groups.sideGroup.id,
      },
      {
        mealOptionId: standardChickenCurry.id,
        groupId: mealData.groups.vegGroup.id,
      },
      {
        mealOptionId: standardPizzaSliceWithSide.id,
        groupId: mealData.groups.sauceGroup.id,
      },
      {
        mealOptionId: standardPizzaSliceWithSide.id,
        groupId: mealData.groups.sideGroup.id,
      },
      {
        mealOptionId: standardSoupSandwich.id,
        groupId: mealData.groups.soupGroup.id,
      },
      {
        mealOptionId: standardSoupSandwich.id,
        groupId: mealData.groups.sandwichTypeGroup.id,
      },
    ],
    skipDuplicates: true,
  });

  const halalChickenCurry = await createMealOption({
    menuId: halalMenu.id,
    name: "HALAL Chicken Curry",
    stickerCount: 1,
    imageUrl: MENU_ITEM_IMAGES.halalChickenCurry,
    nutrition: MEAL_OPTION_NUTRITION.halalChickenCurry,
  });

  const halalSoupSandwich = await createMealOption({
    menuId: halalMenu.id,
    name: "Soup + Sandwich",
    stickerCount: 2,
    imageUrl: MENU_ITEM_IMAGES.halalSoupSandwich,
    nutrition: MEAL_OPTION_NUTRITION.soupAndSandwich,
  });

  const halalWrap = await createMealOption({
    menuId: halalMenu.id,
    name: "Wrap",
    stickerCount: 1,
    imageUrl: MENU_ITEM_IMAGES.wrap,
    nutrition: MEAL_OPTION_NUTRITION.wrap,
  });

  await prisma.mealOptionMealGroup.createMany({
    data: [
      {
        mealOptionId: halalChickenCurry.id,
        groupId: mealData.groups.sideGroup.id,
      },
      {
        mealOptionId: halalChickenCurry.id,
        groupId: mealData.groups.sauceGroup.id,
      },
      {
        mealOptionId: halalSoupSandwich.id,
        groupId: mealData.groups.soupGroup.id,
      },
      {
        mealOptionId: halalSoupSandwich.id,
        groupId: mealData.groups.sandwichTypeGroup.id,
      },
      {
        mealOptionId: halalWrap.id,
        groupId: mealData.groups.wrapFillingsGroup.id,
      },
      {
        mealOptionId: halalWrap.id,
        groupId: mealData.groups.drinkGroup.id,
      },
    ],
    skipDuplicates: true,
  });

  return {
    standardMenu,
    halalMenu,
    standardMealOptions: {
      standardChickenCurry,
      standardPizzaSliceWithSide,
      standardSoupSandwich,
    },
    halalMealOptions: {
      halalChickenCurry,
      halalSoupSandwich,
      halalWrap,
    },
  };
}

async function main() {
  if (RESET_SEED_DATA) {
    await wipeSeedData();
  }

  console.log("🌱 Seeding...");

  const seededAt = new Date();

  const testParentUser = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: {
      name: TEST_NAME,
      role: UserRole.USER,
      hashedPassword: TEST_PASSWORD_HASH,
      emailVerified: seededAt,
      schoolId: null,
    },
    create: {
      email: TEST_USER_EMAIL,
      name: TEST_NAME,
      role: UserRole.USER,
      hashedPassword: TEST_PASSWORD_HASH,
      emailVerified: seededAt,
    },
  });

  const testAdminUser = await prisma.user.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    update: {
      name: TEST_NAME,
      role: UserRole.ADMIN,
      hashedPassword: TEST_PASSWORD_HASH,
      emailVerified: seededAt,
      schoolId: null,
    },
    create: {
      email: TEST_ADMIN_EMAIL,
      name: TEST_NAME,
      role: UserRole.ADMIN,
      hashedPassword: TEST_PASSWORD_HASH,
      emailVerified: seededAt,
    },
  });

  const mealData = await createBaseMealData();
  const globalMenus = await createGlobalMenus(mealData);

  const schools = [];
  let globalPupilIndex = 0;
  let assignedTestPupilCount = 0;
  let testSchoolId = null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const academicStartYear = now.getMonth() >= 7 ? currentYear : currentYear - 1;
  const academicEndYear = academicStartYear + 1;

  for (let i = 0; i < SCHOOL_COUNT; i++) {
    const school = await prisma.school.create({
      data: {
        name: SCHOOL_NAMES[i] || `Donegal School ${i + 1}`,
      },
    });

    await prisma.menuSchool.createMany({
      data: [
        { schoolId: school.id, menuId: globalMenus.standardMenu.id },
        { schoolId: school.id, menuId: globalMenus.halalMenu.id },
      ],
      skipDuplicates: true,
    });

    const schoolAdmin = await prisma.user.upsert({
      where: { email: schoolAdminEmail(i + 1) },
      update: {
        name: `School Admin ${i + 1}`,
        role: UserRole.USER,
        hashedPassword: TEST_PASSWORD_HASH,
        emailVerified: seededAt,
        schoolId: school.id,
      },
      create: {
        email: schoolAdminEmail(i + 1),
        name: `School Admin ${i + 1}`,
        role: UserRole.USER,
        hashedPassword: TEST_PASSWORD_HASH,
        emailVerified: seededAt,
        schoolId: school.id,
      },
      select: { id: true, email: true, name: true },
    });

    await prisma.schedule.createMany({
      data: [
        {
          name: `School Year ${academicStartYear}/${academicEndYear} - ${school.name}`,
          type: ScheduleType.TERM,
          startDate: dateYMD(academicStartYear, 9, 1),
          endDate: dateYMD(academicEndYear, 6, 30),
          schoolId: school.id,
        },
        {
          name: `Christmas ${academicEndYear - 1}/${academicEndYear} - ${school.name}`,
          type: ScheduleType.HOLIDAY,
          startDate: dateYMD(academicEndYear - 1, 12, 22),
          endDate: dateYMD(academicEndYear, 1, 2),
          schoolId: school.id,
        },
        {
          name: `Easter ${academicEndYear} - ${school.name}`,
          type: ScheduleType.HOLIDAY,
          startDate: dateYMD(academicEndYear, 3, 30),
          endDate: dateYMD(academicEndYear, 4, 10),
          schoolId: school.id,
        },
      ],
      skipDuplicates: true,
    });

    const classrooms = [];

    for (let j = 0; j < CLASSROOMS_PER_SCHOOL; j++) {
      const teacher = await prisma.user.upsert({
        where: { email: teacherEmail(i + 1, j + 1) },
        update: {
          name: `Teacher ${i + 1}-${j + 1}`,
          role: UserRole.USER,
          hashedPassword: TEST_PASSWORD_HASH,
          emailVerified: seededAt,
          schoolId: school.id,
        },
        create: {
          email: teacherEmail(i + 1, j + 1),
          name: `Teacher ${i + 1}-${j + 1}`,
          role: UserRole.USER,
          hashedPassword: TEST_PASSWORD_HASH,
          emailVerified: seededAt,
          schoolId: school.id,
        },
        select: { id: true, email: true, name: true },
      });

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

      const pupils = [];

      for (let k = 0; k < PUPILS_PER_CLASSROOM; k++) {
        globalPupilIndex++;

        const pupilName = makePupilName(globalPupilIndex - 1);
        const pupilLastName = pupilName.split(" ").slice(-1)[0];

        const useTestParent = assignedTestPupilCount < 2;

        const parent = useTestParent
          ? testParentUser
          : await prisma.user.create({
              data: {
                email: parentEmail(i + 1, j + 1, k + 1),
                name: makeParentName(globalPupilIndex - 1, pupilLastName),
                role: UserRole.USER,
                hashedPassword: TEST_PASSWORD_HASH,
                emailVerified: seededAt,
                schoolId: school.id,
              },
            });

        const allergies =
          globalPupilIndex % 11 === 0
            ? ["Gluten"]
            : globalPupilIndex % 7 === 0
            ? ["Dairy"]
            : globalPupilIndex % 13 === 0
            ? ["Egg"]
            : globalPupilIndex % 17 === 0
            ? ["Fish"]
            : [];

        const menuId =
          globalPupilIndex % 2 === 0
            ? globalMenus.standardMenu.id
            : globalMenus.halalMenu.id;

        const pupil = await prisma.pupil.create({
          data: {
            name: pupilName,
            status: PupilStatus.REGISTERED,
            classroomId: classroom.id,
            parentId: parent.id,
            menuId,
            allergies,
          },
        });

        if (useTestParent) {
          assignedTestPupilCount++;
          testSchoolId = school.id;
        }

        pupils.push({
          pupil,
          parent,
          menuId,
        });
      }

      await prisma.classroom.update({
        where: { id: classroom.id },
        data: { totalPupils: pupils.length },
      });

      classrooms.push({
        classroom,
        teacher,
        pupils,
      });
    }

    schools.push({
      school,
      schoolAdmin,
      classrooms,
    });
  }

  if (testSchoolId) {
    await prisma.user.updateMany({
      where: {
        email: {
          in: [TEST_USER_EMAIL, TEST_ADMIN_EMAIL],
        },
      },
      data: {
        schoolId: testSchoolId,
      },
    });
  }

  console.log("🍱 Creating populated orders for the next 7 days...");

  const nextDays = nextSevenDays(new Date());
  const c = mealData.choices;

  const standardPlans = [
    {
      mealOptionId: globalMenus.standardMealOptions.standardChickenCurry.id,
      buildItems: () => [
        pickOne([c.rice, c.roastPotatoes, c.chips, c.naan]),
        pickOne([c.peas, c.sweetcorn, c.mixedVeg, c.salad]),
      ],
    },
    {
      mealOptionId: globalMenus.standardMealOptions.standardPizzaSliceWithSide.id,
      buildItems: () => [
        pickOne([c.ketchup, c.tomatoSauce, c.gravy, c.mildCurrySauce]),
        pickOne([c.rice, c.roastPotatoes, c.chips, c.naan]),
      ],
    },
    {
      mealOptionId: globalMenus.standardMealOptions.standardSoupSandwich.id,
      buildItems: () => [
        pickOne([c.tomatoSoup, c.vegetableSoup, c.chickenNoodleSoup]),
        pickOne([c.chickenSandwich, c.hamSandwich, c.cheeseSandwich, c.tunaSandwich]),
      ],
    },
  ];

  const halalPlans = [
    {
      mealOptionId: globalMenus.halalMealOptions.halalChickenCurry.id,
      buildItems: () => [
        pickOne([c.rice, c.roastPotatoes, c.chips, c.naan]),
        pickOne([c.tomatoSauce, c.mildCurrySauce, c.gravy, c.ketchup]),
      ],
    },
    {
      mealOptionId: globalMenus.halalMealOptions.halalSoupSandwich.id,
      buildItems: () => [
        pickOne([c.tomatoSoup, c.vegetableSoup, c.chickenNoodleSoup]),
        pickOne([c.chickenSandwich, c.cheeseSandwich]),
      ],
    },
    {
      mealOptionId: globalMenus.halalMealOptions.halalWrap.id,
      buildItems: () => [
        pickOne([c.chickenTikkaWrap, c.falafelWrap, c.periPeriChickenWrap]),
        pickOne([c.water, c.orangeJuice, c.milk]),
      ],
    },
  ];

  for (const schoolEntry of schools) {
    for (const classEntry of schoolEntry.classrooms) {
      for (const pupilEntry of classEntry.pupils) {
        const plans =
          pupilEntry.menuId === globalMenus.halalMenu.id ? halalPlans : standardPlans;

        for (const date of nextDays) {
          const plan = pickOne(plans);
          const selectedChoices = plan.buildItems();

          await prisma.lunchOrder.upsert({
            where: {
              pupilId_date: {
                pupilId: pupilEntry.pupil.id,
                date,
              },
            },
            update: {
              mealOptionId: plan.mealOptionId,
              items: {
                deleteMany: {},
                create: selectedChoices.map((choice) => ({
                  choiceId: choice.id,
                  selectedIngredients: [],
                })),
              },
            },
            create: {
              pupilId: pupilEntry.pupil.id,
              date,
              mealOptionId: plan.mealOptionId,
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
    }
  }

  const totalClassrooms = SCHOOL_COUNT * CLASSROOMS_PER_SCHOOL;
  const totalPupils = SCHOOL_COUNT * CLASSROOMS_PER_SCHOOL * PUPILS_PER_CLASSROOM;

  console.log("✅ Seed completed");
  console.log(`   Schools: ${SCHOOL_COUNT}`);
  console.log(`   Classrooms: ${totalClassrooms}`);
  console.log(`   Pupils: ${totalPupils}`);
  console.log(`   Orders created for dates: ${nextDays.map((d) => d.toDateString()).join(", ")}`);
  console.log(`   Global menus: 2 (Standard + HALAL)`);
  console.log(`   Meal options per menu: 3`);
  console.log(`   Meal groups per option: 2`);
  console.log(`   Test parent: ${TEST_USER_EMAIL}`);
  console.log(`   Test admin: ${TEST_ADMIN_EMAIL}`);
  console.log(`   Test parent pupils assigned: ${assignedTestPupilCount}`);
  console.log(`   Test school linked: ${testSchoolId || "n/a"}`);
  console.log(`   Example school admin: ${schools[0]?.schoolAdmin.email || "n/a"}`);
  console.log(`   Example teacher: ${schools[0]?.classrooms[0]?.teacher.email || "n/a"}`);
  console.log(`   Example parent: ${schools[0]?.classrooms[0]?.pupils[0]?.parent.email || "n/a"}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });