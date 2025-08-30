/*
  Warnings:

  - You are about to drop the column `fichierId` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `reservationId` on the `Expense` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_reservationId_fkey";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "fichierId",
DROP COLUMN "reservationId";
