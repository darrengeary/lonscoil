-- AlterTable
ALTER TABLE "MealChoice" ADD COLUMN     "extraSticker" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "active" SET DEFAULT false;

-- AlterTable
ALTER TABLE "MealGroup" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MealOption" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "availEnd" TIMESTAMP(3),
ADD COLUMN     "availStart" TIMESTAMP(3),
ADD COLUMN     "caloriesKcal" INTEGER,
ADD COLUMN     "carbsG" DOUBLE PRECISION,
ADD COLUMN     "fatG" DOUBLE PRECISION,
ADD COLUMN     "fibreG" DOUBLE PRECISION,
ADD COLUMN     "proteinG" DOUBLE PRECISION,
ADD COLUMN     "saltG" DOUBLE PRECISION,
ADD COLUMN     "saturatesG" DOUBLE PRECISION,
ADD COLUMN     "sugarsG" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Menu" ALTER COLUMN "active" SET DEFAULT false;

-- CreateTable
CREATE TABLE "_AllergenToMealOption" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_AllergenToMealOption_AB_unique" ON "_AllergenToMealOption"("A", "B");

-- CreateIndex
CREATE INDEX "_AllergenToMealOption_B_index" ON "_AllergenToMealOption"("B");

-- AddForeignKey
ALTER TABLE "_AllergenToMealOption" ADD CONSTRAINT "_AllergenToMealOption_A_fkey" FOREIGN KEY ("A") REFERENCES "Allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllergenToMealOption" ADD CONSTRAINT "_AllergenToMealOption_B_fkey" FOREIGN KEY ("B") REFERENCES "MealOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
