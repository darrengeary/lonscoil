/*
  Warnings:

  - Added the required column `schoolName` to the `PrintJobItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PrintJobItem" ADD COLUMN     "schoolName" TEXT NOT NULL;
