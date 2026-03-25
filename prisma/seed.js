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

const SCHOOL_NAMES = [
  "Scoil Bhríde, Ranelagh",
  "St. Patrick's Boys National School, Drumcondra",
  "Scoil Mhuire Girls National School, Marino",
  "Gaelscoil Dara, Bray",
  "St. Joseph's National School, Tullamore",
  "Scoil Naomh Treasa, Mount Merrion",
  "St. Columba's National School, Douglas",
  "Scoil Íde, Corbally",
  "Our Lady of Lourdes National School, Inchicore",
  "St. Mary's National School, Navan",
];

const CLASSROOM_NAMES = [
  "Junior Infants",
  "Senior Infants",
  "1st Class",
  "2nd Class",
];

const PUPIL_FIRST_NAMES = [
  "Oisín",
  "Tadhg",
  "Cillian",
  "Rían",
  "Darragh",
  "Conor",
  "Seán",
  "Pádraig",
  "Fionn",
  "Eoghan",
  "Aoife",
  "Saoirse",
  "Clodagh",
  "Niamh",
  "Éabha",
  "Fiadh",
  "Orlaith",
  "Caoimhe",
  "Róisín",
  "Aisling",
  "Lorcan",
  "Diarmuid",
  "Tomás",
  "Odhrán",
  "Croía",
  "Molly",
  "Ella",
  "Cara",
  "Holly",
  "Meabh",
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
  "O'Sullivan",
  "Maguire",
  "McGrath",
  "Kavanagh",
  "Brennan",
  "Hogan",
  "Meehan",
  "Donnelly",
];

const PARENT_FIRST_NAMES = [
  "Aoife",
  "Niamh",
  "Sinéad",
  "Gráinne",
  "Deirdre",
  "Ciara",
  "Aisling",
  "Orla",
  "Maeve",
  "Clare",
  "John",
  "Michael",
  "Patrick",
  "Declan",
  "Seamus",
  "Brendan",
  "Eoin",
  "Cathal",
  "Colm",
  "Brian",
];

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

function pickSome(arr, minCount, maxCount) {
  const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
  const pool = [...arr];
  const out = [];

  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }

  return out;
}

