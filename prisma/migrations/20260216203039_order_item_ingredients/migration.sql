-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "selectedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[];
