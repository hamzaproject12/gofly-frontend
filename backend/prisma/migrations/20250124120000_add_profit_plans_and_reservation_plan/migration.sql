-- Ajouter les nouveaux champs profit dans Program avec valeur par défaut 0
ALTER TABLE "Program" ADD COLUMN "profitEconomique" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Program" ADD COLUMN "profitNormal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Program" ADD COLUMN "profitVIP" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Copier les valeurs existantes de profit vers profitNormal pour préserver les données
UPDATE "Program" SET "profitNormal" = "profit" WHERE "profit" IS NOT NULL AND "profit" != 0;

-- Ajouter le champ plan dans Reservation avec valeur par défaut 'Normal'
ALTER TABLE "Reservation" ADD COLUMN "plan" VARCHAR(20) NOT NULL DEFAULT 'Normal';

