-- Heures de vol du programme : heure de départ et heure d'arrivée, au format "HH:mm".
-- Migration purement additive : aucune donnée existante n'est modifiée ni supprimée.
-- Les programmes existants gardent NULL sur ces deux colonnes.

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "heureDepart" VARCHAR(5),
ADD COLUMN     "heureArrivee" VARCHAR(5);
