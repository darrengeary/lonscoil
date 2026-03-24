-- CreateTable
CREATE TABLE "MealOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "stickerCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealOptionMealGroup" (
    "id" TEXT NOT NULL,
    "mealOptionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "MealOptionMealGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealOption_menuId_idx" ON "MealOption"("menuId");

-- CreateIndex
CREATE INDEX "MealOptionMealGroup_mealOptionId_idx" ON "MealOptionMealGroup"("mealOptionId");

-- CreateIndex
CREATE INDEX "MealOptionMealGroup_groupId_idx" ON "MealOptionMealGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "MealOptionMealGroup_mealOptionId_groupId_key" ON "MealOptionMealGroup"("mealOptionId", "groupId");

-- AddForeignKey
ALTER TABLE "MealOption" ADD CONSTRAINT "MealOption_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOptionMealGroup" ADD CONSTRAINT "MealOptionMealGroup_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "MealOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOptionMealGroup" ADD CONSTRAINT "MealOptionMealGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MealGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
