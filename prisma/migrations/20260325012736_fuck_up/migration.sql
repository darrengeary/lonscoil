/*
  Warnings:

  - You are about to drop the column `availEnd` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `availStart` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `caloriesKcal` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `carbsG` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `fatG` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `fibreG` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `proteinG` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `saltG` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `saturatesG` on the `MealOption` table. All the data in the column will be lost.
  - You are about to drop the column `sugarsG` on the `MealOption` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "MealOption" DROP CONSTRAINT "MealOption_menuId_fkey";

-- DropIndex
DROP INDEX "MealOption_menuId_idx";

-- AlterTable
ALTER TABLE "MealGroup" ALTER COLUMN "maxSelections" DROP DEFAULT,
ALTER COLUMN "active" SET DEFAULT true;

-- AlterTable
ALTER TABLE "MealOption" DROP COLUMN "availEnd",
DROP COLUMN "availStart",
DROP COLUMN "caloriesKcal",
DROP COLUMN "carbsG",
DROP COLUMN "fatG",
DROP COLUMN "fibreG",
DROP COLUMN "proteinG",
DROP COLUMN "saltG",
DROP COLUMN "saturatesG",
DROP COLUMN "sugarsG",
ALTER COLUMN "active" SET DEFAULT true;

-- AddForeignKey
ALTER TABLE "MealOption" ADD CONSTRAINT "MealOption_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
