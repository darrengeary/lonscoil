/*
  Warnings:

  - You are about to drop the column `teacherId` on the `Classroom` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Classroom" DROP CONSTRAINT "Classroom_teacherId_fkey";

-- AlterTable
ALTER TABLE "Classroom" DROP COLUMN "teacherId";

-- CreateTable
CREATE TABLE "_TeachersClassrooms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TeachersClassrooms_AB_unique" ON "_TeachersClassrooms"("A", "B");

-- CreateIndex
CREATE INDEX "_TeachersClassrooms_B_index" ON "_TeachersClassrooms"("B");

-- AddForeignKey
ALTER TABLE "_TeachersClassrooms" ADD CONSTRAINT "_TeachersClassrooms_A_fkey" FOREIGN KEY ("A") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeachersClassrooms" ADD CONSTRAINT "_TeachersClassrooms_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
