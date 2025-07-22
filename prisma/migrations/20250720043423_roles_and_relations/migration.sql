/*
  Warnings:

  - A unique constraint covering the columns `[adminId]` on the table `School` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `adminId` to the `School` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "teacherId" TEXT;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "adminId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "School_adminId_key" ON "School"("adminId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
