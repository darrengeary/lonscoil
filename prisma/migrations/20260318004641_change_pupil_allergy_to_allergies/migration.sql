/*
  Warnings:

  - You are about to drop the column `allergy` on the `Pupil` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pupil" DROP COLUMN "allergy",
ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[];
