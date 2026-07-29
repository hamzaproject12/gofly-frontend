-- Cycle de vie des programmes : ACTIF / CLOTURE / ARCHIVE.
-- Migration purement additive : aucune donnée existante n'est modifiée ni supprimée.
-- Les programmes existants prennent la valeur par défaut ACTIF.

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('ACTIF', 'CLOTURE', 'ARCHIVE');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "status" "ProgramStatus" NOT NULL DEFAULT 'ACTIF',
ADD COLUMN     "dateCloture" TIMESTAMP(3),
ADD COLUMN     "dateArchivage" TIMESTAMP(3);
