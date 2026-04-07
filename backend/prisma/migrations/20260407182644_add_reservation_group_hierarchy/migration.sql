-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('LIT', 'CHAMBRE_PRIVEE');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "familyMixed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "groupId" VARCHAR(64),
ADD COLUMN     "isLeader" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentId" INTEGER,
ADD COLUMN     "roomSlot" INTEGER,
ADD COLUMN     "typeReservation" "ReservationType" NOT NULL DEFAULT 'LIT';

-- CreateIndex
CREATE INDEX "Reservation_parentId_idx" ON "Reservation"("parentId");

-- CreateIndex
CREATE INDEX "Reservation_groupId_idx" ON "Reservation"("groupId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
