/*
  Warnings:

  - Made the column `date` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `uploaded_at` on table `Fichier` required. This step will fail if there are existing NULL values in that column.
  - Made the column `paymentDate` on table `Payment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `Program` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `Reservation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `Reservation` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_programId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "Fichier" DROP CONSTRAINT "Fichier_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "Hotel" DROP CONSTRAINT "Hotel_programId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_fichierId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_programId_fkey";

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "date" SET NOT NULL,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Fichier" ALTER COLUMN "uploaded_at" SET NOT NULL,
ALTER COLUMN "uploaded_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paymentDate" SET NOT NULL,
ALTER COLUMN "paymentDate" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Program" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "visaDeadline" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "hotelDeadline" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "flightDeadline" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reservation" ALTER COLUMN "reservationDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fichier" ADD CONSTRAINT "Fichier_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fichierId_fkey" FOREIGN KEY ("fichierId") REFERENCES "Fichier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
