/*
  Warnings:

  - The `status` column on the `Pupil` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PupilStatus" AS ENUM ('REGISTERED', 'UNREGISTERED');

-- AlterTable
ALTER TABLE "Pupil" DROP COLUMN "status",
ADD COLUMN     "status" "PupilStatus" NOT NULL DEFAULT 'UNREGISTERED';
