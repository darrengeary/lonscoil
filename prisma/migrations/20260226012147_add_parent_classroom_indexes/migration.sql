-- CreateIndex
CREATE INDEX "Classroom_schoolId_idx" ON "Classroom"("schoolId");

-- CreateIndex
CREATE INDEX "Pupil_parentId_idx" ON "Pupil"("parentId");

-- CreateIndex
CREATE INDEX "Pupil_classroomId_idx" ON "Pupil"("classroomId");
