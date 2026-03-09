/*
  Warnings:

  - You are about to drop the column `slug` on the `Menu` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Menu_slug_key";

-- AlterTable
ALTER TABLE "Menu" DROP COLUMN "slug";
