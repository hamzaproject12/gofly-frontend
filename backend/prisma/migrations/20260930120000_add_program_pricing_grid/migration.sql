-- Grille tarifaire des programmes (prix de la brochure publiée).
--
-- Migration PUREMENT ADDITIVE : un nouveau type enum, une colonne avec valeur par
-- défaut et trois tables. Aucune colonne existante n'est modifiée ou supprimée, et
-- aucun prix déjà enregistré n'est touché : tous les programmes existants restent
-- en pricingMode = 'CALCUL' et gardent le calcul vol + visa + hôtels + profit.

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('CALCUL', 'GRILLE');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'CALCUL';

-- CreateTable
CREATE TABLE "ProgramFormule" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "note" VARCHAR(300),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramFormule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramFormuleHotel" (
    "id" SERIAL NOT NULL,
    "formuleId" INTEGER NOT NULL,
    "hotelId" INTEGER NOT NULL,

    CONSTRAINT "ProgramFormuleHotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramFormulePrix" (
    "id" SERIAL NOT NULL,
    "formuleId" INTEGER NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "prixVente" INTEGER NOT NULL,

    CONSTRAINT "ProgramFormulePrix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramFormule_programId_ordre_idx" ON "ProgramFormule"("programId", "ordre");

-- CreateIndex
CREATE INDEX "ProgramFormuleHotel_hotelId_idx" ON "ProgramFormuleHotel"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramFormuleHotel_formuleId_hotelId_key" ON "ProgramFormuleHotel"("formuleId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramFormulePrix_formuleId_roomType_key" ON "ProgramFormulePrix"("formuleId", "roomType");

-- AddForeignKey
ALTER TABLE "ProgramFormule" ADD CONSTRAINT "ProgramFormule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFormuleHotel" ADD CONSTRAINT "ProgramFormuleHotel_formuleId_fkey" FOREIGN KEY ("formuleId") REFERENCES "ProgramFormule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFormuleHotel" ADD CONSTRAINT "ProgramFormuleHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFormulePrix" ADD CONSTRAINT "ProgramFormulePrix_formuleId_fkey" FOREIGN KEY ("formuleId") REFERENCES "ProgramFormule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
