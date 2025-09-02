/*
  Warnings:

  - You are about to drop the column `programId` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `flightDeadline` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `hotelDeadline` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `passportDeadline` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `visaDeadline` on the `Reservation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Hotel" DROP CONSTRAINT "Hotel_programId_fkey";

-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "programId";

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "exchange" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "nbJoursMadina" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nbJoursMakkah" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prixAvionDH" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "prixVisaRiyal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "profit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "flightDeadline",
DROP COLUMN "hotelDeadline",
DROP COLUMN "passportDeadline",
DROP COLUMN "visaDeadline";

-- CreateTable
CREATE TABLE "ProgramHotelMadina" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "hotelId" INTEGER NOT NULL,

    CONSTRAINT "ProgramHotelMadina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramHotelMakkah" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "hotelId" INTEGER NOT NULL,

    CONSTRAINT "ProgramHotelMakkah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "hotelId" INTEGER NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "gender" TEXT NOT NULL,
    "nbrPlaceTotal" INTEGER NOT NULL,
    "nbrPlaceRestantes" INTEGER NOT NULL,
    "prixRoom" DOUBLE PRECISION NOT NULL,
    "listeIdsReservation" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramHotelMadina_programId_hotelId_key" ON "ProgramHotelMadina"("programId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramHotelMakkah_programId_hotelId_key" ON "ProgramHotelMakkah"("programId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_programId_hotelId_roomType_gender_key" ON "Room"("programId", "hotelId", "roomType", "gender");

-- AddForeignKey
ALTER TABLE "ProgramHotelMadina" ADD CONSTRAINT "ProgramHotelMadina_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramHotelMadina" ADD CONSTRAINT "ProgramHotelMadina_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramHotelMakkah" ADD CONSTRAINT "ProgramHotelMakkah_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramHotelMakkah" ADD CONSTRAINT "ProgramHotelMakkah_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
