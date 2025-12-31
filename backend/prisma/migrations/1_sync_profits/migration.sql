-- Ajout des colonnes manquantes à l'historique Program
ALTER TABLE "Program" ADD COLUMN "profitEconomique" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Program" ADD COLUMN "profitNormal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Program" ADD COLUMN "profitVIP" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Ajout de la colonne manquante à l'historique Reservation
ALTER TABLE "Reservation" ADD COLUMN "plan" VARCHAR(20) NOT NULL DEFAULT 'Normal';