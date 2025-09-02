-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "flightDeadline" TIMESTAMP(3),
ADD COLUMN     "hotelDeadline" TIMESTAMP(3),
ADD COLUMN     "passportDeadline" TIMESTAMP(3),
ADD COLUMN     "visaDeadline" TIMESTAMP(3);
