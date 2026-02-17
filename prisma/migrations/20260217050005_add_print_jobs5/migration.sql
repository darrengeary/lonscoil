-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "PrintJob_createdById_idx" ON "PrintJob"("createdById");

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
