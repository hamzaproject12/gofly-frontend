-- Dates de voyage du programme : date de départ et date d'arrivée.
-- Migration purement additive : aucune donnée existante n'est modifiée ni supprimée.
-- Les programmes existants gardent NULL sur ces deux colonnes.

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "dateDepart" TIMESTAMP(3),
ADD COLUMN     "dateArrivee" TIMESTAMP(3);
