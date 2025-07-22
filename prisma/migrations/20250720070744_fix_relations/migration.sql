/*
  Warnings:

  - You are about to drop the column `adminId` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `School` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "School" DROP CONSTRAINT "School_adminId_fkey";

-- DropIndex
DROP INDEX "School_adminId_key";

-- AlterTable
ALTER TABLE "MealChoice" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Pupil" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "School" DROP COLUMN "adminId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "school_id" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
