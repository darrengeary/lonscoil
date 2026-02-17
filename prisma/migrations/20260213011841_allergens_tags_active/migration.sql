-- AlterTable
ALTER TABLE "MealChoice" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "availEnd" TIMESTAMP(3),
ADD COLUMN     "availStart" TIMESTAMP(3),
ADD COLUMN     "caloriesKcal" INTEGER,
ADD COLUMN     "carbsG" DOUBLE PRECISION,
ADD COLUMN     "fatG" DOUBLE PRECISION,
ADD COLUMN     "fibreG" DOUBLE PRECISION,
ADD COLUMN     "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "proteinG" DOUBLE PRECISION,
ADD COLUMN     "saltG" DOUBLE PRECISION,
ADD COLUMN     "saturatesG" DOUBLE PRECISION,
ADD COLUMN     "sugarsG" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Allergen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AllergenToMealChoice" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Allergen_name_key" ON "Allergen"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_AllergenToMealChoice_AB_unique" ON "_AllergenToMealChoice"("A", "B");

-- CreateIndex
CREATE INDEX "_AllergenToMealChoice_B_index" ON "_AllergenToMealChoice"("B");

-- AddForeignKey
ALTER TABLE "_AllergenToMealChoice" ADD CONSTRAINT "_AllergenToMealChoice_A_fkey" FOREIGN KEY ("A") REFERENCES "Allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllergenToMealChoice" ADD CONSTRAINT "_AllergenToMealChoice_B_fkey" FOREIGN KEY ("B") REFERENCES "MealChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
