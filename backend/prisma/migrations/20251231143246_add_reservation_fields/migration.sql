-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "groupe" VARCHAR(100),
ADD COLUMN     "passportNumber" VARCHAR(50),
ADD COLUMN     "remarque" TEXT,
ADD COLUMN     "transport" VARCHAR(100);
