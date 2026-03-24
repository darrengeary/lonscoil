-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "LunchOrder_pupilId_date_idx" ON "LunchOrder"("pupilId", "date");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_choiceId_idx" ON "OrderItem"("choiceId");

-- CreateIndex
CREATE INDEX "Pupil_classroomId_name_idx" ON "Pupil"("classroomId", "name");
