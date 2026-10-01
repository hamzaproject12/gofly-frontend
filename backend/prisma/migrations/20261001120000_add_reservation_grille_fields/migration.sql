-- Trace de la grille tarifaire sur une réservation : quelle formule a été vendue,
-- à quel prix de brochure, et si le dossier a été volontairement sorti de la grille.
--
-- Migration PUREMENT ADDITIVE : quatre colonnes nullables (ou à valeur par défaut),
-- un index et une clé étrangère. Aucune colonne existante n'est modifiée, aucune
-- réservation existante n'est touchée — les dossiers déjà enregistrés gardent leur
-- prix, leur réduction et leur plan, et arrivent simplement avec formuleId NULL,
-- prixGrille NULL et horsGrille = false.
--
-- `formuleLabel` fige le libellé vendu : remplacer la grille d'un programme
-- supprime ses formules, ce qui remet `formuleId` à NULL (ON DELETE SET NULL).
-- Sans ce libellé figé, un dossier perdrait la trace de ce qui lui a été vendu.

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "formuleId" INTEGER,
ADD COLUMN     "formuleLabel" VARCHAR(200),
ADD COLUMN     "prixGrille" INTEGER,
ADD COLUMN     "horsGrille" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Reservation_formuleId_idx" ON "Reservation"("formuleId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_formuleId_fkey" FOREIGN KEY ("formuleId") REFERENCES "ProgramFormule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
