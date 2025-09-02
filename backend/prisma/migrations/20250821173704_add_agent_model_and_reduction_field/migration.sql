/*
  Warnings:

  - Added the required column `agentId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "agentId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "agentId" INTEGER,
ADD COLUMN     "reduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "gender" SET DEFAULT 'Homme';

-- CreateTable
CREATE TABLE "Agent" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "email" TEXT,
    "motDePasse" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
