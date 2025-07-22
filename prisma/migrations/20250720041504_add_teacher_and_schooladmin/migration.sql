/*
  Warnings:

  - You are about to drop the column `active` on the `Schedule` table. All the data in the column will be lost.
  - Added the required column `type` to the `Schedule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('TERM', 'HOLIDAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SCHOOLADMIN';
ALTER TYPE "UserRole" ADD VALUE 'TEACHER';

-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "active",
ADD COLUMN     "type" "ScheduleType" NOT NULL;
