-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('CREATED', 'PRINTING', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT,
    "classroomId" TEXT,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'CREATED',
    "nextSeq" INTEGER NOT NULL DEFAULT 1,
    "totalLabels" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "pupilId" TEXT NOT NULL,
    "pupilName" TEXT NOT NULL,
    "classroom" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "extras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "printedAt" TIMESTAMP(3),
    "printError" TEXT,

    CONSTRAINT "PrintJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintJob_date_idx" ON "PrintJob"("date");

-- CreateIndex
CREATE INDEX "PrintJob_status_idx" ON "PrintJob"("status");

-- CreateIndex
CREATE INDEX "PrintJobItem_jobId_seq_idx" ON "PrintJobItem"("jobId", "seq");

-- CreateIndex
CREATE INDEX "PrintJobItem_pupilId_idx" ON "PrintJobItem"("pupilId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJobItem_jobId_seq_key" ON "PrintJobItem"("jobId", "seq");

-- AddForeignKey
ALTER TABLE "PrintJobItem" ADD CONSTRAINT "PrintJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PrintJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
