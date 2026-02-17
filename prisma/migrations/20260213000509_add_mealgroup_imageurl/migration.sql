/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `MealGroup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MealChoice" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "MealGroup" DROP COLUMN "imageUrl";
