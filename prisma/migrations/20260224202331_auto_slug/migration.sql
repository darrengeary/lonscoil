/*
  Warnings:

  - You are about to drop the column `schoolId` on the `Menu` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Menu` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Menu" DROP CONSTRAINT "Menu_schoolId_fkey";

-- DropIndex
DROP INDEX "Menu_schoolId_name_key";

-- AlterTable
ALTER TABLE "Menu" DROP COLUMN "schoolId";

-- CreateTable
CREATE TABLE "MenuSchool" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "MenuSchool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuSchool_menuId_idx" ON "MenuSchool"("menuId");

-- CreateIndex
CREATE INDEX "MenuSchool_schoolId_idx" ON "MenuSchool"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuSchool_menuId_schoolId_key" ON "MenuSchool"("menuId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_name_key" ON "Menu"("name");

-- AddForeignKey
ALTER TABLE "MenuSchool" ADD CONSTRAINT "MenuSchool_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuSchool" ADD CONSTRAINT "MenuSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
