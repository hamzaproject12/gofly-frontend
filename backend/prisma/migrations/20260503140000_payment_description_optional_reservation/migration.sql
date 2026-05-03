-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "reservationId" DROP NOT NULL;

-- AddForeignKey (programId existed without FK in schéma initial)
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
