-- CreateEnum
CREATE TYPE "AbsenceScope" AS ENUM ('PUPIL', 'CLASSROOM');

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "AbsenceScope" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classroomId" TEXT,
    "pupilId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Absence_schoolId_startDate_idx" ON "Absence"("schoolId", "startDate");

-- CreateIndex
CREATE INDEX "Absence_classroomId_startDate_idx" ON "Absence"("classroomId", "startDate");

-- CreateIndex
CREATE INDEX "Absence_pupilId_startDate_idx" ON "Absence"("pupilId", "startDate");

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "Pupil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
