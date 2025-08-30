/*
  Warnings:

  - Added the required column `fileCategory` to the `Fichier` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Fichier" ADD COLUMN     "fileCategory" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "passportDeadline" TIMESTAMP(3);
