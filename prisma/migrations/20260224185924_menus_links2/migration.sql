-- AlterTable
ALTER TABLE "Pupil" ADD COLUMN     "menuId" TEXT;

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuMealGroup" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "maxSelectionsOverride" INTEGER,

    CONSTRAINT "MenuMealGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuMealChoice" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,

    CONSTRAINT "MenuMealChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Menu_slug_key" ON "Menu"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_schoolId_name_key" ON "Menu"("schoolId", "name");

-- CreateIndex
CREATE INDEX "MenuMealGroup_menuId_idx" ON "MenuMealGroup"("menuId");

-- CreateIndex
CREATE INDEX "MenuMealGroup_groupId_idx" ON "MenuMealGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuMealGroup_menuId_groupId_key" ON "MenuMealGroup"("menuId", "groupId");

-- CreateIndex
CREATE INDEX "MenuMealChoice_menuId_idx" ON "MenuMealChoice"("menuId");

-- CreateIndex
CREATE INDEX "MenuMealChoice_choiceId_idx" ON "MenuMealChoice"("choiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuMealChoice_menuId_choiceId_key" ON "MenuMealChoice"("menuId", "choiceId");

-- CreateIndex
CREATE INDEX "Pupil_menuId_idx" ON "Pupil"("menuId");

-- AddForeignKey
ALTER TABLE "Pupil" ADD CONSTRAINT "Pupil_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMealGroup" ADD CONSTRAINT "MenuMealGroup_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMealGroup" ADD CONSTRAINT "MenuMealGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MealGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMealChoice" ADD CONSTRAINT "MenuMealChoice_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMealChoice" ADD CONSTRAINT "MenuMealChoice_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "MealChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
