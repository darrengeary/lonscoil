-- AlterTable
ALTER TABLE "PrintJobItem" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "choiceId" TEXT;
