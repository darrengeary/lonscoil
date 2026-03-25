-- AlterTable
ALTER TABLE "LunchOrder" ADD COLUMN     "mealOptionId" TEXT;

-- AlterTable
ALTER TABLE "MealOption" ADD COLUMN     "availEnd" TIMESTAMP(3),
ADD COLUMN     "availStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PupilMealWeekPattern" (
    "id" TEXT NOT NULL,
    "pupilId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "mealOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PupilMealWeekPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PupilMealWeekPatternItem" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    "selectedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PupilMealWeekPatternItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PupilMealWeekPattern_pupilId_weekday_idx" ON "PupilMealWeekPattern"("pupilId", "weekday");

-- CreateIndex
CREATE INDEX "PupilMealWeekPattern_mealOptionId_idx" ON "PupilMealWeekPattern"("mealOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PupilMealWeekPattern_pupilId_weekday_key" ON "PupilMealWeekPattern"("pupilId", "weekday");

-- CreateIndex
CREATE INDEX "PupilMealWeekPatternItem_patternId_idx" ON "PupilMealWeekPatternItem"("patternId");

-- CreateIndex
CREATE INDEX "PupilMealWeekPatternItem_choiceId_idx" ON "PupilMealWeekPatternItem"("choiceId");

-- CreateIndex
CREATE INDEX "LunchOrder_mealOptionId_idx" ON "LunchOrder"("mealOptionId");

-- CreateIndex
CREATE INDEX "MealChoice_groupId_active_idx" ON "MealChoice"("groupId", "active");

-- CreateIndex
CREATE INDEX "MealChoice_availStart_availEnd_idx" ON "MealChoice"("availStart", "availEnd");

-- CreateIndex
CREATE INDEX "MealOption_menuId_active_idx" ON "MealOption"("menuId", "active");

-- CreateIndex
CREATE INDEX "MealOption_availStart_availEnd_idx" ON "MealOption"("availStart", "availEnd");

-- AddForeignKey
ALTER TABLE "LunchOrder" ADD CONSTRAINT "LunchOrder_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "MealOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PupilMealWeekPattern" ADD CONSTRAINT "PupilMealWeekPattern_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "Pupil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PupilMealWeekPattern" ADD CONSTRAINT "PupilMealWeekPattern_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "MealOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PupilMealWeekPatternItem" ADD CONSTRAINT "PupilMealWeekPatternItem_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "PupilMealWeekPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PupilMealWeekPatternItem" ADD CONSTRAINT "PupilMealWeekPatternItem_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "MealChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
