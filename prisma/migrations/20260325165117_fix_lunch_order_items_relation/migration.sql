/*
  Warnings:

  - You are about to drop the column `createdAt` on the `LunchOrder` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `LunchOrder` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "LunchOrder" DROP CONSTRAINT "LunchOrder_pupilId_fkey";

-- DropIndex
DROP INDEX "LunchOrder_mealOptionId_idx";

-- DropIndex
DROP INDEX "LunchOrder_pupilId_date_idx";

-- AlterTable
ALTER TABLE "LunchOrder" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- AddForeignKey
ALTER TABLE "LunchOrder" ADD CONSTRAINT "LunchOrder_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "Pupil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
