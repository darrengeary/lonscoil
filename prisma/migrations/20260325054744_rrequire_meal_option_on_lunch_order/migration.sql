/*
  Warnings:

  - Made the column `mealOptionId` on table `LunchOrder` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "LunchOrder" DROP CONSTRAINT "LunchOrder_mealOptionId_fkey";

-- AlterTable
ALTER TABLE "LunchOrder" ALTER COLUMN "mealOptionId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "LunchOrder" ADD CONSTRAINT "LunchOrder_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "MealOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
