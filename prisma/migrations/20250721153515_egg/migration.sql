/*
  Warnings:

  - A unique constraint covering the columns `[pupilId,date]` on the table `LunchOrder` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LunchOrder_pupilId_date_key" ON "LunchOrder"("pupilId", "date");