function makePupilName(index) {
  const first = PUPIL_FIRST_NAMES[index % PUPIL_FIRST_NAMES.length];
  const last =
    PUPIL_LAST_NAMES[Math.floor(index / PUPIL_FIRST_NAMES.length) % PUPIL_LAST_NAMES.length];
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

  // Meal groups
  const sideGroup = await prisma.mealGroup.create({
    data: { name: "Side", maxSelections: 1, active: true },
  });

  const vegGroup = await prisma.mealGroup.create({
    data: { name: "Veg", maxSelections: 1, active: true },
  });

  const drinkGroup = await prisma.mealGroup.create({
    data: { name: "Drink", maxSelections: 1, active: true },
  });

  const dessertGroup = await prisma.mealGroup.create({
    data: { name: "Dessert", maxSelections: 1, active: true },
  });

  const soupGroup = await prisma.mealGroup.create({
    data: { name: "Soup", maxSelections: 1, active: true },
  });

  const sandwichTypeGroup = await prisma.mealGroup.create({
    data: { name: "Sandwich Type", maxSelections: 1, active: true },
  });

  const sandwichCondimentGroup = await prisma.mealGroup.create({
    data: { name: "Sandwich Condiment", maxSelections: 1, active: true },
  });

  const wrapFillingsGroup = await prisma.mealGroup.create({
    data: { name: "Wrap Filling", maxSelections: 1, active: true },
  });

  const sauceGroup = await prisma.mealGroup.create({
    data: { name: "Sauce", maxSelections: 1, active: true },
  });

  // Choices
  const rice = await createChoice({
    groupId: sideGroup.id,
    name: "Steamed Rice",
    nutrition: { kcal: 180, p: 4, c: 38, s: 0, f: 1, sat: 0.2, fib: 1.2, salt: 0.02 },
  });

  const naan = await createChoice({
    groupId: sideGroup.id,
    name: "Naan Bread",
    allergens: [allergenByName.Gluten, allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 220, p: 6, c: 36, s: 3, f: 5, sat: 1.8, fib: 1.5, salt: 0.55 },
  });

  const roastPotatoes = await createChoice({
    groupId: sideGroup.id,
    name: "Roast Potatoes",
    nutrition: { kcal: 210, p: 4, c: 32, s: 1, f: 7, sat: 0.8, fib: 3.2, salt: 0.3 },
  });

  const pastaTwists = await createChoice({
    groupId: sideGroup.id,
    name: "Pasta Twists",
    allergens: [allergenByName.Gluten].filter(Boolean),
    nutrition: { kcal: 240, p: 8, c: 44, s: 2, f: 3, sat: 0.6, fib: 2.4, salt: 0.08 },
  });

  const chips = await createChoice({
    groupId: sideGroup.id,
    name: "Oven Chips",
    nutrition: { kcal: 230, p: 3, c: 33, s: 0.5, f: 9, sat: 1, fib: 3, salt: 0.4 },
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

  const fruitPot = await createChoice({
    groupId: dessertGroup.id,
    name: "Fruit Pot",
    nutrition: { kcal: 120, p: 1.5, c: 28, s: 22, f: 0.5, sat: 0.1, fib: 4, salt: 0.02 },
  });

  const yoghurt = await createChoice({
    groupId: dessertGroup.id,
    name: "Yoghurt",
    allergens: [allergenByName.Dairy].filter(Boolean),
    nutrition: { kcal: 160, p: 8, c: 18, s: 16, f: 6, sat: 3.5, fib: 0, salt: 0.15 },
  });

  const flapjack = await createChoice({
    groupId: dessertGroup.id,
    name: "Oat Flapjack",
    allergens: [allergenByName.Gluten].filter(Boolean),
    nutrition: { kcal: 190, p: 4, c: 26, s: 11, f: 8, sat: 2, fib: 3, salt: 0.25 },
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

  const mayo = await createChoice({
    groupId: sandwichCondimentGroup.id,
    name: "Mayo",
    allergens: [allergenByName.Egg].filter(Boolean),
    nutrition: { kcal: 80, p: 0, c: 0.5, s: 0, f: 8, sat: 1.2, fib: 0, salt: 0.2 },
  });

  const ketchup = await createChoice({
    groupId: sandwichCondimentGroup.id,
    name: "Ketchup",
    nutrition: { kcal: 20, p: 0, c: 5, s: 4, f: 0, sat: 0, fib: 0.1, salt: 0.18 },
  });

  const noSauce = await createChoice({
    groupId: sandwichCondimentGroup.id,
    name: "No Sauce",
    nutrition: { kcal: 0, p: 0, c: 0, s: 0, f: 0, sat: 0, fib: 0, salt: 0 },
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

  return {
    allergenByName,
    groups: {
      sideGroup,
      vegGroup,
      drinkGroup,
      dessertGroup,
      soupGroup,
      sandwichTypeGroup,
      sandwichCondimentGroup,
      wrapFillingsGroup,
      sauceGroup,
    },
    choices: {
      rice,
      naan,
      roastPotatoes,
      pastaTwists,
      chips,
      peas,
      sweetcorn,
      mixedVeg,
      salad,
      water,
      orangeJuice,
      milk,
      fruitPot,
      yoghurt,
      flapjack,
      tomatoSoup,
      vegetableSoup,
      chickenNoodleSoup,
      chickenSandwich,
      hamSandwich,
      cheeseSandwich,
      tunaSandwich,
      mayo,
      ketchup,
      noSauce,
      chickenTikkaWrap,
      falafelWrap,
      periPeriChickenWrap,
      tomatoSauce,
      mildCurrySauce,
      gravy,
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

async function createMenusForSchool(schoolId, schoolName, mealData) {
  const standardMenu = await prisma.menu.create({
    data: {
      name: `${schoolName} Standard Menu`,
      active: true,
      schoolLinks: {
        create: [{ schoolId }],
      },
    },
  });

  const halalMenu = await prisma.menu.create({
    data: {
      name: `${schoolName} Halal Menu`,
      active: true,
      schoolLinks: {
        create: [{ schoolId }],
      },
    },
  });

  await linkAllGroupsAndChoicesToMenu(standardMenu.id, mealData);
  await linkAllGroupsAndChoicesToMenu(halalMenu.id, mealData);

  // Standard menu: 4 meal options
  const standardChickenCurry = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Chicken Curry",
      stickerCount: 1,
      active: true,
    },
  });

  const standardPastaBolognese = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Pasta Bolognese",
      stickerCount: 1,
      active: true,
    },
  });

  const standardSausageAndChips = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Sausage & Chips",
      stickerCount: 1,
      active: true,
    },
  });

  const standardSoupAndSandwich = await prisma.mealOption.create({
    data: {
      menuId: standardMenu.id,
      name: "Soup + Sandwich + Condiment",
      stickerCount: 2,
      active: true,
    },
  });

  await prisma.mealOptionMealGroup.createMany({
    data: [
      { mealOptionId: standardChickenCurry.id, groupId: mealData.groups.sideGroup.id },
      { mealOptionId: standardChickenCurry.id, groupId: mealData.groups.vegGroup.id },
      { mealOptionId: standardChickenCurry.id, groupId: mealData.groups.drinkGroup.id },
      { mealOptionId: standardChickenCurry.id, groupId: mealData.groups.dessertGroup.id },

      { mealOptionId: standardPastaBolognese.id, groupId: mealData.groups.vegGroup.id },
      { mealOptionId: standardPastaBolognese.id, groupId: mealData.groups.drinkGroup.id },
      { mealOptionId: standardPastaBolognese.id, groupId: mealData.groups.dessertGroup.id },

      { mealOptionId: standardSausageAndChips.id, groupId: mealData.groups.sauceGroup.id },
      { mealOptionId: standardSausageAndChips.id, groupId: mealData.groups.drinkGroup.id },
      { mealOptionId: standardSausageAndChips.id, groupId: mealData.groups.dessertGroup.id },

      { mealOptionId: standardSoupAndSandwich.id, groupId: mealData.groups.soupGroup.id },
      { mealOptionId: standardSoupAndSandwich.id, groupId: mealData.groups.sandwichTypeGroup.id },
      { mealOptionId: standardSoupAndSandwich.id, groupId: mealData.groups.sandwichCondimentGroup.id },
      { mealOptionId: standardSoupAndSandwich.id, groupId: mealData.groups.drinkGroup.id },
    ],
    skipDuplicates: true,
  });

  // Halal menu: 4 meal options
  const halalChickenCurry = await prisma.mealOption.create({
    data: {
      menuId: halalMenu.id,
      name: "Halal Chicken Curry",
      stickerCount: 1,
      active: true,
    },
  });

  const halalChickenMeatballs = await prisma.mealOption.create({
    data: {
      menuId: halalMenu.id,
      name: "Halal Chicken Meatballs",
      stickerCount: 1,
      active: true,
    },
  });

  const halalWrapBox = await prisma.mealOption.create({
    data: {
      menuId: halalMenu.id,
      name: "Wrap Box",
      stickerCount: 1,
      active: true,
    },
  });

  const halalSoupAndSandwich = await prisma.mealOption.create({
    data: {
      menuId: halalMenu.id,
      name: "Halal Soup + Sandwich + Condiment",
      stickerCount: 2,
      active: true,
    },
  });

  await prisma.mealOptionMealGroup.createMany({
    data: [
      { mealOptionId: halalChickenCurry.id, groupId: mealData.groups.sideGroup.id },
      { mealOptionId: halalChickenCurry.id, groupId: mealData.groups.vegGroup.id },
      { mealOptionId: halalChickenCurry.id, groupId: mealData.groups.drinkGroup.id },
      { mealOptionId: halalChickenCurry.id, groupId: mealData.groups.dessertGroup.id },

      { mealOptionId: halalChickenMeatballs.id, groupId: mealData.groups.sideGroup.id },
      { mealOptionId: halalChickenMeatballs.id, groupId: mealData.groups.vegGroup.id },
      { mealOptionId: halalChickenMeatballs.id, groupId: mealData.groups.drinkGroup.id },
      { mealOptionId: halalChickenMeatballs.id, groupId: mealData.groups.dessertGroup.id },

      { mealOptionId: halalWrapBox.id, groupId: mealData.groups.wrapFillingsGroup.id },
      { mealOptionId: halalWrapBox.id, groupId: mealData.groups.sideGroup.id },
      { mealOptionId: halalWrapBox.id, groupId: mealData.groups.drinkGroup.id },
      { mealOptionId: halalWrapBox.id, groupId: mealData.groups.dessertGroup.id },

      { mealOptionId: halalSoupAndSandwich.id, groupId: mealData.groups.soupGroup.id },
      { mealOptionId: halalSoupAndSandwich.id, groupId: mealData.groups.sandwichTypeGroup.id },
      { mealOptionId: halalSoupAndSandwich.id, groupId: mealData.groups.sandwichCondimentGroup.id },
      { mealOptionId: halalSoupAndSandwich.id, groupId: mealData.groups.drinkGroup.id },
    ],
    skipDuplicates: true,
  });

  return {
    standardMenu,
    halalMenu,
    standardMealOptions: {
      standardChickenCurry,
      standardPastaBolognese,
      standardSausageAndChips,
      standardSoupAndSandwich,
    },
    halalMealOptions: {
      halalChickenCurry,
      halalChickenMeatballs,
      halalWrapBox,
      halalSoupAndSandwich,
    },
  };
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

  const mealData = await createBaseMealData();

  const schools = [];
  let globalPupilIndex = 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const academicStartYear = now.getMonth() >= 7 ? currentYear : currentYear - 1;
  const academicEndYear = academicStartYear + 1;

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

    const menuBundle = await createMenusForSchool(school.id, school.name, mealData);

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
          role: UserRole.TEACHER,
        },
        create: {
          email: teacherEmail(i + 1, j + 1),
          name: `Teacher ${i + 1}-${j + 1}`,
          role: UserRole.TEACHER,
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
        const parent = await prisma.user.create({
          data: {
            email: parentEmail(i + 1, j + 1, k + 1),
            name: makeParentName(globalPupilIndex - 1, pupilLastName),
            role: UserRole.USER,
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
          globalPupilIndex % 2 === 0 ? menuBundle.standardMenu.id : menuBundle.halalMenu.id;

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
      menus: {
        standardMenu: menuBundle.standardMenu,
        halalMenu: menuBundle.halalMenu,
      },
      mealOptions: {
        ...menuBundle.standardMealOptions,
        ...menuBundle.halalMealOptions,
      },
      classrooms,
    });
  }

  console.log("🍱 Creating populated orders for the next 7 days...");

  const nextDays = nextSevenDays(new Date());
  const c = mealData.choices;

  for (const schoolEntry of schools) {
    const standardPlans = [
      {
        mealOptionId: schoolEntry.mealOptions.standardChickenCurry.id,
        buildItems: () => [
          pickOne([c.rice, c.naan]),
          pickOne([c.peas, c.sweetcorn, c.mixedVeg]),
          pickOne([c.water, c.orangeJuice, c.milk]),
          pickOne([c.fruitPot, c.yoghurt, c.flapjack]),
        ],
      },
      {
        mealOptionId: schoolEntry.mealOptions.standardPastaBolognese.id,
        buildItems: () => [
          pickOne([c.peas, c.sweetcorn, c.mixedVeg, c.salad]),
          pickOne([c.water, c.orangeJuice, c.milk]),
          pickOne([c.fruitPot, c.yoghurt, c.flapjack]),
        ],
      },
      {
        mealOptionId: schoolEntry.mealOptions.standardSausageAndChips.id,
        buildItems: () => [
          pickOne([c.ketchup, c.tomatoSauce, c.gravy]),
          pickOne([c.water, c.orangeJuice, c.milk]),
          pickOne([c.fruitPot, c.yoghurt, c.flapjack]),
        ],
      },
      {
        mealOptionId: schoolEntry.mealOptions.standardSoupAndSandwich.id,
        buildItems: () => [
          pickOne([c.tomatoSoup, c.vegetableSoup, c.chickenNoodleSoup]),
          pickOne([c.chickenSandwich, c.hamSandwich, c.cheeseSandwich, c.tunaSandwich]),
          pickOne([c.mayo, c.ketchup, c.noSauce]),
          pickOne([c.water, c.orangeJuice, c.milk]),
        ],
      },
    ];

    const halalPlans = [
      {
        mealOptionId: schoolEntry.mealOptions.halalChickenCurry.id,
        buildItems: () => [
          pickOne([c.rice, c.naan]),
          pickOne([c.peas, c.sweetcorn, c.mixedVeg]),
          pickOne([c.water, c.orangeJuice, c.milk]),
          pickOne([c.fruitPot, c.yoghurt, c.flapjack]),
        ],
      },
      {
        mealOptionId: schoolEntry.mealOptions.halalChickenMeatballs.id,
        buildItems: () => [
          pickOne([c.pastaTwists, c.roastPotatoes]),
          pickOne([c.peas, c.sweetcorn, c.mixedVeg, c.salad]),
          pickOne([c.water, c.orangeJuice, c.milk]),
          pickOne([c.fruitPot, c.yoghurt, c.flapjack]),
        ],
      },
      {
        mealOptionId: schoolEntry.mealOptions.halalWrapBox.id,
        buildItems: () => [
          pickOne([c.chickenTikkaWrap, c.falafelWrap, c.periPeriChickenWrap]),
          pickOne([c.chips, c.roastPotatoes, c.salad]),
          pickOne([c.water, c.orangeJuice, c.milk]),
          pickOne([c.fruitPot, c.yoghurt, c.flapjack]),
        ],
      },
      {
        mealOptionId: schoolEntry.mealOptions.halalSoupAndSandwich.id,
        buildItems: () => [
          pickOne([c.tomatoSoup, c.vegetableSoup, c.chickenNoodleSoup]),
          // keep halal-safe sandwich choices here
          pickOne([c.chickenSandwich, c.cheeseSandwich]),
          pickOne([c.mayo, c.ketchup, c.noSauce]),
          pickOne([c.water, c.orangeJuice, c.milk]),
        ],
      },
    ];

    for (const classEntry of schoolEntry.classrooms) {
      for (const pupilEntry of classEntry.pupils) {
        const plans =
          pupilEntry.menuId === schoolEntry.menus.halalMenu.id ? halalPlans : standardPlans;

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
  console.log(`   Menus per school: 2 (Standard + Halal)`);
  console.log(`   Meal options per menu: 4`);
  console.log(`   Site admin: admin@school.io`);
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